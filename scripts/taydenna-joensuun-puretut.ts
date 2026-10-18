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
 * JOENSUUN PURETTUJEN RIVIEN OSAPUOLET JA LISATIEDOT (D-314).
 *
 * Johannes 19.10.2026 jonorivista `bee597b7` (Noljakan uusi paivakoti):
 * *"tassa ja muissa askem puretuissa hankkeissa ei ole yhtaan
 * osapuolta. talle on ainakin loydettavissa ne taalta: <joensuu.fi:n
 * tiedote>. Katso onko muihin purettuihin loydettavissa muita
 * lisatietoja."* ja *"ja lisaa nuo tahan hankkeeseen."*
 *
 * LAHDE OLI PAATOSASIAKIRJA, joka kertoo investoinnin muttei
 * toteuttajia. Kaupungin TIEDOTTEET kertovat ne. joensuu.fi on
 * WordPress, ja `wp-json/wp/v2/search` loytaa tiedotteet hankenimella
 * (tyyppi `joe_release`) -- nain loytyi lisatietoa neljalle rivilla
 * kuudesta; purkukohteista ei tiedoteta, eika Fingridilla ole sivua
 * kahdelle sahkoasemalle (52 hankesivua lapi, vain Harviala-Hangasmaki
 * joka on eri hanke).
 *
 * NOLJAKKA: tiedote 17.8.2026 antaa paaurakoitsijan (Rakennustoimisto
 * K. Tervo Oy) ja paasuunnittelijan (VAAKA-ARK Oy), kerrosalan
 * 1 835 m2 ja valmistumisen marraskuussa 2027.
 *
 *   KUSTANNUS: tiedote sanoo 7,1 milj. euroa, kannassa on 6,5 milj.
 *   PIDETAAN 6,5. Lahdeasiakirja on konsernijaoston esityslista
 *   19.10.2026 (haettu sivulta) eli KAKSI KUUKAUTTA TIEDOTETTA
 *   UUDEMPI, ja se sanoo nimenomaan "kustannusennuste on paivittynyt
 *   urakkatarjousten saamisen jalkeen 6,5 milj. euroon". Tiedotteen
 *   luku on hankesuunnitelman vanha arvio. Molemmat jaavat kuvaukseen.
 *
 * NIITTYLAHTI -- OMA VIRHEENI JATKUI HYVAKSYNTAAN. Purkurivin
 * hyvaksynta tasmasi UUDEN KOULUN hankkeeseen `3dc2566f`, ja koulun
 * kuvaukseksi tuli purkuteksti: asiakas nakee hankkeen nimelta
 * "Niittylahden uusi koulu ja paivakoti" jonka kuvaus kertoo vanhan
 * rakennuksen purkamisesta. Sama `matched`-ansa kolmannen kerran
 * (muisti: matched-overwrites-fields, D-312). Korjataan:
 *   - koululle oma kuvaus kaupungin hankesivulta ja tiedotteesta
 *   - `purettava`-lippu pois koulun rivilta
 *   - purku saa OMAN hankkeen, kuten nelja muuta purkukohdetta;
 *     Johannes on jo hyvaksynyt rivin, joten sita ei palauteta jonoon
 *   - koulun nimi kaupungin omaan muotoon, paatosotsikko
 *     `also_known_as`-listaan (ks. muisti title-precedence)
 *
 *   npx tsx scripts/taydenna-joensuun-puretut.ts
 *   npx tsx scripts/taydenna-joensuun-puretut.ts --apply
 */

/* --- Jonorivit --- */
const NOLJAKKA = "bee597b7-7cc8-4650-9920-76940f0bd939"
const MEHTIMAKI = "e4e94c9e-0000-0000-0000-000000000000" /* korvataan haulla */
const UTRA = "d6d043cc-0000-0000-0000-000000000000"
const KIRJASTO = "2454f4b2-0000-0000-0000-000000000000"
const NIITTYLAHTI_JONO = "2fed0c57-04d8-4499-b8e9-612a275819d3"

/* --- Hankkeet --- */
const KOULU = "3dc2566f-9282-4557-b23e-c53b1d70d631"
const LAHDERIVI = "9beb523a-28eb-4755-a511-99ef37bb5368"

