import { extractStreetAddress } from "./extractStreetAddress"
import { inferBuildingType } from "./buildingType"
import { extractDecisionWinners } from "./decisionWinners"
import { inferDecisionPhase, phaseFromTitle } from "./decisionPhase"

/*
 * Dynasty-päätösjärjestelmä (Innofactor), käytössä kahdeksalla kunnalla
 * oncloudos.com-alustalla. Polut ovat identtiset ja vain verkkotunnus
 * vaihtuu, joten yksi jäsentäjä kattaa ne kaikki.
 *
 * Kattaa saman vaiheen kuin Helsingin lähde: kunnan nimetyn
 * investointipäätöksen, joka ei näy Hilmassa eikä urakoitsijan tiedotteissa.
 *
 * RSS SÄÄSTI LÄPIKÄYNNIN. Ensin kartoitin ketjun toimielimet -> kokoukset ->
 * asialistat -> asiat, mikä olisi ollut ~230 pyyntöä per kunta. Asian sivulta
 * löytyi kuitenkin RSS-linkki, ja se palauttaa jopa 1000 tuoreinta asiaa
 * YHDELLÄ pyynnöllä. Dynasty on siis yhtä halpa kuin Helsingin
 * Elasticsearch-haku.
 *
 * Hakutoimintoa alustalla ei ole: page=search, fsearch, search_start ja
 * asiakirjahaku palauttavat kaikki nolla tavua.
 */

const RSS_ITEMS = 1000
const RECENCY_MONTHS = 18

/*
 * Kuvaus haetaan asian omalta sivulta, koska RSS:n description on vain
 * otsikon toisinto. Määrä on rajattu per ajo samaan tapaan kuin Oulun
 * kaavakerääjässä: jono purkautuu useamman ajon aikana eikä yksi kunta syö
 * koko aikabudjettia.
 */
const MAX_DETAIL_FETCHES_PER_RUN = 60

/*
 * Asialistat ovat täynnä hallinnollisia vakioasioita ("Kokouksen laillisuuden
 * toteaminen", "Pöytäkirjan tarkastajien valinta"), joten suodatus tehdään
 * positiivisella listalla kuten STT:ssä (D-029). Poissulkulista ei riittäisi:
 * poissuljettavia aiheita on ääretön määrä, rakentamisen sanastoa ei.
 */
export const CONSTRUCTION_SIGNALS = [
  "hankesuunnitel",
  "tarveselvit",
  "toteutussuunnitel",
  "rakentamissuunnitel",
  "uudisrakenn",
  "peruskorja",
  "perusparann",
  "laajennu",
  "purkami",
  "purku-urak",
  "urakka",
  "urakoits",
  "urakkasopimu",
  "investointiohjelma",
  "rakennuttami",
  "koulun rakent",
  "päiväkodin rakent",
  "monitoimital",
  "liikuntahalli",
  "uimahalli",
  "katusuunnitel",
  "siltasuunnitel",
  "kunnallistekni",
  /*
   * Kolme viimeista lisattiin kun sama lista otettiin kayttoon CaseM:ssa.
   * Ne loytyivat mittaamalla mita positiivinen lista karsii vaarin: ilman
   * niita jaivat pois "Pirkkala-Linnainmaa -raitiotien allianssisopimus"
   * (Tampere), "Lentokenttaalueen rakennushanke" (Pori) ja "Neljan tuulen
   * koulun toteutusmuoto" (Rovaniemi) - kaikki aitoja hankepaatoksia.
   */
  "allianssisopimu",
  "rakennushank",
  "toteutusmuoto",
]

/*
 * Vakioasiat jotka läpäisisivät positiivisen listan mutta eivät ole
 * hankkeita: lausunnot, oikaisuvaatimukset ja viranhaltijapäätösten
 * kokoomalistat.
 */
