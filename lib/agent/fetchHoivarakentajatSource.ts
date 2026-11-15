import * as cheerio from "cheerio"
import { YRITYSTIEDOTTEEN_IKKUNA_KK } from "@/lib/agent/tiedotteenIkkuna"
import { getMunicipalityByName } from "@/lib/geo/municipalities"
import { PHASE_LABELS, phaseAdvances } from "@/lib/projects/phases"
import { mergeCompanyNames } from "@/lib/projects/projectCompanies"
import { detectCityFromText } from "./detectCityFromText"
import { extractClientFromText } from "./fetchSttHakuSource"
import { inferCompanyPhase, LEAD_LENGTH } from "./companyRelease"
import { inferBuildingType } from "./buildingType"

/*
 * HOIVARAKENTAJAT (D-427).
 *
 * Hoiva-, palvelu- ja päiväkotirakennusten kehittäjä ja rakentaja
 * (hirsirakentaminen, vuokramalli). Johannes 16.11.2026 Oulun
 * palvelukodista (Attendo, Sarvikangas): *"tätä hanketta emme minusta
 * tienneet, olisimme voineet löytää sen täältä"*.
 *
 * KAKSI LÄHDETTÄ SAMALTA SIVUSTOLTA:
 *
 *   1. `/rakenteilla-olevat-hoivarakennukset` — yhtiön oma luettelo
 *      käynnissä olevista kohteista: tyyppi, tilaaja, katuosoite,
 *      toiminnan alkamiskuukausi ja projektipäällikkö. Mitattu
 *      16.11.2026: 14 kohdetta, joista meillä oli 2–3.
 *   2. `/tiedotteet/rss.xml` — HubSpotin tiedotesyöte (20 uusinta).
 *      Tiedote kertoo hankkeen jo sopimusvaiheessa, kuukausia ennen kuin
 *      kohde ilmestyy rakenteilla-luetteloon.
 *
 * Projektipäällikön puhelin ja sähköposti luetaan yhteystietosivulta
 * (schema.org Person -merkintä), joten jokaiselle työmaalle tulee nimetty
 * ihminen, jolle soittaa.
 */

const SIVU = "https://hoivarakentajat.fi"
export const RAKENTEILLA_URL = `${SIVU}/rakenteilla-olevat-hoivarakennukset`
export const YHTEYSTIEDOT_URL = `${SIVU}/yhteystiedot`
export const TIEDOTE_RSS = `${SIVU}/tiedotteet/rss.xml`
const JULKAISIJA = "Hoivarakentajat"
const UA = "Mozilla/5.0 (compatible; tyomaat.fi/1.0)"

export type HoivaKohde = {
  tyyppi: string
  tilaaja: string | null
  katu: string | null
  postinumero: string | null
  kunta: string | null
  /* "2026-08" */
  toimintaAlkaa: string | null
  projektipaallikko: string | null
}

export type Yhteyshenkilo = { title: string | null; phone: string | null; email: string | null }

function siisti(s: string | undefined | null): string {
  return String(s ?? "").replace(/\s+/g, " ").trim()
}

export function jasennaRakenteilla(html: string): HoivaKohde[] {
  const $ = cheerio.load(html)
  const kohteet: HoivaKohde[] = []
  $(".card__body").each((_, el) => {
    const body = $(el)
    const tyyppi = siisti(body.find(".subheading").first().text())
    const katuosat = body
      .find("p.street span")
      .map((_, s) => siisti($(s).text()))
      .get()
    if (!tyyppi || !katuosat.length) return
    const tiedot = body
      .find("p")
      .not(".street")
      .find("span")
      .map((_, s) => siisti($(s).text()))
      .get()
    const posti = (katuosat[1] ?? "").match(/^(\d{5})\s+(.+)$/)
    const alku = tiedot.map((t) => t.match(/Toiminta alkaa\s+(\d{1,2})\/(\d{4})/i)).find(Boolean)
    const pp = tiedot.map((t) => t.match(/Projektipäällikkö:\s*(.+)$/i)).find(Boolean)
    kohteet.push({
      tyyppi,
      tilaaja: siisti(body.find("h3").first().text()) || null,
      katu: katuosat[0] || null,
      postinumero: posti?.[1] ?? null,
      kunta: posti?.[2] ?? null,
      toimintaAlkaa: alku ? `${alku[2]}-${alku[1].padStart(2, "0")}` : null,
      projektipaallikko: pp ? siisti(pp[1]) : null,
    })
  })
  return kohteet
}

