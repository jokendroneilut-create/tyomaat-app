import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * KERAVAN UUTISLAHDE KANTAAN (D-247).
 *
 * Parseri on `lib/agent/fetchKeravaUutisetSource.ts`; tama lisaa rivin
 * `discovery_sources`-tauluun. Sama muoto kuin Helsingin kaupungin
 * uutisilla, joka on ainoa aiempi kunnan uutisvirta lahteena.
 *
 *   npx tsx scripts/lisaa-kerava-uutislahde.ts            (kuivaharjoitus)
 *   npx tsx scripts/lisaa-kerava-uutislahde.ts --apply
 */
const APPLY = process.argv.includes("--apply")

const RIVI = {
  id: "legacy-kerava-uutiset",
  name: "Keravan kaupungin uutiset",
  type: "html",
  category: "construction_news",
  url: "https://www.kerava.fi/wp-json/wp/v2/posts?categories=52,56",
  priority: 10,
  enabled: true,
  refresh_minutes: 1440,
  collector: "legacyFetchCollector",
  parser: "kerava_uutiset",
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
  console.log(`  kaupunki ${kandidaatit.filter((k: any) => k.city).length}`)
  console.log(`  kuvaus   ${kandidaatit.filter((k: any) => k.description).length}`)
  console.log(`  valmiiksi merkittyja ${kandidaatit.filter((k: any) => k.completed).length}`)

  /*
   * Paallekkaisyys olemassa olevaan: sama uutinen on voinut tulla jo
   * muuta kautta. Tarkistetaan source_url ennen kuin lahde lisataan,
   * jottei jonoon valu kaksoiskappaleita. Ks. [[company-source-filtering]].
   */
  const urlit = kandidaatit.map((k: any) => k.source_url).filter(Boolean)
  let jo_kannassa = 0
  for (let i = 0; i < urlit.length; i += 100) {
    const { count } = await db.from("potential_projects").select("id", { count: "exact", head: true }).in("source_url", urlit.slice(i, i + 100))
    jo_kannassa += count ?? 0
  }
  console.log(`  jo potential_projects-taulussa: ${jo_kannassa}`)

  console.log("\n10 ensimmaista kandidaattia:")
  for (const k of kandidaatit.slice(0, 10)) console.log(`  - [${k.phase}] ${k.name}`)

  console.log("\nlisattava rivi:")
  console.log(JSON.stringify(RIVI, null, 1))

  if (!APPLY) { console.log("\n=== KUIVAHARJOITUS ==="); return }

  const { error } = await db.from("discovery_sources").insert(RIVI)
  if (error) throw error
  console.log("\n=== LISATTY ===")
}
main().catch((e) => { console.error(e); process.exit(1) })
