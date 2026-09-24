import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * PALJONKO JULKAISIJASYOTE TOISI HAKUSANOJEN PAALLE?
 *
 * `stt_haku` arvaa 44 hakusanalla mita tiedotteessa lukee. STT:n oma
 * julkaisijasyote (publisherId) palauttaa yhden yrityksen KAIKKI
 * tiedotteet ilman arvausta, yhdella pyynnolla.
 *
 * Mittatikku: kuinka moni rakennusalan julkaisijan tiedote 12 kk ajalta
 * PUUTTUU kannasta kokonaan - siis mistaan lahteesta.
 *
 *   npx tsx scripts/measure-stt-julkaisijasyote.ts
 */

/* publisherId luettu olemassa olevien STT-dokumenttien osoitteista. */
const JULKAISIJAT: [string, string][] = [
  ["Kreate Group Oyj", "69818424"],
  ["GRK Infra Oyj", "69819211"],
  ["Jatke Oy", "69820730"],
  ["Hartela", "1812"],
  ["Skanska Oy", "69819623"],
  ["Fira", "69819368"],
  ["Consti Oyj", "69818904"],
  ["Rakennusliike Lapti Oy", "55623418"],
  ["Rakennusliike Soimu Oy", "69818770"],
  ["Rakennustoimisto K.Tervo Oy", "69818946"],
  ["Tekova Oyj", "69820639"],
  ["Mangrove Oy", "69819151"],
  ["Nimlas", "69817476"],
  ["Senaatti-kiinteistot", "69820807"],
  ["Puolustuskiinteistot", "69820941"],
  ["Helsingin kaupungin asunnot (Heka)", "69818936"],
  ["Asuntosaatio", "10333333"],
]

const KUUKAUDET = 12

async function haeJulkaisija(id: string) {
  const out: any[] = []
  for (let page = 0; page < 4; page++) {
    const res = await fetch(
      `https://www.sttinfo.fi/public-website-api/releases?publisherId=${id}&language=fi&size=50&page=${page}`,
      { headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" } }
    )
    if (!res.ok) break
    const data: any = await res.json()
    const rel = data?.releases ?? []
    if (!rel.length) break
    out.push(...rel)
    if (rel.length < 50) break
  }
  return out
}

const otsikko = (r: any) => String(r?.versions?.fi?.title ?? "")

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const raja = new Date(Date.now() - KUUKAUDET * 30 * 86400000).toISOString().slice(0, 10)

  /* Kaikki tallennetut STT-osoitteet kerralla: .in() osuisi rivikattoon. */
  const osoitteet = new Set<string>()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("source_documents")
      .select("document_url")
      .ilike("document_url", "%sttinfo.fi%")
      .range(from, from + 999)
    if (error) throw error
    for (const d of data ?? []) {
      const m = String(d.document_url).match(/tiedote\/(\d+)/)
      if (m) osoitteet.add(m[1])
    }
    if (!data || data.length < 1000) break
  }
  console.log(`kannassa STT-tiedotteita: ${osoitteet.size}\n`)

  /*
   * Sama suodatin kuin tuotannossa: tiedote joka ei lapaise
   * rakentamissignaalia ei olisi kandidaatti tallakaan lahteella.
   */
  const { sttKandidaatti } = await import("../lib/agent/fetchSttHakuSource")

  console.log("tiedotteita  kannassa  puuttuu  niista hanke  julkaisija")
  const uudet: { nimi: string; r: any; k: any }[] = []
  for (const [nimi, id] of JULKAISIJAT) {
    const kaikki = (await haeJulkaisija(id)).filter((r) => String(r.date).slice(0, 10) >= raja)
    const ohi = kaikki.filter((r) => !osoitteet.has(String(r.id)))
    const hankkeet = ohi
      .map((r) => ({ r, k: sttKandidaatti(r, { cutoffDate: null, sourceName: "stt_julkaisijat" }) }))
      .filter((x) => x.k)
    for (const x of hankkeet) uudet.push({ nimi, r: x.r, k: x.k })
    console.log(
      String(kaikki.length).padStart(11),
      String(kaikki.length - ohi.length).padStart(9),
      String(ohi.length).padStart(8),
      String(hankkeet.length).padStart(13),
      " " + nimi
    )
  }

  console.log(`
=== uusia hanke-ehdokkaita ${uudet.length} kpl ===`)
  for (const { nimi, r, k } of uudet.sort((x, y) => String(y.r.date).localeCompare(String(x.r.date)))) {
    console.log(
      `${String(r.date).slice(0, 10)}  ${nimi.slice(0, 20).padEnd(20)}  ${String(k.city ?? "-").padEnd(12)}  ${otsikko(r).slice(0, 60)}`
    )
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
