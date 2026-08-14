/*
 * Pitää account_lifecycle-lokin ajan tasalla.
 *
 * MIKSI TAYDENNYS EIKA TRIGGERI. Tilejä syntyy useaa reittiä: kutsu
 * sovelluksesta, Supabasen hallintapaneeli, mahdollinen tuleva
 * itserekisteröinti. Jokaisen polun kiinniottaminen erikseen tarkoittaa
 * että unohdettu polku jää hiljaa kirjaamatta. Täsmäytys auth.usersia
 * vasten kattaa ne kaikki, myös menneet, ja sen voi ajaa uudelleen.
 *
 * Triggeriä auth.users-tauluun ei tehdä: se on Supabasen oma skeema, ja
 * rikkinäinen triggeri siellä estäisi kirjautumisen.
 *
 * KAKSI SUUNTAA:
 *   1. auth.usersissa mutta ei lokissa  -> kirjataan "created"
 *   2. lokissa mutta ei enää auth.usersissa -> kirjataan "deleted"
 *
 * Kohdan 2 aikaleima on HAVAINTOHETKI, ei poistohetki - sitä ei ole
 * kirjattu mihinkään. Se merkitään metadataan, jottei arviota luulla
 * mittaukseksi (sama virhe kuin vahtikoiran aikaleimoissa, D-067).
 *
 *   npx tsx scripts/sync-account-lifecycle.ts
 *   npx tsx scripts/sync-account-lifecycle.ts --apply
 */
import { readFileSync } from "node:fs"

const APPLY = process.argv.includes("--apply")

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8")
  .replace(/\r/g, "")
  .split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1)
  }
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const probe = await supabase.from("account_lifecycle").select("id").limit(1)
  if (probe.error) {
    console.log("Taulua account_lifecycle ei ole viela.")
    console.log("Aja ensin docs/sql/2026-08-15_account_lifecycle.sql Supabasen SQL-editorissa.")
    console.log(`(${probe.error.message})`)
    process.exit(1)
  }

  /* Kaikki auth-tilit sivutettuna. */
  const authUsers: any[] = []
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    authUsers.push(...data.users)
    if (data.users.length < 200) break
  }

  const { data: profiles } = await supabase.from("profiles").select("id,email,full_name")
  const profileById = new Map((profiles ?? []).map((p: any) => [p.id, p]))

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

  const has = new Set(existing.map((r) => `${r.user_id}:${r.event}`))
  const knownUsers = new Set(existing.map((r) => r.user_id))
  const liveIds = new Set(authUsers.map((u) => u.id))

  console.log(`${APPLY ? "KIRJOITETAAN" : "KUIVAHARJOITTELU (--apply kirjoittaa)"}`)
  console.log(`auth-tileja ${authUsers.length}, lokissa ${knownUsers.size} tilia\n`)

  /* 1. Puuttuvat "created". */
  const missingCreated = authUsers
    .filter((u) => !has.has(`${u.id}:created`))
    .map((u) => {
      const p: any = profileById.get(u.id)
      return {
        user_id: u.id,
        email: u.email ?? p?.email ?? null,
        full_name: p?.full_name ?? null,
        event: "created",
        occurred_at: u.created_at,
        metadata: { source: "sync-account-lifecycle" },
      }
    })

  console.log(`kirjataan "created": ${missingCreated.length}`)

  /* 2. Kadonneet tilit. */
  const vanished = [...knownUsers].filter((id) => !liveIds.has(id) && !has.has(`${id}:deleted`))
  console.log(`kirjataan "deleted" (havaittu kadonneeksi): ${vanished.length}`)
  for (const id of vanished) console.log(`  ${id}`)

  if (!APPLY) return

  for (let i = 0; i < missingCreated.length; i += 500) {
    const { error } = await supabase
      .from("account_lifecycle")
      .upsert(missingCreated.slice(i, i + 500), { onConflict: "user_id,event" })
    if (error) console.log(`  VIRHE created: ${error.message}`)
  }

  if (vanished.length > 0) {
    const { error } = await supabase.from("account_lifecycle").upsert(
      vanished.map((id) => ({
        user_id: id,
        event: "deleted",
        occurred_at: new Date().toISOString(),
        metadata: {
          source: "sync-account-lifecycle",
          /* Poistohetkea ei ole kirjattu mihinkaan - tama on havaintohetki. */
          occurred_at_is_detection_time: true,
        },
      })),
      { onConflict: "user_id,event" }
    )
    if (error) console.log(`  VIRHE deleted: ${error.message}`)
  }

  console.log("\nvalmis")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
