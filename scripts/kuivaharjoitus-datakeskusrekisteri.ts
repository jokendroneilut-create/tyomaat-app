import { readFileSync, readdirSync, existsSync } from "node:fs"
import { join } from "node:path"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * DATAKESKUSREKISTERI: KUIVAHARJOITUS (D-365).
 *
 * Kaksi kysymysta, joihin ei saa vastata nimella:
 *
 *   1. PAALLEKKAISYYS. Rekisterin nimet ovat sen omia ("Scale42 Kitee,
 *      Puhos"), joten nimivertailu ei kerro onko hanke meilla.
 *      Tasmaytys tehdaan KOORDINAATILLA ja kunnalla.
 *   2. MITA TASMAYTIN TEKISI. Rekisteri on koostaja (D-354), joten
 *      osuman kirjoittamat kentat on luettava ennen ajoa -- varsinkin
 *      `developer`, jonka osuva lahde kirjoittaa olemassa olevan
 *      paalle (`body.developer || match.developer`).
 *
 *   npx tsx scripts/kuivaharjoitus-datakeskusrekisteri.ts --kansio=<polku>
 */
const kansioArg = process.argv.find((a) => a.startsWith("--kansio="))
const KANSIO = kansioArg ? kansioArg.slice("--kansio=".length) : null
/* Tasmaytys 150 x 7 000 kestaa minuutteja; pelkka paallekkaisyys sekunteja. */
const VAIN_PAALLEKKAISYYS = process.argv.includes("--vain-paallekkaisyys")

/* Kahden pisteen etaisyys kilometreina. */
function km(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371
  const rad = (x: number) => (x * Math.PI) / 180
  const dLat = rad(bLat - aLat)
  const dLon = rad(bLon - aLon)
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

const SADE_KM = 3

async function main() {
  const moduuli = await import("../lib/agent/fetchDatakeskusrekisteriSource")

  type Rivi = { h: any; t: any }
  const rekisteri: Rivi[] = []
  if (KANSIO && existsSync(KANSIO)) {
    for (const f of readdirSync(KANSIO)) {
      if (!f.endsWith(".json")) continue
      const j = JSON.parse(readFileSync(join(KANSIO, f), "utf8"))
      const t = j?.hanke
      if (!t?.nimi) continue
      rekisteri.push({ h: { id: t.id, nimi: t.nimi, kunta: t.kunta, vaihe: t.vaihe }, t })
    }
  }
  if (!rekisteri.length) {
    console.log("Anna --kansio=<polku> jossa on rekisterin JSONit (scripts/hae-datakeskusrekisterin-hankkeet.ts hakee ne).")
    return
  }

  const vaiheet: Record<string, number> = {}
  for (const r of rekisteri) vaiheet[r.h.vaihe ?? "-"] = (vaiheet[r.h.vaihe ?? "-"] ?? 0) + 1
  console.log(`Rekisterissa ${rekisteri.length} hanketta`)
  console.log("  " + Object.entries(vaiheet).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", "))

  const mukaan = rekisteri.filter((r) => moduuli.vaiheeksi(r.h.vaihe) !== null)
  console.log(`  mukaan otettavia (ei toiminnassa/peruttu): ${mukaan.length}\n`)

  /* Kannan rivit koordinaatteineen. */
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
  /*
   * EI `additional_info`A: 7 000 rivin kuvaussarake kaataa kyselyn
   * kannan aikakatkaisuun ([[backfill-run-limits]]). Datakeskus
   * tunnistuu nimesta ja tyypista ilman kuvausta.
   */
  /*
   * VAIN SE MITA MITTAUS TARVITSEE. Seka `additional_info` etta
   * `metadata` kaatoivat kyselyn kannan aikakatkaisuun 7 000 rivilla
   * ([[backfill-run-limits]]). Tasmaytin tulee toimeen naillakin.
   */
  const SARAKKEET =
    "id,name,city,region,location,phase,status,developer,builder,property_type," +
    "estimated_completion,construction_start,is_public,latitude,longitude"
  const omat: any[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error } = await db.from("projects").select(SARAKKEET).range(a, a + 999)
    if (error) throw error
    omat.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }
  /*
   * VERTAILUJOUKKO RAJATAAN DATAKESKUKSIIN (korjaus omaan mittaukseen).
   *
   * Ensimmainen versio vertasi koordinaattia KAIKKIIN hankkeisiin, ja
   * tulos oli roskaa: "XTX Marketsin datakeskus, Kajaani" nayttti osuvan
   * "Lohtajan lahiliikunta-alueen maanrakennusurakkaan". Syy on tunnettu:
   * 61 % riveista on geokoodattu KUNNAN VARAPISTEESEEN
   * ([[address-register-geocode]]), joten saman kunnan rivit ovat kaikki
   * muutaman sadan metrin paassa toisistaan. Kolmen kilometrin sade
   * mittasi siis kuntaa, ei paikkaa.
   */
  const ONKO_DATAKESKUS = /datakeskus|palvelinkeskus|konesali|data ?cent/i
  const vertailu = omat.filter(
    (o) =>
      o.property_type === "Datakeskus" ||
      ONKO_DATAKESKUS.test(String(o.name ?? ""))
  )
  console.log(`Kannassa ${omat.length} hanketta, niista datakeskuksia ${vertailu.length}\n`)

  const { findProjectMatchDetailed } = await import("../lib/agent/projectMatcher")
  const { phaseAdvances } = await import("../lib/projects/phases")

  let onJo = 0
  let tasmaa = 0
  let jonoon = 0
  const kirjoittaisi: string[] = []
  const koordinaattiEiTasmayta: string[] = []

  for (const r of mukaan) {
    const e: any = moduuli.datakeskusEhdokas(r.h, r.t)

    /* 1. Koordinaattiosuma: onko sama kohde jo meilla? */
    const lahella = vertailu
      .filter((o) => o.latitude && o.longitude && r.t.sijainti_lat && r.t.sijainti_lon)
      .map((o) => ({ o, d: km(r.t.sijainti_lat, r.t.sijainti_lon, o.latitude, o.longitude) }))
      .filter((x) => x.d <= SADE_KM && (!e.city || !x.o.city || x.o.city === e.city))
      .sort((a, b) => a.d - b.d)

    /* 2. Mita tasmaytin tekisi. */
    const osuma: any = VAIN_PAALLEKKAISYYS
      ? null
      : findProjectMatchDetailed(omat as any, e)
    const kohde = osuma ? omat.find((o) => o.id === (osuma.project?.id ?? osuma.projectId)) : null
    const pisteet = osuma?.confidence ?? 0

    if (lahella.length) onJo++
    if (pisteet >= 70) tasmaa++
    else jonoon++

    const tila = pisteet >= 70 ? `TASMAA ${pisteet}` : lahella.length ? `LAHELLA, ei tasmaa (${pisteet})` : "UUSI"
    console.log(`${tila.padEnd(26)} ${String(e.phase).padEnd(13)} ${String(e.name).slice(0, 52)}`)
    console.log(`   ${String(e.city ?? "?").padEnd(14)} tilaaja ${e.developer ?? "-"}`)
    if (lahella.length) {
      for (const { o, d } of lahella.slice(0, 2))
        console.log(`   ${d.toFixed(1)} km: ${String(o.name).slice(0, 56)} [${o.phase}] tilaaja ${o.developer ?? "-"}`)
    }
    if (pisteet >= 70 && kohde) {
      const muutos: string[] = []
      if (e.developer && kohde.developer && e.developer !== kohde.developer)
        muutos.push(`tilaaja "${kohde.developer}" -> "${e.developer}"`)
      if (e.developer && !kohde.developer) muutos.push(`tilaaja tyhja -> "${e.developer}"`)
      if (phaseAdvances(kohde.phase, e.phase)) muutos.push(`vaihe ${kohde.phase} -> ${e.phase}`)
      if (e.property_type && kohde.property_type && e.property_type !== kohde.property_type)
        muutos.push(`tyyppi "${kohde.property_type}" -> "${e.property_type}"`)
      if (muutos.length) {
        console.log(`   MUUTTAISI: ${muutos.join(" | ")}`)
        kirjoittaisi.push(`${e.name}: ${muutos.join(" | ")}`)
      }
    }
    /* Koordinaatti sanoo "sama paikka" mutta tasmaytin ei osu: nimet eroavat. */
    if (lahella.length && pisteet < 70) koordinaattiEiTasmayta.push(`${e.name} <-> ${lahella[0].o.name}`)
    console.log()
  }

  console.log("=== YHTEENVETO ===")
  console.log(`rekisterin hankkeita mukana      ${mukaan.length}`)
  console.log(`  koordinaatti osuu kantaan      ${onJo}  (<= ${SADE_KM} km, sama kunta)`)
  console.log(`  tasmaytin yhdistaisi (>=70)    ${tasmaa}`)
  console.log(`  menisi jonoon                  ${jonoon}`)
  console.log(`\nKANNAN ARVOJA MUUTTUISI ${kirjoittaisi.length} rivilla:`)
  for (const k of kirjoittaisi) console.log(`   ${k}`)
  console.log(`\nKOORDINAATTI SANOO SAMA, TASMAYTIN EI (${koordinaattiEiTasmayta.length}):`)
  for (const k of koordinaattiEiTasmayta.slice(0, 25)) console.log(`   ${k}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
