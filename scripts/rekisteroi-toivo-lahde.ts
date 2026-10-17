import { readFileSync } from "node:fs"
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}
/*
 * Toivo Groupin tiedotteet lahteeksi (D-300). Koodi on jo sources.ts:ssa;
 * tama rivi kertoo kierratykselle etta lahde on olemassa (D-001).
 *
 * Prioriteetti 10 = perustaso, kuten NRC, Fingrid ja Destia. Mitattu
 * 15.10.2026: 333 lahteesta 330 on kymmenella, eli kentta on binaarinen
 * ja `priority > 10` varaisi kiinteän paikan joka ajossa muiden
 * kierroksesta pois. Hankeuutisia tulee noin kaksi kuukaudessa, joten
 * taattua paikkaa ei tarvita.
 *
 *   npx tsx scripts/rekisteroi-toivo-lahde.ts
 *   npx tsx scripts/rekisteroi-toivo-lahde.ts --apply
 */
async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const rivi = {
    id: "legacy-toivo-tiedotteet",
    name: "Toivo Group tiedotteet",
    type: "html",
    category: "company_project",
    /*
     * Osoite on ihmiselle luettava IR-sivu. Varsinainen haku menee
     * Inderesin pilvifunktioon, joka on dokumentoitu lahdetiedostossa —
     * tahan ei kirjoiteta sita, koska kentta nakyy Operations-sivulla
     * linkkina.
     */
    url: "https://sijoittajille.toivo.fi/fi/tiedotteet",
    priority: 10,
    enabled: true,
    refresh_minutes: 1440,
    collector: "legacyFetchCollector",
    parser: "toivo_tiedotteet",
  }

  const { data: ennen, error } = await db.from("discovery_sources").select("id").eq("parser", "toivo_tiedotteet")
  if (error) { console.error(`VIRHE luettaessa: ${error.message}`); process.exit(1) }
  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")
  console.log(`rivejä ennen: ${(ennen ?? []).length}`)
  console.log(JSON.stringify(rivi, null, 1))
  if ((ennen ?? []).length) { console.log("\nLahde on jo rekisterissa, ei lisata."); return }
  if (!apply) { console.log("\nEi kirjoitettu."); return }

  const { error: virhe } = await db.from("discovery_sources").insert(rivi)
  console.log(virhe ? `VIRHE: ${virhe.message}` : "TEHTY — lahde on rekisterissa")
}
main().catch((e) => { console.error("KAATUI:", e?.message ?? e); process.exit(1) })