export function jasennaYhteystiedot(html: string): Map<string, Yhteyshenkilo> {
  const $ = cheerio.load(html)
  const henkilot = new Map<string, Yhteyshenkilo>()
  $('[itemtype="https://schema.org/Person"]').each((_, el) => {
    const p = $(el)
    const nimi = siisti(p.find('[itemprop="name"]').first().text())
    if (!nimi) return
    const puhelin = p.find('[itemprop="telephone"]').first().attr("href")?.replace(/^tel:/i, "") ?? null
    const sahkoposti = p.find('[itemprop="email"]').first().attr("href")?.replace(/^mailto:/i, "") ?? null
    henkilot.set(nimi.toLowerCase(), {
      title: siisti(p.find('[itemprop="jobTitle"]').first().text()) || null,
      phone: puhelin ? siisti(puhelin) : null,
      email: sahkoposti ? siisti(sahkoposti) : null,
    })
  })
  return henkilot
}

/*
 * TOIMINNAN ALKU ON VALMISTUMISEN YLÄRAJA, EI VALMISTUMISPÄIVÄ.
 *
 * Luettelo kertoo milloin käyttäjä aloittaa ("Toiminta alkaa 8/2026").
 * Rakennus valmistuu sitä ennen, joten arvioksi kirjataan alkamiskuukauden
 * ensimmäinen päivä.
 *
 * LUETTELOSSA ON MYÖS JO VALMISTUNEITA. Mitattu 16.11.2026: Norlandian
 * Kurttilan päiväkoti (Espoo, "Toiminta alkaa 8/2026") avautui elokuussa,
 * mutta oli yhä "Rakenteilla nyt" -listassa. Kohdetta, jonka toiminta on
 * jo alkanut, ei siksi väitetä rakenteilla olevaksi: vaihetta ei merkitä
 * julkaisijan varmaksi, jolloin tuonnin vanhentuneen valmistumisen
 * sääntö estää sitä syntymästä uutena hankkeena.
 */
export function hoivaKohdeEhdokas(
  k: HoivaKohde,
  yhteys: Map<string, Yhteyshenkilo>,
  nyt: Date = new Date()
) {
  const kunta = k.kunta ? getMunicipalityByName(k.kunta)?.name ?? k.kunta : null
  const sijainti = [k.katu, [k.postinumero, k.kunta].filter(Boolean).join(" ")].filter(Boolean).join(", ")
  const valmistuu = k.toimintaAlkaa ? `${k.toimintaAlkaa}-01` : null
  const kuluvaKk = nyt.toISOString().slice(0, 7)
  const kaynnissa = !k.toimintaAlkaa || k.toimintaAlkaa >= kuluvaKk
  const pp = k.projektipaallikko ? yhteys.get(k.projektipaallikko.toLowerCase()) : undefined
  const [kk, vuosi] = k.toimintaAlkaa ? [k.toimintaAlkaa.slice(5, 7), k.toimintaAlkaa.slice(0, 4)] : [null, null]

  const kuvaus = [
    `${JULKAISIJA} rakentaa: ${k.tyyppi.toLowerCase()}${k.tilaaja ? `, käyttäjä ${k.tilaaja}` : ""}.`,
    sijainti ? `Kohde sijaitsee osoitteessa ${sijainti}.` : null,
    kk ? `Toiminta alkaa ${Number(kk)}/${vuosi}.` : null,
    "Tiedot ovat Hoivarakentajien omalta rakenteilla olevien kohteiden sivulta.",
  ]
    .filter(Boolean)
    .join(" ")

  return {
    name: `${k.tyyppi} ${k.tilaaja ?? ""}, ${k.katu ?? ""}, ${k.kunta ?? ""}`.replace(/\s+,/g, ",").replace(/,\s*,/g, ",").trim(),
    description: kuvaus,
    city: kunta,
    region: kunta ? getMunicipalityByName(kunta)?.region ?? null : null,
    location: sijainti || null,
    developer: k.tilaaja,
    builder: JULKAISIJA,
    phase: PHASE_LABELS.construction,
    phase_authoritative: kaynnissa,
    completed: false,
    property_type: inferBuildingType(k.tyyppi, kuvaus) ?? (/päiväkoti/i.test(k.tyyppi) ? "Päiväkoti" : "Hoivakoti"),
    estimated_completion: valmistuu,
    /*
     * OMA OSOITE JOKAISELLE KORTILLE. Dokumentit tallennetaan osoitteen
     * mukaan; ensimmäisessä ajossa kaikilla korteilla oli luettelon
     * osoite, ja 8 kortista talteen jäi yksi (16.11.2026).
     */
    source_url: korttiOsoite(k),
    confidence: 0.8,
    source_name: "hoivarakentajat",
    metadata: {
      related_companies: mergeCompanyNames([], k.tilaaja ? [k.tilaaja] : []),
      contact_persons: k.projektipaallikko
        ? [
            {
              kind: "person" as const,
              name: k.projektipaallikko,
              title: pp?.title ?? "Projektipäällikkö",
              organization: JULKAISIJA,
              phone: pp?.phone ?? null,
              email: pp?.email ?? null,
              role: "builder",
              source: YHTEYSTIEDOT_URL,
            },
          ]
        : [],
      toiminta_alkaa: k.toimintaAlkaa,
      field_sources: {
        developer: "kentta",
        builder: "julkaisija",
        location: "kentta",
        estimated_completion: k.toimintaAlkaa ? "toiminta alkaa" : null,
        phase: kaynnissa ? "julkaisijan luettelo" : "luettelo, toiminta jo alkanut",
      },
    },
  }
}

