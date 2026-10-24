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
 * ILMASOTAKOULUN YHDISTAMISEN JALKISIIVOUS (D-349).
 *
 * Johannes 25.10.2026: *"yhdista ilmasotakoulun rivit"*. Yhdistaminen
 * tehtiin `merge-duplicate-projects.ts`:lla: sailyi vanhempi rivi
 * `c5326ae1` (Jyvaskyla/Tikkakoski, oikea sijainti), piilotettiin
 * `c8e2c136` (Loppi, vaara sijainti).
 *
 * YHDISTAMINEN TAYTTAA TYHJAT METADATA-AVAIMET POISTETTAVALTA, ja
 * silloin mukana tuli nelja avainta jotka kuvaavat PIILOTETTUA rivia,
 * eivat sailynytta:
 *
 *   region            "Kanta-Hame" -- rivin oma sarake on Keski-Suomi
 *   geocode_source    kertoo Lopen koordinaatin alkuperan
 *   geocoded_at       sama
 *   possible_duplicate_of  osoittaa riviin itseensa
 *
 * Lisaksi kaksi osapuolivirhetta jotka teksti ratkaisee: *"Puolustus-
 * kiinteistot suunnittelee Ilmasotakoululle Tikkakoskelle uutta
 * lentokonehallia"*. Rakennuttaja on siis Puolustuskiinteistot, ei
 * konsernin emo Senaattikiinteistot -- ja Puolustuskiinteistot ei ole
 * RAKENTAJA ([[party-role-fields]]), joten metadatan `builder` poistuu.
 * Senaattikiinteistot jaa liittyvaksi yritykseksi, koska se on
 * julkaisija ja emo.
 *
 *   npx tsx scripts/siivoa-ilmasotakoulun-yhdistys.ts
 *   npx tsx scripts/siivoa-ilmasotakoulun-yhdistys.ts --apply
 */

import { mergeCompanyNames } from "../lib/projects/projectCompanies"

const RIVI = "c5326ae1-c5f2-4446-ba6e-6a5b2bf9e989"
const POISTETTAVAT = ["region", "geocode_source", "geocoded_at", "possible_duplicate_of", "builder"]

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  const { data, error } = await db
    .from("projects")
    .select("id,name,city,region,developer,builder,metadata")
    .eq("id", RIVI)
    .single()
  if (error) {
    console.error(`VIRHE: ${error.message}`)
    process.exit(1)
  }

  const md: Record<string, any> = { ...(data.metadata ?? {}) }
  console.log(`\n${data.name} (${data.city}, ${data.region})`)
  for (const avain of POISTETTAVAT) {
    if (md[avain] == null) continue
    console.log(`   metadata.${avain}: ${JSON.stringify(md[avain]).slice(0, 60)} -> poistetaan`)
    delete md[avain]
  }

  console.log(`   developer: ${data.developer} -> Puolustuskiinteistöt`)
  md.related_companies = mergeCompanyNames(md.related_companies, ["Senaattikiinteistöt"])
  console.log(`   liittyvät yritykset: ${JSON.stringify(md.related_companies)}`)

  if (!apply) {
    console.log("\nEi kirjoitettu. Aja --apply kun rivit on luettu.")
    return
  }

  const { error: e } = await db
    .from("projects")
    .update({ developer: "Puolustuskiinteistöt", metadata: md })
    .eq("id", RIVI)
  if (e) console.error(`VIRHE: ${e.message}`)
  else console.log("\nKirjoitettu.")
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
