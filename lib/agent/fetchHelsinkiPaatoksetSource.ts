import { extractStreetAddress } from "./extractStreetAddress"
import * as cheerio from "cheerio"
import { helsinginYhteyshenkilot } from "./helsinginLisatiedot"
import { inferBuildingType } from "./buildingType"
import { extractDecisionWinners } from "./decisionWinners"
import { inferDecisionPhase } from "./decisionPhase"
import { genericizeDecisionTitle } from "./decisionTitle"
import { stripHtml } from "./stripHtml"

/*
 * Helsingin päätösjärjestelmä (Ahjo) Elasticsearch-proxyn kautta.
 *
 * Tämä lähde kattaa vaiheen jota meillä ei aiemmin ollut: kunnan NIMETYN
 * INVESTOINTIPÄÄTÖKSEN. Hanke on päätetty ja nimetty, mutta ei vielä
 * kilpailutettu — joten se ei näy Hilmassa eikä urakoitsijan tiedotteissa.
 * Aukko löytyi RPT:n hankelistaa läpikäymällä (ks. docs/rpt/README.md):
 * 552 puuttuvasta hankkeesta valtaosa oli juuri tässä vaiheessa.
 *
 * Rajapinta selvitettiin ajamalla haku selaimessa ja tallentamalla
 * fetch-kutsut — vanha Open Ahjo (dev.hel.fi/paatokset/v1) on kuollut, eikä
 * osoite ollut luettavissa minifioidusta bundlesta. Ei vaadi
 * tunnistautumista.
 *
 * Aineisto on poikkeuksellisen hyvä: subject sisältää nimen JA osoitteen,
 * decision_motion on esittelijän perustelut (mitattu 28 192 merkkiä: tausta,
 * tarve, laajuus, kustannus, aikataulu) ja unique_issue_id on pysyvä
 * tunniste täsmäytykseen.
 */
const SEARCH_URL =
  "https://paatokset-elastic-proxy.api.hel.ninja/paatokset_decisions/_search"

/*
 * TUOREUSIKKUNA 3 KK, EI 18 (D-185).
 *
 * Koko ikkuna haetaan joka ajolla ja jokainen osuma kulkee tuonnin läpi.
 * Mitattu 11.9.2026:
 *
 *   18 kk  528 osumaa, 287 kandidaattia   3 kk  68 osumaa
 *
 * Haku itse on nopea (2-5 s), mutta 287 kandidaatista vain 6 oli
 * "jo nähty", koska seen-ikkuna on viikko ja lähde tulee vuoroon 4-6
 * vrk:n välein: yksi myöhästyminen tai kaatuminen vie koko erän ikkunan
 * ulkopuolelle ja kaikki tuodaan uudelleen. Ajo kesti tavallisestikin
 * 72-77 s 90 sekunnin katosta, ja 10.9. se ylitti rajan.
 *
 * MIKSI 3 KK RIITTÄÄ. 13.8. jälkeen luotujen Helsinki-ehdokkaiden päätös
 * oli luontihetkellä enintään 8 vrk vanha (mediaani 2). Lähde tulee
 * vuoroon 4-6 vrk:n välein, joten 3 kk:n ikkunassa jokainen päätös
 * näkyy noin 15 ajossa. Myöhempi päätös samasta hankkeesta on uusi
 * osuma, joten vaiheen eteneminen näkyy edelleen.
 *
 * EI VANHENNUSANSAA. Ikkunasta pudonnut päätös lakkaa päivittämästä
 * dokumenttinsa `last_seen_at`ia, mutta tämän lähteen dokumentit ovat
 * tyyppiä `listing` (309/309), ja listausrivit pidetään aina
 * (`evaluateUnlisted`: listingOnly -> keep). Tarkistettu ennen muutosta,
 * koska juuri tällainen muutos rikkoisi toisen työn huomaamatta (D-184).
 */
const RECENCY_MONTHS = 3

