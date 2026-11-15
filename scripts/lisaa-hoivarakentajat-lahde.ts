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
 * HOIVARAKENTAJAT LAHTEEKSI (D-427).
 *
 * Johannes 16.11.2026: *"katso tilanne ja lisää lähde tarvittaessa"*.
 *
 * Mitattu kuivaharjoituksessa (`scripts/kuivaharjoitus-hoivarakentajat.ts`)
 * 16.11.2026: 13 ehdokasta (5 tiedotetta korttineen + 8 korttia), joista
 * 2 täsmää kantaan (Tavana Hämeenlinna, Humana Vaasa) ja saa osoitteen,
 * projektipäällikön ja vaiheen. Jokaisella on nimetty projektipäällikkö
 * puhelimineen.
 *
 *   npx tsx scripts/lisaa-hoivarakentajat-lahde.ts
 *   npx tsx scripts/lisaa-hoivarakentajat-lahde.ts --apply
 */

const APPLY = process.argv.includes("--apply")

const RIVI = {
  id: "legacy-hoivarakentajat",
  name: "Hoivarakentajat (tiedotteet ja rakenteilla)",
  type: "html",
  category: "company_project",
  url: "https://hoivarakentajat.fi/rakenteilla-olevat-hoivarakennukset",
  priority: 10,
  enabled: true,
  refresh_minutes: 1440,
  collector: "legacyFetchCollector",
  parser: "hoivarakentajat",
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

  /* Parserin on oltava rekisterissa, muuten legacyFetchCollector ei loyda sita. */
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

  const puuttuu = (kandidaatit as any[]).filter(
    (k) => !k.name || !k.city || !k.builder || !k.source_url
  )
  console.log(`pakolliset kentät puuttuvat: ${puuttuu.length}`)
  for (const k of puuttuu) console.log(`   ${k.name ?? "(ei nimeä)"} — ${k.city ?? "ei kuntaa"}`)

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
