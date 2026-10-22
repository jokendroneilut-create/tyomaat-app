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
 * VALIAIKAINEN JA PYSYVA SKEITTIHALLI OVAT ERI HANKKEET (D-333).
 *
 * Johannes 22.10.2026 korjasi minua: *"ymmarsit vaarin. nykyinen halli
 * otetaan kayttoon tammikuuhun 2027 mennessa, mutta suunnittelussa on
 * kokonaan uusi halli."* Olin tiivistanyt kuvauksen valiaikais-
 * jarjestelyyn ja esittanyt sen hankkeena.
 *
 * LAHDE RATKAISI, EI TIEDOTE. STT:n tiedote on tiivistelma. Luin
 * lautakunnan oikean asiakirjan (hel-2026-016045) Helsingin
 * paatosindeksista, ja se kertoi mita kumpikaan meista ei tiennyt:
 *
 *   - Tarveselvitys koskee KOKONAAN Malmin jaahallia, ja se on
 *     vuokrahanke: sopimus 1.11.2026-30.6.2028, laajuus 3 463 htm2,
 *     vuokra n. 443 440 EUR/vuosi, kaynnistamiskustannus n. 40 000 EUR.
 *   - Pysyvasta hallista on vain SIJAINTISELVITYS kaynnissa. Ei
 *     sijaintia, ei aikataulua, ei kustannusta -- eika sen tarvitse
 *     olla Malmilla.
 *
 * Jaahallissa on silti aitoa rakennettavaa: hyppyreita,
 * vauhdinottoramppeja, muunneltava street-skeittialue, erotettava
 * tanssialue ja kadentaitotiloja.
 *
 * KAKSI RIVIA, Johanneksen valinta:
 *
 *   1. TAMA rivi = jaahallin toteutus. Otsikko jaa Johanneksen
 *      antamaksi ([[title-precedence]]).
 *   2. UUSI rivi = pysyva halli, tietoisesti ohut. Nimessa EI ole
 *      Malmia, koska sijainti on auki ja Malmi on nimenomaan
 *      valiaikainen -- muuten rivit sekoittuisivat.
 *
 * Pysyvan hallin lahteeksi paatosasiakirja eika STT-tiedote:
 * paatokset.hel.fi on pysyva arkisto (D-237), ja sama asiakirja on
 * molempien rivien peruste.
 *
 *   npx tsx scripts/erottele-skeittihallit.ts
 *   npx tsx scripts/erottele-skeittihallit.ts --apply
 */

const JAAHALLI_RIVI = "9fbd7b06-ee72-468a-bfc6-a02ec1ce2a08"
const PAATOS = "https://paatokset.hel.fi/fi/asia/hel-2026-016045"
const TIEDOTE =
  "https://www.sttinfo.fi/tiedote/72428648/kulttuuri-ja-vapaa-aikalautakunnan-paatokset-20102026-malmille-uusi-skeitti-ja-harrastushalli-ja-uimahalleissa-kokeillaan-perhelippua-vuonna-2027?publisherId=60579873&lang=fi"