/*
 * Kategoriat ovat lähteen OMA luokittelu, joten suodatus ei nojaa
 * hakusana-arvailuun kuten STT:ssä (D-029). Mitatut määrät koko indeksistä
 * suluissa.
 *
 * Mukaan otetaan vain aito rakentaminen. Ulkopuolelle jäävät tarkoituksella:
 * tonttivuokraukset (4475), tilojen myynti ja vuokraus (3643), tilapäinen
 * käyttö (2633) — nämä eivät ole hankkeita — sekä asemakaavoitus (2450),
 * rakennusluvat (796) ja poikkeamismenettely (874), jotka meillä on jo
 * SUKKA- ja Lupapiste-lähteistä.
 */
export const CATEGORIES = [
  "Rakennusten ja rakennelmien suunnittelu ja toteutus", // 1685
  "Alueiden kohdesuunnittelu, uudisrakentaminen ja peruskorjaus", // 922
  "Maa-alueiden rakentamiskelpoiseksi saattaminen", // 170
  "Purkaminen", // 143
]

/*
 * VIIDES LUOKKA: KILPAILUTUS, VAIN URAKOITSIJAN VALINTA (D-386).
 *
 * Yllä olevat neljä luokkaa kattavat hankkeen SUUNNITTELUPÄÄTÖKSET
 * (tarveselvitys, hankesuunnitelma, katusuunnitelma). Urakoitsijan
 * valinta ei ole niissä — se on omassa luokassaan "Kilpailutus", jota
 * tämä lähde ei hakenut lainkaan. Siksi kannassa oli hankkeita joiden
 * suunnitelma oli tullut meille mutta voittaja ei.
 *
 * Laukaiseva tapaus (Johannes 7.11.2026): Koulupuistikon aukio. Rivi
 * sai katusuunnitelman, mutta infrapäällikön päätös 6.7.2026
 * (HEL 2026-010171, Tieluiska Oy, 1 097 273 €) ei tullut mitään reittiä
 * — ja juuri se on asiakkaalle kiinnostava tieto.
 *
 * MIKSI AUKKO EI TÄYTY MUUALTA. Nämä ovat enimmäkseen
 * minikilpailutuksia puitesopimuksen sisällä, eikä minikilpailutuksesta
 * tehdä Hilma-ilmoitusta. Tieto on vain päätöksessä.
 *
 * SUODATUS ON KOKO TYÖ: 21/382. Mitattu 7.11.2026 kolmen kuukauden
 * ikkunasta: luokassa on 382 asiaa, joista 28 mainitsee otsikossa
 * valinnan ja 21 on urakoitsijan valinta. Loput 361 ovat
 * lisä- ja muutostyötilauksia (62), puitejärjestelyjä, palveluhankintoja,
 * keskeytyksiä ja oikaisuvaatimuksia.
 *
 * SÄÄNTÖ ON OTSIKOSSA, KOSKA PÄÄTÖSLAJI ON OTSIKOSSA. Kunnan otsikko
 * nimeää päätöksen ("…kokonaisurakka, urakoitsijan valinta"), joten
 * leipätekstiä ei tarvitse arvailla. Hyväksytään kolme muotoa, kaikki
 * luettu aineistosta:
 *
 *   urakoitsijan valinta        18  (myös "kokonaisurakoitsijan valinta")
 *   toteuttajan valinta          2  (projektinjohtourakka)
 *   urakoitsijoiden valinta      1
 *
 * ULKONA TARKOITUKSELLA, kaikki mitattuja muotoja samasta ikkunasta:
 *
 *   - "tarjoajien valintapäätös" ja "tarjoajien valinta rajoitettuun
 *     menettelyyn" (4). Tarjoajien valinta on kilpailun AVAAMINEN, ei
 *     urakoitsijan valinta — sama erottelu kuin voittajapoiminnassa,
 *     jossa "tarjoajiksi" ei ole voittajarooli (decisionWinners.ts).
 *   - lisä- ja muutostyötilaukset (62). Nämä koskevat jo tehtyä
 *     sopimusta. Niillä voisi myöhemmin päivittää olemassa olevan rivin
 *     VAIHETTA, mutta uutta riviä niistä ei synny.
 *   - leikki- ja erikoisvälinehankinnat sekä DPS:n toimittajavalinnat
 *     (4). Välinehankinta ei ole rakennushanke.
 *   - hankintaoikaisuvaatimukset (1 valinnasta). Nämä putoavat jo
 *     `EXCLUDE_PATTERNS`in oikaisuvaatimus-kuvioon, ja se on
 *     tarkistettu testillä eikä oletettu.
 *
 * TIEDOSSA OLEVA AUKKO, EI KORJATTAVISSA OTSIKOSTA. Staran johtokunta
 * myöntää urakoita otsikolla joka ei nimeä päätöslajia lainkaan:
 * "Uimastadionin uima-altaiden laatoitusten uusiminen" on
 * 4 039 600 euron urakka Tiilikaari Oy:lle. Näitä ei saa otsikosta, ja
 * ne jäävät edelleen poimimatta (ks. muisti:
 * winner-extraction-open-items).
 */
