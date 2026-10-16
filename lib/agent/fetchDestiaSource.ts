import * as cheerio from "cheerio"

import { detectCityFromText } from "./detectCityFromText"
import { extractStreetAddress } from "./extractStreetAddress"
import { extractExplicitClient } from "./fetchSttHakuSource"
import { inferBuildingType } from "./buildingType"
import { PHASE_LABELS } from "@/lib/projects/phases"

/*
 * DESTIAN TIEDOTTEET.
 *
 * MIKSI. Destia oli `20_YRITYSLAHTEET.md`:n avoimista aukoista
 * kolmanneksi suurin: 13 hanketta kannassa ilman omaa lähdettä. Se oli
 * merkitty hankalaksi, koska `destia.fi/referenssit/` on JS-renderöity
 * ilman upotettua JSONia — mutta **se arvio koski referenssejä, ei
 * uutishuonetta**, ja juuri uutishuone kertoo urakkavoitot.
 *
 * Herätteenä yksi hanke 17.10.2026: Rakennuslehden juttu "Destia urakoi
 * uusiutuvan energian hanketta Vuolijoella" oli jonossa, ja alkuperäinen
 * oli Destian oma tiedote samalta päivältä. Jonorivin kuvaus oli 197
 * merkkiä, Destian oma sivu 5 078.
 *
 * RAJAPINTA LÖYTYI SELAIMEN VERKKOLIIKENTEESTÄ. Uutishuone renderöi
 * listan JS:llä, joten sivun HTML:ssä ei ole linkkejä. Lista tulee
 * omasta päätepisteestä, ja se on **POST** — siksi GET-kokeilut
 * (`/sitemap.xml`, `/feed/`, `/wp-json/wp/v2/posts`) palauttivat tyhjää.
 *
 * Rungon muoto on luettu teeman `main.js`:stä, koska arvaukset
 * palauttivat `foundPosts: 0`. Ratkaiseva yksityiskohta: parametri on
 * **`postTypes` monikossa ja taulukkona**.
 *
 * Mitattu 17.10.2026: `postTypes: ["release"]` antaa 391 tiedotetta,
 * joista **26 on viimeisen 12 kuukauden sisällä**. Sivutus toimii ja
 * päivät laskevat siististi (sivu 1: 2026-10-14 … 2026-02-12, sivu 2:
 * 2026-02-06 … 2025-03-20).
 */

const API = "https://destia.fi/wp-json/destia/posts"

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

const SIVUN_KOKO = 20
const MAX_SIVUJA = 6
const CONCURRENCY = 4

/*
 * 12 KUUKAUDEN IKKUNA ON PAKOLLINEN. Arkistossa on 391 tiedotetta
 * vuodesta 2018; vanha urakkavoitto ei ole mahdollisuus vaan historiaa.
 * Sama sääntö kuin muilla yrityslähteillä.
 */
export const IKKUNA_PAIVAA = 365

export type DestiaTiedote = {
  otsikko: string
  url: string
  paiva: string
}