const JAAHALLI_KUVAUS = [
  "Malmin jäähalliin toteutetaan skeitti- ja harrastushalli, joka palvelee skeittauksen lisäksi scoottausta, " +
    "BMX-pyöräilyä ja muita urbaaneja temppulajeja. Skeittihallin yhteyteen tulee harrastushalli matalan " +
    "kynnyksen omaehtoiseen harrastamiseen sekä liikunnan että katukulttuurien parissa.",
  "Tilakokonaisuus on laajuudeltaan noin 3 463 htm². Skeitattava alue käsittää muun muassa muunneltavan " +
    "street-skeittialueen, ja korkeaan jäähalliin voidaan toteuttaa suuremman huonekorkeuden vaativia " +
    "toiminnallisia rakenteita kuten hyppyreitä ja vauhdinottoramppeja, joita matalampaan Kontulan " +
    "skeittihalliin ei ole voitu rakentaa. Harrastushallin alueelle sijoittuu katulajien " +
    "harrastusmahdollisuuksia, muista tiloista erotettava tanssialue sekä pienimuotoisia kädentaidon tiloja. " +
    "Laaja yhtenäinen tila mahdollistaa myös tapahtumien, esimerkiksi skeittikisojen, järjestämisen.",
  "Jääkenttäsäätiön hallinnassa oleva halli otetaan käyttöön vähäisin muutostöin ja nopealla aikataululla. " +
    "Vuokrasopimuksen kesto on 1.11.2026–30.6.2028, ja tavoitteena on avata tilat ainakin osittain joulukuussa " +
    "2026 ja täydessä laajuudessa tammikuussa 2027. Tilojen kokonaisvuokra on arviolta noin 10,67 euroa/m²/kk " +
    "eli noin 443 440 euroa vuodessa, ja toiminnan käynnistämiskustannuksiin varataan noin 40 000 euroa.",
  "Malmin jäähalli on väliaikainen ratkaisu arviolta kahden vuoden ajaksi: pysyvän skeittihallin sijaintia " +
    "koskeva selvitys on erikseen käynnissä. Uusi halli vastaa erityisesti Koillis-Helsingin lasten ja nuorten " +
    "harrastustilojen tarpeeseen; Helsingin nykyinen sisäskeittihalli Luuppi sijaitsee Kontulassa ja sen " +
    "käyttöaste on korkea.",
  "Helsingin kulttuuri- ja vapaa-aikalautakunta hyväksyi hallin tarveselvityksen kokouksessaan 20.10.2026.",
].join("\n\n")

const PYSYVA_KUVAUS = [
  "Helsinki selvittää pysyvän sisäskeittihallin sijaintia. Skeittauksen sisäharjoittelumahdollisuuksien " +
    "lisäämiselle on tunnistettu pitkäaikainen tarve: kaupungin ainoana sisäharjoittelupaikkana toimii " +
    "Kontulan Luupin skeittihalli, jonka käyttöaste on korkea ja tilat paikoitellen ruuhkautuneet. Uusi halli " +
    "palvelisi skeittauksen lisäksi scoottausta, BMX-pyöräilyä ja muita urbaaneja temppulajeja, ja sen " +
    "yhteyteen tulisi harrastushalli matalan kynnyksen omaehtoiseen harrastamiseen.",
  "Sijaintia koskeva selvitys on kesken, eikä hankkeelle ole vielä julkistettu paikkaa, laajuutta, " +
    "aikataulua tai kustannusarviota. Väliaikaisena ratkaisuna skeitti- ja harrastushalli toteutetaan Malmin " +
    "jäähalliin arviolta kahden vuoden ajaksi (vuokrakausi 1.11.2026–30.6.2028).",
  "Tarve on tunnistettu Helsingin kulttuuri- ja vapaa-aikalautakunnan käsittelyssä 20.10.2026, jossa " +
    "hyväksyttiin Malmin väliaikaisen hallin tarveselvitys.",
].join("\n\n")