export const KILPAILUTUS_CATEGORY = "Kilpailutus"

const URAKOITSIJAN_VALINTA = /(?:urakoitsijan|urakoitsijoiden|toteuttajan)\s+valinta/i

/*
 * Kuviot ovat päätöslajeja, eivät yksittäisiä sanoja — samasta syystä
 * kuin `EXCLUDE_PATTERNS`issa. Pelkkä "lisätyö" pudottaisi myös aidon
 * valinnan, jonka otsikossa mainitaan lisätyövaraus; ankkuri on siksi
 * tilaus tai päätös. Aineistossa esiintyy myös lyöntivirhe
 * "lisätyötyötilaus" (Töölönlahden tulvasuojelu), joten toisto on
 * valinnainen.
 */
const KILPAILUTUS_EXCLUDE = [
  /(?:lis[aä]|muutos)ty[oö](?:ty[oö])?(?:tilaus|p[aä][aä]t[oö]s|varaus)/i,
  /varauksen\s+korotus/i,
  /tarjoajien\s+valinta/i,
  /tarjousvaihee/i,
  /\(DPS\)/i,
  /leikkiv[aä]line|erikoisv[aä]line|toimintav[aä]line/i,
]

/*
 * Tosi vain kun hitti tulee pelkästään Kilpailutus-luokasta. Jos
 * päätöksellä on myös rakentamisluokka, se kulkee kuten ennen — ilman
 * tätä ehtoa otsikkosääntö alkaisi karsia rivejä jotka tulevat jo nyt
 * oikein. Tarkistettu indeksistä 7.11.2026: päällekkäisiä luokkia on 0,
 * mutta ehto on silti tässä, koska muuten sääntö rikkoisi toisen työn
 * heti kun luokittelu muuttuu (D-184).
 */
/* Luokka on indeksissä taulukko, mutta yksialkioinen. */
export function paatoksenLuokat(source: any): string[] {
  const raaka = source?.category_name
  return (Array.isArray(raaka) ? raaka : [raaka]).filter(Boolean).map(String)
}

/*
 * ASIAN PÖYDÄLLEPANO EI OLE VALINTA (D-386).
 *
 * Mitattu tapaus on Töölön Kisahalli: luokka Kilpailutus, otsikko
 * "…toteuttajan valinta sekä sopimuksen teko", mutta päätösteksti on
 * *"jaosto päätti panna asian pöydälle"*. Asia siirtyi seuraavaan
 * kokoukseen, eikä urakoitsijaa ole valittu.
 *
 * Ilman tätä syntyisi rivi jonka vaihe on "Sopimus myönnetty" ja hinta
 * 115 M€ — luku on esittelijän *päätösehdotuksesta*, jota jaosto ei
 * hyväksynyt. Esitetty voittaja (Fira Rakennus Oy) voi vielä vaihtua,
 * ja väärä urakoitsija on pahempi kuin tyhjä kenttä
 * (ks. muisti: winner-can-change).
 *
 * TARKISTUS ON ENNEN `seen`-MERKINTÄÄ silmukassa, jotta saman asian
 * aiempi — oikea — päätös pääsee vielä läpi samalla ajolla. Uusin
 * päätös voittaa muuten aina, koska lajittelu on päivän mukaan.
 *
 * KOSKEE VAIN KILPAILUTUSTA. Suunnittelupäätösten pöydällepanoja ei
 * kosketa: niistä ei ole kysytty, ja niiden perustelut sisältävät
 * hankkeen kuvauksen joka on arvokas sellaisenaan.
 */
