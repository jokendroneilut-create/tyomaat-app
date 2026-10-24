import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * AUTTAISIKO PK-SEUDUN KAUPUNGINOSALISTA? (D-344)
 *
 * Johannes 24.10.2026: *"olisiko muuten jarkevaa olla oma lista ainakin
 * pk-seudun kaupunginosista. auttaisiko se sijoittamisessa kartalle ja
 * muutenkin kaupunkien tunnistamisessa?"*
 *
 * KAUPUNGIN TUNNISTAMISEEN vastaus on jo mitattu: kuratoitu
 * paikannimikartta vapaassa tekstissa antoi 7 uutta virhetta vastaan 2
 * hyotya ([[curated-map-field-not-prose]]). Sita ei mitata uudelleen.
 *
 * KARTALLE SIJOITTAMINEN on eri kysymys: siina kunta on jo tiedossa ja
 * kyse on tarkemmasta pisteesta. Tama mittaa kaksi lukua:
 *
 *   1. montako PK-seudun hanketta on kunnan varapisteessa tai ilman
 *      koordinaattia
 *   2. monellako niista kaupunginosan nimi on otsikossa tai sijainnissa
 *
 * Lista on HSY:n avoin aineisto (185 kaupunginosaa, FI+SV).
 *
 *   npx tsx scripts/mittaa-kaupunginosat.ts
 *   npx tsx scripts/mittaa-kaupunginosat.ts --rivit
 */

const WFS =
  "https://kartta.hsy.fi/geoserver/wfs?service=WFS&version=2.0.0&request=GetFeature" +
  "&typeName=taustakartat_ja_aluejaot:kaupunginosat_2022&outputFormat=application/json&srsName=EPSG:4326"

const KUNTAKOODI: Record<string, string> = {
  "091": "Helsinki",
  "049": "Espoo",
  "092": "Vantaa",
  "235": "Kauniainen",
}

type Osa = { nimi: string; kunta: string; lat: number; lon: number }

/* Polygonin keskipiste riittaa: tarkkuus paranee kunnan keskustasta. */
function keskipiste(geometry: any): { lat: number; lon: number } | null {
  const renkaat: number[][][] =
    geometry?.type === "Polygon"
      ? geometry.coordinates
      : geometry?.type === "MultiPolygon"
        ? geometry.coordinates.flat()
        : []
  const pisteet = renkaat.flat()
  if (!pisteet.length) return null
  let lon = 0
  let lat = 0
  for (const p of pisteet) {
    lon += p[0]
    lat += p[1]
  }
  return { lat: lat / pisteet.length, lon: lon / pisteet.length }
}

async function main() {
  const naytaRivit = process.argv.includes("--rivit")

  const res = await fetch(WFS, { cache: "no-store" })
  const json: any = await res.json()
  const osat: Osa[] = []
  for (const f of json.features ?? []) {
    const kunta = KUNTAKOODI[String(f.properties?.kunta ?? "")]
    const piste = keskipiste(f.geometry)
    if (!kunta || !piste) continue
    for (const nimi of [f.properties?.nimi, f.properties?.nimi_se]) {
      const n = String(nimi ?? "").trim()
      if (n.length >= 4) osat.push({ nimi: n, kunta, lat: piste.lat, lon: piste.lon })
    }
  }
  console.log(`Kaupunginosia: ${osat.length} nimeä (FI+SV), kunnat ${[...new Set(osat.map((o) => o.kunta))].join(", ")}\n`)

  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const hankkeet: any[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error } = await db
      .from("projects")
      .select("id,name,city,location,latitude,longitude,metadata")
      .in("city", ["Helsinki", "Espoo", "Vantaa", "Kauniainen"])
      .range(a, a + 999)
    if (error) {
      console.error(`VIRHE: ${error.message}`)
      process.exit(1)
    }
    hankkeet.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }
  console.log(`PK-seudun hankkeita: ${hankkeet.length}`)

  /* Varapiste = sama koordinaatti toistuu kymmenilla riveilla. */
  const pisteet = new Map<string, number>()
  for (const p of hankkeet) {
    if (p.latitude == null || p.longitude == null) continue
    const avain = `${Number(p.latitude).toFixed(4)},${Number(p.longitude).toFixed(4)}`
    pisteet.set(avain, (pisteet.get(avain) ?? 0) + 1)
  }
  const varapisteet = new Set(
    [...pisteet.entries()].filter(([, n]) => n >= 20).map(([k]) => k)
  )
  console.log(`\nVarapisteitä (sama koordinaatti >= 20 rivillä):`)
  for (const [k, n] of [...pisteet.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)) {
    console.log(`   ${String(n).padStart(4)}  ${k}${varapisteet.has(k) ? "  <- varapiste" : ""}`)
  }

  const luvut = { epatarkka: 0, osuma: 0, eiOsumaa: 0 }
  const naytteet: string[] = []

  for (const p of hankkeet) {
    const avain =
      p.latitude == null || p.longitude == null
        ? null
        : `${Number(p.latitude).toFixed(4)},${Number(p.longitude).toFixed(4)}`
    const epatarkka = avain == null || varapisteet.has(avain)
    if (!epatarkka) continue
    luvut.epatarkka += 1

    const teksti = `${p.name ?? ""} ${p.location ?? ""}`
    const loytyi = osat.find(
      (o) =>
        o.kunta === p.city &&
        new RegExp(`(?<![\\wÅÄÖåäö])${o.nimi.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(teksti)
    )
    if (!loytyi) {
      luvut.eiOsumaa += 1
      continue
    }
    luvut.osuma += 1
    if (naytteet.length < 500) {
      naytteet.push(
        `   ${String(p.city).padEnd(11)} ${String(p.name).slice(0, 52).padEnd(54)} -> ${loytyi.nimi}`
      )
    }
  }

  console.log(`\n=== TULOS ===`)
  console.log(`Epätarkka sijainti (varapiste tai tyhjä): ${luvut.epatarkka}`)
  console.log(`   niistä kaupunginosa nimessä/sijainnissa: ${luvut.osuma}`)
  console.log(`   ei osumaa: ${luvut.eiOsumaa}`)

  for (const n of naytaRivit ? naytteet : naytteet.slice(0, 30)) console.log(n)
  if (!naytaRivit && naytteet.length > 30) console.log(`   ... (${naytteet.length - 30} lisää)`)
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
