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
 * KIRJALANSALMI: VAARA OTSIKKO JA KAKSOISKAPPALE (D-382).
 *
 * Johannes pyysi korjaamaan otsikon ja `tyon_laji`-kentan: rivin nimi
 * oli *"Kirjalansalmen vanhan sillan purku"* ja `tyon_laji: "purku"`,
 * mutta kuvaus, urakoitsija ja 128 M€ ovat koko uusimishankkeen. Vanhan
 * sillan purku on hankkeen MYOHEMPI VAIHE, ei tama hanke
 * ([[phases-are-separate-projects]]).
 *
 * Korjatessa paljastui kaksoiskappale: sama hanke on kannassa myos
 * Kreaten omalta sivulta. Pelkka otsikon korjaus olisi jattanyt kaksi
 * lahes samannimista rivia asiakkaalle nakyviin.
 *
 * 128 M€ ON KOKO ALLIANSSIN HINTA, EI YHDEN SILLAN. Vaylan sivu sanoo:
 * *"Allianssihankkeen kehitysvaihe kaynnistyi lokakuussa 2021 ... Hankkeen
 * kustannukset ovat 128 miljoonaa euroa."* Hanke kattaa MOLEMMAT sillat,
 * Kirjalansalmen ja Hessundinsalmen. Yksi rivi, yksi luku -- ei kahta
 * rivia samalla summalla ([[alliance-split]]).
 *
 * SAILYVA RIVI ON KREATEN, koska siina on `manually_edited_at` ja kolme
 * yhteyshenkiloa yhden sijaan ([[manual-parties-linkedin]]). Vaylan
 * rivilta tuodaan se mita siina on enemman: rakennuttaja, kustannus,
 * neljas yhteyshenkilo ja tilaajan oma hankesivu.
 *
 * NIMI OTETAAN LAHTEESTA. Kumpikaan vanha ei kelpaa: toinen nimeaa
 * vaaran vaiheen, toinen on Kreaten markkinointiotsikko ("Suomen
 * vaativimpiin siltaprojekteihin kuuluva..."). Vaylan oma nimi on
 * neutraali ja kattaa molemmat sillat. Vanhat jaavat
 * `also_known_as`-listaan ([[title-precedence]]).
 *
 * LAHTEEKSI TILAAJAN SIVU. Molemmat ovat alkuperaisia lahteita, mutta
 * tilaajan hankesivulla on kustannus, aikataulu ja yhteystiedot; Kreaten
 * osoite sailyy `source_urls_found`-listassa.
 *
 *   npx tsx scripts/yhdista-kirjalansalmi.ts
 *   npx tsx scripts/yhdista-kirjalansalmi.ts --apply
 */
const APPLY = process.argv.includes("--apply")

const SAILYY = "a88a1f46-53f6-4fdc-ac4e-bed796e62fd7" /* Kreaten rivi, kasin muokattu */
const PIILOON = "570a1a50-2fd1-4c53-a078-73a9a2d86b83" /* Vaylan rivi, "vanhan sillan purku" */

const NIMI = "Mt 180 Kirjalansalmen ja Hessundinsalmen siltojen uusiminen"
const VAYLA = "https://vayla.fi/mt-180-kirjalansalmen-ja-hessundinsalmen-siltojen-uusiminen"

const LISAYS =
  "Kyseessä on allianssihanke, jonka kehitysvaihe käynnistyi lokakuussa " +
  "2021 ja varsinaiset rakentamistyöt loppuvuodesta 2022. Hankkeen " +
  "kustannukset ovat 128 miljoonaa euroa, ja summa kattaa molemmat sillat. " +
  "Uuden Kirjalansalmen sillan valmistuttua nykyinen silta ja siltapenger " +
  "puretaan."

const avain = (n: unknown) => String(n ?? "").toLowerCase().replace(/\s+/g, " ").trim()

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const { data: a, error: e1 } = await db.from("projects").select("*").eq("id", SAILYY).maybeSingle()
  if (e1) throw e1
  const { data: b, error: e2 } = await db.from("projects").select("*").eq("id", PIILOON).maybeSingle()
  if (e2) throw e2
  if (!a || !b) throw new Error("rivia ei loydy")

  /* Yhteyshenkilot yhdistetaan nimella; kumpikaan ei saa kadota. */
  const omat = Array.isArray(a.metadata?.contact_persons) ? [...a.metadata.contact_persons] : []
  const tuotavat = Array.isArray(b.metadata?.contact_persons) ? b.metadata.contact_persons : []
  let lisatty = 0
  for (const k of tuotavat) {
    if (omat.some((x: any) => avain(x?.name) === avain(k?.name))) continue
    omat.push(k)
    lisatty++
  }

  const nimet = [
    ...new Set([
      ...(Array.isArray(a.metadata?.also_known_as) ? a.metadata.also_known_as : []),
      String(a.name),
      String(b.name),
    ]),
  ].filter((n) => n !== NIMI)

  const kuvaus = `${String(a.additional_info ?? "").trim()}\n\n${LISAYS}`.trim()

  const lahteet = [
    ...new Set([
      ...(Array.isArray(a.metadata?.source_urls_found) ? a.metadata.source_urls_found : []),
      String(a.metadata?.source_url ?? ""),
      VAYLA,
    ]),
  ].filter(Boolean)

  console.log(`SAILYY  ${a.name}`)
  console.log(`   nimi         -> ${NIMI}`)
  console.log(`   rakennuttaja ${a.developer ?? "-"} -> ${b.developer ?? "-"}`)
  console.log(`   urakoitsija  ${a.builder ?? "-"} -> ${b.builder ?? a.builder}`)
  console.log(`   kustannus    ${a.estimated_cost ?? "-"} -> ${(128_000_000).toLocaleString("fi")} € (koko allianssi)`)
  console.log(`   lahde        ${String(a.metadata?.source_url ?? "-").slice(0, 58)} -> ${VAYLA}`)
  console.log(`   yhteyshlot   ${tuotavat.length + omat.length - omat.length + omat.length - lisatty} -> ${omat.length} (uusia ${lisatty})`)
  console.log(`   kuvaus       ${String(a.additional_info ?? "").length} -> ${kuvaus.length}`)
  console.log(`   tyon_laji    ${a.metadata?.tyon_laji ?? "-"} (Vaylan rivilla oli "${b.metadata?.tyon_laji}")`)
  console.log(`   myos nimella: ${nimet.join(" | ")}`)
  console.log(`\nPIILOON ${b.name}`)

  if (!APPLY) {
    console.log("\nKUIVAHARJOITUS")
    return
  }

  const md = {
    ...(a.metadata ?? {}),
    source_url: VAYLA,
    source_urls_found: lahteet,
    description: kuvaus,
    also_known_as: nimet,
    contact_persons: omat,
    developer: b.developer ?? a.metadata?.developer ?? null,
    estimated_cost: 128_000_000,
    cost_source: "vayla_emosivu",
    /* "purku" oli vaara: se on hankkeen myohempi vaihe, ei tama hanke. */
    tyon_laji: "uudisrakennus",
    field_sources: {
      ...(a.metadata?.field_sources ?? {}),
      estimated_cost: "Vaylan hankesivu: allianssihankkeen kustannukset 128 M€, kattaa molemmat sillat",
      developer: "Vaylan hankesivu",
      name: "Vaylan hankesivun oma nimi",
    },
    merged_from_project_ids: [
      ...new Set([
        ...(Array.isArray(a.metadata?.merged_from_project_ids) ? a.metadata.merged_from_project_ids : []),
        PIILOON,
      ]),
    ],
  }

  const { error: e3 } = await db
    .from("projects")
    .update({
      name: NIMI,
      developer: b.developer ?? a.developer,
      builder: b.builder ?? a.builder,
      estimated_cost: 128_000_000,
      additional_info: kuvaus,
      metadata: md,
    })
    .eq("id", SAILYY)
  if (e3) throw e3

  const { error: e4 } = await db
    .from("projects")
    .update({
      is_public: false,
      metadata: {
        ...(b.metadata ?? {}),
        piilotuksen_syy: `Yhdistetty hankkeeseen ${SAILYY} (sama Mt 180 -allianssihanke)`,
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
