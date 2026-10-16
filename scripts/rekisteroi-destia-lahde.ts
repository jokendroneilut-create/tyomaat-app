import { readFileSync } from "node:fs"
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}
/*
 * Destian tiedotteet lahteeksi (D-295). Koodi on jo sources.ts:ssa;
 * tama rivi kertoo kierratykselle etta lahde on olemassa (D-001).
 * Prioriteetti 10 = perustaso, kuten NRC ja Fingrid: tiedotteita tulee
 * noin kaksi kuukaudessa, joten taattua paikkaa ei tarvita.
 *
 *   npx tsx scripts/rekisteroi-destia-lahde.ts
 *   npx tsx scripts/rekisteroi-destia-lahde.ts --apply
 */
async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const rivi = {
    id: "legacy-destia-tiedotteet",
    name: "Destia tiedotteet",
    type: "html",
    category: "company_project",
    url: "https://destia.fi/uutishuone/",
    priority: 10,
    enabled: true,
    refresh_minutes: 1440,
    collector: "legacyFetchCollector",
    parser: "destia_tiedotteet",
  }

  const { data: ennen, error } = await db.from("discovery_sources").select("id").eq("parser", "destia_tiedotteet")
  if (error) { console.error(`VIRHE luettaessa: ${error.message}`); process.exit(1) }
  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")
  console.log(`rivejä ennen: ${(ennen ?? []).length}`)
  console.log(JSON.stringify(rivi, null, 1))
  if ((ennen ?? []).length) { console.log("\nLahde on jo rekisterissa, ei lisata."); return }
  if (!apply) { console.log("\nEi kirjoitettu."); return }

  const { error: virhe } = await db.from("discovery_sources").insert(rivi)
  console.log(virhe ? `VIRHE: ${virhe.message}` : "TEHTY — lahde on rekisterissa")
}
main().catch(e => { console.error(e?.message ?? e); process.exit(1) })