const TIEDOTTEET = {
  noljakka: "https://www.joensuu.fi/ajankohtaista/tiedotteet/noljakan-uuden-paivakodin-rakentaminen-on-alkanut/",
  mehtimaki:
    "https://www.joensuu.fi/ajankohtaista/tiedotteet/mehtimaen-tekonurmikentan-kehittamisesta-laaditaan-hankesuunnitelma/",
  utra: "https://www.joensuu.fi/ajankohtaista/tiedotteet/utraan-rakennetaan-uusi-alakoulu-ja-paivakoti/",
  kirjasto:
    "https://www.joensuu.fi/kaupunki-ja-kehitys/suunnittelu-ja-rakentaminen/kaupungin-rakentaminen/joensuun-paakirjaston-peruskorjaushanke/",
  niittylahti:
    "https://www.joensuu.fi/kaupunki-ja-kehitys/suunnittelu-ja-rakentaminen/kaupungin-rakentaminen/niittylahden-koulu-ja-paivakoti/",
}

type JonoLisa = {
  haku: string
  nimi: string
  tiedote: string
  /* Vain tyhjaan kenttaan. */
  metadata?: Record<string, unknown>
  yritykset?: string[]
  lisaKuvaus: string
}

const JONOLISAT: JonoLisa[] = [
  {
    haku: "Noljakan uusi päiväkoti",
    nimi: "Noljakan uusi päiväkoti",
    tiedote: TIEDOTTEET.noljakka,
    metadata: {
      builder: "Rakennustoimisto K. Tervo Oy",
      estimated_completion: "2027-11-30",
      kerrosala_m2: 1835,
      alue: "Erkinpellon urheilu- ja virkistysalue",
    },
    yritykset: ["Rakennustoimisto K. Tervo Oy", "VAAKA-ARK Oy"],
    lisaKuvaus:
      "Joensuun kaupungin tiedote 17.8.2026 (rakentaminen alkanut): päiväkodin PÄÄURAKOITSIJANA toimii " +
      "joensuulainen Rakennustoimisto K. Tervo Oy ja PÄÄSUUNNITTELIJA on VAAKA-ARK Oy. Päiväkoti " +
      "rakennetaan Erkinpellon urheilu- ja virkistysalueelle nykyisen urheilukentän läheisyyteen ja on " +
      "valmis arviolta marraskuussa 2027. Rakennus on yksikerroksinen ja sen kerrosala on 1 835 m². " +
      "Kohteesta tulee Joensuun ensimmäinen luontopainotteinen päiväkoti: pihalle tulee marjapensaita, " +
      "hedelmäpuita ja kasvimaa, ja alueen puustoa säilytetään. Lämmitys toteutetaan maalämpönä ja osa " +
      "sähköstä saadaan katon aurinkopaneeleista; kohteelle haetaan Rakennustiedon ympäristöluokitusta " +
      "4/5. Tiedotteessa kustannusarvioksi mainitaan 7,1 milj. euroa, mutta konsernijaoston 19.10.2026 " +
      "esityslista on uudempi ja kertoo urakkatarjousten jälkeen päivittyneen ennusteen 6,5 milj. euroa. " +
      "Hanke kuuluu kokonaisuuteen, jolle EU:n CINEA on myöntänyt 18 milj. euron avustuksen ja jota " +
      "Euroopan investointipankki rahoittaa 120 milj. euron lainalla. Työmaan viereinen pysäköintialue " +
      "on osittain työmaaliikenteen käytössä, ja matonpesupaikka siirtyy skeittiparkin viereen (uusi " +
      "paikka avautuu toukokuussa 2027).",
  },
  {
    haku: "Mehtimäen jalkapallostadion",
    nimi: "Mehtimäen jalkapallostadion",
    tiedote: TIEDOTTEET.mehtimaki,
    lisaKuvaus:
      "Joensuun kaupungin tiedote 28.5.2026: kaupunginhallitus päätti yksimielisesti 25.5.2026 " +
      "käynnistää hankesuunnitelman laatimisen tekonurmikentän kehittämiseksi kaikkien sarjatasojen " +
      "vaatimukset täyttäväksi jalkapallostadioniksi. Nykyinen kenttä täyttää pääosin " +
      "olosuhdevaatimukset, mutta katsomotilat ovat puutteelliset: paikkoja on 750, joista suurin osa " +
      "ei vastaa pysyvän katsomon vaatimuksia, kun Veikkausliiga edellyttää vähintään 2 500 katettua " +
      "paikkaa. Hankesuunnitelmassa määritellään katsomot, tekniset tilat ja muut rakenteet sekä " +
      "tarkastellaan toteutusvaihtoehtoja ja rahoitusta. Suunnitelma pyritään laatimaan vuoden 2026 " +
      "aikana, jotta investoinnit voidaan huomioida vuosien 2027–2029 taloussuunnittelussa. Mehtimäen " +
      "aluetta kehitetään kokonaisuutena liikunnan, hyvinvoinnin ja koulutuksen keskittymäksi.",
  },
  {
    haku: "Utran uusi koulu ja päiväkoti",
    nimi: "Utran uusi koulu ja päiväkoti",
    tiedote: TIEDOTTEET.utra,
    metadata: { estimated_completion: "2031-12-31" },
    lisaKuvaus:
      "Joensuun kaupungin tiedote 16.6.2026: kaupunginvaltuusto päätti 15.6.2026 uuden kolmisarjaisen " +
      "alakoulun sekä kolmeryhmäisen päiväkodin rakentamisesta Utraan. Uusi koulu korvaa Utran nykyisen " +
      "kolmisarjaisen koulun ja sen on määrä valmistua vuonna 2031. Koulu rakennetaan nykyisen Utran " +
      "koulun viereen ja päiväkoti koulun yhteyteen; nykyinen koulu jatkaa toimintaansa uuden " +
      "valmistumiseen saakka. Tilakeskus aloitti hankesuunnitelman laadinnan syksyllä 2026 ja " +
      "kaavoitus käynnistää tarvittavat kaavatyöt. Valtuusto päätti samalla Pataluodon alakoulun " +
      "lakkauttamisesta uuden Utran koulun valmistuessa; Mutalan koulun jatkoa arvioidaan uudelleen " +
      "keväällä 2030. Uusi koulu on samaa kokoluokkaa kuin Karsikon alakoulu.",
  },
  {
    haku: "Joensuun pääkirjaston peruskorjaus",
    nimi: "Joensuun pääkirjaston peruskorjaus",
    tiedote: TIEDOTTEET.kirjasto,
    lisaKuvaus:
      "Joensuun kaupungin hankesivu ja tiedote 11.8.2026: pääkirjaston rakennus on lähes 40-vuotias ja " +
      "sen talotekniikka on uusimisen tarpeessa. Suunnittelu alkaa 2026, hankesuunnitelma tuodaan " +
      "kaupunginvaltuuston päätettäväksi arviolta vuonna 2028, ja myönteisen päätöksen jälkeen " +
      "korjaushanke voi toteutua vuosien 2029–2031 aikana. Peruskorjauksessa uusitaan laajalti " +
      "talotekniikkaa ja kirjastotoimintoja voidaan sijoittaa tilaan uudella tavalla; lähtökohtana on " +
      "parantaa esteettömyyttä ja akustiikkaa, ekologisuutta ja energiatehokkuutta, työskentely- ja " +
      "kokoustiloja sekä piha-aluetta. Valmisteluvaiheessa rakennukseen tehdään kuntotarkastuksia. " +
      "Peruskorjauksen ajan kirjasto toimisi myöhemmin päätettävässä väistötilassa. Syksyllä 2026 " +
      "kerätään asukkailta toiveita tiloista (Tilavisio yhdessä kuntalaisten kanssa -hanke) ja keväällä " +
      "2027 niistä muodostetaan tilamalleja. Hanke on osa Euroopan investointipankin Joensuulle " +
      "myöntämää lainapakettia.",
  },
]