const POYDALLE =
  /panna\s+asian\s+p[oö]yd[aä]lle|pani\s+asian\s+p[oö]yd[aä]lle|palautti\s+asian\s+uudelleen\s+valmistel/i

export function onPoydallePano(paatosteksti: string): boolean {
  return POYDALLE.test(paatosteksti)
}

/*
 * HANKINNAN ARVO PÄÄTÖKSESTÄ (D-386).
 *
 * Yleinen `extractCostFromText` ei poimi näistä yhtään, ja se on
 * tarkoituksellista: siellä on mitattu, että *hankinta*-sanan summat
 * ovat tiedotteissa väärin (ajoneuvojen huoltoleasing), joten
 * hankinta-ankkuri on jätetty pois. Hankintapäätöksessä sama lause on
 * päinvastoin kaikkein luotettavin tieto: se on juuri se summa josta
 * päätetään.
 *
 * Siksi summa poimitaan TÄSSÄ, lähdekohtaisesti, ja kirjataan
 * `contract_value`-kenttään — ei `estimated_cost`iin. Se on sama laji
 * kuin Hilman sopimusarvo, ja `resolveProjectCost` antaa sille
 * korkeamman arvon kuin tekstistä arvatulle luvulle muttei ylitä käsin
 * annettua (ks. muisti: matched-overwrites-fields).
 *
 * KOLME MUOTOA, LUETTU 21 VALINNASTA 7.11.2026:
 *
 *   "Hankinnan arvo on 1 563 700 euroa (alv 0 %)"            18
 *   "arvonlisäverottomaan kokonaishintaan 8 333 000 euroa"     1
 *   "…projektinjohtourakan tavoitehintaan 15 720 744,34 e."    1
 *   (21. on yllä mainittu pöydällepano, jossa summaa ei ole)
 *
 * TARJOUSVERTAILU ON ULKONA ILMAN ERILLISTÄ SÄÄNTÖÄ, koska ankkuri on
 * lauseessa eikä läheisyydessä: häviäjien hinnat luetellaan muodossa
 * "VM Suomalainen Oy 1 785 000 euroa", jossa ei ole ankkurisanaa. Sama
 * koskee suunnittelijan kustannusarviota ("Suunnittelijan laatima
 * kustannusarvio urakasta on 286 936,16 euroa"), joka on urakkahintaa
 * PIENEMPI eikä kerro sopimuksen arvoa.
 */
const SUMMA = "(\\d[\\d   .]*(?:,\\d+)?)\\s*(?:euroa|euron|€)"

const ARVO_ANKKURIT = [
  new RegExp(`hankinnan\\s+arvo\\s+on\\s+${SUMMA}`, "i"),
  new RegExp(
    `arvonlis[aä]verotto\\w*\\s+(?:[a-zåäö-]+\\s+){0,3}?(?:kokonais|tavoite|urakka)hintaan\\s+${SUMMA}`,
    "i"
  ),
]

export function hankinnanArvo(paatosteksti: string): number | null {
  for (const ankkuri of ARVO_ANKKURIT) {
    const osuma = paatosteksti.match(ankkuri)
    if (!osuma) continue
    /*
     * Ryhmittelijä voi olla väli, sitkeä väli tai piste; desimaalierotin
     * on pilkku. Sama normalisointi kuin `extractCostFromText`issa.
     */
    const luku = Number(
      String(osuma[1] ?? "")
        .replace(/[\s  .]/g, "")
        .replace(",", ".")
    )
    if (!Number.isFinite(luku) || luku < 1000) continue
    return Math.round(luku)
  }
  return null
}

