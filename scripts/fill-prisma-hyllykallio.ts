import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * PRISMA HYLLYKALLIO: TIEDOT GRANLUNDIN SIVULTA KASIN.
 *
 * Lujatalon referenssisivulta saatiin vain otsikko, laajuus ja urakkamuoto.
 * Granlundin projektisivulla on tilaaja, aikataulu, pinta-ala, muut
 * toimijat ja nimetty yhteyshenkilo.
 *
 * VAIN LISAYS: olemassa olevia arvoja ei korvata, ja Lujatalo sailyy
 * paaurakoitsijana. Granlund on suunnittelija, ei urakoitsija.
 *
 * SAHKOPOSTIA EI KEKSITA. Granlundin sivulla lukee malliosoite
 * "etunimi.sukunimi@granlund.fi". Se on ohje eika osoite (D-123), joten
 * yhteyshenkilosta talletetaan nimi, nimike ja puhelin.
 *
 * PINTA-ALASSA ON RISTIRIITA, jota ei ratkaista arvaamalla: Lujatalo
 * sanoo 35 180 brm2 ja Granlund 30 000 m2. Molemmat kirjataan omina
 * kenttinaan alkuperineen.
 *
 * Aja ensin ilman --apply-lippua.
 */

const APPLY = process.argv.includes("--apply")
const ID = "35af2746-300a-4cf0-bff2-da6f36e04a9b"
const GRANLUND = "https://www.granlund.fi/projektit/prisma-hyllykallio-laajennus-ja-saneeraus/"

const KUVAUS = `Seinäjoen Hyllykallion Prisman laajennus ja uudistustyöt ovat käynnistyneet kesällä 2026. Suunnittelu aloitettiin kesällä 2024.

Prisma Hyllykallioon rakennetaan laajennusta noin 4 000 m², jonka jälkeen kauppakeskuksen kokonaispinta-ala on noin 30 000 m². Kiinteistö on rakennettu alun perin vuonna 1975, ja edellinen iso laajennus valmistui 2012.

Kiinteistö uudistetaan kokonaisuudessaan niin rakennus- kuin talotekniikan osalta. Kauppakäytävän, ravintolamaailman sekä liiketilojen yleisilmettä uudistetaan, ja kauppakeskus muuttuu myös julkisivuiltaan. Uudet valaistut sisäänkäyntiportit ja katokset ohjaavat asiakasliikennettä. Myös pihajärjestelyt ja paikoitusalueet muuttuvat.

Granlund toimii hankkeessa pää- ja arkkitehtisuunnittelijana sekä vastaa sähkösuunnittelusta ja huoltokirjakoordinoinnista. Lujatalo urakoi kohteen jaettuna urakkana.

Lähteet: Lujatalo (urakoitsija) ja Granlund (suunnittelija).`

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { data: nyt, error } = await supabase
    .from("potential_projects")
    .select("*")
    .eq("id", ID)
    .maybeSingle()
  if (error) throw error
  if (!nyt) throw new Error("ehdokasta ei loydy")

  const meta: any = nyt.metadata ?? {}
  const historia: any[] = Array.isArray(meta.source_history) ? meta.source_history : []

  const onJoGranlund = historia.some((h) => String(h?.document_url ?? "").includes("granlund.fi"))

  const kontaktit: any[] = Array.isArray(meta.contact_persons) ? meta.contact_persons : []
  const onJoJyrki = kontaktit.some((c) => String(c?.name ?? "").toLowerCase().includes("jääskeläinen"))

  const uusiMeta: any = {
    ...meta,
    description: KUVAUS,
    developer: meta.developer ?? "Eepee Kiinteistöt Oy",
    estimated_completion: meta.estimated_completion ?? "2027-12-31",
    building_type: meta.building_type ?? "Liiketila",
    construction_type: meta.construction_type ?? "Korjausrakentaminen",
    related_companies: [
      ...new Set([
        ...(Array.isArray(meta.related_companies) ? meta.related_companies : []),
        "Granlund (pää- ja arkkitehtisuunnittelu, sähkösuunnittelu)",
        "Ramboll Finland Oy",
        "Sustera HVAC Design Oy",
        "Fredag Oy",
      ]),
    ],
    /* Ristiriita kirjataan, ei ratkaista. */
    laajuus_lujatalo: meta.laajuus ?? null,
    laajuus_granlund: "30 000 m2 (kokonaispinta-ala laajennuksen jälkeen)",
    laajennus_m2: 4000,
    granlund_url: GRANLUND,
    manually_filled_at: new Date().toISOString(),
    ...(onJoJyrki
      ? {}
      : {
          contact_persons: [
            ...kontaktit,
            {
              name: "Jyrki Jääskeläinen",
              title: "Liiketoimintajohtaja, arkkitehtisuunnittelu, Granlund",
              organization: "Granlund",
              email: "",
              phone: "040 066 4540",
              kind: "person",
            },
          ],
        }),
    ...(onJoGranlund
      ? {}
      : {
          source_history: [
            ...historia,
            {
              source_name: "granlund",
              source_document_id: null,
              document_url: GRANLUND,
              notice_type: null,
              main_type: null,
              date_published: null,
              is_contract_award: false,
              winners: null,
              seen_at: new Date().toISOString(),
            },
          ],
        }),
  }

  console.log(APPLY ? "=== AJETAAN ===" : "=== KUIVAHARJOITUS (ei kirjoiteta) ===")
  console.log(`  ${nyt.title}\n`)
  for (const k of ["developer", "estimated_completion", "building_type", "construction_type", "granlund_url", "laajuus_granlund"]) {
    console.log(`  ${k.padEnd(24)} ${String(uusiMeta[k]).slice(0, 66)}`)
  }
  console.log(`  ${"related_companies".padEnd(24)} ${uusiMeta.related_companies.length} kpl`)
  console.log(`  ${"contact_persons".padEnd(24)} ${(uusiMeta.contact_persons ?? kontaktit).length} kpl`)
  console.log(`  ${"source_history".padEnd(24)} ${(uusiMeta.source_history ?? historia).length} kpl`)
  console.log(`  ${"kuvaus".padEnd(24)} ${String(meta.description ?? "").length} -> ${KUVAUS.length} merkkia`)

  if (!APPLY) { console.log("\n(kuivaharjoitus — aja --apply)"); return }

  const { error: uErr } = await supabase
    .from("potential_projects")
    .update({ metadata: uusiMeta, updated_at: new Date().toISOString() })
    .eq("id", ID)
  if (uErr) throw uErr
  console.log("\nkirjoitettu")
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