export function jasennaLista(vastaus: unknown): DestiaTiedote[] {
  const posts = (vastaus as any)?.posts
  if (!Array.isArray(posts)) return []

  return posts
    .map((p: any) => ({
      otsikko: String(p?.title ?? "").replace(/\s+/g, " ").trim(),
      url: String(p?.link ?? "").trim(),
      paiva: String(p?.dateIntl ?? "").slice(0, 10),
    }))
    .filter((t) => t.otsikko && /^https?:\/\//.test(t.url) && /^\d{4}-\d{2}-\d{2}$/.test(t.paiva))
}

export function onTuore(paiva: string, nyt = new Date()): boolean {
  const ms = new Date(`${paiva}T00:00:00Z`).getTime()
  if (!Number.isFinite(ms)) return false
  return nyt.getTime() - ms <= IKKUNA_PAIVAA * 86_400_000
}

/*
 * TIEDOTE EI OLE HANKE.
 *
 * Mitattu otsikoista 17.10.2026: 12 kuukauden 26 tiedotteesta valtaosa
 * ei kerro rakennuskohteesta lainkaan — "Destialla lähes 300
 * kesäharjoittelijaa", "Ahlström Collective Impact lisää tukeaan
 * UNICEFille", "Destia ja Vastuu Group tiivistävät yhteistyötään",
 * "Tieverkon jatkuva rapautuminen uhkaa investointeja" (edunvalvontaa,
 * ei urakka).
 *
 * Suodatus on tässäkin koko työ: ilman sitä katselmointijono täyttyy
 * yritysviestinnästä.
 */
const EI_HANKE = new RegExp(
  [
    /* henkilöstö ja koulutus */
    "harjoittelij", "rekrytoi", "koulutta", "koulutuks", "opiskelij", "henkilöstö",
    "nimitys", "nimitetty",
    /* talous */
    "tulos", "osavuosikatsaus", "tilinpäätös", "vuosikertomus", "kasvoi", "liikevaihto",
    /* vastuullisuus ja kumppanuudet */
    "unicef", "lahjoit", "tukeaan", "sponsor", "yhteistyötään", "kumppanuus",
    "sertifi", "vastuullisuus", "kestävyysraport",
    /* selvitykset ja edunvalvonta */
    "selvitys", "selvityksen", "selvittää", "uhkaa", "kyselyn", "tutkimuksen mukaan",
    "kokonaiskuva", "kaipaavat", "julkaisevat", "julkaisee",
    /* palkinnot ja muu yritysviestintä */
    "palkittiin", "palkinto", "tuplavoitto", "innostavimmat",
    "työturvallisuu", "turvallisuuskultt", "verkkokaup",
    "vahvistaa.{0,20}johtamista", "avaa.{0,20}palvelu",
  ].join("|"),
  "i"
)

/*
 * KUNNOSSAPITO EI OLE RAKENNUSHANKE. "Destia voitti seitsemän
 * maanteiden hoitourakkaa" on monivuotinen palvelusopimus, ei työmaa.
 */
const KUNNOSSAPITO = /hoitourak|kunnossapitourak|kunnossapidon|ylläpitourak|talvihoito/i

/*
 * POSITIIVINEN SIGNAALI VAADITAAN, EI PELKKÄ MUSTA LISTA.
 *
 * Ensimmäinen versio luetteloi vain poissuljettavia aiheita, ja
 * kuivaharjoitus päästi läpi 8 / 16 ei-hanketta: työturvallisuuden
 * johtaminen, tilinpäätös, edunvalvonta, "Innostavimmat työpaikat"
 * -palkinto, verkkokaupan avaus. Lista olisi kasvanut loputtomiin.
 *
 * Tiedotteen on siis kerrottava urakasta tai rakentamisesta. Molemmat
 * ehdot ovat voimassa: positiivinen signaali JA ei poissulkevaa aihetta
 * — "Destia ja Oulun ammattikorkeakoulu aloittavat talonrakentamisen
 * koulutuksen" sisältää sanan "talonrakentamis" mutta on koulutusuutinen.
 */
const HANKESIGNAALI = new RegExp(
  [
    "urak(?:ka|an|oi|oitsij)",
    "rakentaa",
    "rakennus(?:urakka|työt|hanke)",
    "peruskorja",
    "saneera",
    "toteuttaa",
    "toteutussopimus",
    "allekirjoit",
    "käynnistyn",
    "käynnistyi",
    "parantaa.{0,30}(?:tie|väylä|rata|katu)",
    "sähköasema",
    "silta",
    "ratikan",
    "raitiotie",
  ].join("|"),
  "i"
)

export function onHanketiedote(otsikko: string): boolean {
  if (!otsikko) return false
  if (EI_HANKE.test(otsikko)) return false
  if (KUNNOSSAPITO.test(otsikko)) return false
  return HANKESIGNAALI.test(otsikko)
}

/*
 * Tiedotesivu on tavallista palvelinrenderöityä HTML:ää (mitattu: 306 ms,
 * 5 078 merkkiä tekstiä), toisin kuin listaus.
 */
export function jasennaTiedote(html: string): string {
  const $ = cheerio.load(html)
  $("script,style,noscript,nav,header,footer,form").remove()

  /*
   * Artikkelin oma lohko ensin; koko body sisältäisi päävalikon
   * palvelulistan ("Akkuenergiavarastot Aurinkovoimainfra …"), joka
   * vuotaisi jokaiseen kuvaukseen.
   */
  const lohko = $("article").first().text() || $("main").first().text() || $("body").text()

  return lohko.replace(/\s+/g, " ").trim()
}

async function haeLista(sivu: number): Promise<{ posts: unknown }> {
  const vastaus = await fetch(API, {
    method: "POST",
    cache: "no-store",
    headers: {
      "user-agent": UA,
      "content-type": "application/json",
      accept: "application/json",
    },
    /* Runko luettu teeman main.js:stä; `postTypes` on monikko. */
    body: JSON.stringify({
      lang: "fi",
      perPage: SIVUN_KOKO,
      page: sivu,
      postTypes: ["release"],
      year: null,
    }),
  })
  if (!vastaus.ok) return { posts: [] }
  return (await vastaus.json()) as { posts: unknown }
}

async function haeHtml(url: string): Promise<string | null> {
  try {
    const vastaus = await fetch(url, { cache: "no-store", headers: { "user-agent": UA } })
    if (!vastaus.ok) return null
    return await vastaus.text()
  } catch {
    return null
  }
}

export async function fetchDestiaSource() {
  const tiedotteet: DestiaTiedote[] = []

  for (let sivu = 1; sivu <= MAX_SIVUJA; sivu++) {
    const data = await haeLista(sivu)
    const rivit = jasennaLista(data)
    if (!rivit.length) break

    tiedotteet.push(...rivit.filter((t) => onTuore(t.paiva)))

    /* Päivät laskevat, joten ikkunan ohitettua ei tarvitse jatkaa. */
    if (!onTuore(rivit[rivit.length - 1].paiva)) break
  }

  const jono = tiedotteet.filter((t) => onHanketiedote(t.otsikko))
  const results: any[] = []

  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (jono.length) {
        const t = jono.shift()
        if (!t) break

        const html = await haeHtml(t.url)
        if (!html) continue

        const teksti = jasennaTiedote(html)
        /* Tyhjä sivu ei ole hanke. */
        if (teksti.length < 200) continue

        results.push({
          name: t.otsikko,
          city: detectCityFromText(t.otsikko) ?? detectCityFromText(teksti),
          region: null,
          location: extractStreetAddress(teksti),
          /*
           * Tiedote kertoo urakkavoitosta, eli sopimus on syntynyt mutta
           * työmaa ei välttämättä ole alkanut. Sama tulkinta kuin
           * muillakin urakoitsijalähteillä.
           */
          phase: PHASE_LABELS.contract_awarded,
          description: teksti.slice(0, 4000),
          /* Tilaaja vain yksiselitteisestä maininnasta, ei arvauksesta. */
          developer: extractExplicitClient(teksti),
          /* Julkaisija on urakoitsija omassa tiedotteessaan. */
          builder: "Destia Oy",
          property_type: inferBuildingType(t.otsikko, teksti),
          source_url: t.url,
          confidence: 0.65,
          completed: false,
          source_name: "destia_tiedotteet",
        })
      }
    })
  )

  return results
}
