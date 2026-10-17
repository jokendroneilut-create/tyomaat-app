import { detectCityFromText } from "./detectCityFromText"
import { extractStreetAddress } from "./extractStreetAddress"
import { extractExplicitClient } from "./fetchSttHakuSource"
import { inferBuildingType } from "./buildingType"
import { PHASE_LABELS } from "@/lib/projects/phases"

/*
 * TOIVO GROUPIN TIEDOTTEET.
 *
 * MIKSI. Rakennuslehden kartoitus (`20_YRITYSLAHTEET.md`, 17.10.2026)
 * nosti Toivon parhaaksi yksittäiseksi lähde-ehdokkaaksi: 14 hanketta
 * kannassa, joista **13 jäisi ilman tätä lähdettä** — Toivo toimii usein
 * omana rakennuttajanaan ilman nimettyä rakentajaa, joten hanke ei tule
 * meille kenenkään muun kautta. Johannes 17.10.2026: *"Toivo group
 * kannattaa ottaa lähteeksi, ainakin sijoittajille.toivo.fi löytyy heti
 * tuore hanke ja yritys on muutenkin merkittävä ja aktiivinen."*
 *
 * RAJAPINTA LÖYTYI SELAIMEN VERKKOLIIKENTEESTÄ, JA KOLME UMPIKUJAA
 * ENNEN SITÄ. Nämä on kirjattu, jottei niitä kokeilla uudelleen:
 *
 *   1. `toivo.fi/wp-json/wp/v2/posts` — WordPress, mutta vain 3 juttua
 *      ja uusin 17.1.2025. Blogi, ei hankeuutisia. `kohde`-sisältötyyppi
 *      ei ole REST:ssä (404).
 *   2. `news.cision.com/fi/toivo-group-oyj` — jäsentyy siististi, mutta
 *      **jakelu loppui 18.4.2024**. Cisionin oma syöte (`/feed`,
 *      `mb.cision.com/Public/feed/20566/Releases.xml`) on 404/403.
 *   3. `sijoittajille.toivo.fi/files/content/publications.json` ja sen
 *      pakattu rinnakkaistiedosto `publications_compressed` — molemmat
 *      ovat **vanhaa 2022-aineistoa** (176 riviä, uusin 12.9.2022) eikä
 *      niissä ole leipätekstiä. Sivu lataa ne yhä, mikä johti harhaan.
 *
 * Oikea lähde on IR-sivun Inderes-widgetin oma pilvifunktio. Kaksi
 * päätepistettä: lista ja yhden tiedotteen sisältö.
 *
 * VAATII `origin`- JA `referer`-OTSAKKEEN. Ilman niitä vastaus on
 * `403 not allowed`; pelkkä `referer` ei riitä.
 *
 * Mitattu 17.10.2026: 356 julkaisua, joista `PRESS_RELEASE`-tunnisteella
 * 121 ja viimeisen 12 kk:n sisällä **27**. Tunniste on se joka erottaa
 * hankkeet: omien osakkeiden hankinta on `SHARE_REPURCHASE` ja
 * pörssitiedote `STOCK_EXCHANGE_RELEASE`, eli kohina on tunnisteessa
 * eikä vaadi sanastoa. Sisältö on HTML-kappaleita, esimerkkitiedote
 * 3 002 merkkiä: hankkeen arvo, sijainti, asuntomäärä, kumppani,
 * valmistumisaika ja yhteyshenkilöt puhelinnumeroineen.
 */

/* Widget-tunnus on Toivon oma; se on IR-sivun `pageProps`-oliossa. */
const WIDGET_ID = "toivo-4e1f3143-512d-4ee9-86a2-e9c74fee7484"

const LISTA_API =
  "https://europe-west1-inderes-widgets-prod.cloudfunctions.net/widgetProps/PublicationArchive"
const SISALTO_API =
  "https://europe-west1-inderes-widgets-prod.cloudfunctions.net/widgetData"

const IR_SIVU = "https://sijoittajille.toivo.fi/fi/tiedotteet"

const OTSAKKEET = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  accept: "application/json",
  /* Pilvifunktio tarkistaa molemmat; pelkkä referer antaa 403. */
  referer: IR_SIVU,
  origin: "https://sijoittajille.toivo.fi",
}

const CONCURRENCY = 4

/*
 * 12 KUUKAUDEN IKKUNA, kuten muilla yrityslähteillä. Arkisto alkaa
 * 19.5.2021; vuoden 2021 hanke on historiaa, ei mahdollisuus.
 */