const EXCLUDE_PATTERNS = [
  /*
   * Lausunto on toimielimen kannanotto TOISEN toimielimen valmisteluun, ei
   * hankepäätös. Kuvio oli ensin ankkuroitu otsikon alkuun, mutta mitattu
   * muoto on "Liikunta- ja hyvinvointilautakunnan lausunto Kivenlahden
   * pukutilojen hankesuunnitelmasta" - lausunto on keskellä. Kolme viidestä
   * ensimmäisestä osumasta oli tällaisia, ja ne kaksinkertaistaisivat
   * hankkeen jonossa varsinaisen päätöksen rinnalla.
   */
  /\blausunto/i,
  /\blausunnon\b/i,
  /oikaisuvaatimu/i,
  /viranhaltijoiden\s+päätökset/i,
  /pöytäkirjan\s+tarkast/i,
  /kokouksen\s+laillisuu/i,
  /valtuustoaloit/i,
  /*
   * Kaksi kuviota jotka positiivinen lista paastaa lapi vaarin perustein.
   * Molemmat mitattu Kouvolasta ja Porvoosta.
   *
   * 1. Valtion perusparannusavustus yksityistielle ei ole kaupungin hanke
   *    vaan avustuspaatos yksityiselle tiekunnalle - kolme osumaa
   *    Kouvolassa. Sana "perusparann" osuu, kohde ei.
   * 2. Sopimuksen purkaminen ei ole rakennuksen purkamista:
   *    "Tyollistymista edistavan monialaisen tuen yhteistyosopimuksen (TYM)
   *    purkaminen" (Porvoo). Sulkeiden takia valissa on sanoja, joten kuvio
   *    sallii niita rajatusti.
   */
  /perusparannusavustu/i,
  /sopimuksen[^,;.]{0,40}purkami/i,
]

export type DynastyConfig = {
  /** Aliverkkotunnus oncloudos.com-alustalla, esim. "espoo". */
  host: string
  /*
   * Koko CGI-osoite niille asennuksille jotka eivat ole oncloudos.com:issa.
   * Joensuu on maakunnallisessa asennuksessa, jossa kunta on POLUSSA eika
   * aliverkkotunnuksessa: dynastyjulkaisu.pohjoiskarjala.net/joensuu/cgi/...
   * Juuri vastaa 403:lla, joten asennus loytyi vasta polkua kokeilemalla.
   */
  cgiBase?: string
  city: string
  region: string
  /*
   * Rakennuttajan nimi kirjoitetaan auki eikä johdeta kaupungin nimestä.
   * Suomen genetiivi ei ole säännöllinen (Lahti -> Lahden, Tornio ->
   * Tornion), eivätkä kaikki ole kaupunkeja: Kirkkonummi ja Tuusula ovat
   * kuntia. Automaattinen johtaminen tuotti "Lahtin kaupunki".
   */
  developer: string
  sourceName: string
}

/*
 * Dynasty tarjoilee RSS:n ja asiasivun ERI KOODAUKSELLA samalta palvelimelta:
 * RSS on iso-8859-1 (kuten XML-esittelyssä lukee), asiasivu UTF-8 (kuten
 * vastauksen content-type kertoo). Koodaus luetaan siksi vastauksesta eikä
 * oleteta.
 *
 * Ennen tätä molemmat purettiin latin1:nä, jolloin asiasivun ääkköset
 * hajosivat: "Liitteenä" -> "LiitteenÃ¤". Vika koski KAIKKIA 73 Dynasty-
 * ehdokasta - kuvaus oli lukukelvoton ihmiselle ja täsmäytykselle.
 */
export async function fetchDecoded(url: string, fallback = "utf-8"): Promise<string | null> {
  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        accept: "application/rss+xml,text/html,*/*",
        "user-agent": "Mozilla/5.0 (compatible; tyomaat.fi/1.0)",
      },
    })
    if (!res.ok) return null

    const buffer = await res.arrayBuffer()
    const declared = res.headers.get("content-type")?.match(/charset=([\w-]+)/i)?.[1]

    try {
      return new TextDecoder(declared ?? fallback).decode(buffer)
    } catch {
      /* Tuntematon koodausnimi: puretaan oletuksella eikä kaadeta ajoa. */
      return new TextDecoder(fallback).decode(buffer)
    }
  } catch {
    return null
  }
}

