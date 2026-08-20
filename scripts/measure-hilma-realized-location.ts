import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * MITTAUS: onko Hilman ilmoituksessa rakenteinen suorituspaikka?
 *
 * Nykyinen osoite poimitaan vapaasta kuvaustekstista. eForms-ilmoituksessa
 * on oma kentta BT-5101 (realizedLocation), jota emme lue. Tama skripti
 * mittaa kuinka usein se on oikeasti taytetty - ei kirjoita mitaan.
 *
 * Kayttamamme AVP-hakurajapinta ei palauta tata kenttaa, joten haku tehdaan
 * ilmoitussivun omasta rajapinnasta web/api/public/procedure/N/enotice/M.
 */

const SAMPLE = Number(process.argv.find((a) => a.startsWith("--n="))?.slice(4) ?? 60)
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"

const noticeIdFrom = (url: string): string | null =>
  url.match(/enotice\/(\d+)/)?.[1] ?? url.match(/procurement\/(\d+)/)?.[1] ?? null

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const rows: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("potential_projects")
      .select("id, title, address, status, created_at, metadata")
      .not("metadata->>procedure_id", "is", null)
      .order("created_at", { ascending: false })
      .range(from, from + 999)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  const withAddress = rows.filter((r) => r.address)
  const without = rows.filter((r) => !r.address)
  console.log(`Hilma-ehdokkaita: ${rows.length}  osoite on: ${withAddress.length}  puuttuu: ${without.length}`)

  /* Otos painotetaan niihin joilta osoite puuttuu - siina on hyoty. */
  const sample = without.slice(0, SAMPLE)
  console.log(`otos: ${sample.length} ilmoitusta joilta osoite puuttuu\n`)

  let ok = 0, anywhere = 0, street = 0, cityOnly = 0, failed = 0
  const samples: string[] = []

  for (const r of sample) {
    const procedureId = String(r.metadata?.procedure_id ?? "")
    const noticeId = noticeIdFrom(String(r.metadata?.source_url ?? ""))
    if (!procedureId || !noticeId) { failed++; continue }

    const url = `https://www.hankintailmoitukset.fi/web/api/public/procedure/${procedureId}/enotice/${noticeId}`
    let json: any
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } })
      if (!res.ok) { failed++; continue }
      json = await res.json()
    } catch { failed++; continue }
    ok++

    const lots = json?.eForm?.procurementProjectLot ?? []
    const locs: any[] = []
    for (const lot of lots) for (const l of lot?.procurementProject?.realizedLocation ?? []) locs.push(l)
    for (const l of json?.eForm?.procurementProject?.realizedLocation ?? []) locs.push(l)

    const streets = locs.map((l) => l?.address?.streetName?.value).filter(Boolean)
    const cities = locs.map((l) => l?.address?.cityName?.value).filter(Boolean)
    const regions = locs.map((l) => l?.address?.region?.value).filter(Boolean)

    if (streets.length) {
      street++
      if (samples.length < 12) samples.push(`  OSOITE  ${String(r.title).slice(0, 40).padEnd(42)} ${streets[0]}, ${cities[0] ?? "-"}`)
    } else if (cities.length) {
      cityOnly++
      if (samples.length < 12) samples.push(`  kaupunki ${String(r.title).slice(0, 40).padEnd(41)} ${cities[0]}`)
    } else if (regions.some((x) => String(x).startsWith("anyw"))) {
      anywhere++
    }
  }

  console.log(`haettu onnistuneesti:      ${ok}`)
  console.log(`  katuosoite kentassa:     ${street}`)
  console.log(`  vain kaupunki:           ${cityOnly}`)
  console.log(`  "anywhere" / tyhja:      ${anywhere}`)
  console.log(`haku epaonnistui:          ${failed}`)
  if (samples.length) { console.log("\nesimerkkeja:"); for (const s of samples) console.log(s) }
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
