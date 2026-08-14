/*
 * Käyttäjätilanteen tilannekuva.
 *
 * MIKSI TAMA ON SKRIPTI EIKA KERTALUONTOINEN KYSELY. Myynti- ja
 * aktivointitoimenpiteiden vaikutus näkyy vain vertaamalla samoja
 * lukuja samalla tavalla laskettuna eri ajankohtina. Tulokset
 * kirjataan docs/10_USERS.md:hen, jotta sarja säilyy.
 *
 * KAKSI ERI ASIAA, JOITA EI SAA SEKOITTAA:
 *   - tili luotu   = myynnin tulos (joku kirjautui sisään ensimmäisen kerran)
 *   - aktiivisuus  = tuotteen tulos (joku palasi takaisin)
 * Rekisteröityneiden määrä yksin ei kerro kummastakaan mitään.
 *
 *   npx tsx scripts/snapshot-users.ts
 */
import { readFileSync } from "node:fs"

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

const DAY = 86_400_000
const month = (iso: string) => String(iso).slice(0, 7)
const daysAgo = (iso: string | null | undefined) =>
  iso ? Math.floor((Date.now() - new Date(iso).getTime()) / DAY) : null

/* Omat testitilit eivat kuulu lukuihin. */
const INTERNAL = /@tyomaat\.fi$|jokendroneilut|^test|\+test@/i

/*
 * YKSI TILI VOI HUKUTTAA KAIKEN MUUN. Mitattu 14.8.2026: yksi tili
 * tuotti 21 355 tapahtumaa 24 062:sta eli 89 %. Keskiarvot ja
 * tapahtumajakaumat ovat merkityksettömiä ilman tätä erottelua, joten
 * hallitseva tili raportoidaan erikseen eikä piiloteta.
 */