export function kilpailutusHyvaksytaan(
  subject: string,
  categories: string[]
): boolean {
  const onRakentamisluokka = categories.some((c) => CATEGORIES.includes(c))
  if (onRakentamisluokka) return true
  if (!categories.includes(KILPAILUTUS_CATEGORY)) return true

  if (!URAKOITSIJAN_VALINTA.test(subject)) return false
  return !KILPAILUTUS_EXCLUDE.some((re) => re.test(subject))
}

/* Tuleeko hitti pelkästään Kilpailutus-luokasta? */
export function onKilpailutusluokka(source: any): boolean {
  const luokat = paatoksenLuokat(source)
  return (
    luokat.includes(KILPAILUTUS_CATEGORY) &&
    !luokat.some((c) => CATEGORIES.includes(c))
  )
}

/*
 * Kategoriasuodatus jättää läpi hallinnollisia päätöksiä jotka eivät ole
 * hankkeita. Mitattu otoksesta: 80 % kohinaa, ja se keskittyi muutamaan
 * toistuvaan muotoon.
 *
 * Kuviot ovat tarkkoja eivätkä yksittäisiä sanoja: "korvaus" yksin pudottaisi
 * myös aidon hankkeen "Suutarilan kirjaston KORVAAVAN uudisrakennuksen
 * hankesuunnitelma" - malli teki mitatusti juuri tuon virheen.
 */
const EXCLUDE_PATTERNS = [
  /tontille\s+maksettava\s+korvaus/i,
  /kustannusten\s+korvaaminen/i,
  /vahingonkorvau/i,
  /^\s*lausunto\b/i,
  /\blausunto\s+osoitteess/i,
  /aamukouluasia/i,
  /oikaisuvaatimu/i,
  /valitus\b/i,
  /\bvuokrasopimu/i,
  /määräalan\s+myynti/i,
]

export function shouldExclude(subject: string): boolean {
  return EXCLUDE_PATTERNS.some((re) => re.test(subject))
}

const PAGE_SIZE = 100
const MAX_PAGES = 20

/*
 * Vaihe päätellään otsikosta. Kunnan päätösketju on vakiintunut:
 * tarveselvitys -> hankesuunnitelma -> toteutussuunnitelma -> urakka.
 */
export function inferPhase(subject: string): string {
  const text = subject.toLowerCase()
  if (/urakka|urakoitsij|toteutussopimus/.test(text)) return "Sopimus myönnetty"
  if (/toteutussuunnitel|rakentamispäätös/.test(text)) return "Rakennuslupa"
  if (/hankesuunnitel/.test(text)) return "Suunnittelussa"
  if (/tarveselvit/.test(text)) return "Suunnittelu"
  return "Suunnittelussa"
}

/*
 * Perustelut ovat pitkiä ja alkavat vakiofraasilla. Kuvaukseen otetaan
 * päätösteksti ja perustelut yhdessä, koska päätösteksti yksin on usein
 * pelkkä "hyväksyi esityksen mukaisesti" - mitattu 704 merkkiä vs. 28 192.
 */
function buildDescription(content: string, motion: string): string | null {
  const parts = [stripHtml(content), stripHtml(motion)]
    .map((p) => p.trim())
    .filter((p) => p.length > 0)

  const joined = parts.join(" ").replace(/\s+/g, " ").trim()
  return joined || null
}

/*
 * Ahjon `meeting_date` on unix-sekunteina, mutta aineistossa esiintyy myös
 * valmiiksi ISO-muotoinen merkkijono. Molemmat kelpaavat; mikä tahansa muu
 * palauttaa null, koska väärä päätöspäivä olisi pahempi kuin puuttuva -
 * sen perusteella hanke voitaisiin todeta vanhentuneeksi.
 */
