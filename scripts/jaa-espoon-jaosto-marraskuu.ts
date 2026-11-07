import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * ESPOON JAOSTOTIEDOTE 2.11.2026 KAHDEKSI EHDOKKAAKSI.
 *
 * Johannes 8.11.2026 jonorivista `2a18ad8d`: *"hankkeessa useita tulevia
 * hankkeita, jaetaan omiksi hankkeikseen. ilmoita kun taman hankkeen voi
 * hylata."*
 *
 * Sama kuvio kuin D-255:ssa (saman jaoston lokakuun tiedote), ja sama
 * malli: yhtena rivina tiedote saisi vaaran nimen, vaaran sijainnin ja
 * vaarat osapuolet — nyt otsikkona oli koko paatosluettelo ja
 * sijaintina Kalastajantie 23, joka koskee vain toista hanketta.
 *
 * EROJA EDELLISEEN:
 *
 * 1. ALKUPERAISTA RIVIA EI MERKITA IGNORED. Johannes hylkaa sen itse
 *    kayttoliittymasta; tama ajo vain luo uudet rivit ja kertoo kun
 *    alkuperainen voi hylata.
 * 2. OSAPUOLTEN EROTIN ON `//`, EI PILKKU (D-313). Edellinen skripti
 *    kirjoitti "Urbanizator Oy, JM Suomi Oy, ..." pilkuilla, ja
 *    `splitCompanyField` nayttaa sellaisen kortilla YHTENA yrityksena.
 *
 * KAKSI HANKETTA, EI KOLMEA. Tiedote luettelee kolme tontinvuokrausta,
 * mutta Espoon oma uutinen 29.10.2026 kertoo etta paloasema ja
 * opiskelija-asunnot ovat sama hanke: *"paloasema rakennetaan osaksi
 * asuinkerrostaloa… Paloasema seka Hoasin ja AYY:n opiskelija-asunnot
 * muodostavat Aalto Village 2 -hankkeen, jonka rakentamisen
 * kilpailuttaminen on kaynnissa."* Kolme vuokrasopimusta, yksi urakka.
 *
 * EI OTETA HANKKEEKSI: kaupunkimarkkinoinnin periaatteiden selostus
 * (hallinnollinen asia) eika Espoon Golfseuran maanvuokrasopimus, joka
 * poistettiin listalta. Aalto Village -kokonaisuuden ensimmainen vaihe
 * valmistui 2019, eika siita tehda rivia.
 *
 *   npx tsx scripts/jaa-espoon-jaosto-marraskuu.ts
 *   npx tsx scripts/jaa-espoon-jaosto-marraskuu.ts --apply
 */
const APPLY = process.argv.includes("--apply")
const LAHDE = "2a18ad8d-1bb8-46b8-b317-de6dacac2357"

/*
 * Espoon oma uutinen, josta Aalto Village 2:n tiedot luettiin. EI mene
 * kuvaukseen: kuvaus siirtyy asiakkaalle, eika paljas osoite ole
 * kuvausta (ks. muisti: no-reviewer-notes-in-description). Oikea paikka
 * toiselle lahteelle on `project_sources`, jonka Johannes voi lisata
 * hyvaksynnan jalkeen — ja se on parempi lahde kuin STT, koska se on
 * julkaisijan oma sivu (ks. muisti: rakennuslehti-is-secondary).
 */
