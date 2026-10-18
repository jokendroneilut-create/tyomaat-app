import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * OTERANIN LAHDE KANTAAN (D-310).
 *
 * Keraaja on `lib/agent/sources.ts`:ssa; tama lisaa rivin
 * `discovery_sources`-tauluun. Perustaso (priority 10, kerran
 * vuorokaudessa): Oteran julkaisee noin seitseman hankejuttua vuodessa.
 *
 *   npx tsx scripts/lisaa-oteran-lahde.ts            (kuivaharjoitus)
 *   npx tsx scripts/lisaa-oteran-lahde.ts --apply
 *
 * Paallekkaisyys tulostetaan kahdella tavalla: sama lahde-URL
 * (`metadata->>source_url`, ks. D-250) ja nimen tunnistesana
 * `projects`-taulussa. Oteranin hankkeista osa on jo kannassa Hilman ja
 * Vaylaviraston kautta eri osoitteella, joten pelkka URL-vertailu
 * nayttaisi aina nollaa.
 */
const APPLY = process.argv.includes("--apply")

/* Oteran on paaurakoitsija, kuten VRJ -> company_project. */
const RIVI = {
  id: "legacy-oteran",
  name: "Oteran ajankohtaista",
  type: "html",
  category: "company_project",
  url: "https://oteran.fi/ajankohtaista/",
  priority: 10,
  enabled: true,
  refresh_minutes: 1440,
  collector: "legacyFetchCollector",
  parser: "oteran",
}

/*
 * TUNNISTESANA: pisin isolla alkava sana joka ei ole kunta eika
 * yleissana ("Luikonlahden", "Aleksanterinkadun"), muuten pisin sana,
 * muuten koko nimi (LOU/ITA-siltaurakat). Taivutus pois leikkaamalla.
 */
const YLEISSANA = /(?:rakentaminen|parantaminen|saneeraus|korjaus|urakka|hanke|ahvenanmaa)/iu

function tunnistesana(nimi: string, onKunta: (s: string) => boolean): string {
  const sanat = nimi
    .split(/[\s,/:]+/)
    .map((s) => s.replace(/[^\p{L}\d-]/gu, ""))
    .filter((s) => s.length >= 4 && !/^\d/.test(s) && !YLEISSANA.test(s) && !onKunta(s))
  const pisin = (lista: string[]) => [...lista].sort((a, b) => b.length - a.length)[0]
  const sana = pisin(sanat.filter((s) => /^\p{Lu}/u.test(s))) ?? pisin(sanat.filter((s) => s.length >= 8))
  if (!sana) return nimi
  return /\d/.test(sana) ? sana : sana.slice(0, Math.max(5, sana.length - 3))
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const { data: jo, error: joVirhe } = await db.from("discovery_sources").select("id, name, parser").or(`id.eq.${RIVI.id},parser.eq.${RIVI.parser}`)
  if (joVirhe) throw joVirhe
  if (jo?.length) { console.log("Lahde on jo olemassa:", JSON.stringify(jo)); return }

  const { sources } = await import("../lib/agent/sources")
  const { getMunicipalityByAnyForm } = await import("../lib/geo/municipalityFromName")
  const { detectCityFromText } = await import("../lib/agent/detectCityFromText")
  const lahde = (sources as any[]).find((s) => s.name === RIVI.parser)
  if (!lahde) { console.log(`EI LISATA - parseria "${RIVI.parser}" ei ole rekisterissa`); return }

  const alkoi = Date.now()
  const kandidaatit = await lahde.fetch()
  console.log(`haku ${((Date.now() - alkoi) / 1000).toFixed(1)} s, kandidaatteja ${kandidaatit.length}`)
  console.log(`  kaupunki ${kandidaatit.filter((k: any) => k.city).length}`)
  console.log(`  kuvaus   ${kandidaatit.filter((k: any) => k.description).length}`)
  console.log(`  paaurakoitsija ${kandidaatit.filter((k: any) => k.builder).length}`)
  console.log(`  rakennuttaja ${kandidaatit.filter((k: any) => k.developer).length}`)
  console.log(`  valmiiksi merkittyja ${kandidaatit.filter((k: any) => k.completed).length}`)

  /* Sama source_url: metadata-kentassa, ei omana sarakkeena (D-250). */
  const urlit = kandidaatit.map((k: any) => k.source_url).filter(Boolean)
  let samaUrl = 0
  for (let i = 0; i < urlit.length; i += 100) {
    const { count, error } = await db
      .from("potential_projects")
      .select("id", { count: "exact", head: true })
      .in("metadata->>source_url", urlit.slice(i, i + 100))
    if (error) throw error
    samaUrl += count ?? 0
  }
  console.log(`  jo potential_projects-taulussa (sama source_url): ${samaUrl}`)

  console.log("\nkandidaatit ja nimivertailu projects-tauluun:")
  let nimiOsumia = 0
  for (const k of kandidaatit) {
    console.log(`  - [${k.phase}] ${k.city ?? "-"} | ${k.name}`)
    const sana = tunnistesana(k.name, (s) => getMunicipalityByAnyForm(s) != null || detectCityFromText(s.toLowerCase()) != null)
    const { data, error } = await db.from("projects").select("name, city, builder, phase").ilike("name", `%${sana}%`).limit(5)
    if (error) throw error
    if (data?.length) nimiOsumia++
    for (const p of data ?? []) console.log(`      ~ "${sana}": ${p.city ?? "-"} | ${p.name} | ${p.builder ?? "-"} | ${p.phase}`)
    if (!data?.length) console.log(`      ("${sana}": ei osumaa)`)
  }
  console.log(`\nnimen tunnistesanalla osuma: ${nimiOsumia}/${kandidaatit.length} (lue osumat: naapurihanke ei ole sama)`)

  const { data: oteranin, error: oVirhe } = await db.from("projects").select("name, city, phase").ilike("builder", "%oteran%")
  if (oVirhe) throw oVirhe
  console.log(`\nprojects, builder ~ Oteran: ${oteranin?.length ?? 0}`)
  for (const p of oteranin ?? []) console.log(`  . ${p.city ?? "-"} | ${p.name} | ${p.phase}`)

  console.log("\nlisattava rivi:")
  console.log(JSON.stringify(RIVI, null, 1))

  if (!APPLY) { console.log("\n=== KUIVAHARJOITUS ==="); return }

  const { error } = await db.from("discovery_sources").insert(RIVI)
  if (error) throw error
  console.log("\n=== LISATTY ===")
}
main().catch((e) => { console.error(e); process.exit(1) })
