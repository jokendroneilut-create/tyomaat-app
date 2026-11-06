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
 * OULU-KEMI: KAKSI SUUNNITELMASIVUA, YKSI HANKE (D-378).
 *
 * Johannes 7.11.2026: *"molemmissa on linkki joka vie samaan paikkaan.
 * 'Ratasuunnitelma on valmistunut. Hanke on toteutuksessa.' korjaa
 * vaihe ja yhdista."*
 *
 * Molemmat sivut sanovat saman ja linkittavat emohankkeeseen
 * `/oulu-kemi-uudet-liikennepaikat`. Ne ovat siis SAMAN hankkeen
 * suunnitelmavaiheen alasivuja, eivat kaksi hanketta.
 *
 * SE SELITTAA MYOS KUSTANNUKSEN. Molemmilla alasivulla lukee
 * 7 500 000 €, ja emosivulla **15 000 000 €** eli tasan kaksinkertainen.
 * Epailin kaksoislaskentaa; luku oli oikein per liikennepaikka, mutta
 * YHDISTETYLLE riville kuuluu emon 15 M€
 * ([[combined-figure-split-by-owner-page]]).
 *
 * VAIHE: "Hanke on toteutuksessa" -> Rakenteilla. Molemmilla oli
 * "Suunnittelu", koska rivit syntyivat ratasuunnitelmasivuilta.
 *
 * SAILYVA RIVI ON II, koska siina on `manually_edited_at` -- Johannes
 * on muokannut sita kasin, eika kasin tehty saa kadota
 * ([[manual-parties-linkedin]]). Simon rivi piilotetaan, ei poisteta
 * ([[queue-removal-ignored]]).
 *
 * NIMI VAIHDETAAN, poikkeuksena [[title-precedence]]-saantoon. Kumpikaan
 * vanha nimi ei kuvaa yhdistettya kokonaisuutta: "Uusi liikennepaikka,
 * ratasuunnitelma, Ii" olisi vaara otsikko rivilla joka kattaa myos
 * Simon. Molemmat vanhat nimet jaavat `also_known_as`-listaan.
 *
 * SIJAINTI ON AINOA ARVAUS. Hanke rakentaa kaksi liikennepaikkaa
 * kahdessa maakunnassa (Ii / Pohjois-Pohjanmaa ja Simo / Lappi), ja rivi
 * voi nayttaa yhden. Valittu Ii, koska sailyva rivi on sen; Simo loytyy
 * kuvauksesta ja also_known_as-listalta. Molemmilla riveilla luki
 * aiemmin "Lappi", mika oli Ii:n osalta vaarin.
 *
 *   npx tsx scripts/yhdista-oulu-kemi-liikennepaikat.ts
 *   npx tsx scripts/yhdista-oulu-kemi-liikennepaikat.ts --apply
 */
import { PHASE_LABELS } from "../lib/projects/phases"

const APPLY = process.argv.includes("--apply")

const SAILYY = "88d27595-03f4-4918-a5e7-5a0be9d17cd7" /* Uusi liikennepaikka, ratasuunnitelma, Ii */
const PIILOON = "0d15df8b-a853-445e-9de2-82e591d5aad9" /* Maksniemen liikennepaikka, ratasuunnitelma, Simo */

const EMO = "https://vayla.fi/oulu-kemi-uudet-liikennepaikat"
const NIMI = "Oulu–Kemi-rataosa, uudet liikennepaikat"

/*
 * KUVAUSTA EI KORVATA VAAN TAYDENNETAAN.
 *
 * Oma teksti kutisti kuvauksen 1 752 merkista 729:aan, eli olisi
 * havittanyt tuhat merkkia lahteen omaa tekstia. Kuvaus on se mita
 * asiakas lukee ([[description-is-the-product]]), joten uusi karki
 * kertoo yhdistamisen ja laajuuden, ja vanha teksti jaa sen alle.
 */