const DOMINANT_SHARE = 0.25

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const page = async (table: string, columns = "*") => {
    const rows: any[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from(table).select(columns).range(from, from + 999)
      if (error) throw error
      rows.push(...(data ?? []))
      if (!data || data.length < 1000) break
    }
    return rows
  }

  const profiles = await page("profiles")
  const events = await page("analytics_events", "user_id,event_type,created_at")
  const favorites = await page("user_project_favorites", "user_id")
  const statuses = await page("user_project_status", "user_id")
  const prefs = await page("user_today_preferences", "user_id")
  const searches = await page("saved_searches", "user_id")

  const internal = profiles.filter((p) => INTERNAL.test(String(p.email ?? "")))
  const users = profiles.filter((p) => !INTERNAL.test(String(p.email ?? "")))
  const internalIds = new Set(internal.map((p) => p.id))

  /*
   * MITTARIN ALKU ON KERROTTAVA. analytics_events alkoi kerätä dataa
   * kesken kaiken, joten sitä ennen rekisteröityneiden käytöstä ei ole
   * tietoa. Ilman tätä riviä "ei koskaan käyttänyt" luetaan väitteeksi
   * käyttäjistä, vaikka se on väite mittarista.
   */
  const eventDates = events.map((e) => e.created_at).filter(Boolean).sort()
  const trackingStart = eventDates[0]

  console.log(`TILANNEKUVA ${new Date().toISOString().slice(0, 10)}`)
  console.log("=".repeat(60))
  console.log(
    `\nHUOM: analytiikka alkoi ${String(trackingStart).slice(0, 10)}. Sitä ennen`
  )
  console.log(`      rekisteröityneiden käytöstä ei ole tietoa lainkaan.`)
  console.log(`\nTILIT`)
  console.log(`  yhteensä            ${profiles.length}`)
  console.log(`  omia/testitilejä    ${internal.length}`)
  console.log(`  asiakastilejä       ${users.length}`)

  /* Rekisteroityneet kuukausittain. */
  const byMonth = new Map<string, number>()
  for (const p of users) byMonth.set(month(p.created_at), (byMonth.get(month(p.created_at)) ?? 0) + 1)
  console.log(`\n  uudet tilit kuukausittain`)
  for (const [k, v] of [...byMonth].sort()) console.log(`    ${k}   ${String(v).padStart(3)}`)

  /* Aktiivisuus tapahtumista. */
  const firstSeen = new Map<string, string>()
  const lastSeen = new Map<string, string>()
  const eventCount = new Map<string, number>()
  for (const e of events) {
    if (!e.user_id || internalIds.has(e.user_id)) continue
    eventCount.set(e.user_id, (eventCount.get(e.user_id) ?? 0) + 1)
    const f = firstSeen.get(e.user_id)
    if (!f || e.created_at < f) firstSeen.set(e.user_id, e.created_at)
    const l = lastSeen.get(e.user_id)
    if (!l || e.created_at > l) lastSeen.set(e.user_id, e.created_at)
  }

  /* Hallitseva tili esiin ennen kuin mitaan keskiarvoja lasketaan. */
  const totalEvents = [...eventCount.values()].reduce((s, n) => s + n, 0)
  const ranked = [...eventCount].sort((a, b) => b[1] - a[1])
  const emailById = new Map(profiles.map((p) => [p.id, String(p.email ?? "")]))
  const dominant = ranked.filter(([, n]) => totalEvents > 0 && n / totalEvents > DOMINANT_SHARE)

  if (dominant.length > 0) {
    console.log(`\nHALLITSEVA TILI`)
    for (const [id, n] of dominant) {
      const email = emailById.get(id) ?? "(ei profiilia)"
      console.log(
        `  ${email.replace(/^(.{2}).*(@.*)$/, "$1***$2")}  ${n} tapahtumaa` +
          ` = ${Math.round((n / totalEvents) * 100)} % kaikista`
      )
    }
    console.log(`  -> tapahtumamäärät alla ilman tätä tiliä`)
  }
  const dominantIds = new Set(dominant.map(([id]) => id))

  const withAny = users.filter((u) => eventCount.has(u.id))
  const active = (d: number) =>
    users.filter((u) => {
      const age = daysAgo(lastSeen.get(u.id))
      return age !== null && age <= d
    })

  console.log(`\nAKTIVOITUMINEN (mitattu ${String(trackingStart).slice(0, 10)} alkaen)`)
  console.log(`  nähty mittausjaksolla     ${withAny.length} / ${users.length}`)
  console.log(`  ei jälkeäkään jaksolla    ${users.length - withAny.length}`)
  console.log(`  aktiivinen 7 vrk sisällä  ${active(7).length}`)
  console.log(`  aktiivinen 30 vrk sisällä ${active(30).length}`)
  console.log(`  aktiivinen 90 vrk sisällä ${active(90).length}`)

  /* Kayttokerrat per kayttaja, hallitseva tili pois. */
  const counts = withAny
    .filter((u) => !dominantIds.has(u.id))
    .map((u) => eventCount.get(u.id) ?? 0)
    .sort((a, b) => a - b)
  if (counts.length) {
    const q = (p: number) => counts[Math.floor(counts.length * p)]
    console.log(`\n  tapahtumia per käyttänyt: mediaani ${q(0.5)}, p90 ${q(0.9)}, max ${counts[counts.length - 1]}`)
    console.log(`  vain 1-2 tapahtumaa (kokeili ja jätti): ${counts.filter((c) => c <= 2).length}`)
  }

  /* Kohortti: rekisteroitymiskuukausi vs viela aktiivinen. */
  console.log(`\nKOHORTIT (rekisteröitymiskuukausi -> aktiivinen 30 vrk sisällä)`)
  for (const [k] of [...byMonth].sort()) {
    const cohort = users.filter((u) => month(u.created_at) === k)
    const still = cohort.filter((u) => {
      const age = daysAgo(lastSeen.get(u.id))
      return age !== null && age <= 30
    })
    const everUsed = cohort.filter((u) => eventCount.has(u.id))
    console.log(
      `    ${k}   tilejä ${String(cohort.length).padStart(3)}` +
        `   käytti ${String(everUsed.length).padStart(3)}` +
        `   yhä aktiivisia ${String(still.length).padStart(3)}`
    )
  }

  /* Syvempi sitoutuminen. */
  const distinct = (rows: any[]) =>
    new Set(rows.map((r) => r.user_id).filter((id) => id && !internalIds.has(id))).size

  console.log(`\nSITOUTUMINEN (montako asiakastiliä on tehnyt tämän)`)
  console.log(`  suosikkeja tallentanut     ${distinct(favorites)}`)
  console.log(`  hankkeen tilaa muuttanut   ${distinct(statuses)}`)
  console.log(`  Tänään-asetukset säätänyt  ${distinct(prefs)}`)
  console.log(`  tallennettu haku           ${distinct(searches)}`)

  /* Tapahtumatyypit viimeiseltä 30 vrk:lta. */
  const recent = events.filter(
    (e) =>
      e.user_id &&
      !internalIds.has(e.user_id) &&
      !dominantIds.has(e.user_id) &&
      (daysAgo(e.created_at) ?? 999) <= 30
  )
  const types = new Map<string, number>()
  for (const e of recent) types.set(e.event_type, (types.get(e.event_type) ?? 0) + 1)
  console.log(`\nTAPAHTUMAT 30 VRK (asiakastilit ilman hallitsevaa, yhteensä ${recent.length})`)
  for (const [k, v] of [...types].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    console.log(`    ${String(v).padStart(5)}  ${k}`)
  }

  /* Aktiivisuus viikoittain - nakyyko myyntitoimenpide. */
  console.log(
    `\nAKTIIVISET KÄYTTÄJÄT VIIKOITTAIN (12 vk; nolla ennen ` +
      `${String(trackingStart).slice(0, 10)} = mittarin alku, ei käytös)`
  )
  for (let w = 11; w >= 0; w--) {
    const end = Date.now() - w * 7 * DAY
    const start = end - 7 * DAY
    const ids = new Set(
      events
        .filter((e) => {
          if (!e.user_id || internalIds.has(e.user_id)) return false
          const t = new Date(e.created_at).getTime()
          return t >= start && t < end
        })
        .map((e) => e.user_id)
    )
    const label = new Date(start).toISOString().slice(0, 10)
    console.log(`    ${label}   ${String(ids.size).padStart(3)} ${"#".repeat(ids.size)}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
