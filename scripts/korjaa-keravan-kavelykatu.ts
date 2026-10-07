import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * KERAVAN KAVELYKATU: KILPAILUN TULOS HANKKEELLE (D-247).
 *
 * Hankkeen kuvaus oli nelja kuukautta vanhentunut — siina luki etta
 * "voittaja julkistetaan Keravan paivana 14.6.2026". Kilpailu ratkesi
 * silloin, ja lahde kertoo tuloksen:
 *
 *   voittaja        LOCI Maisema-arkkitehdit ("Sininen helminauha"),
 *                   20 000 EUR palkinto, suositellaan jatkosuunnittelun
 *                   tarjoajaksi
 *   kunniamaininta  VSU maisema-arkkitehdit Oy ("Keravan syke")
 *   muut            MASU Planning Oy ja Sweco Finland Oy jattivat
 *                   ehdotuksen, eivat sijoittuneet
 *
 * MIKSI LOCI MENEE related_companies-KENTTAAN EIKA
 * architectural_design-KENTTAAN. Lahde sanoo etta tyoryhmaa
 * "suositellaan jatkosuunnittelun tarjoajaksi" — sopimusta ei ole.
 * Suunnittelijakenttaan kirjaaminen vaittaisi enemman kuin lahde sanoo.
 * `related_companies` nakyy asiakkaalle listarivilla urakoitsijan
 * vieressa ja sanoo tasan sen mika on totta: liittyva yritys.
 *
 * MIKSI VSU EI MENE MIHINKAAN. Kunniamaininta ei ole osapuolisuhde.
 * Johannes oli lisaamassa VSU:n yhteystietoa — lahde osoitti etta
 * tyon saa LOCI.
 *
 *   npx tsx scripts/korjaa-keravan-kavelykatu.ts          (kuivaharjoitus)
 *   npx tsx scripts/korjaa-keravan-kavelykatu.ts --apply
 */
const APPLY = process.argv.includes("--apply")

const ID = "4d7be2d5-3ae6-4f1c-b75d-8cd6bb950ed9"
const LAHDE =
  "https://www.kerava.fi/kaupunkisuunnittelu/kauppakaaren-kavelykadun-suunnittelukilpailu-on-ratkennut/"
const VOITTAJA = "LOCI Maisema-arkkitehdit"

const UUSI_KUVAUS = [
  "Keravan keskustan kävelykadun (Kauppakaari) suunnittelukilpailu ratkesi 14.6.2026.",
  "Voittajaksi valittiin ehdotus ”Sininen helminauha”, jonka tekijä on LOCI Maisema-arkkitehdit yhteistyökumppaneineen.",
  "Voittanut työryhmä sai 20 000 euron palkinnon, ja sitä suositellaan jatkosuunnittelun tarjoajaksi.",
  "",
  "Kunniamaininnan sai ehdotus ”Keravan syke” (VSU maisema-arkkitehdit Oy). Muut kilpailuun valitut työryhmät olivat MASU Planning Oy ja Sweco Finland Oy; muita ehdotuksia ei asetettu paremmuusjärjestykseen.",
  "",
  "Jatkosuunnittelussa päätetään toteutusvaiheiden ajoitus ja lopulliset suunnitteluratkaisut. Toteuttamisen kustannukset tarkentuvat suunnittelun edetessä. Kaupunki on asettanut Suomen elinvoimaisimman kävelykadun rakentamisen valtuustokauden 2026–2029 kärkihankkeeksi.",
].join("\n")

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const { data, error } = await db
    .from("projects")
    .select("id, name, phase, developer, additional_info, metadata")
    .eq("id", ID)
    .maybeSingle()

  if (error) throw error
  if (!data) { console.log("Hanketta ei loytynyt"); return }

  const hanke: any = data
  const metadata = (hanke.metadata ?? {}) as Record<string, any>

  /* LISATAAN, EI KORVATA: kasin annettu tieto sailyy. */
  const ennen: string[] = Array.isArray(metadata.related_companies) ? metadata.related_companies : []
  const jalkeen = ennen.includes(VOITTAJA) ? ennen : [...ennen, VOITTAJA]

  const historia: any[] = Array.isArray(metadata.source_history) ? metadata.source_history : []
  const uusiHistoria = historia.some((h) => h?.source_url === LAHDE)
    ? historia
    : [...historia, { source_url: LAHDE, source_name: "kerava_uutiset", lisatty: new Date().toISOString() }]

  const uusiMetadata = {
    ...metadata,
    related_companies: jalkeen,
    source_url: metadata.source_url ?? LAHDE,
    source_history: uusiHistoria,
    /* Molemmat jaljella olleet nimet on nyt paatetty: kumpikaan ei ole osapuoli. */
    osapuoliehdotus: null,
    edited_at: new Date().toISOString(),
    edited_fields: [...new Set([...(metadata.edited_fields ?? []), "additional_info", "related_companies"])],
  }

  console.log("=== ENNEN ===")
  console.log(" nimi             ", hanke.name)
  console.log(" vaihe            ", hanke.phase)
  console.log(" rakennuttaja     ", hanke.developer)
  console.log(" related_companies", JSON.stringify(ennen))
  console.log(" source_url       ", JSON.stringify(metadata.source_url ?? null))
  console.log(" osapuoliehdotus  ", JSON.stringify((metadata.osapuoliehdotus?.nimet ?? []).map((n: any) => n.nimi)))
  console.log(" kuvaus (alku)    ", String(hanke.additional_info ?? "").slice(0, 120) + "...")

  console.log("\n=== JALKEEN ===")
  console.log(" related_companies", JSON.stringify(jalkeen))
  console.log(" source_url       ", JSON.stringify(uusiMetadata.source_url))
  console.log(" osapuoliehdotus   null (molemmat nimet paatetty)")
  console.log(" rakennuttaja      ei muuteta:", hanke.developer)
  console.log(" vaihe             ei muuteta:", hanke.phase)
  console.log("\n uusi kuvaus:\n" + UUSI_KUVAUS.split("\n").map((r) => "   " + r).join("\n"))

  if (!APPLY) { console.log("\n=== KUIVAHARJOITUS ==="); return }

  const { error: virhe } = await db
    .from("projects")
    .update({ additional_info: UUSI_KUVAUS, metadata: uusiMetadata })
    .eq("id", ID)

  if (virhe) throw virhe
  console.log("\n=== PAIVITETTY ===")
}
main().catch((e) => { console.error(e); process.exit(1) })