export function toIsoDate(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value > 1e11 ? value : value * 1000
    const date = new Date(ms)
    if (Number.isNaN(date.getTime())) return null
    return date.toISOString().slice(0, 10)
  }

  if (typeof value === "string") {
    const iso = value.match(/^(\d{4}-\d{2}-\d{2})/)
    if (iso) return iso[1]

    const numeric = Number(value)
    if (Number.isFinite(numeric) && numeric > 0) return toIsoDate(numeric)
  }

  return null
}

/*
 * YHTEYSHENKILO PAATOSSIVULTA (D-240).
 *
 * Hakurajapinnassa on 29 kenttaa eika yhtaan yhteystietoa, joten
 * projektipaallikon nimi, puhelin ja sahkoposti ovat vain
 * paatossivulla. Mitattu 6.10.2026: 25 sivun otoksesta **jokaisella**
 * oli henkilo — ja samaan aikaan 519 hanketta 524:sta oli kannassa
 * ilman yhteyshenkiloa. Tama oli koko kannan suurin yksittainen puute.
 *
 * BUDJETTI, KOSKA SIVUHAKU MAKSAA AIKAA. Yksi sivu vastaa noin
 * puolessa sekunnissa, ja ajossa on muitakin lahteita. Loput jaavat
 * seuraavaan ajoon — toisin kuin Lupapisteen kuulutukset,
 * paatokset.hel.fi on pysyva arkisto eika sivu katoa (D-237).
 */
const YHTEYSHENKILO_BUDJETTI = 30

async function haeYhteyshenkilot(url: string) {
  try {
    const vastaus = await fetch(url, {
      cache: "no-store",
      headers: { "user-agent": "Mozilla/5.0 (compatible; tyomaat.fi/1.0)" },
    })
    if (!vastaus.ok) return []

    const $ = cheerio.load(await vastaus.text())
    return helsinginYhteyshenkilot($("body").text().split(/\s+/g).join(" "))
  } catch {
    return []
  }
}

/*
 * YKSI PAIKKA JOSSA EHDOKAS RAKENNETAAN.
 *
 * Erotettu silmukasta siksi, etta kuivaharjoitus
 * (`scripts/kuivaharjoitus-helsingin-kilpailutus.ts`) ajaa saman koodin
 * kuin tuotanto. Jos skripti rakentaisi ehdokkaan itse, luettu rivi ei
 * todistaisi mitaan kirjoitettavasta rivista
 * (ks. muisti: metric-shares-parser-blind-spot).
 */
export function paatoksenOsoite(source: any): string {
  const first = (v: unknown) => (Array.isArray(v) ? v[0] : v)
  const relativeUrl = String(first(source.decision_url) ?? "").trim()
  return relativeUrl.startsWith("http")
    ? relativeUrl
    : `https://paatokset.hel.fi${relativeUrl}`
}

export type PaatosYhteyshenkilo = {
  nimi: string
  nimike: string | null
  sahkoposti: string | null
  puhelin: string | null
}

