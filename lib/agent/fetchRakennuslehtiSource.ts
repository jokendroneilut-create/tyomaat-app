import { extractReleaseBody } from "./companyRelease"
import { detectCityFromText } from "./detectCityFromText"
import { getMunicipalityByName } from "@/lib/geo/municipalities"
import { builderFromHeadline } from "./builderFromHeadline"
import { mergeCompanyNames } from "@/lib/projects/projectCompanies"
import { LEAD_LENGTH } from "./buildingType"

/*
 * Rakennuslehti (rakennuslehti.fi/feed) — alan uutislehden RSS. Kattaa juuri
 * ne isot yksityishankkeet (datakeskukset, tehtaat, toimitilat, sillat,
 * sähköasemat) jotka jäävät Hilman ja kaavalähteiden ulkopuolelle, koska
 * rakennuttaja on yksityinen eikä kilpailuta julkisesti.
 *
 * Syöte sisältää myös runsaasti kohinaa (yrityskaupat, osavuosikatsaukset,
 * suhdanneluvut, mielipiteet), joten suodatus on tiukka: otsikossa/kuvauksessa
 * on oltava selvä KONKREETTINEN rakennushanke-signaali EIKÄ yhtään poissulkevaa
 * talous-/yrityskauppa-/mielipidetermiä. Kaupunki päätellään tekstistä
 * (detectCityFromText, taivutukset mukana); jos ei löydy, jää tyhjäksi ja
 * ihminen täyttää. Confidence matala (0.5) — vapaamuotoinen uutinen,
 * tarkistetaan TIC:issä. Sama muoto kuin muut yrityslähteet (sources.ts).
 */

const FEED_URL = "https://www.rakennuslehti.fi/feed/"

// Konkreettinen rakennushanke — vähintään yhden oltava mukana.
const PROJECT_KEYWORDS = [
  "rakentaa",
  "rakennetaan",
  "rakennuttaa",
  "rakennushanke",
  "rakennustyöt",
  "rakennusurakka",
  "toteuttaa",
  "urakoi",
  "urakan",
  "urakka",
  "urakalle",
  "saneeraus",
  "peruskorjaus",
  "esirakenta",
  "datakeskus",
  "konesali",
  "tuotantolaitos",
  "tehdas",
  "tehtaan",
  "logistiikkakesk",
  "kerrostalo",
  "asuinkortteli",
  "asuntoja",
  "toimitilahanke",
  "toimitilat",
  "hotelli",
  "kampus",
  "sähköasema",
  "silta ",
  "tunneli",
  "laituri",
  "tiehank",
  "raitiotie",
  "ratikk",
  "päiväkoti",
  "hoivakoti",
  "uusi koulu",
  "kouluhanke",
  "sairaala",
  "kunnantoimisto",
]

// Poissulkevat termit — pudottavat vaikka jokin hanketermi osuisi
// (yrityskaupat, talousluvut, suhdanteet, mielipiteet, tapahtumat, henkilöuutiset).
const EXCLUDE_KEYWORDS = [
  "yrityskaup",
  "yritysost",
  "ostaa",
  "osti ",
  "myynnille",
  "myy tytär",
  "liikevaihto",
  "liikevaihdon",
  "liiketulos",
  "tilauskanta",
  "tilauskerty",
  "tilauskirja",
  "osavuosikats",
  "kvartaal",
  "neljänneksel",
  "vuosineljänn",
  "tulosohjeistus",
  "tulosvaroitus",
  "luottamus",
  "suhdann",
  "tilastokeskus",
  "hintaindeksi",
  "kustannusindeksi",
  "kustannukset nousi",
  "mielipide",
  "pääkirjoitus",
  "kolumni",
  "asiantuntija:",
  "tunnustus",
  "palkinto",
  "palkittiin",
  "maailmanperint",
  "messut",
  "mallitalo",
  "työntekijämäärä",
  "irtisano",
  "lomautt",
  "yt-neuvott",
  "konkurss",
  "nimitys",
  "uusi toimitusjohtaja",
]

const COMPLETED_KEYWORDS = [
  "valmistui",
  "valmistunut",
  "otettu käyttöön",
  "avattiin",
  "vihittiin käyttöön",
]

