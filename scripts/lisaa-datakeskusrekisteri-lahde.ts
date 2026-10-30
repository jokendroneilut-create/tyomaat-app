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
 * DATAKESKUSREKISTERI LAHTEEKSI (D-365).
 *
 *   npx tsx scripts/lisaa-datakeskusrekisteri-lahde.ts
 *   npx tsx scripts/lisaa-datakeskusrekisteri-lahde.ts --apply
 */
const APPLY = process.argv.includes("--apply")

const RIVI = {
  id: "legacy-datakeskusrekisteri",
  name: "Datakeskushankkeiden kansallinen rekisteri",
  type: "html",
  category: "company_project",
  url: "https://www.datakeskusrekisteri.fi/hankkeet",
  priority: 10,
  enabled: true,
  refresh_minutes: 1440,
  collector: "legacyFetchCollector",
  parser: "datakeskusrekisteri",
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const { data: jo, error } = await db
    .from("discovery_sources")
    .select("id, name, parser, enabled")
    .or(`id.eq.${RIVI.id},parser.eq.${RIVI.parser}`)
  if (error) throw error
  if (jo?.length) {
    console.log(`Lähde on jo olemassa: ${JSON.stringify(jo)}`)
    return
  }

  const { sources } = await import("../lib/agent/sources")
  const lahde = (sources as any[]).find((s) => s.name === RIVI.parser)
  if (!lahde) {
    console.log(`EI LISÄTÄ – parseria "${RIVI.parser}" ei ole rekisterissä`)
    return
  }

  const alkoi = Date.now()
  const kandidaatit = await lahde.fetch()
  console.log(`haku ${((Date.now() - alkoi) / 1000).toFixed(1)} s, kandidaatteja ${kandidaatit.length}`)
  if (!kandidaatit.length) {
    console.log("EI LISÄTÄ – haku ei tuottanut yhtään kohdetta")
    return
  }

  const puuttuu = (kandidaatit as any[]).filter((k) => !k.name || !k.city || !k.phase || !k.source_url)
  console.log(`pakolliset kentät puuttuvat: ${puuttuu.length}`)
  for (const k of puuttuu.slice(0, 10)) console.log(`   ${k.name ?? "(ei nimeä)"} — ${k.city ?? "ei kuntaa"}`)

  const vaiheet: Record<string, number> = {}
  for (const k of kandidaatit as any[]) vaiheet[k.phase] = (vaiheet[k.phase] ?? 0) + 1
  console.log(`vaiheet: ${Object.entries(vaiheet).map(([a, b]) => `${a} ${b}`).join(", ")}`)

  console.log(`\nLisättävä rivi:\n${JSON.stringify(RIVI, null, 2)}`)
  if (!APPLY) {
    console.log("\nEi kirjoitettu. Aja --apply kun rivi on luettu.")
    return
  }

  const { error: e } = await db.from("discovery_sources").insert(RIVI)
  if (e) {
    console.error(`VIRHE: ${e.message}`)
    process.exit(1)
  }
  console.log("\nLisätty.")
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