export function paatoksestaEhdokas(
  source: any,
  yhteyshenkilot: PaatosYhteyshenkilo[] = []
) {
  const first = (v: unknown) => (Array.isArray(v) ? v[0] : v)
  const s = source
  const subject = String(first(s.subject) ?? "").trim()
  const issueId = String(
    first(s.unique_issue_id) ?? String(first(s.decision_url) ?? "")
  )
  const paatosUrl = paatoksenOsoite(s)

  const description = buildDescription(
    String(first(s.decision_content) ?? ""),
    String(first(s.decision_motion) ?? "")
  )

  const winners = extractDecisionWinners(description)
  const sopimusarvo = onKilpailutusluokka(s) ? hankinnanArvo(description ?? "") : null

  return {
        /*
         * PÄÄTÖSPÄIVÄ TALTEEN. `meeting_date` on haettu ES-vastauksessa
         * alusta asti (suodatus ja lajittelu käyttävät sitä), mutta sitä
         * ei ole tallennettu mihinkään. Ilman sitä emme tiedä milloin
         * päätös tehtiin - vain milloin ME näimme sen, eli vuonna 2021
         * tehty päätös näyttää tuoreelta jos se tuotiin kantaan tänään.
         *
         * Mitattu 12.8.2026: jonossa oli 108 riviä joiden asiatunnus on
         * vuodelta 2021 tai vanhempi, eikä ikää voinut mitata muuten kuin
         * arvaamalla asiatunnuksen vuodesta tai leipätekstistä.
         */
        metadata: {
          decision_date: toIsoDate(first(s.meeting_date)),
          /*
           * Sopimusarvo vain urakoitsijan valinnasta: suunnittelupäätöksen
           * summa on arvio eikä sopimus, ja se tulee jo kuvauksesta
           * yleisellä poimijalla.
           */
          ...(sopimusarvo ? { contract_value: sopimusarvo } : {}),
          /*
           * AVAIN ON `contact_persons`, EI `contacts`. Ensimmainen versio
           * kaytti jalkimmaista (kuten kaavakerain apiCollectorissa), ja
           * se olisi mennyt kantaan mutta ei nakyviin: metadata
           * yhdistetaan sellaisenaan, eika mikaan lue `contacts`-avainta
           * legacy-polulla. Tarkistettu kannasta: stt_haku, rakennuslehti
           * ja are kayttavat kaikki `contact_persons`.
           */
          ...(yhteyshenkilot.length
            ? {
                contact_persons: yhteyshenkilot.map((h) => ({
                  kind: "person" as const,
                  name: h.nimi,
                  title: h.nimike,
                  email: h.sahkoposti,
                  phone: h.puhelin,
                  organization: "Helsingin kaupunki",
                })),
              }
            : {}),
        },
        name: genericizeDecisionTitle(subject),
        description,
        city: "Helsinki",
        region: "Uusimaa",
        /*
         * Osoite on tyypillisesti otsikon sulkeissa: "…perusparannuksen
         * hankesuunnitelma (Kenttäkuja 12, Pukinmäki)". Varalla koko
         * kuvaus.
         */
        location:
          extractStreetAddress(subject) ?? extractStreetAddress(description),
        developer: "Helsingin kaupunki",
        /*
         * Asiatunnus (HEL-2025-008563) on pysyvä ja yksilöivä, joten se
         * kelpaa tunnisteeksi täsmäytyksessä.
         */
        permit_number: issueId,
        property_type: inferBuildingType(subject, description),
        winners,
        /*
         * Helsingin otsikkopäättely on rikkaampi kuin muiden (hankesuunnitelma,
         * tarveselvitys, rakentamispäätös), joten se jää varalle sellaisenaan.
         */
        phase: inferDecisionPhase({
          description,
          hasWinner: winners.length > 0,
          fallback: inferPhase(subject),
          title: subject,
        }),
        business_value: "high",
        source_url: paatosUrl,
        confidence: 0.6,
        completed: false,
        source_name: "helsinki_paatokset",
  }
}