const KOULUN_KUVAUS =
  "Joensuun kaupunki rakentaa Niittylahteen uuden koulun ja päiväkodin nykyisen koulun ja päiväkodin " +
  "tontille osoitteeseen Kummuntie 9. Koulu ja päiväkoti tulevat samaan rakennukseen: 2-sarjainen " +
  "alakoulu ja 3-ryhmäinen päiväkoti. Koulun tiloihin tulee perusopetustilojen lisäksi tilat " +
  "KELPO-opetukselle, liikuntasali sekä kuntosali, ja oppilaita on valmistumisen aikaan noin 300. " +
  "Päiväkotiin tulee tilat kahdelle päiväkotiryhmälle ja yhdelle esikouluryhmälle. Pedagogisessa " +
  "suunnitelmassa painottuu lukeminen ja lukutaito.\n\n" +
  "Kaupunginvaltuusto päätti koulun ja päiväkodin rakentamisesta 8.12.2025. Hankesuunnittelu " +
  "käynnistyi alkuvuodesta 2026, ja konsernijaosto käsitteli hankesuunnitelmaa 14.9.2026. Tarkempi " +
  "suunnittelu alkaa aikaisintaan alkuvuodesta 2027. Alueen asemakaava on luonnosvaiheessa ja " +
  "tavoitteena on, että kaava saa lainvoiman vuoden 2027 alkuun mennessä. Rakennustyöt alkavat vanhan " +
  "rakennuksen purkamisella, joka voi alkaa kaavan saatua lainvoiman; rakentaminen ajoittuisi vuosiin " +
  "2027–2029 ja uusi rakennus pihoineen valmistuu aikaisintaan loppuvuodesta 2029. Tilat otettaisiin " +
  "käyttöön arviolta tammikuussa 2030.\n\n" +
  "Hankesuunnitelman mukainen kustannusarvio on 22,1 milj. euroa (Tilakeskuksen investointiohjelma). " +
  "Nykyinen Niittylahden koulu siirtyy väistötiloihin rakentamisen ajaksi. Samassa yhteydessä " +
  "valtuusto päätti 5+1-ryhmäisen päiväkodin rakentamisesta Reijolaan, joka on oma hankkeensa.\n\n" +
  "Lähteet: Joensuun kaupungin hankesivu ja tiedote 16.9.2026 (hankesuunnitelmat konsernijaostossa)."