export function korttiOsoite(k: HoivaKohde): string {
  const avain = `${k.katu ?? ""} ${k.kunta ?? ""} ${k.tilaaja ?? ""}`
    .toLowerCase()
    .replace(/[äå]/g, "a")
    .replace(/ö/g, "o")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
  return `${RAKENTEILLA_URL}#${avain}`
}

/* Toiminta alkanut ennen kuluvaa kuukautta: luettelo on jäänyt jälkeen. */
export function toimintaJoAlkanut(k: HoivaKohde, nyt: Date = new Date()): boolean {
  return k.toimintaAlkaa != null && k.toimintaAlkaa < nyt.toISOString().slice(0, 7)
}

async function hae(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, { cache: "no-store", headers: { "user-agent": UA } })
    return r.ok ? await r.text() : null
  } catch {
    return null
  }
}

export type TiedoteRss = { otsikko: string; linkki: string; ingressi: string; julkaistu: Date | null }

export function jasennaTiedotteet(xml: string): TiedoteRss[] {
  const $ = cheerio.load(xml, { xmlMode: true })
  return $("item")
    .map((_, el) => {
      const item = $(el)
      const ingressi = cheerio.load(item.find("description").first().text())("p").text()
      const pvm = item.find("pubDate").first().text()
      return {
        otsikko: siisti(item.find("title").first().text()),
        linkki: siisti(item.find("link").first().text()).replace(/\?hsLang=.*$/, ""),
        ingressi: siisti(ingressi),
        julkaistu: pvm ? new Date(pvm) : null,
      }
    })
    .get()
    .filter((t: TiedoteRss) => t.otsikko && t.linkki)
}

/*
 * Yritysuutiset (kasvu, omistajat, portfoliokaupat) eivät ole hankkeita.
 * Hankkeen tunnistaa siitä, että otsikko kertoo kenelle tai mihin
 * rakennetaan.
 */
const EI_HANKE = /kasvoi|pääomistaja|omistaja|portfoliokau|vuosikertomus|rekrytoi|nimitys|tulos/i
const HANKE = /rakenta|palvelukoti|hoivakoti|päiväkoti|asumisyksikkö|koti\b|kodin|yksikkö|kiinteistö/i

/*
 * KÄYTTÄJÄ ON ALLATIIVISSA OTSIKOSSA: "Tavanalle", "Humanalle",
 * "Attendolle Kuopioon", "Norlandia Hoivalle ja Aberialle". Yleinen
 * `extractClientFromText` tunnisti mitatuista viidestä vain yhden.
 * Isolla alkava sana, jonka pääte on -lle; edeltävä isolla alkava sana
 * kuuluu nimeen ("Norlandia Hoiva"). Pienellä alkava ("lähelle") ei ole
 * nimi.
 */
