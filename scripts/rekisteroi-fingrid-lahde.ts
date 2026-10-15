import { readFileSync } from "node:fs"
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}
/*
 * Fingridin kantaverkkohankkeet lahteeksi (D-289). Koodi on jo
 * sources.ts:ssa; tama rivi kertoo kierratykselle etta lahde on
 * olemassa (D-001). Muoto kopioitu GRK:n ja NRC:n riveista.
 *
 * Prioriteetti on NRC:ta korkeampi (12 vs. 10): 50/52 hanketta on
 * kesken, eli lahteen tuotos on tuoretta eika historiaa.
 *
 *   npx tsx scripts/rekisteroi-fingrid-lahde.ts
 *   npx tsx scripts/rekisteroi-fingrid-lahde.ts --apply
 */
async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const rivi = {
    id: "legacy-fingrid-hankkeet",
    name: "Fingrid kantaverkkohankkeet",
    type: "html",
    category: "company_project",
    url: "https://www.fingrid.fi/kantaverkko/rakentaminen/hankkeet/",
    priority: 12,
    enabled: true,
    refresh_minutes: 1440,
    collector: "legacyFetchCollector",
    parser: "fingrid_hankkeet",
  }

  const { data: ennen, error: lukuvirhe } = await db.from("discovery_sources").select("id").eq("parser", "fingrid_hankkeet")
  /* Tyhja tulos voi olla ohitettu virhe, joten virhe luetaan erikseen. */
  if (lukuvirhe) { console.error(`VIRHE luettaessa: ${lukuvirhe.message}`); process.exit(1) }

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")
  console.log(`rivejä ennen: ${(ennen ?? []).length}`)
  console.log(JSON.stringify(rivi, null, 1))
  if ((ennen ?? []).length) { console.log("\nLahde on jo rekisterissa, ei lisata."); return }
  if (!apply) { console.log("\nEi kirjoitettu."); return }

  const { error } = await db.from("discovery_sources").insert(rivi)
  console.log(error ? `VIRHE: ${error.message}` : "TEHTY — lahde on rekisterissa")
}
main().catch(e => { console.error(e?.message ?? e); process.exit(1) })