export const IKKUNA_PAIVAA = 365

/* Lehdistötiedote = hankeuutinen. Muut tunnisteet ovat talousviestintää. */
const HANKETUNNISTE = "PRESS_RELEASE"

export type ToivoJulkaisu = {
  id: string
  otsikko: string
  paiva: string
}

export function jasennaLista(vastaus: unknown): ToivoJulkaisu[] {
  const rivit = (vastaus as any)?.props?.publications
  if (!Array.isArray(rivit)) return []

  return rivit
    .filter((p: any) => Array.isArray(p?.tags) && p.tags.includes(HANKETUNNISTE))
    .map((p: any) => ({
      id: String(p?._id ?? "").trim(),
      otsikko: String(p?.title ?? "").replace(/\s+/g, " ").trim(),
      paiva: String(p?.publishedAt ?? "").slice(0, 10),
    }))
    .filter((p) => p.id && p.otsikko && /^\d{4}-\d{2}-\d{2}$/.test(p.paiva))
}

export function onTuore(paiva: string, nyt = new Date()): boolean {
  const ms = new Date(`${paiva}T00:00:00Z`).getTime()
  if (!Number.isFinite(ms)) return false
  return nyt.getTime() - ms <= IKKUNA_PAIVAA * 86_400_000
}

/*
 * LEHDISTÖTIEDOTE EI VIELÄ TARKOITA HANKETTA.
 *
 * Mitattu 12 kuukauden 27 otsikosta: kolme on tulosjulkistuksen kutsuja
 * ("Kutsu Toivo Group Oyj:n vuoden 2026 tammi-kesäkuun
 * liiketoimintakatsauksen julkistukseen") ja yksi rekrytointiuutinen
 * ("rekrytoi useita uusia osaajia liiketoiminnan kasvun seurauksena").
 * Loput 23 ovat konkreettisia kohteita euromäärineen.
 */
const EI_HANKE = new RegExp(
  [
    "kutsu.{0,60}julkistukseen",
    "liiketoimintakatsau",
    "puolivuosikatsau",
    "tilinpäätöstiedote",
    "vuosikertomus",
    "rekrytoi",
    "nimity",
    "johtoryhmä",
    "yhtiökokou",
    "osakeanti",
    "osakkeiden",
    "hallituksen ehdotu",
  ].join("|"),
  "i"
)

/*
 * POSITIIVINEN SIGNAALI VAADITAAN MYÖS, samasta syystä kuin Destialla:
 * pelkkä musta lista kasvaisi loputtomiin. Toivon otsikot ovat
 * poikkeuksellisen kuvailevia, joten signaali löytyy otsikosta.
 */
const HANKESIGNAALI = new RegExp(
  [
    "hank(?:e|keen|etta|keita)",
    "rakennus(?:hanke|kohde|urakka)",
    "rakentaa",
    "rakennetta",
    "aloittanut",
    "aloittaa",
    "käynnistä",
    "käynnistänyt",
    "urakka",
    "urakkasopimu",
    "kerrostalo",
    "asuntoraken",
    "aluerakennu",
    "päiväkoti",
    "päiväkod",
    "hoivakod",
    "toteuttama",
    "toteuttaa",
    "kauppakirja",
    "sopimuksen",
    "solminut",
  ].join("|"),
  "i"
)

export function onHanketiedote(otsikko: string): boolean {
  if (!otsikko) return false
  if (EI_HANKE.test(otsikko)) return false
  return HANKESIGNAALI.test(otsikko)
}

/*
 * Sisältö on HTML-kappaleita. Kuvatekstit ja yhteystietolohko tulevat
 * mukaan, mutta ne eivät haittaa kuvausta — toisin kuin naapuriartikkelit
 * (ks. Rakennuslehden `trimAtArticleEnd`), ne koskevat samaa hanketta.
 */
