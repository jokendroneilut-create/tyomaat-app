import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * VRJ:N, TORPPARIN JA PELTI-ASSIEN LAHTEET KANTAAN (D-250).
 *
 * Keraimet ovat `lib/agent/sources.ts`:ssa; tama lisaa rivin
 * `discovery_sources`-tauluun. Perustaso (priority 10, kerran
 * vuorokaudessa): kukin yritys julkaisee muutaman hankejutun vuodessa.
 *
 *   npx tsx scripts/lisaa-sivuurakoitsijalahde.ts vrj               (kuivaharjoitus)
 *   npx tsx scripts/lisaa-sivuurakoitsijalahde.ts vrj --apply
 *   (sama: torppari, pelti_assat)
 */
const APPLY = process.argv.includes("--apply")

const RIVIT: Record<string, any> = {
  /* VRJ on paaurakoitsija, kuten Kastelli -> company_project. */
  vrj: {
    id: "legacy-vrj",
    name: "VRJ ajankohtaista",
    type: "html",
    category: "company_project",
    url: "https://www.vrj.fi/ajankohtaista.html",
    priority: 10,
    enabled: true,
    refresh_minutes: 1440,
    collector: "legacyFetchCollector",
    parser: "vrj",
  },
  /* Sivu-urakoitsijat kuten Are ja Sarlin (D-214) -> company_release. */
  torppari: {
    id: "legacy-torppari",
    name: "Torppari ajankohtaista",
    type: "html",
    category: "company_release",
    url: "https://www.torppariyhtiot.fi/ajankohtaista",
    priority: 10,
    enabled: true,
    refresh_minutes: 1440,
    collector: "legacyFetchCollector",
    parser: "torppari",
  },
  pelti_assat: {
    id: "legacy-pelti-assat",
    name: "Pelti-Ässät hankeuutiset",
    type: "html",
    category: "company_release",
    url: "https://www.peltiassat.fi/blogit-ja-jutut",
    priority: 10,
    enabled: true,
    refresh_minutes: 1440,
    collector: "legacyFetchCollector",
    parser: "pelti_assat",
  },
}

async function main() {
  const avain = process.argv.find((a) => RIVIT[a])
  if (!avain) {
    console.log("anna lahteen avain:", Object.keys(RIVIT).join(", "))
    return
  }
  const RIVI = RIVIT[avain]

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
  console.log(`  paaurakoitsija ${kandidaatit.filter((k: any) => k.builder).length}`)
  console.log(`  rakennuttaja ${kandidaatit.filter((k: any) => k.developer).length}`)
  console.log(`  valmiiksi merkittyja ${kandidaatit.filter((k: any) => k.completed).length}`)

  /*
   * PAALLEKKAISYYS OLEMASSA OLEVAAN. Lahde-URL on `metadata`-kentassa,
   * EI omana sarakkeenaan: `.in("source_url", ...)` (kuten
   * lisaa-kerava-uutislahde.ts:ssa) palauttaa virheen, jonka count on
   * null — ja se tulostui "0", eli tarkistus ei tarkistanut mitaan.
   * Virhe heitetaan nyt eika nielaista.
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

  console.log("\nkandidaatit:")
  for (const k of kandidaatit) console.log(`  - [${k.phase}] ${k.city ?? "-"} | ${k.name}`)

  console.log("\nlisattava rivi:")
  console.log(JSON.stringify(RIVI, null, 1))

  if (!APPLY) { console.log("\n=== KUIVAHARJOITUS ==="); return }

  const { error } = await db.from("discovery_sources").insert(RIVI)
  if (error) throw error
  console.log("\n=== LISATTY ===")
}
main().catch((e) => { console.error(e); process.exit(1) })