export function kayttajaOtsikosta(otsikko: string): string | null {
  const m = otsikko.match(/(?:^|\s)((?:[A-ZÅÄÖ][\wåäöÅÄÖ-]*\s+)?[A-ZÅÄÖ][\wåäöÅÄÖ-]*?)lle(?=\s|$|,)/)
  if (!m) return null
  /* "Hoivarakentajilta Humanalle": julkaisijan oma nimi ei kuulu käyttäjään. */
  const nimi = m[1].replace(/^Hoivarakentaj\S*\s*/i, "").trim()
  return nimi || null
}

/*
 * Tyyppi otsikon kohteesta, ei sivulauseesta: "asumisyksikkö Hämeenlinnan
 * uuden Ahveniston sairaalan lähelle" sai yleiseltä päättelyltä tyypin
 * Sairaala.
 */
export function hoivaTyyppi(otsikko: string, teksti: string): string | null {
  if (/päiväko/i.test(otsikko)) return "Päiväkoti"
  if (/palvelukoti|hoivakoti|asumisyksikkö|palveluyksikkö|vammaispalvelu|\bkoti\b|kodit\b/i.test(otsikko)) return "Hoivakoti"
  return inferBuildingType(otsikko, teksti) ?? null
}

export function tiedoteEhdokas(t: TiedoteRss) {
  const city = detectCityFromText(t.otsikko) ?? detectCityFromText(t.ingressi)
  return {
    name: t.otsikko,
    description: t.ingressi || null,
    city,
    region: city ? getMunicipalityByName(city)?.region ?? null : null,
    location: null as string | null,
    phase: inferCompanyPhase(t.otsikko, t.ingressi),
    developer:
      extractClientFromText(t.otsikko, t.ingressi.slice(0, LEAD_LENGTH)) ?? kayttajaOtsikosta(t.otsikko),
    builder: JULKAISIJA,
    property_type: hoivaTyyppi(t.otsikko, t.ingressi),
    source_url: t.linkki,
    confidence: 0.7,
    completed: false,
    source_name: "hoivarakentajat",
  }
}

/*
 * KORTTI JA TIEDOTE OVAT SAMA HANKE (D-427).
 *
 * Kuivaharjoitus 16.11.2026: luettelon kortti "Palvelukoti Humana,
 * Radiotie 9, Vaasa" ja tiedote "Hoivarakentajilta Humanalle uusi
 * vammaispalveluyksikkö Vaasaan" eivät täsmänneet toisiinsa
 * (nimet eri, vanhalla rivillä ei osoitetta) — kahdesta lähteestä olisi
 * syntynyt kaksi riviä. Siksi ne yhdistetään jo tässä: kortti kuuluu
 * tiedotteeseen, kun kunta on sama ja tiedotteen otsikko nimeää kortin
 * käyttäjän ("Attendolle", "Norlandia Hoivalle ja Aberialle").
 *
 * Tiedotteen otsikko säilyy nimenä, koska jo kannassa olevat rivit ovat
 * syntyneet siitä (STT, Rakennuslehti) ja täsmäävät siihen. Kortilta
 * tulevat osoite, projektipäällikkö, toiminnan alku ja vaihe.
 */
function kayttajanAvain(nimi: string | null): string {
  return String(nimi ?? "").toLowerCase().split(/\s+/)[0] ?? ""
}

