/*
 * TILIEN ELINKAARILOKIN TÄSMÄYTYS.
 *
 * `account_lifecycle` on pysyvä päiväkirja tunnuksista (D-069). Ilman
 * sitä ei vuoden päästä voisi sanoa montako tunnusta on kaikkiaan
 * luotu, koska kova poisto vie mukanaan sähköpostin ja luontipäivän.
 *
 * Ylläpito on TÄSMÄYTYS eikä triggeri: tilejä syntyy useaa reittiä, ja
 * unohdettu reitti jäisi hiljaa kirjaamatta. Triggeriä `auth.users`iin
 * ei tehdä, koska rikkinäinen triggeri Supabasen omassa skeemassa
 * estäisi kirjautumisen.
 *
 * MIKSI TÄMÄ ON OMA MODUULINSA. Sama täsmäytys ajetaan kahdesta
 * paikasta: käsin skriptillä ja ajastettuna reittinä. Kaksi
 * toteutusta erkaantuisi ajan myötä, ja poikkeama näkyisi vasta
 * silloin kun historiaa tarvitaan — eli liian myöhään.
 *
 * TÄSMÄYTYS OLI AJASTAMATTA 24.8.2026 asti. Se oli ajettu viimeksi
 * 17.8., ja 24 tunnusta oli lokin ulkopuolella — mukana maksavia
 * asiakkaita. Jos joku niistä olisi poistettu, historia olisi mennyt.
 */

export type LifecycleRow = {
  user_id: string
  email?: string | null
  full_name?: string | null
  event: string
  occurred_at: string
  metadata: Record<string, unknown>
}

export type LifecyclePlan = {
  created: LifecycleRow[]
  /* Tili on kadonnut auth.usersista ilman että poistoa kirjattiin. */
  deleted: LifecycleRow[]
  authCount: number
  knownUsers: number
}

export function planLifecycleSync(input: {
  authUsers: { id: string; email?: string | null; created_at?: string | null }[]
  profiles: { id: string; email?: string | null; full_name?: string | null }[]
  existing: { user_id: string; event: string }[]
  now: string
}): LifecyclePlan {
  const profileById = new Map(input.profiles.map((p) => [p.id, p]))
  const has = new Set(input.existing.map((r) => `${r.user_id}:${r.event}`))
  const knownUsers = new Set(input.existing.map((r) => r.user_id))
  const liveIds = new Set(input.authUsers.map((u) => u.id))

  const created: LifecycleRow[] = input.authUsers
    .filter((u) => !has.has(`${u.id}:created`))
    /*
     * Ilman luontipäivää rivi olisi arvoton: koko lokin tarkoitus on
     * tietää milloin tili syntyi. Mieluummin tyhjä kuin väärä.
     */
    .filter((u) => !!u.created_at)
    .map((u) => {
      const p = profileById.get(u.id)
      return {
        user_id: u.id,
        email: u.email ?? p?.email ?? null,
        full_name: p?.full_name ?? null,
        event: "created",
        occurred_at: u.created_at as string,
        metadata: { source: "sync-account-lifecycle" },
      }
    })

  const deleted: LifecycleRow[] = [...knownUsers]
    .filter((id) => !liveIds.has(id) && !has.has(`${id}:deleted`))
    .map((id) => ({
      user_id: id,
      event: "deleted",
      occurred_at: input.now,
      metadata: {
        source: "sync-account-lifecycle",
        /* Poistohetkea ei ole kirjattu mihinkaan - tama on havaintohetki. */
        occurred_at_is_detection_time: true,
      },
    }))

  return { created, deleted, authCount: input.authUsers.length, knownUsers: knownUsers.size }
}

/* I/O-kuori: lukee kannan, laskee suunnitelman ja kirjoittaa jos apply. */
export async function runLifecycleSync(
  supabase: any,
  opts: { apply: boolean; now?: string } = { apply: false }
): Promise<LifecyclePlan & { applied: boolean; errors: string[] }> {
  const errors: string[] = []

  const authUsers: any[] = []
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    authUsers.push(...data.users)
    if (data.users.length < 200) break
  }

  const { data: profiles, error: pErr } = await supabase
    .from("profiles")
    .select("id,email,full_name")
  if (pErr) throw pErr

  const existing: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("account_lifecycle")
      .select("user_id,event")
      .range(from, from + 999)
    if (error) throw error
    existing.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  const plan = planLifecycleSync({
    authUsers,
    profiles: profiles ?? [],
    existing,
    now: opts.now ?? new Date().toISOString(),
  })

  if (!opts.apply) return { ...plan, applied: false, errors }

  for (let i = 0; i < plan.created.length; i += 500) {
    const { error } = await supabase
      .from("account_lifecycle")
      .upsert(plan.created.slice(i, i + 500), { onConflict: "user_id,event" })
    if (error) errors.push(`created: ${error.message}`)
  }

  if (plan.deleted.length) {
    const { error } = await supabase
      .from("account_lifecycle")
      .upsert(plan.deleted, { onConflict: "user_id,event" })
    if (error) errors.push(`deleted: ${error.message}`)
  }

  return { ...plan, applied: true, errors }
}