/*
 * RSS:n CDATA-sisalto ja asiasivun HTML ovat itsekin entiteettikoodattuja.
 * Kolme perusentiteettia ei riita: mitattu "Tikkarinne 9 keittion
 * peruskorjaus &ndash; hankesuunnitelman hyvaksyminen" (Joensuu), jossa
 * purkamaton &ndash; jai hankkeen nimeen ja siita edelleen tasmaytykseen.
 */
const RSS_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  ndash: "–", mdash: "—", auml: "ä", Auml: "Ä", ouml: "ö", Ouml: "Ö",
  aring: "å", Aring: "Å",
}

export function cdata(value: string | undefined): string {
  return (value ?? "")
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&([a-zA-Z]+);/g, (m, name) => RSS_ENTITIES[name] ?? m)
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, " ")
    .trim()
}

/*
 * RSS-otsikko on muotoa "Kaupunginhallitus 10.08.2026 / Asian otsikko".
 * Toimielin ja päivä erotetaan, jotta asian oma otsikko jää nimeksi -
 * muuten jokainen hanke alkaisi toimielimen nimellä eikä täsmäytys löytäisi
 * niitä.
 */
export function parseRssTitle(raw: string): {
  organization: string | null
  date: Date | null
  subject: string
} {
  const [head, ...rest] = raw.split(" / ")
  const subject = rest.join(" / ").trim()
  const dateMatch = head.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/)

  return {
    organization: dateMatch ? head.slice(0, dateMatch.index).trim() : head.trim(),
    date: dateMatch
      ? new Date(Number(dateMatch[3]), Number(dateMatch[2]) - 1, Number(dateMatch[1]))
      : null,
    subject: subject || head.trim(),
  }
}

export function isConstructionSubject(subject: string): boolean {
  const text = subject.toLowerCase()
  if (EXCLUDE_PATTERNS.some((re) => re.test(subject))) return false
  return CONSTRUCTION_SIGNALS.some((k) => text.includes(k))
}

/*
 * Asian sivu on kokonainen HTML-sivu jossa on sivukalusteet. Leipäteksti
 * alkaa vasta valikoiden jälkeen, joten alku katkaistaan tunnetusta
 * vakiotekstistä.
 */
export function extractItemText(html: string): string | null {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    /*
     * Numeeriset entiteetit purettava nimettyjen lisäksi. Dynasty käyttää
     * runsaasti sitkeää välilyöntiä muodossa &#xa0;, ja purkamattomana se
     * jäi kuvaukseen sellaisenaan: "osan mukaisena. &#xa0; Liitteenä".
     */
    .replace(/&([a-zA-Z]+);/g, (m, name) => RSS_ENTITIES[name] ?? m)
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    /* Puretut sitkeät välilyönnit tavallisiksi. */
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim()

  const cut = text.split(/Kokouksen tiedot|Asian otsikko|Selostus|Päätös/i)
  const body = cut.length > 1 ? cut.slice(1).join(" ").trim() : text

  return body.length >= 40 ? body : null
}

/*
 * Lupapäätöksen otsikko on pelkkä lupatunnus ja osoite ("Laajennuslupa
 * 49-2024-260, Pohjantie 3"), josta ei näe mistä hankkeessa on kyse.
 * Päätöstekstissä lukee kuitenkin toimenpide sellaisenaan:
 *
 *   "Toimenpide Toimistorakennuksen muuttaminen asuinkerrostaloksi"
 *
 * Nostetaan se otsikoksi ja säilytetään osoite perässä, koska se erottaa
 * saman kunnan samankaltaiset luvat toisistaan.
 */
const PERMIT_TITLE = /^(rakennus|laajennus|toimenpide|purkamis|maisematyö)lupa\s+[\d/-]/i

const OPERATION =
  /\bToimenpide\s+(.{10,150}?)\s+(?:Pääsuunnittelija|Rakennuspaikka|Hakija|Lausunnot|Paloluokka|Rakenteellinen|Hakemuksen)/

