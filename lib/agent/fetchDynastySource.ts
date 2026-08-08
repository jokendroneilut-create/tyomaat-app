import { extractStreetAddress } from "./extractStreetAddress"

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
const CONSTRUCTION_SIGNALS = [
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
]

export type DynastyConfig = {
  /** Aliverkkotunnus oncloudos.com-alustalla, esim. "espoo". */
  host: string
  city: string
  region: string
  sourceName: string
}

/*
 * Dynasty tarjoilee RSS:n latin1-koodattuna eikä UTF-8:na, joten ääkköset
 * hajoavat jos vastaus luetaan tekstinä. Puretaan tavuista.
 */
async function fetchLatin1(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        accept: "application/rss+xml,text/html,*/*",
        "user-agent": "Mozilla/5.0 (compatible; tyomaat.fi/1.0)",
      },
    })
    if (!res.ok) return null
    return new TextDecoder("iso-8859-1").decode(await res.arrayBuffer())
  } catch {
    return null
  }
}

function cdata(value: string | undefined): string {
  return (value ?? "")
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
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
function extractItemText(html: string): string | null {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()

  const cut = text.split(/Kokouksen tiedot|Asian otsikko|Selostus|Päätös/i)
  const body = cut.length > 1 ? cut.slice(1).join(" ").trim() : text

  return body.length >= 40 ? body : null
}

export function createDynastyFetcher(config: DynastyConfig) {
  return async function fetchDynasty() {
    const base = `https://${config.host}.oncloudos.com/cgi/DREQUEST.PHP`
    const rss = await fetchLatin1(`${base}?page=rss/meetingitems&show=${RSS_ITEMS}`)
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
        const html = await fetchLatin1(link)
        if (html) description = extractItemText(html)
      }

      /*
       * Ilman kuvausta ehdokas hylätään katselmoinnissa (D-027), joten
       * sellaista ei kannata luoda - se palaa seuraavassa ajossa kun
       * hakubudjetti riittää.
       */
      if (!description) continue

      results.push({
        name: subject,
        description,
        city: config.city,
        region: config.region,
        location: extractStreetAddress(subject) ?? extractStreetAddress(description),
        developer: `${config.city}n kaupunki`,
        permit_number: itemId,
        property_type: null,
        phase: /urak/i.test(subject) ? "Sopimus myönnetty" : "Suunnittelussa",
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

export const fetchEspooPaatoksetSource = createDynastyFetcher({
  host: "espoo",
  city: "Espoo",
  region: "Uusimaa",
  sourceName: "espoo_paatokset",
})