const PURUN_KUVAUS =
  "Joensuun Tilakeskus esittää Niittylahden vanhan koulun ja päiväkodin purettavaksi vuonna 2027. " +
  "Lähteen sanamuoto: \"Nittylahden koulu ja päiväkoti\". Esitys sisältyy Tilakeskuksen vuoden 2027 " +
  "investointiohjelmaan, jonka konsernijaosto käsittelee 19.10.2026.\n\n" +
  "Kaupungin hankesivun mukaan purettavat rakennukset sijaitsevat osoitteessa Kummuntie 9 ja purku " +
  "aloittaa uuden koulun ja päiväkodin rakennustyöt: purkaminen voi alkaa, kun alueen uusi asemakaava " +
  "on lainvoimainen (tavoite vuoden 2027 alkuun mennessä). Nykyinen koulu siirtyy väistötiloihin " +
  "rakentamisen ajaksi.\n\n" +
  "HUOM: samalle tontille rakennetaan uusi koulu ja päiväkoti, joka on OMA hankkeensa (22,1 milj. " +
  "euroa) — tämä rivi koskee vanhan rakennuksen purkua. Älä yhdistä näitä kahta: hyväksyntä tasmasi " +
  "purun kertaalleen uuden koulun riville ja korvasi sen kuvauksen."

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  /* --- 1. Jonorivien taydennykset --- */
  console.log(`\n1) JONORIVIT (${JONOLISAT.length})`)
  for (const j of JONOLISAT) {
    const { data: rivit, error } = await db
      .from("potential_projects")
      .select("id, title, status, metadata")
      .eq("title", j.haku)
    if (error) {
      console.error(`   VIRHE haku "${j.haku}": ${error.message}`)
      continue
    }
    if ((rivit ?? []).length !== 1) {
      console.error(`   VIRHE: "${j.haku}" -> ${(rivit ?? []).length} riviä, odotettiin 1`)
      continue
    }
    const r: any = (rivit ?? [])[0]
    const md: Record<string, any> = { ...(r.metadata ?? {}) }
    console.log(`\n   ${r.id.slice(0, 8)} ${r.title} [${r.status}]`)

    const lisatyt: string[] = []
    for (const [k, v] of Object.entries(j.metadata ?? {})) {
      const nyt = md[k]
      if (nyt != null && String(nyt).trim() !== "" && String(nyt) !== "null") {
        console.log(`      ${k.padEnd(22)} ON JO "${nyt}" -- ei korvata`)
        continue
      }
      md[k] = v
      lisatyt.push(`${k}=${v}`)
    }
    if (lisatyt.length) console.log(`      lisätään: ${lisatyt.join(", ")}`)

    if (j.yritykset?.length) {
      const yr = new Set<string>([
        ...(Array.isArray(md.related_companies) ? md.related_companies : []),
        ...j.yritykset,
      ])
      md.related_companies = [...yr]
      console.log(`      related_companies     ${JSON.stringify([...yr])}`)
    }

    const historia: any[] = Array.isArray(md.source_history) ? md.source_history : []
    if (!historia.some((h) => h?.source_url === j.tiedote || h?.document_url === j.tiedote)) {
      historia.push({
        seen_at: new Date().toISOString(),
        source_name: "joensuu_tiedotteet",
        source_url: j.tiedote,
        document_url: j.tiedote,
      })
      md.source_history = historia
      console.log(`      source_history        + ${j.tiedote.slice(8, 70)}`)
    }

    const vanha = String(md.description ?? "").trim()
    const onJo = vanha.includes(j.lisaKuvaus.slice(0, 60))
    md.description = onJo ? vanha : [vanha, j.lisaKuvaus].filter(Boolean).join("\n\n")
    console.log(`      kuvaus                ${vanha.length} -> ${String(md.description).length}${onJo ? " (on jo)" : ""}`)
    console.log(`      lisätään: ${j.lisaKuvaus.slice(0, 160)}...`)

    if (!apply) continue
    const { error: e1 } = await db.from("potential_projects").update({ metadata: md }).eq("id", r.id)
    if (e1) console.error(`      VIRHE: ${e1.message}`)
    else console.log(`      kirjoitettu`)
  }

  /* --- 2. Niittylahti: koulun kuvaus takaisin --- */
  console.log(`\n2) NIITTYLAHDEN KOULU: purkuteksti pois koulun rivilta`)
  const { data: koulu, error: e2 } = await db.from("projects").select("*").eq("id", KOULU).maybeSingle()
  if (e2 || !koulu) {
    console.error(`   VIRHE: koulun riviä ei loytynyt (${e2?.message ?? "ei rivia"})`)
    process.exit(1)
  }
  const k: any = koulu
  const km: Record<string, any> = { ...(k.metadata ?? {}) }
  const aka = new Set<string>([...(Array.isArray(km.also_known_as) ? km.also_known_as : [])])
  if (String(k.name) !== "Niittylahden uusi koulu ja päiväkoti") aka.add(String(k.name))
  console.log(`   nimi      "${k.name}"`)
  console.log(`             -> "Niittylahden uusi koulu ja päiväkoti" (paatosotsikko also_known_as:iin)`)
  console.log(`   purettava ${km.purettava} -> poistetaan (tama on uudisrakennus)`)
  console.log(`   kuvaus    ${String(k.additional_info ?? "").length} -> ${KOULUN_KUVAUS.length} merkkiä`)
  console.log(`   NYKYINEN (vaara): ${String(k.additional_info ?? "").slice(0, 150)}`)
  console.log(`   UUSI:             ${KOULUN_KUVAUS.slice(0, 150)}`)
  console.log(`   valmistuminen ${k.estimated_completion ?? "-"} -> 2029-12-31 (lahde: "valmistuu aikaisintaan loppuvuodesta 2029")`)

  /* --- 3. Purku omaksi hankkeeksi --- */
  const { data: purku } = await db.from("projects").select("id, name").ilike("name", "%Niittylahden koulun ja päiväkodin purku%")
  console.log(`\n3) NIITTYLAHDEN PURKU omaksi hankkeeksi: ${(purku ?? []).length ? "ON JO" : "luodaan"}`)
  const { data: jonorivi } = await db
    .from("potential_projects")
    .select("id, title, status, metadata")
    .eq("id", NIITTYLAHTI_JONO)
    .maybeSingle()
  const jm: any = (jonorivi as any)?.metadata ?? {}
  console.log(`   jonorivi ${NIITTYLAHTI_JONO.slice(0, 8)} [${(jonorivi as any)?.status}] -- Johannes on hyvaksynyt taman`)
  console.log(`   hanke: Niittylahden koulun ja päiväkodin purku, Joensuu, Suunnittelussa, tilaaja Joensuun kaupunki`)
  console.log(`   kuvaus: ${PURUN_KUVAUS.slice(0, 170)}...`)

  if (!apply) {
    console.log("\nEi kirjoitettu. Aja --apply kun rivit on luettu.")
    return
  }

  delete km.purettava
  km.also_known_as = [...aka]
  km.tiedote_url = TIEDOTTEET.niittylahti
  const kh: any[] = Array.isArray(km.source_history) ? km.source_history : []
  if (!kh.some((h) => h?.source_url === TIEDOTTEET.niittylahti)) {
    kh.push({
      seen_at: new Date().toISOString(),
      source_name: "joensuu_tiedotteet",
      source_url: TIEDOTTEET.niittylahti,
      document_url: TIEDOTTEET.niittylahti,
    })
    km.source_history = kh
  }
  const { error: e3 } = await db
    .from("projects")
    .update({
      name: "Niittylahden uusi koulu ja päiväkoti",
      additional_info: KOULUN_KUVAUS,
      estimated_completion: "2029-12-31",
      metadata: km,
    })
    .eq("id", KOULU)
  if (e3) {
    console.error(`   VIRHE koulu: ${e3.message}`)
    process.exit(1)
  }
  console.log(`   koulu korjattu`)

  if (!(purku ?? []).length) {
    const { error: e4 } = await db.from("projects").insert({
      name: "Niittylahden koulun ja päiväkodin purku",
      city: "Joensuu",
      region: "Pohjois-Karjala",
      phase: "Suunnittelussa",
      developer: "Joensuun kaupunki",
      property_type: "Koulu",
      is_public: true,
      status: "active",
      needs_review: true,
      source_confidence: 40,
      additional_info: PURUN_KUVAUS,
      metadata: {
        region: "Pohjois-Karjala",
        source: "joensuu_paatokset",
        source_name: "joensuu_paatokset",
        source_url: jm.source_url,
        paatos_url: jm.paatos_url,
        liite_urlt: jm.liite_urlt,
        operation: "Niittylahden koulun ja päiväkodin purku",
        description: PURUN_KUVAUS,
        developer: "Joensuun kaupunki",
        phase_hint: "Suunnittelussa",
        building_type: "Koulu",
        purettava: true,
        tyon_laji: "purku",
        purkuvuosi: 2027,
        project_address: "Kummuntie 9",
        eroteltu_rivista: LAHDERIVI,
        eroteltu_lahteen_sanamuoto: "Nittylahden koulu ja päiväkoti",
        potential_project_id: NIITTYLAHTI_JONO,
        /* Naapurihanke, jotta kukaan ei yhdista naita uudelleen. */
        liittyva_hanke: KOULU,
        tiedote_url: TIEDOTTEET.niittylahti,
        source_history: [
          {
            seen_at: new Date().toISOString(),
            source_name: "joensuu_paatokset",
            source_url: jm.source_url,
            document_url: jm.paatos_url,
          },
          {
            seen_at: new Date().toISOString(),
            source_name: "joensuu_tiedotteet",
            source_url: TIEDOTTEET.niittylahti,
            document_url: TIEDOTTEET.niittylahti,
          },
        ],
      },
    })
    if (e4) console.error(`   VIRHE purku: ${e4.message}`)
    else console.log(`   purku luotu omaksi hankkeeksi`)
  }
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