export function upgradePermitTitle(title: string, body: string | null): string {
  if (!title || !body || !PERMIT_TITLE.test(title)) return title

  const operation = body.match(OPERATION)?.[1]?.trim()
  if (!operation) return title

  /* Osoite on lupatunnuksen jälkeen pilkulla erotettuna. */
  const address = title.split(",").slice(1).join(",").trim()
  return address ? `${operation}, ${address}` : operation
}

export function createDynastyFetcher(config: DynastyConfig) {
  return async function fetchDynasty() {
    const base =
      config.cgiBase ?? `https://${config.host}.oncloudos.com/cgi/DREQUEST.PHP`
    const rss = await fetchDecoded(`${base}?page=rss/meetingitems&show=${RSS_ITEMS}`)
    if (!rss) return []

    const cutoff = new Date()
    cutoff.setMonth(cutoff.getMonth() - RECENCY_MONTHS)

    const results: any[] = []
    const seen = new Set<string>()
    let detailFetches = 0

    for (const match of rss.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const block = match[1]
      const rawTitle = cdata(block.match(/<title>([\s\S]*?)<\/title>/)?.[1])
      const link = cdata(block.match(/<link>([\s\S]*?)<\/link>/)?.[1])
      if (!rawTitle || !link) continue

      const { organization, date, subject } = parseRssTitle(rawTitle)
      if (date && date < cutoff) continue
      if (!isConstructionSubject(subject)) continue

      const itemId = link.match(/id=([0-9\-]+)/)?.[1] ?? link

      /*
       * Sama asia käsitellään ketjussa: lautakunta valmistelee, valtuusto
       * päättää. Asian id on eri joka käsittelyssä, joten tunniste ei riitä -
       * mitattu "Saarnilaakson koulun ja nuorisotilan hankesuunnitelman
       * hyväksyminen" kahdesti. Otsikko on Dynastyssa ainoa yhteinen avain,
       * koska RSS ei anna asiatunnusta kuten Helsingin Ahjo.
       *
       * RSS on uusimmasta vanhimpaan, joten ensimmäinen osuma on tuorein
       * käsittely - se on myös se jonka halutaan jäävän.
       */
      const key = subject.toLowerCase().replace(/[^a-zåäö0-9]+/g, " ").trim()
      if (seen.has(key) || seen.has(itemId)) continue
      seen.add(key)
      seen.add(itemId)

      let description: string | null = null
      if (detailFetches < MAX_DETAIL_FETCHES_PER_RUN) {
        detailFetches++
        const html = await fetchDecoded(link)
        if (html) description = extractItemText(html)
      }

      /*
       * Ilman kuvausta ehdokas hylätään katselmoinnissa (D-027), joten
       * sellaista ei kannata luoda - se palaa seuraavassa ajossa kun
       * hakubudjetti riittää.
       */
      if (!description) continue

      const winners = extractDecisionWinners(description)

      results.push({
        name: upgradePermitTitle(subject, description),
        description,
        city: config.city,
        region: config.region,
        location: extractStreetAddress(subject) ?? extractStreetAddress(description),
        developer: config.developer,
        permit_number: itemId,
        property_type: inferBuildingType(subject, description),
        winners,
        phase: inferDecisionPhase({
          description,
          hasWinner: winners.length > 0,
          fallback: phaseFromTitle(subject),
        }),
        business_value: "high",
        source_url: link,
        confidence: 0.6,
        completed: false,
        source_name: config.sourceName,
        metadata_extra: { organization },
      })
    }

    return results
  }
}

/*
 * Kahdeksan kuntaa samalla alustalla. Jokainen on oma lähteensä
 * discovery_sourcesissa, jotta putken vuorottelu jakaa ne eri ajoihin eikä
 * yksi kunta syö koko aikabudjettia - sama kuvio kuin kaavalähteillä.
 */
export const fetchEspooPaatoksetSource = createDynastyFetcher({
  host: "espoo", city: "Espoo", region: "Uusimaa",
  developer: "Espoon kaupunki", sourceName: "espoo_paatokset",
})