function getTagValue(item: string, tag: string): string | undefined {
  const match = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"))
  return match?.[1]
    ?.replace(/<!\[CDATA\[/g, "")
    .replace(/\]\]>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#8211;/g, "–")
    .replace(/&#8221;|&#8220;/g, '"')
    .replace(/\s+/g, " ")
    .trim()
}

export async function fetchRakennuslehtiSource() {
  const results: any[] = []

  const response = await fetch(FEED_URL, {
    cache: "no-store",
    headers: { "user-agent": "Mozilla/5.0 (compatible; tyomaat.fi/1.0)" },
  })
  if (!response.ok) {
    throw new Error(
      `Rakennuslehden syötteen haku epäonnistui: ${response.status} ${response.statusText}`
    )
  }

  const xml = await response.text()
  const items = xml.match(/<item[\s\S]*?<\/item>/gi) || []

  for (const item of items) {
    const title = getTagValue(item, "title") || ""
    const link = getTagValue(item, "link") || ""
    const description = getTagValue(item, "description") || null

    if (!title || !link) continue

    const haystack = `${title} ${description ?? ""}`.toLowerCase()

    if (!PROJECT_KEYWORDS.some((k) => haystack.includes(k))) continue
    if (EXCLUDE_KEYWORDS.some((k) => haystack.includes(k))) continue

    const completed = COMPLETED_KEYWORDS.some((k) => haystack.includes(k))
    const city = detectCityFromText(haystack)
    const region = city ? getMunicipalityByName(city)?.region ?? null : null

    results.push({
      name: title,
      description,
      /*
       * Urakoitsija jo syotevaiheessa silloin kun otsikko ja ingressi
       * riittavat; rikastus taydentaa loput leipatekstista.
       */
      builder: builderFromHeadline(title, description),
      city, // valtakunnallinen syöte -> ei oletuskaupunkia; null jos ei tunnisteta
      region,
      location: null,
      phase: completed ? "Valmistunut" : "Suunnittelussa",
      source_url: link,
      confidence: 0.5,
      completed,
      source_name: "rakennuslehti",
    })
  }

  return results
}

/*
 * ARTIKKELIN LEIPÄTEKSTI RSS-INGRESSIN TILALLE.
 *
 * RSS antaa vain ingressin: mitattu 14.8.2026 "Nyab rakentaa sähköaseman
 * Forssaan" -rivillä kuvaus oli 56 merkkiä ("Rakentaminen alkaa
 * elokuussa ja valmista on vuonna 2028."). Artikkelin alusta löytyy
 * kaikki olennainen:
 *
 *   "Infrarakentaja Nyab on sopinut kantaverkkoyhtiö Fingridin kanssa
 *    Pikkumuolaan 400 kilovoltin sähköaseman rakentamisesta Forssassa.
 *    Projekti käynnistyy elokuussa 2026 ja valmistuu vuoden 2028 lopussa."
 *
 * eli urakoitsija, tilaaja, kohde, sijainti ja aikataulu.
 *
 * ARTIKKELI ON KATKAISTAVA. Sivulla on jutun jälkeen lista MUIDEN
 * artikkelien otsikoita ("Luetuimmat artikkelit: Fira rakentaa ison
 * datakeskuksen hollantilaisyhtiölle..."). Ilman katkaisua ne päätyisivät
 * hankkeen kuvaukseen - sama saaste joka tuotti vääriä kohdetyyppejä ja
 * kustannuksia muissa lähteissä.
 *
 * MAKSUMUURI EI OLE AINOA RAJA. Maksuttomissa jutuissa ei ole
 * kirjautumiskehotusta lainkaan, jolloin poiminta jatkui uutislistaan
 * asti: "Härmälänojan silta" venyi 4 000 merkkiin ja loppuosa oli
 * naapuriartikkelien otsikoita ("Rakennusteholle iso OSAO-urakka",
 * "Tekovalta liikekompleksi Ouluun"). Nuo ovat yritysnimiä ERI
 * hankkeista, eli juuri sitä evidenssiä jota urakoitsijapoiminta lukee.
 * Siksi mukana ovat myös lehden omat palkit.
 */
const ARTICLE_END_MARKERS = [
  "Tämä artikkeli on tilaajille",
  "Kirjaudu sisään",
  "Luetuimmat artikkelit",
  "Hyödynnä 1kk",
  "Tilaa Rakennuslehti",
  "Lue uusin lehti",
  "Tilaa uutiskirje",
  "Tuoreimmat uutiset",
]

export function trimAtArticleEnd(text: string): string {
  let cut = text.length
  for (const marker of ARTICLE_END_MARKERS) {
    const at = text.indexOf(marker)
    if (at >= 0 && at < cut) cut = at
  }
  return text.slice(0, cut).trim()
}

export async function enrichRakennuslehtiCandidate(candidate: any): Promise<any> {
  if (!candidate?.source_url) return candidate

  try {
    const res = await fetch(candidate.source_url, {
      cache: "no-store",
      headers: { "user-agent": "Mozilla/5.0 (compatible; tyomaat.fi/1.0)" },
    })
    if (!res.ok) return candidate

    const body = trimAtArticleEnd(extractReleaseBody(await res.text()) ?? "")

    /*
     * Lyhyempi kuin RSS:n ingressi tarkoittaa että poiminta epäonnistui;
     * silloin pidetään se mitä oli.
     */
    if (body.length <= String(candidate.description ?? "").length) return candidate

    return { ...candidate, ...poiminnatTekstista(candidate, body), description: body }
  } catch {
    return candidate
  }
}

/*
 * KAUPUNKI JA URAKOITSIJA LUETAAN VASTA LEIPÄTEKSTISTÄ (D-214).
 *
 * `fetchRakennuslehtiSource` päättelee kaupungin RSS-syötteen otsikosta ja
 * ingressistä. Ne ovat usein liian lyhyitä: mitattu esimerkki 23.9.2026,
 * "Are sai viiden miljoonan talotekniikkaurakan kouluhankkeesta" - otsikko
 * ei nimeä kaupunkia lainkaan, artikkelin ensimmäinen virke nimeää sekä
 * kaupungin että urakoitsijan ("Talotekniikkayritys Are on saanut
 * talotekniikkaurakan Halkokarin koulu- ja päiväkotihankkeesta
 * Kokkolassa"). Hanke jäi jonoon ilman maakuntaa, kaupunkia ja yritystä.
 *
 * Kaupunki on myös duplikaattitunnistuksen ehto: täsmäytys vaatii saman
 * kaupungin, joten ilman sitä sama hanke toisesta lähteestä ei löydy.
 *
 * VAIN TÄYDENNETÄÄN. Jos syöte ehti jo päätellä kentän, se säilyy -
 * ingressi on lähempänä otsikkoa ja siten harvemmin naapurihankkeesta.
 */
/*
 * SIVU-URAKAN SAAJA EI OLE PAAURAKOITSIJA.
 *
 * "Are sai viiden miljoonan talotekniikkaurakan" ja "Kreate sai
 * tasoristeysten poistourakan" ovat sama otsikkomuoto mutta eri rooli:
 * Kreate on hankkeen paaurakoitsija, Are yksi urakoitsija muiden joukossa.
 * Mitattu esimerkki: Aren omassa tiedotteessa lukee "Hankkeen
 * paaurakoitsijana toimii Lujatalo Oy".
 *
 * Vaara rooli on pahempi kuin puuttuva tieto, koska urakoitsijakenttaa
 * kaytetaan kilpailija-analyysiin. Sivu-urakan saaja menee siksi
 * `related_companies`-listaan - sama ratkaisu kuin suunnittelijalla
 * (`companyRelease.ts`, role "designer").
 *
 * Oma kuvio eika `detectTrades`: se vaatii lajin olevan urakkasanan alku
 * ("sahkourakka"), eika tunne talotekniikkaa lainkaan. Urakkalajien
 * taksonomia ohjaa duplikaattien vetoja, joten sita ei muuteta tata varten.
 */
const SIVUURAKKA =
  /taloteknii|\blvi\b|\blvia\b|\blvis\b|putkiurak|ilmanvaihtourak|sahkourak|sähköurak|automaatiourak|maalausurak|kattourak|viherurak/i

export function poiminnatTekstista(
  candidate: any,
  body: string
): Record<string, any> {
  const lisat: Record<string, any> = {}

  if (!candidate?.city) {
    /*
     * OTSIKKO ENSIN, SITTEN INGRESSI - EI KOKO ARTIKKELIA.
     *
     * Jutun loppuosa siteeraa johtajia ja kertoo yrityksen muista
     * kohteista. Mitattu 25.9.2026 kuivaharjoituksessa: "Kajaanilainen
     * datakeskus rakentuu vahvasti paikallisin voimin" sai kaupungikseen
     * Lahden. Sama raja kuin osapuolten poiminnassa (LEAD_LENGTH).
     */
    const city =
      detectCityFromText(String(candidate?.name ?? "").toLowerCase()) ??
      detectCityFromText(body.slice(0, LEAD_LENGTH).toLowerCase())
    if (city) {
      lisat.city = city
      if (!candidate?.region) lisat.region = getMunicipalityByName(city)?.region ?? null
    }
  }

  const yritys = candidate?.builder
    ? null
    : builderFromHeadline(candidate?.name ?? null, body)

  if (yritys && !SIVUURAKKA.test(String(candidate?.name ?? ""))) {
    lisat.builder = yritys
  } else if (yritys) {
    const ennen: string[] = Array.isArray(candidate?.metadata?.related_companies)
      ? candidate.metadata.related_companies
      : []
    const jalkeen = mergeCompanyNames(ennen, [yritys])

    /* Ei ehdoteta muutosta jos yritys on jo listalla. */
    if (jalkeen.length !== ennen.length) {
      lisat.metadata = { ...(candidate?.metadata ?? {}), related_companies: jalkeen }
    }
  }

  return lisat
}
