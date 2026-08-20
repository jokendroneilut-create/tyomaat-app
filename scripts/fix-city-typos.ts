import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * KAUPUNKIKENTAN KIRJOITUSVIRHEET.
 *
 * Kolme hanketta joiden kaupunki on kirjoitettu vaarin, jolloin kunta ei
 * tunnistu eika maakunta taydenny. Naita ei lisata kuntaluettelon aliaksiksi
 * (D-093): virhe korjataan rivilta, ei legitimoida hakuun.
 *
 * Korjaus tehdaan vain jos rivi vastaa odotettua: kaupunki on tasmalleen
 * odotettu virheellinen arvo. Nimi tarkistetaan silmalla kuivaharjoituksesta.
 *
 * Aja ensin ilman --apply-lippua.
 */

const APPLY = process.argv.includes("--apply")

/*
 * Odotettu virheellinen arvo -> oikea kirjoitusasu.
 *
 * "Pertunmaa" lakkasi kuntana 1.1.2025 (liitettiin Mantyharjuun), mutta se
 * kirjoitetaan silti nain: korjataan vain kirjoitusvirhe, ei siirreta
 * hanketta toiseen kuntaan. Maakunta ratkeaa aliaksen kautta.
 */
const TYPOS: { from: string; to: string; expectInName: string }[] = [
  { from: "Kokkolam", to: "Kokkola", expectInName: "Biltema" },
  { from: "Kirkonummi", to: "Kirkkonummi", expectInName: "Nissniku" },
  { from: "Pertumaa", to: "Pertunmaa", expectInName: "Aurinko" },
]

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { getMunicipalityByAnyForm } = await import("../lib/geo/municipalityFromName")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  console.log(APPLY ? "=== AJETTU ===" : "=== KUIVAHARJOITUS (ei kirjoiteta) ===\n")

  let fixed = 0

  for (const typo of TYPOS) {
    const { data, error } = await supabase
      .from("projects")
      .select("id, name, city, region, location, is_public")
      .eq("city", typo.from)
    if (error) throw error

    if (!data?.length) {
      console.log(`  EI OSUMAA   "${typo.from}" - jo korjattu tai arvo muuttunut`)
      continue
    }

    const municipality = getMunicipalityByAnyForm(typo.to)
    if (!municipality) {
      console.log(`  VIRHE       kohdenimi "${typo.to}" ei ratkea kunnaksi`)
      continue
    }

    for (const p of data) {
      const nameOk = String(p.name).toLowerCase().includes(typo.expectInName.toLowerCase())

      console.log(`  "${typo.from}" -> "${typo.to}"  (${municipality.region})`)
      console.log(`     nimi:      ${p.name}`)
      console.log(`     osoite:    ${p.location ?? "-"}`)
      console.log(`     maakunta:  ${p.region ?? "-"}  ->  ${municipality.region}`)
      console.log(`     nakyvyys:  ${p.is_public ? "asiakkaille nakyva" : "piilotettu"}`)
      console.log(`     nimitarkistus ("${typo.expectInName}"): ${nameOk ? "OK" : "EI TASMAA - OHITETAAN"}`)
      console.log("")

      if (!nameOk) continue
      fixed++

      if (!APPLY) continue

      await supabase
        .from("projects")
        .update({ city: typo.to, region: municipality.region })
        .eq("id", p.id)
    }
  }

  console.log(`korjattavia riveja: ${fixed}`)
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