export async function fetchHelsinkiPaatoksetSource() {
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - RECENCY_MONTHS)

  /*
   * TUOREUSRAJA ISO-MUODOSSA, EI SEKUNTEINA.
   *
   * `meeting_date` on indeksissä date-kenttä, ja Elasticsearch tulkitsee
   * paljaan luvun EPOCH-MILLISEKUNNEIKSI. Sekunteina annettu raja
   * (1 739 401 512) tarkoitti sille 21.1.1970, joten se ei rajannut mitään:
   * mitattu 12.8.2026, sama kysely ilman suodatinta ja sekuntirajalla
   * palautti kummallakin 143 318 osumaa ja vanhin oli 23.1.2015.
   *
   * Rajan ei siis pitänyt vuotaa hieman - se ei ollut voimassa lainkaan,
   * ja lähde toi jonoon vuoteen 2015 asti vanhoja päätöksiä. Tämä on
   * suora syy siihen että jonossa oli 2021-vuoden asioita.
   *
   * ISO-merkkijono on yksiselitteinen eikä riipu yksikkötulkinnasta.
   * Mitattu korjauksen jälkeen: 25 943 osumaa, vanhin 13.2.2025.
   */
  const cutoffIso = cutoff.toISOString()

  const results: any[] = []
  const seen = new Set<string>()
  let yhteyshenkiloHaettu = 0

  for (let page = 0; page < MAX_PAGES; page++) {
    let hits: any[] = []
    try {
      const res = await fetch(SEARCH_URL, {
        method: "POST",
        cache: "no-store",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "user-agent": "Mozilla/5.0 (compatible; tyomaat.fi/1.0)",
        },
        body: JSON.stringify({
          query: {
            bool: {
              filter: [
                { terms: { category_name: [...CATEGORIES, KILPAILUTUS_CATEGORY] } },
                { range: { meeting_date: { gte: cutoffIso } } },
              ],
            },
          },
          _source: [
            "subject",
            "issue_subject",
            "decision_content",
            "decision_motion",
            "decision_url",
            "organization_name",
            "meeting_date",
            "unique_issue_id",
            "category_name",
          ],
          /*
           * JARJESTYKSELLE RATKAISIJA, MUUTEN SIVUTUKSESTA KATOAA RIVEJA
           * (sama vika kuin D-358).
           *
           * Kokouspaiva on sama kymmenilla paatoksilla, joten pelkka
           * `meeting_date desc` jattaa jarjestyksen maaraamattomaksi ja
           * `from`-sivutus voi antaa saman rivin kahdesti ja toisen ei
           * kertaakaan. Tama EI ole teoreettista: Kilpailutus-luokan
           * kuivaharjoituksessa 7.11.2026 Kipparlahden laiturin valinta
           * katosi kokonaan kahden ajon valilla, ja mittaus koko
           * ikkunan yli vahvisti syyn:
           *
           *   sivukoko 100  460 osumaa -> 460 uniikkia
           *   sivukoko  50  460 osumaa -> 458 uniikkia, 2 duplikaattia
           *
           * Ratkaisijalla molemmat antavat 460/460. Asiatunnus ei ole
           * taysin uniikki (sama asia saa useita paatoksia), joten
           * paatoksen osoite on viimeisena.
           */
          sort: [
            { meeting_date: "desc" },
            { unique_issue_id: "asc" },
            { decision_url: "asc" },
          ],
          size: PAGE_SIZE,
          from: page * PAGE_SIZE,
        }),
      })
      if (!res.ok) break
      const json = await res.json()
      hits = json?.hits?.hits ?? []
    } catch {
      break
    }

    if (hits.length === 0) break

    for (const hit of hits) {
      const s = hit?._source ?? {}
      const first = (v: unknown) => (Array.isArray(v) ? v[0] : v)

      const subject = String(first(s.subject) ?? "").trim()
      const relativeUrl = String(first(s.decision_url) ?? "").trim()
      if (!subject || !relativeUrl) continue

      if (shouldExclude(subject)) continue
      if (!kilpailutusHyvaksytaan(subject, paatoksenLuokat(s))) continue
      if (
        onKilpailutusluokka(s) &&
        onPoydallePano(String(first(s.decision_content) ?? ""))
      ) {
        continue
      }

      /*
       * Sama asia saa useita päätöksiä (esittely, päätös, muutoksenhaku).
       * unique_issue_id pitää ne yhtenä hankkeena - ilman tätä sama koulu
       * tulisi jonoon kolmesti.
       */
      const issueId = String(first(s.unique_issue_id) ?? relativeUrl)
      if (seen.has(issueId)) continue
      seen.add(issueId)

      const paatosUrl = paatoksenOsoite(s)

      const yhteyshenkilot =
        yhteyshenkiloHaettu < YHTEYSHENKILO_BUDJETTI
          ? await haeYhteyshenkilot(paatosUrl)
          : []
      if (yhteyshenkiloHaettu < YHTEYSHENKILO_BUDJETTI) yhteyshenkiloHaettu += 1

      results.push(paatoksestaEhdokas(s, yhteyshenkilot))
    }

    if (hits.length < PAGE_SIZE) break
  }

  return results
}
