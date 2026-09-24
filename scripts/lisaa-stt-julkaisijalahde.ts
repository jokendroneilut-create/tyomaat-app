import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * STT-JULKAISIJASYOTE LAHTEEKSI (D-211).
 *
 * Lahteet ovat rivaja `discovery_sources`-taulussa; koodissa on vain
 * parserin nimi (`lib/agent/sources.ts`). Tama lisaa rivin.
 *
 * Perustaso (priority 10) eika taattu paikka: aukko on kertynyt
 * kuukausien ajalta eika se kasva tunneittain, ja haku kestaa 1,4 s.
 *
 *   npx tsx scripts/lisaa-stt-julkaisijalahde.ts            (kuivaharjoitus)
 *   npx tsx scripts/lisaa-stt-julkaisijalahde.ts --apply
 */
const APPLY = process.argv.includes("--apply")

const RIVI = {
  id: "legacy-stt-julkaisijat",
  name: "STT-julkaisijat (rakennusliikkeet)",
  type: "html",
  category: "press_release",
  url: "https://www.sttinfo.fi/",
  priority: 10,
  enabled: true,
  refresh_minutes: 1440,
  collector: "legacyFetchCollector",
  parser: "stt_julkaisijat",
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const { data: jo } = await db.from("discovery_sources").select("id, name, parser, enabled").eq("id", RIVI.id).maybeSingle()
  if (jo) {
    console.log("Lahde on jo olemassa:", JSON.stringify(jo))
    return
  }

  const { sources } = await import("../lib/agent/sources")
  const koodissa = (sources as any[]).some((s) => s.name === RIVI.parser)
  console.log(`parser "${RIVI.parser}" loytyy sources.ts:sta: ${koodissa}`)
  if (!koodissa) { console.log("EI LISATA - parseria ei ole rekisterissa"); return }

  const { fetchSttJulkaisijatSource } = await import("../lib/agent/fetchSttJulkaisijatSource")
  const alkoi = Date.now()
  const kandidaatit = await fetchSttJulkaisijatSource()
  console.log(`haku ${((Date.now() - alkoi) / 1000).toFixed(1)} s, kandidaatteja ${kandidaatit.length}`)

  console.log("\nlisattava rivi:")
  console.log(JSON.stringify(RIVI, null, 1))

  if (!APPLY) { console.log("\n=== KUIVAHARJOITUS ==="); return }

  const { error } = await db.from("discovery_sources").insert(RIVI)
  if (error) throw error
  console.log("\n=== LISATTY ===")
}
main().catch((e) => { console.error(e); process.exit(1) })