const ESPOON_UUTINEN =
  "https://www.espoo.fi/fi/uutiset/2026/10/espoo-vuokraa-otaniemesta-tontin-paloasemaa-varten-sen-yhteyteen-tulee-opiskelija-asuntoja"

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const { data } = await db.from("potential_projects").select("*").eq("id", LAHDE).maybeSingle()
  const alku: any = data
  if (!alku) { console.log("lahderivia ei loydy"); return }
  if (alku.status !== "new") { console.log("lahderivi ei ole enaa jonossa:", alku.status); return }
  const md = alku.metadata ?? {}

  /*
   * Yhteyshenkilo on jaoston PUHEENJOHTAJA eli luottamushenkilo, ei
   * hankkeen yhteyshenkilo. Merkitaan viranomaiseksi: han ei laske
   * yhteystietokattavuuteen (D-207) muttei myoskaan katoa.
   */
  const yhteys = (md.contact_persons ?? []).map((c: any) => ({ ...c, role: "authority" }))

  const pohja = {
    status: "new",
    municipality: "Espoo",
    source_count: 1,
    metadata: {
      region: "Uusimaa",
      city: "Espoo",
      source: md.source,
      source_name: md.source_name,
      source_url: md.source_url,
      source_history: md.source_history ?? null,
      resolver: "manual-split",
      contact_persons: yhteys,
      jaettu_lahteesta: LAHDE,
    },
  }

  const uudet = [
    {
      ...pohja,
      title: "Nuorisoasunnot Matinkylän Tiistilään, Kalastajantie 23",
      address: "Kalastajantie 23, Espoo",
      confidence: 70,
      metadata: {
        ...pohja.metadata,
        location: "Kalastajantie 23, Espoo",
        phase_hint: "Suunnittelussa",
        /*
         * AVAIN ON `building_type`, EI `property_type` (D-389).
         * Hyvaksyntareitti lukee `metadata.building_type`, eika
         * `metadata.property_type`ia lue mikaan koodi — ensimmainen
         * versio tasta skriptista kirjoitti tyypin kuolleeseen
         * kenttaan, ja rivit olisivat menneet hankkeeksi ilman tyyppia.
         */
        building_type: "Kerrostalo",
        /*
         * Tontin vuokralainen rakennuttaa, eli myyjan kannalta oikea
         * osapuoli. Espoon kaupunki on maanomistaja ja jaa liittyvaksi
         * yritykseksi (sama ratkaisu kuin D-255:ssa).
         */
        developer: "M2-Kodit",
        related_companies: ["Espoon kaupunki"],
        description: [
          "Espoon kaupunginhallituksen elinkeino- ja kilpailukykyjaosto päätti 2.11.2026 vuokrata Matinkylän Tiistilästä tontin M2-Kodeille valtion tukemaa nuorisoasuntotuotantoa varten.",
          "Kalastajantie 23:ssa sijaitsevalle tontille suunnitellaan vuokra-asuntoja nuorille aikuisille ja perheille: asukkaiksi voidaan valita 18–29-vuotiaita, ja asunnoissa voi asua 35-vuotiaaksi saakka.",
          "Tontilla on rakennusoikeutta 3 200 kerrosneliömetriä.",
          "Vuokra-aika on 60 vuotta ja perusvuokra 76 800 euroa vuodessa; luku on maanvuokra eikä rakentamisen kustannusarvio.",
        ].join(" "),
      },
    },
    {
      ...pohja,
      title: "Aalto Village 2: paloasema ja noin 400 opiskelija-asuntoa, Otaniemi",
      address: "Otaniemi, Espoo",
      /*
       * Korkeampi varmuus kuin Matinkylan rivilla: urakan kilpailutus on
       * kaynnissa ja aloitusajankohta tiedossa, eli hanke on selvasti
       * pidemmalla kuin tontinvuokraus.
       */
      confidence: 80,
      metadata: {
        ...pohja.metadata,
        location: "Otaniemi, Espoo",
        /*
         * VAIHE ON KILPAILUTUS, EI SUUNNITTELU. Espoon uutinen sanoo
         * suoraan: *"jonka rakentamisen kilpailuttaminen on kaynnissa."*
         * Tiedotteesta yksin lukisi "Suunnittelussa".
         */
        phase_hint: "Kilpailutus",
        /*
         * AVAIN ON `building_type`, EI `property_type` (D-389).
         * Hyvaksyntareitti lukee `metadata.building_type`, eika
         * `metadata.property_type`ia lue mikaan koodi — ensimmainen
         * versio tasta skriptista kirjoitti tyypin kuolleeseen
         * kenttaan, ja rivit olisivat menneet hankkeeksi ilman tyyppia.
         */
        building_type: "Kerrostalo",
        /*
         * Kolme rakennuttajaa, erottimena `//` (D-313): pilkulla
         * erotettu lista nakyisi kortilla yhtena yrityksena.
         */
        developer:
          "Länsi-Uudenmaan hyvinvointialue // Helsingin seudun opiskelija-asuntosäätiö Hoas // Aalto-yliopiston ylioppilaskunta AYY",
        related_companies: ["Espoon kaupunki"],
        /*
         * "Vuodenvaihteessa 2026–2027" luetaan vuoden alkuun. Tama on
         * tulkinta, ei lahteen oma paiva — merkitaan silti, koska
         * aloitusvuosi on asiakkaalle olennainen ja kuvaus kertoo
         * alkuperaisen sanamuodon.
         */
        construction_start: "2027-01-01",
        description: [
          "Espoon kaupunginhallituksen elinkeino- ja kilpailukykyjaosto päätti 2.11.2026 vuokrata Otaniemestä tontin Länsi-Uudenmaan hyvinvointialueelle paloasemaa varten sekä tontit Helsingin seudun opiskelija-asuntosäätiölle (Hoas) ja Aalto-yliopiston ylioppilaskunnan kiinteistöyhtiölle opiskelija-asuntoja varten.",
          "Paloasema ja opiskelija-asunnot muodostavat Aalto Village 2 -hankkeen, johon kuuluu paloasema ja noin 400 opiskelija-asuntoa.",
          "Hankkeesta tekee erityislaatuisen se, että paloasema rakennetaan osaksi asuinkerrostaloa: paloasema sijaitsee alakerrassa, osa Hoasin opiskelija-asunnoista sen yläkerrassa ja osa vieressä, ja AYY:n asunnot tulevat viereen.",
          "Tontit sijaitsevat Tapiolantien ja Miestentien risteyksen tuntumassa. Vuokra-aika on 60 vuotta.",
          "Rakentamisen kilpailuttaminen on käynnissä, ja rakentamisen on suunniteltu alkavan vuodenvaihteessa 2026–2027.",
          "Paloaseman suunnittelu käynnistyi kaupungin hankkeena ja siirtyi Länsi-Uudenmaan hyvinvointialueelle vuonna 2023, kun pelastustoimen järjestämisvastuu siirtyi hyvinvointialueille.",
          "Hankkeen myötä Aalto Village -kokonaisuus valmistuu; sen ensimmäisen vaiheen opiskelija-asunnot valmistuivat 2019.",
        ].join(" "),
      },
    },
  ]

  console.log("LAHDE:", alku.title)
  console.log("  tila", alku.status, "| sijainti", alku.address, "| luotu", String(alku.created_at).slice(0, 10))
  console.log(`  -> jaetaan ${uudet.length} ehdokkaaseen; ALKUPERAISTA EI KOSKETA\n`)

  for (const u of uudet) {
    console.log("=== " + u.title)
    console.log("   sijainti    ", u.address)
    console.log("   vaihe       ", u.metadata.phase_hint, "| varmuus", u.confidence, "| tyyppi", u.metadata.building_type)
    console.log("   rakennuttaja", u.metadata.developer)
    console.log("   liittyvat   ", JSON.stringify(u.metadata.related_companies))
    console.log("   aloitus     ", (u.metadata as any).construction_start ?? "-")
    console.log("   yhteyshlo   ", (u.metadata.contact_persons ?? []).map((c: any) => `${c.name} [${c.role}]`).join(", ") || "-")
    console.log("   lahde       ", u.metadata.source_url)
    console.log("   kuvaus      ", String(u.metadata.description))
    console.log()
  }

  console.log(`Toinen lahde Aalto Village 2:lle (lisattavissa hyvaksynnan jalkeen):
   ${ESPOON_UUTINEN}
`)
  console.log("EI oteta hankkeeksi: kaupunkimarkkinoinnin periaatteet (selostus),")
  console.log("Espoon Golfseuran maanvuokrasopimus (poistettiin listalta),")
  console.log("Aalto Village -kokonaisuuden 2019 valmistunut ensimmainen vaihe.")

  if (!APPLY) { console.log("\n=== KUIVAHARJOITUS ==="); return }

  const idt: string[] = []
  for (const u of uudet) {
    const { data: luotu, error } = await db.from("potential_projects").insert(u).select("id").single()
    if (error) throw error
    idt.push(luotu.id)
  }

  /*
   * Alkuperaiseen kirjataan VAIN mihin se jakautui. Tila jaa `new`:ksi,
   * jotta Johannes hylkaa rivin itse — ilman merkintaa hylkays hukkaisi
   * tiedon siita, etta rivin sisalto on tallessa toisaalla.
   */
  const { error: e2 } = await db
    .from("potential_projects")
    .update({ metadata: { ...md, jaettu_ehdokkaiksi: idt } })
    .eq("id", LAHDE)
  if (e2) throw e2

  console.log("\n=== LUOTU ===")
  for (const id of idt) console.log(`   https://app.tyomaat.fi/tic/projects/${id}`)
  console.log("  alkuperaiseen kirjattu jaettu_ehdokkaiksi; tila yha 'new'")
}
main().catch(e => { console.error(e); process.exit(1) })