export const fetchKuopioPaatoksetSource = createDynastyFetcher({
  host: "kuopio", city: "Kuopio", region: "Pohjois-Savo",
  developer: "Kuopion kaupunki", sourceName: "kuopio_paatokset",
})

export const fetchLahtiPaatoksetSource = createDynastyFetcher({
  host: "lahti", city: "Lahti", region: "Päijät-Häme",
  developer: "Lahden kaupunki", sourceName: "lahti_paatokset",
})

export const fetchKirkkonummiPaatoksetSource = createDynastyFetcher({
  host: "kirkkonummi", city: "Kirkkonummi", region: "Uusimaa",
  developer: "Kirkkonummen kunta", sourceName: "kirkkonummi_paatokset",
})

export const fetchTuusulaPaatoksetSource = createDynastyFetcher({
  host: "tuusula", city: "Tuusula", region: "Uusimaa",
  developer: "Tuusulan kunta", sourceName: "tuusula_paatokset",
})

export const fetchSavonlinnaPaatoksetSource = createDynastyFetcher({
  host: "savonlinna", city: "Savonlinna", region: "Etelä-Savo",
  developer: "Savonlinnan kaupunki", sourceName: "savonlinna_paatokset",
})

export const fetchTornioPaatoksetSource = createDynastyFetcher({
  host: "tornio", city: "Tornio", region: "Lappi",
  developer: "Tornion kaupunki", sourceName: "tornio_paatokset",
})

export const fetchYlojarviPaatoksetSource = createDynastyFetcher({
  host: "ylojarvi", city: "Ylöjärvi", region: "Pirkanmaa",
  developer: "Ylöjärven kaupunki", sourceName: "ylojarvi_paatokset",
})

/*
 * Joensuu ei ollut niiden 40 kunnan joukossa jotka testattiin
 * oncloudos.com:issa, koska se ei ole siella. Asennus on maakunnallinen ja
 * kunta on polussa - siksi cgiBase.
 */
export const fetchJoensuuPaatoksetSource = createDynastyFetcher({
  host: "joensuu",
  cgiBase: "https://dynastyjulkaisu.pohjoiskarjala.net/joensuu/cgi/DREQUEST.PHP",
  city: "Joensuu", region: "Pohjois-Karjala",
  developer: "Joensuun kaupunki", sourceName: "joensuu_paatokset",
})

/*
 * Kouvolalla on oma Dynasty-asennus omalla verkkotunnuksella. Se ei loytynyt
 * aliverkkotunnusarvauksella eika kunnan paatoksenteko-sivulta, vaan vasta
 * sen alta "Esityslistat ja poytakirjat" -sivulta.
 */
export const fetchKouvolaPaatoksetSource = createDynastyFetcher({
  host: "kouvola",
  cgiBase: "https://ep10.kouvola.fi/cgi/DREQUEST.PHP",
  city: "Kouvola", region: "Kymenlaakso",
  developer: "Kouvolan kaupunki", sourceName: "kouvola_paatokset",
})

/*
 * Porvoo ON oncloudos.com:issa, mutta aliverkkotunnus on "porvoofi" eika
 * "porvoo". Siksi se ei ollut niiden 8 joukossa jotka vastasivat aiemmasta
 * 40 kunnan testista - kaava ei osunut yhden tavun takia.
 *
 * HUOM: syotteessa on Porvoon isannoiman ymparistoterveysjaoston asioita,
 * jotka koskevat naapurikuntia (Loviisa, Sipoo, Askola, Lapinjarvi). Ne ovat
 * paaosin lausuntoja ja terveysvalvonnan maarayksia, jotka poissulkulista ja
 * rakentamisen sanasto pudottavat. Jos kaupunkikentta alkaa nayttaa vaaralta,
 * syy on tassa.
 */
export const fetchPorvooPaatoksetSource = createDynastyFetcher({
  host: "porvoofi",
  city: "Porvoo", region: "Uusimaa",
  developer: "Porvoon kaupunki", sourceName: "porvoo_paatokset",
})
