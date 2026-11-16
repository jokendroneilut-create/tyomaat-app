/*
 * Piilottaa puitejärjestelyrivit, jotka eivät ole rakennushankkeita (D-431).
 *
 * Puitejärjestelyllä ei ole yhtä kohdetta, työmaata eikä
 * valmistumispäivää: tilaaja valitsee urakoitsijat tekemään
 * ammattikohtaisia töitä omissa kiinteistöissään sopimuskauden ajan.
 *
 * POISTO ON `is_public: false` + `metadata.piilotuksen_syy`, EI DELETE.
 * Konventio on sama kuin skriptissä piilota-kunnossapitosopimukset.ts.
 *
 *   npx tsx scripts/piilota-puitejarjestelyt.ts          (kuivaharjoitus)
 *   npx tsx scripts/piilota-puitejarjestelyt.ts --apply
 */
import { readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"

const APPLY = process.argv.includes("--apply")

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  if (/^["'].*["']$/.test(v)) v = v.slice(1, -1)
  process.env[m[1]] ??= v
}

const SYY =
  "Puitejärjestely, ei rakennushanke – ei yhtä kohdetta eikä työmaata; sopimuskausi 1.5.–30.10.2026 päättynyt (D-431)"

/** Vihdin vuosisopimuserä 1.5.–30.10.2026. Tunnisteiden alut. */
const POISTETTAVAT = ["3a56f549", "c1b79114", "6281894d", "892dcd01", "23c3f4ae"]

async function main() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data, error } = await db
    .from("projects")
    .select("id,name,city,phase,is_public,metadata")
    .ilike("name", "*puitej*")
    .eq("city", "Vihti")
  if (error) throw error

  let piilotettu = 0
  for (const alku of POISTETTAVAT) {
    const h = (data ?? []).find((r) => r.id.startsWith(alku))
    if (!h) { console.log(`EI LOYDY ${alku}`); continue }
    if (!h.is_public) { console.log(`jo piilossa: ${h.name.slice(0, 70)}`); continue }
    console.log(`${APPLY ? "PIILOTETAAN" : "(kuiva)    "} ${h.id} ${h.phase} | ${h.name.slice(0, 80)}`)
    if (!APPLY) continue
    const md = { ...(h.metadata ?? {}), piilotuksen_syy: SYY, piilotettu_at: new Date().toISOString() }
    const { error: e2 } = await db.from("projects").update({ is_public: false, metadata: md }).eq("id", h.id)
    if (e2) console.log(`   VIRHE: ${e2.message}`)
    else piilotettu++
  }
  console.log(`\n=== ${APPLY ? `AJETTU, piilotettu ${piilotettu}/${POISTETTAVAT.length}` : "KUIVAHARJOITUS"} ===`)
}

main().catch((e) => { console.error(e); process.exit(1) })
