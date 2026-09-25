import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * TALOTEKNIIKKAYRITYKSEN UUTISLAHDE KANTAAN (D-214).
 *
 * Parseri on `lib/agent/sources.ts`:ssa; tama lisaa rivin
 * `discovery_sources`-tauluun. Perustaso (priority 10): yritys tiedottaa
 * muutaman kerran kuukaudessa.
 *
 *   npx tsx scripts/lisaa-talotekniikkalahde.ts are            (kuivaharjoitus)
 *   npx tsx scripts/lisaa-talotekniikkalahde.ts are --apply
 */
const APPLY = process.argv.includes("--apply")

const RIVIT: Record<string, any> = {
  are: {
    id: "legacy-are",
    name: "Are ajankohtaista",
    type: "html",
    category: "company_release",
    url: "https://www.are.fi/meista/ajankohtaista/",
    priority: 10,
    enabled: true,
    refresh_minutes: 1440,
    collector: "legacyFetchCollector",
    parser: "are",
  },
  sarlin: {
    id: "legacy-sarlin",
    name: "Sarlin ajankohtaista",
    type: "html",
    category: "company_release",
    url: "https://www.sarlin.com/ajankohtaista/tag/uutinen",
    priority: 10,
    enabled: true,
    refresh_minutes: 1440,
    collector: "legacyFetchCollector",
    parser: "sarlin",
  },
  amplit: {
    id: "legacy-amplit",
    name: "Amplit ajankohtaista",
    type: "html",
    category: "company_release",
    url: "https://www.amplit.fi/ajankohtaista/",
    priority: 10,
    enabled: true,
    refresh_minutes: 1440,
    collector: "legacyFetchCollector",
    parser: "amplit",
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
  console.log(`  paaurakoitsija ${kandidaatit.filter((k: any) => k.builder).length}`)
  console.log(`  rakennuttaja ${kandidaatit.filter((k: any) => k.developer).length}`)

  console.log("\nlisattava rivi:")
  console.log(JSON.stringify(RIVI, null, 1))

  if (!APPLY) { console.log("\n=== KUIVAHARJOITUS ==="); return }

  const { error } = await db.from("discovery_sources").insert(RIVI)
  if (error) throw error
  console.log("\n=== LISATTY ===")
}
main().catch((e) => { console.error(e); process.exit(1) })