const PYSYVA = {
  title: "Helsingin pysyvä skeittihalli",
  municipality: "Helsinki",
  confidence: 40,
  metadata: {
    city: "Helsinki",
    region: "Uusimaa",
    source: "helsinki_paatokset",
    source_name: "helsinki_paatokset",
    /* Oma fragmentti, jottei `duplicate_source` hylkaa tulevaa tuontia. */
    source_url: `${PAATOS}#pysyva-skeittihalli`,
    operation: "Helsingin pysyvä skeittihalli",
    description: PYSYVA_KUVAUS,
    developer: "Helsingin kaupunki",
    phase_hint: "Suunnittelu",
    building_type: "Liikuntapaikka",
    contact_persons: [
      {
        kind: "person" as const,
        name: "Teemu Kosunen",
        title: "projektipäällikkö",
        email: "teemu.kosunen@hel.fi",
        phone: "09 310 78078",
        organization: "Helsingin kaupunki",
      },
    ],
    eroteltu_rivista: JAAHALLI_RIVI,
    eroteltu_lahteen_sanamuoto:
      "Pysyvän skeittihallin sijaintia koskevan selvityksen ollessa käynnissä Malmin jäähalli soveltuu väliaikaiseksi",
    liittyva_hanke: JAAHALLI_RIVI,
    /*
     * Tietoisesti ohut rivi: sijaintiselvitys on kesken. Katselmoija
     * nakee taman ja voi jattaa rivin odottamaan.
     */
    odottaa: "Sijaintiselvitys kesken; ei paikkaa, laajuutta, aikataulua eika kustannusta",
  },
}

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  /* ---------- 1. JAAHALLIN RIVI ---------- */
  const { data, error } = await db
    .from("potential_projects")
    .select("id, title, status, metadata")
    .eq("id", JAAHALLI_RIVI)
    .maybeSingle()
  if (error || !data) {
    console.error(`VIRHE: ${error?.message ?? "ei rivia"}`)
    process.exit(1)
  }
  const p = data as any
  const vanha = String(p.metadata?.description ?? "")

  console.log(`\n=== 1. ${p.title}  [${p.status}] ===`)
  console.log(`   kuvaus ${vanha.length} -> ${JAAHALLI_KUVAUS.length} merkkia`)
  console.log(`   lahde-URL: ${String(p.metadata?.source_url ?? "").slice(0, 60)}…`)
  console.log(`   paatos_url lisataan: ${PAATOS}`)
  console.log(`\n${JAAHALLI_KUVAUS}`)

  /* ---------- 2. PYSYVAN HALLIN RIVI ---------- */
  console.log(`\n\n=== 2. UUSI RIVI: ${PYSYVA.title} ===`)
  const { data: onko } = await db
    .from("potential_projects")
    .select("id, status")
    .eq("title", PYSYVA.title)
  if ((onko ?? []).length) {
    console.log(`   ON JO JONOSSA: ${JSON.stringify(onko)} -- ei lisata`)
  } else {
    console.log(`   kunta ${PYSYVA.municipality}, varmuus ${PYSYVA.confidence}, vaihe ${PYSYVA.metadata.phase_hint}`)
    console.log(`   odottaa: ${PYSYVA.metadata.odottaa}`)
    console.log(`\n${PYSYVA_KUVAUS}`)
  }

  if (!apply) {
    console.log("\n\nEi kirjoitettu. Aja --apply kun rivit on luettu.")
    return
  }

  const md: Record<string, any> = { ...(p.metadata ?? {}) }
  md.description = JAAHALLI_KUVAUS
  md.paatos_url = PAATOS
  md.estimated_completion = "2027-01-31"
  md.kuvaus_korjattu = {
    syy: "Edellinen tiivistys sekoitti valiaikaisen jaahallin ja suunnitellun pysyvan hallin",
    lahde: PAATOS,
    tiedote: TIEDOTE,
    edellinen: vanha,
    milloin: new Date().toISOString().slice(0, 10),
  }
  const { error: e1 } = await db.from("potential_projects").update({ metadata: md }).eq("id", JAAHALLI_RIVI)
  if (e1) {
    console.error(`VIRHE jaahalli: ${e1.message}`)
    process.exit(1)
  }
  console.log(`\nJaahallin kuvaus paivitetty (${JAAHALLI_KUVAUS.length} merkkia).`)

  if ((onko ?? []).length) {
    console.log("Pysyvan hallin rivi oli jo jonossa, ei lisatty.")
    return
  }
  const { error: e2 } = await db.from("potential_projects").insert({
    title: PYSYVA.title,
    municipality: PYSYVA.municipality,
    status: "new",
    confidence: PYSYVA.confidence,
    source_count: 1,
    metadata: PYSYVA.metadata,
  })
  if (e2) {
    console.error(`VIRHE pysyva: ${e2.message}`)
    process.exit(1)
  }
  console.log(`Pysyvan hallin rivi lisatty jonoon.`)
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