export function yhdistaKohteetJaTiedotteet(
  tiedotteet: TiedoteRss[],
  kohteet: HoivaKohde[],
  yhteys: Map<string, Yhteyshenkilo>,
  nyt: Date = new Date()
) {
  const korttiEhdokkaat = kohteet.map((k) => ({ k, e: hoivaKohdeEhdokas(k, yhteys, nyt) }))
  const kaytetyt = new Set<number>()
  const tulos: any[] = []

  for (const t of tiedotteet) {
    const e: any = tiedoteEhdokas(t)
    const otsikko = t.otsikko.toLowerCase()
    const omat = korttiEhdokkaat
      .map((x, i) => ({ ...x, i }))
      .filter(
        ({ k, e: ke, i }) =>
          !kaytetyt.has(i) &&
          ke.city != null &&
          ke.city === e.city &&
          kayttajanAvain(k.tilaaja).length >= 4 &&
          otsikko.includes(kayttajanAvain(k.tilaaja))
      )
    if (omat.length) {
      for (const o of omat) kaytetyt.add(o.i)
      const ensimmainen = omat[0].e
      const kayttajat = mergeCompanyNames([], omat.map((o) => o.k.tilaaja).filter(Boolean) as string[])
      tulos.push({
        ...e,
        description: [e.description, ...omat.map((o) => o.e.description)].filter(Boolean).join("\n\n"),
        location: ensimmainen.location,
        developer: e.developer ?? ensimmainen.developer,
        phase: ensimmainen.phase,
        phase_authoritative: omat.some((o) => o.e.phase_authoritative),
        estimated_completion: omat
          .map((o) => o.e.estimated_completion)
          .filter(Boolean)
          .sort()
          .pop() ?? null,
        metadata: {
          ...ensimmainen.metadata,
          related_companies: kayttajat,
          contact_persons: omat
            .flatMap((o) => o.e.metadata.contact_persons)
            .filter((c, i, kaikki) => kaikki.findIndex((x) => x.name === c.name) === i),
          hoivarakentajat_kortit: omat.map((o) => o.e.name),
        },
      })
    } else {
      tulos.push(e)
    }
  }

  /*
   * Kortti ilman tiedotetta tulee omana rivinään vain jos toiminta ei ole
   * vielä alkanut. Ensimmäinen ajo vei jonoon Espoon, Kangasalan ja
   * Mikkelin kortit, joiden toiminta alkoi 8–10/2026: jono ei käytä
   * tuonnin vanhentuneen valmistumisen sääntöä, joten se on tehtävä tässä.
   */
  korttiEhdokkaat.forEach(({ k, e }, i) => {
    if (!kaytetyt.has(i) && !toimintaJoAlkanut(k, nyt)) tulos.push(e)
  })
  return tulos
}

export async function fetchHoivarakentajatSource() {
  const [xml, html, yht] = await Promise.all([hae(TIEDOTE_RSS), hae(RAKENTEILLA_URL), hae(YHTEYSTIEDOT_URL)])
  const raja = new Date()
  raja.setMonth(raja.getMonth() - YRITYSTIEDOTTEEN_IKKUNA_KK)
  const tiedotteet = (xml ? jasennaTiedotteet(xml) : [])
    .filter((t) => !t.julkaistu || t.julkaistu >= raja)
    .filter((t) => HANKE.test(t.otsikko) && !EI_HANKE.test(t.otsikko))
  const kohteet = html ? jasennaRakenteilla(html) : []
  const yhteys = yht ? jasennaYhteystiedot(yht) : new Map<string, Yhteyshenkilo>()
  return yhdistaKohteetJaTiedotteet(tiedotteet, kohteet, yhteys)
}

/*
 * Rikastus vain tiedotteille. Luettelon kortilla ei ole omaa sivua
 * (source_url on luettelo), ja yritysrikastin poimisi luettelosivulta koko
 * listan yhden hankkeen kuvaukseksi.
 */
export function createHoivarakentajatEnricher(yritysrikastin: (c: any) => Promise<any>) {
  return async (c: any) => {
    if (!c?.source_url || c.source_url.startsWith(RAKENTEILLA_URL)) return c
    const r = await yritysrikastin(c)
    /*
     * KORTIN TIETO VOITTAA TIEDOTTEEN PÄÄTTELYN (D-427).
     *
     * Ensimmäisessä ajossa rikastin päätteli vaiheen tiedotteen tekstistä
     * ja korvasi kortin "Rakenteilla" -vaiheen: Tavana jäi
     * suunnitteluun ja Jyväskylä putosi suunnitteluun. Kortti on
     * julkaisijan oma tilannetieto, tiedote kuukausia vanhempi kertomus.
     * Vaihe saa vain edetä; osoite, käyttäjä, valmistuminen ja
     * yhteyshenkilö tulevat kortilta jos kortti on.
     */
    const yhteys = [...(c.metadata?.contact_persons ?? []), ...(r.metadata?.contact_persons ?? [])].filter(
      (h: any, i: number, kaikki: any[]) => kaikki.findIndex((x) => x.name === h.name) === i
    )
    return {
      ...r,
      phase: phaseAdvances(r.phase, c.phase) ? c.phase : r.phase,
      phase_authoritative: c.phase_authoritative ?? r.phase_authoritative,
      location: c.location ?? r.location,
      developer: c.developer ?? r.developer,
      estimated_completion: c.estimated_completion ?? r.estimated_completion,
      metadata: {
        ...(r.metadata ?? {}),
        ...(c.metadata ?? {}),
        related_companies: mergeCompanyNames(c.metadata?.related_companies ?? [], r.metadata?.related_companies ?? []),
        contact_persons: yhteys,
      },
    }
  }
}
