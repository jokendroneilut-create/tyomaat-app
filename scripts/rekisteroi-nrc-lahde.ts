import { readFileSync } from "node:fs"
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}
/*
 * NRC:n projektisivut lahteeksi (D-288). Koodi on jo sources.ts:ssa;
 * tama rivi kertoo kierratykselle etta lahde on olemassa (D-001).
 * Muoto kopioitu GRK:n ja NCC:n riveista.
 *
 *   npx tsx scripts/rekisteroi-nrc-lahde.ts
 *   npx tsx scripts/rekisteroi-nrc-lahde.ts --apply
 */
async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const rivi = {
    id: "legacy-nrc-projektit",
    name: "NRC projektit",
    type: "html",
    category: "company_project",
    url: "https://www.nrcgroup.fi/projektit",
    priority: 10,
    enabled: true,
    refresh_minutes: 1440,
    collector: "legacyFetchCollector",
    parser: "nrc_projektit",
  }

  const { data: ennen } = await db.from("discovery_sources").select("id").eq("parser", "nrc_projektit")
  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")
  console.log(`rivejä ennen: ${(ennen ?? []).length}`)
  console.log(JSON.stringify(rivi, null, 1))
  if ((ennen ?? []).length) { console.log("\nLahde on jo rekisterissa, ei lisata."); return }
  if (!apply) { console.log("\nEi kirjoitettu."); return }

  const { error } = await db.from("discovery_sources").insert(rivi)
  console.log(error ? `VIRHE: ${error.message}` : "TEHTY — lahde on rekisterissa")
}
main().catch(e => { console.error(e?.message ?? e); process.exit(1) })
