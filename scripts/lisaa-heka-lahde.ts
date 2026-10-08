import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * HEKAN UUDISKOHDELUETTELO KANTAAN (D-251).
 *
 * Keraaja on `lib/agent/sources.ts`:ssa; tama lisaa rivin
 * `discovery_sources`-tauluun. Perustaso (priority 10, kerran
 * vuorokaudessa), EI taattua paikkaa: luettelo muuttuu muutaman kerran
 * vuodessa, ja taattu paikka on kallis (D-210).
 *
 *   npx tsx scripts/lisaa-heka-lahde.ts            (kuivaharjoitus)
 *   npx tsx scripts/lisaa-heka-lahde.ts --apply
 */
const APPLY = process.argv.includes("--apply")

/*
 * company_project kuten Espoon Asunnot (kaupungin vuokrataloyhtio) ja
 * kohdekatalogit (Lapti, T2H): legacy-keraaja, julkaisija on rakennuttaja.
 * Hoas ja muut asuntosaatiot ovat developer_release, mutta se luokka
 * kuuluu foundationReleaseParserin tiedotevirralle apiCollectorilla.
 */
const RIVI = {
  id: "legacy-heka",
  name: "Heka uudiskohteet",
  type: "html",
  category: "company_project",
  url: "https://www.hekaoy.fi/kohteet/ajankohtaiset-uudiskohteemme/",
  priority: 10,
  enabled: true,
  refresh_minutes: 1440,
  collector: "legacyFetchCollector",
  parser: "heka",
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const { data: jo } = await db.from("discovery_sources").select("id, name, parser").eq("id", RIVI.id).maybeSingle()
  if (jo) { console.log("Lahde on jo olemassa:", JSON.stringify(jo)); return }

  const { sources } = await import("../lib/agent/sources")
  const lahde = (sources as any[]).find((s) => s.name === RIVI.parser)
  if (!lahde) { console.log(`EI LISATA - parseria "${RIVI.parser}" ei ole rekisterissa`); return }

  const alkoi = Date.now()
  const kandidaatit = await lahde.fetch()
  console.log(`haku ${((Date.now() - alkoi) / 1000).toFixed(1)} s, kandidaatteja ${kandidaatit.length}`)
  console.log(`  valmistumispaiva ${kandidaatit.filter((k: any) => k.estimated_completion).length}`)
  console.log(`  asuntomaara      ${kandidaatit.filter((k: any) => k.metadata?.apartments).length}`)
  console.log(`  valmiiksi merkittyja ${kandidaatit.filter((k: any) => k.completed).length}`)

  /*
   * PAALLEKKAISYYS OLEMASSA OLEVAAN. Lahde-URL on `metadata`-kentassa,
   * ei omana sarakkeenaan (D-250); virhe heitetaan eika nielaista.
   */
  const urlit = kandidaatit.map((k: any) => k.source_url).filter(Boolean)
  let jo_kannassa = 0
  for (let i = 0; i < urlit.length; i += 100) {
    const { count, error } = await db
      .from("potential_projects")
      .select("id", { count: "exact", head: true })
      .in("metadata->>source_url", urlit.slice(i, i + 100))
    if (error) throw error
    jo_kannassa += count ?? 0
  }
  console.log(`  jo potential_projects-taulussa (sama source_url): ${jo_kannassa}`)

  /*
   * Uusi lahde, joten URL-osumia ei odoteta. Osoitehaku projects-tauluun
   * kertoo mitka kohteet ovat jo kannassa muista lahteista (Skanskan
   * tiedotteet, kasin lisatyt) ja tulevat siis kaksoiskappaleina jonoon.
   */
  console.log("\nkandidaatit (kannassa = projects.location tai nimi sisaltaa katuosoitteen):")
  for (const k of kandidaatit) {
    const { data, error } = await db
      .from("projects")
      .select("name")
      .or(`location.ilike.%${k.location}%,name.ilike.%${k.location}%`)
      .limit(5)
    if (error) throw error
    const osumat = (data ?? []).map((p: any) => p.name)
    console.log(`  - [${k.phase}] ${k.name} | ${k.estimated_completion} | ${osumat.length ? `KANNASSA: ${osumat.join(" / ")}` : "uusi"}`)
  }

  console.log("\nlisattava rivi:")
  console.log(JSON.stringify(RIVI, null, 1))

  if (!APPLY) { console.log("\n=== KUIVAHARJOITUS ==="); return }

  const { error } = await db.from("discovery_sources").insert(RIVI)
  if (error) throw error
  console.log("\n=== LISATTY ===")
}
main().catch((e) => { console.error(e); process.exit(1) })