export function jasennaSisalto(html: string): string {
  return String(html ?? "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;|&#8221;|&#8220;/g, '"')
    .replace(/&#8211;|&#8212;/g, "-")
    .replace(/&(?:rdquo|ldquo);/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim()
}

/*
 * TYYPPIÄ EI SAA PÄÄTELLÄ NAAPURUSTOSTA.
 *
 * Mitattu 17.10.2026: "4,2M€ aluerakennushanke Espoon Mankkaalle" sai
 * tyypin **Koulu**, koska tiedotteessa luki "kahdeksan laadukasta
 * rivitalokotia hienolle paikalle Mankkaan palveluiden ja koulujen
 * välittömään läheisyyteen". Sana "koulujen" oli 56 merkkiä
 * "rivitalokotia"-sanan jälkeen ja voitti.
 *
 * Sama laji virhe kuin D-292:ssa: lahiympariston kuvaus on
 * markkinointitekstia, ei kohteen ominaisuus. Siksi läheisyyttä
 * kuvaavat lauseenosat pudotetaan ennen päättelyä — tekstiä ei
 * muuten kosketa, koska kuvaukseen ne kuuluvat.
 */
const LAHEISYYS = /läheisyy|lähellä|välittömä|naapuri|kävelymatka|palveluiden|palvelujen|yhteyksien/i

export function tyypinTeksti(teksti: string): string {
  /*
   * Lause KATKAISTAAN laheisyyssanasta, ei pudoteta kokonaan. Ensimmainen
   * versio pudotti koko lauseen, ja silloin Mankkaan "rivitalokotia"
   * katosi samalla: tyyppi muuttui vaarasta tyhjaksi. Katkaisu sailyttaa
   * kohteen kuvauksen ja jattaa vain naapuruston pois.
   */
  return String(teksti ?? "")
    .split(/(?<=[.!?])\s+/)
    .map((lause) => {
      const osuma = lause.match(LAHEISYYS)
      return osuma?.index === undefined ? lause : lause.slice(0, osuma.index)
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
}

async function haeLista(): Promise<unknown> {
  const osoite = `${LISTA_API}?publicationLangs=fi&widgetId=${encodeURIComponent(WIDGET_ID)}`
  const vastaus = await fetch(osoite, { cache: "no-store", headers: OTSAKKEET })
  if (!vastaus.ok) {
    throw new Error(
      `Toivon tiedotelistan haku epäonnistui: ${vastaus.status} ${vastaus.statusText}`
    )
  }
  return await vastaus.json()
}

async function haeSisalto(id: string): Promise<string | null> {
  try {
    const osoite = `${SISALTO_API}?type=Publication&publicationId=${encodeURIComponent(id)}`
    const vastaus = await fetch(osoite, { cache: "no-store", headers: OTSAKKEET })
    if (!vastaus.ok) return null
    const data: any = await vastaus.json()
    return typeof data?.content === "string" ? data.content : null
  } catch {
    return null
  }
}

export async function fetchToivoSource() {
  const kaikki = jasennaLista(await haeLista())
  const jono = kaikki.filter((p) => onTuore(p.paiva) && onHanketiedote(p.otsikko))
  const results: any[] = []

  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (jono.length) {
        const p = jono.shift()
        if (!p) break

        const html = await haeSisalto(p.id)
        if (!html) continue

        const teksti = jasennaSisalto(html)
        if (teksti.length < 200) continue

        results.push({
          name: p.otsikko,
          city: detectCityFromText(p.otsikko) ?? detectCityFromText(teksti),
          region: null,
          location: extractStreetAddress(teksti),
          /*
           * Tiedote kertoo hankkeen aloituksesta tai sopimuksesta, ei
           * valmistumisesta. Sama tulkinta kuin muilla urakoitsija- ja
           * rakennuttajalähteillä.
           */
          phase: PHASE_LABELS.contract_awarded,
          description: teksti.slice(0, 4000),
          /*
           * Toivo on julkaisijana itse hankkeen toteuttaja. Tilaaja
           * otetaan vain yksiselitteisestä maininnasta — osassa
           * tiedotteita kohde rakennetaan rahastolle tai kunnalle
           * ("Premicon rahastolle", "Oulun kaupungille").
           */
          builder: "Toivo Group Oyj",
          developer: extractExplicitClient(teksti),
          property_type: inferBuildingType(p.otsikko, tyypinTeksti(teksti)),
          /*
           * KUSTANNUSTA EI ANNETA OMANA KENTTÄNÄÄN. `importCandidate` ei lue
           * `cost_estimate`-kenttää lainkaan, joten arvo olisi pudonnut
           * hiljaisesti. Summa on tiedotteen tekstissä ("noin 7,5
           * miljoonan euron"), ja `resolveProjectCost` poimii sen sieltä
           * tasolla `text`.
           */
          source_url: `${IR_SIVU}?publicationId=${p.id}`,
          confidence: 0.65,
          completed: false,
          source_name: "toivo_tiedotteet",
        })
      }
    })
  )

  return results
}