const KARKI =
  "Oulu–Kemi-rataosalle rakennetaan kaksi uutta liikennepaikkaa: Iihin " +
  "(Pohjois-Pohjanmaa) ja Maksniemeen Simoon (Lappi). Ratasuunnitelmat " +
  "ovat valmistuneet ja saaneet lainvoiman, ja hanke on toteutuksessa. " +
  "Kokonaiskustannusarvio on 15 miljoonaa euroa, eli 7,5 miljoonaa euroa " +
  "kumpaakin liikennepaikkaa kohden. Tilaaja on Väylävirasto."

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const { data: sailyy, error: e1 } = await db
    .from("projects")
    .select("*")
    .eq("id", SAILYY)
    .maybeSingle()
  if (e1) throw e1
  const { data: piiloon, error: e2 } = await db
    .from("projects")
    .select("*")
    .eq("id", PIILOON)
    .maybeSingle()
  if (e2) throw e2
  if (!sailyy || !piiloon) throw new Error("rivia ei loydy")

  const nimet = [
    ...new Set([
      ...(Array.isArray(sailyy.metadata?.also_known_as) ? sailyy.metadata.also_known_as : []),
      String(sailyy.name),
      String(piiloon.name),
    ]),
  ].filter((n) => n !== NIMI)

  console.log(`SAILYY   ${sailyy.name}`)
  console.log(`   nimi      ${sailyy.name}  ->  ${NIMI}`)
  console.log(`   vaihe     ${sailyy.phase}  ->  ${PHASE_LABELS.construction}`)
  console.log(`   kustannus ${Number(sailyy.estimated_cost).toLocaleString("fi")}  ->  ${(15_000_000).toLocaleString("fi")} €`)
  console.log(`   kaupunki  ${sailyy.city ?? "-"}  ->  Ii`)
  console.log(`   maakunta  ${sailyy.region ?? "-"}  ->  Pohjois-Pohjanmaa`)
  console.log(`   lahde     ${String(sailyy.metadata?.source_url ?? "-").slice(0, 52)}  ->  ${EMO}`)
  const KUVAUS = `${KARKI}

${String(sailyy.additional_info ?? "").trim()}`.trim()
  console.log(`   kuvaus    ${String(sailyy.additional_info ?? "").length}  ->  ${KUVAUS.length} merkkia (karki + vanha)`)
  console.log(`   myos nimella: ${nimet.join(" | ")}`)
  console.log(`\nPIILOON  ${piiloon.name}`)
  console.log(`   is_public ${piiloon.is_public} -> false`)

  if (!APPLY) {
    console.log("\nKUIVAHARJOITUS")
    return
  }

  const md = {
    ...(sailyy.metadata ?? {}),
    source_url: EMO,
    description: KUVAUS,
    also_known_as: nimet,
    estimated_cost: 15_000_000,
    cost_source: "vayla_emosivu",
    phase_hint: PHASE_LABELS.construction,
    field_sources: {
      ...(sailyy.metadata?.field_sources ?? {}),
      estimated_cost: "Vaylaviraston emohankkeen sivu: 15 000 000 €",
      phase: "Vaylan sivu: \u201dRatasuunnitelma on valmistunut. Hanke on toteutuksessa.\u201d",
    },
    merged_from_project_ids: [
      ...new Set([
        ...(Array.isArray(sailyy.metadata?.merged_from_project_ids)
          ? sailyy.metadata.merged_from_project_ids
          : []),
        PIILOON,
      ]),
    ],
  }

  const { error: e3 } = await db
    .from("projects")
    .update({
      name: NIMI,
      phase: PHASE_LABELS.construction,
      estimated_cost: 15_000_000,
      city: "Ii",
      region: "Pohjois-Pohjanmaa",
      additional_info: KUVAUS,
      metadata: md,
    })
    .eq("id", SAILYY)
  if (e3) throw e3

  const { error: e4 } = await db
    .from("projects")
    .update({
      is_public: false,
      metadata: {
        ...(piiloon.metadata ?? {}),
        piilotuksen_syy: `Yhdistetty hankkeeseen ${SAILYY} (sama Vaylan emohanke)`,
        piilotettu_at: new Date().toISOString(),
        merged_into_project_id: SAILYY,
      },
    })
    .eq("id", PIILOON)
  if (e4) throw e4

  console.log("\n=== AJETTU ===")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
