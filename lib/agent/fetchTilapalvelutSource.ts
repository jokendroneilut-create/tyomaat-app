import * as cheerio from "cheerio"

import { detectCityFromText } from "@/lib/agent/detectCityFromText"
import { getMunicipalityByName } from "@/lib/geo/municipalities"
import { inferBuildingType } from "@/lib/agent/buildingType"
import { MONTHS, parseEstimatedCompletionDate } from "@/lib/agent/parseFinnishCompletionDate"
import { onValmistunut } from "@/lib/agent/sivuurakoitsijaRss"
import { mergeCompanyNames } from "@/lib/projects/projectCompanies"
import { PHASE_LABELS } from "@/lib/projects/phases"

/*
 * TAMPEREEN TILAPALVELUT OY: HANKKEET (D-339).
 *
 * Johannes 24.10.2026 Aamulehden Kanjonin koulu -jutusta. Hanke oli
 * kannassa paatostuonnin nimella "Koulun ja paivakodin peruskorjaus ja
 * laajennus" -- vaara tyyppi, vaara vaihe, ei kuvausta. Tilapalveluiden
 * oma hankesivu kertoi kaiken: urakoitsijan (Peab), aikataulun,
 * kustannusarvion ja hankepaallikon puhelimen.
 *
 * Tilapalvelut on Tampereen kaupungin rakennuttaja (koulut, paivakodit,
 * kulttuuri- ja liikuntatilat). Hankkeet ovat juuri niita, joiden
 * tyomaayhteys puuttuu paatoksista: paatoksessa on valmistelija,
 * hankesivulla hankkeen oma hankepaallikko.
 *
 * REITTI: WordPressin oma tyyppi `portfolio`,
 * `wp-json/wp/v2/portfolio?per_page=100`. Yksi pyynto antaa kaikki 68
 * juttua koko tekstina (mitattu 24.10.2026). robots.txt ei kiella mitaan.
 *
 * VAIHE TULEE LUOKITUKSESTA, ei sanastosta. `portfolio-types`:
 *   46 Tulevat hankkeet            (3)  -- aina mukana
 *   49 Meneillaan olevat hankkeet  (9)  -- aina mukana
 *   50 Asiakastarinat              (56) -- vain 12 kk ikkuna
 * Kaksi ensimmaista ovat julkaisijan oma lista kesken olevista, joten
 * ikkunaa ei tarvita. Asiakastarinoissa on myos vuosien 2018-2023
 * kehityshankkeita ja lokerikkojuttuja, ja ikkuna karsii ne.
 *
 * KENTTALOHKO. Jutun lopussa on lohko "Sijainti / Aikataulu /
 * Kustannusarvio / Rakennuttaja / ...suunnittelu / ...urakoitsija",
 * jokainen kentta omana kappaleenaan (otsikko lihavoituna, arvo <br>:n
 * jalkeen). Merkinta vaihtelee (<strong>, <b><span>), joten kappale
 * luetaan tekstina rivi kerrallaan: ensimmainen rivi on otsikko.
 *
 * YHTEYSHENKILO "Jutellaanko lisaa?" -laatikosta: nimi, nimike, puhelin
 * ja mailto-painike. Rakennetaan kolmikosta eika tekstipoimijalla
 * (muisti fields-into-prose-break-contacts), ja kuvaus katkaistaan
 * ennen kenttalohkoa, jotta nimet eivat paady leipatekstiin.
 */

export const TILAPALVELUT = "Tampereen Tilapalvelut Oy"

const RAJAPINTA = "https://tampereentilapalvelut.fi/wp-json/wp/v2/portfolio?per_page=100"
const UA = "Mozilla/5.0 (compatible; tyomaat.fi/1.0)"
const AIKAKATKAISU_MS = 30000
const IKKUNA_KUUKAUSIA = 12

const TULEVAT = 46
const MENEILLAAN = 49

export type TilapalvelutYhteys = {
  name: string
  title: string | null
  phone: string | null
  email: string | null
}

export type TilapalvelutJulkaisu = {
  otsikko: string
  osoite: string
  pvm: Date | null
  luokat: number[]
  teksti: string
  kentat: Map<string, string>
  yhteys: TilapalvelutYhteys | null
}

/*
 * WPBakeryn lyhytkoodit ([vc_row ...]) jaavat rajapinnan tekstiin.
 * Ne korvataan kappalerajalla: lohkon ensimmainen kentta ("Sijainti")
 * alkaa suoraan [vc_column_text]-koodin jalkeen ilman <p>-avausta, ja
 * ilman rajaa se liimautui edelliseen kappaleeseen (kuivaharjoitus
 * 24.10.2026: osoite puuttui kaikilta 20:lta).
 */
const LYHYTKOODI = /\[\/?vc_[^\]]*\]/g
/* [vc_raw_html] on base64-koodattu murupolku, ei tekstia. */
const RAAKA_HTML = /\[vc_raw_html[^\]]*\][\s\S]*?\[\/vc_raw_html\]/g
/* Nollaleveat valilyonnit puhelinnumeroiden edessa. */
const NOLLALEVEA = /[​-‍﻿]/g

const KENTTA = /^(sijainti|aikataulu|kustannusarvio|arkkitehti|rakennuttaja|rakennuttaminen|rahoittaja|[\wäöå -]*suunnittel\w*|[\wäöå -]*urakoitsija)$/i
const onKentta = (rivi: string) => rivi.length < 60 && KENTTA.test(rivi)

const siisti = (s: string) => s.replace(NOLLALEVEA, "").replace(/\s+/g, " ").trim()

export function jasennaJulkaisu(j: any): TilapalvelutJulkaisu {
  const raaka = String(j?.content?.rendered ?? "")
  const html = raaka.replace(RAAKA_HTML, "").replace(LYHYTKOODI, "</p><p>")
  const $ = cheerio.load(html)
  const otsikko = siisti(cheerio.load(String(j?.title?.rendered ?? "")).text())

  /* Yhteyslaatikko alkaa "Jutellaanko lisaa?" -otsikosta. */
  let yhteys: TilapalvelutYhteys | null = null
  const laatikko = $("h2")
    .filter((_, h) => /jutellaanko/i.test($(h).text()))
    .first()
  if (laatikko.length) {
    const kappaleet = laatikko.nextAll("p").toArray()
    const rivit = kappaleet.flatMap((p) => {
      $(p).find("br").replaceWith("\n")
      return $(p).text().split("\n").map(siisti).filter(Boolean)
    })
    const puhelinRivi = rivit.find((r) => /^puhelin/i.test(r))
    const muut = rivit.filter((r) => r !== puhelinRivi)
    /* Painikkeen osoite on URL-koodattu: mailto%3Aetunimi.sukunimi%40tilapa.fi */
    const sahkoposti = raaka
      .replace(/%3A/gi, ":")
      .replace(/%40/g, "@")
      .match(/mailto:([a-z0-9._+-]+@[a-z0-9.-]+\.[a-z]{2,})/i)
    const nimi = muut[0] ?? ""
    if (/^[A-ZÅÄÖ][\wåäö-]+(\s+[A-ZÅÄÖ][\wåäö-]+)+$/.test(nimi)) {
      yhteys = {
        name: nimi,
        title: muut[1] ?? null,
        phone: puhelinRivi ? siisti(puhelinRivi.replace(/^puhelin:?/i, "")) || null : null,
        email: sahkoposti ? sahkoposti[1].toLowerCase() : null,
      }
    }
    laatikko.nextAll().remove()
    laatikko.remove()
  }

  /*
   * Kenttalohko: kappale jonka ensimmainen rivi on tunnettu otsikko.
   * Samassa kappaleessa voi olla useampi kentta perakkain <br>:lla
   * erotettuna ("Putkiurakoitsija / X Oy / Ilmanvaihtourakoitsija / Y Oy"),
   * joten jokainen otsikkorivi aloittaa uuden kentan.
   */
  const kentat = new Map<string, string>()
  let ensimmainenKentta: any = null
  $("p").each((_, p) => {
    const kopio = $(p).clone()
    kopio.find("br").replaceWith("\n")
    const rivit = kopio.text().split("\n").map(siisti).filter(Boolean)
    if (rivit.length < 2 || !onKentta(rivit[0])) return
    if (!ensimmainenKentta) ensimmainenKentta = p
    let avain = ""
    let arvot: string[] = []
    const talleta = () => {
      if (avain && arvot.length && !kentat.has(avain)) kentat.set(avain, arvot.join(" "))
    }
    for (const rivi of rivit) {
      if (onKentta(rivi)) {
        talleta()
        avain = rivi.toLowerCase()
        arvot = []
      } else arvot.push(rivi)
    }
    talleta()
  })

  /* Kuvaus = kenttalohkoa edeltava teksti. */
  if (ensimmainenKentta) {
    $(ensimmainenKentta).nextAll().remove()
    $(ensimmainenKentta).remove()
  }
  $("h2, h3, h4").each((_, h) => {
    $(h).replaceWith(`\n${$(h).text()}\n`)
  })
  /* Jokainen juttu alkaa jakopainikkeiden otsikolla "Jaa somessa:". */
  const teksti = siisti(
    $("p, h2, h3, h4")
      .toArray()
      .map((p) => $(p).text())
      .join(" ")
  ).replace(/^Jaa somessa:\s*/i, "")

  const pvm = j?.date ? new Date(String(j.date)) : null
  return {
    otsikko,
    osoite: String(j?.link ?? ""),
    pvm: pvm && !isNaN(pvm.getTime()) ? pvm : null,
    luokat: Array.isArray(j?.["portfolio-types"]) ? j["portfolio-types"].map(Number) : [],
    teksti,
    kentat,
    yhteys,
  }
}

export function jasennaJulkaisut(data: unknown): TilapalvelutJulkaisu[] {
  return Array.isArray(data) ? data.map(jasennaJulkaisu) : []
}

export function julkaisunAikaraja(nyt: Date = new Date()): Date {
  const raja = new Date(nyt)
  raja.setMonth(raja.getMonth() - IKKUNA_KUUKAUSIA)
  return raja
}

/* Asiakastarinoissa on myos muuta kuin rakennushankkeita. */
const EI_KOHDE = /kehityshanke|katselmoin|drone|lokerik|puuteknise|sisäilmaa|maalämmöllä/i

export function onKeskenLuokassa(j: Pick<TilapalvelutJulkaisu, "luokat">): boolean {
  return j.luokat.includes(TULEVAT) || j.luokat.includes(MENEILLAAN)
}

export function lapaiseeSuodatuksen(
  j: Pick<TilapalvelutJulkaisu, "otsikko" | "pvm" | "luokat">,
  aikaraja: Date = julkaisunAikaraja()
): boolean {
  if (EI_KOHDE.test(j.otsikko)) return false
  if (onKeskenLuokassa(j)) return true
  return !j.pvm || j.pvm >= aikaraja
}

/*
 * Kustannusarvio on kentassa muodossa "22 900 000 euroa", "Noin 9,2
 * miljoonaa euroa", "6 050 000" tai "Vapaa-aikakeskuksen osuus on
 * 12 600 000 euroa". Ensimmainen luku ratkaisee.
 */
export function kustannus(arvo: string | undefined): number | null {
  if (!arvo) return null
  const milj = arvo.match(/(\d+(?:[,.]\d+)?)\s*(?:milj|M€)/i)
  if (milj) return Math.round(Number(milj[1].replace(",", ".")) * 1_000_000)
  const euro = arvo.match(/\d{1,3}(?:[  ]\d{3})+|\d{5,}/)
  if (!euro) return null
  const luku = Number(euro[0].replace(/[  ]/g, ""))
  return luku >= 100_000 ? luku : null
}

const KUUKAUSI = `(${Object.keys(MONTHS).join("|")})\\w*\\s+(\\d{4})`

/*
 * Rakentamisen aloitus aikataulusta: "Rakentaminen: Uudet rakennustyot
 * alkavat maaliskuussa 2027", "Rakennustyot aloitettiin huhtikuussa
 * 2024" tai jakso "Elokuu 2026 – elokuu 2028". Kuun ensimmainen paiva.
 */
export function aloitus(aikataulu: string | undefined): string | null {
  if (!aikataulu) return null
  const osumat = [
    aikataulu.match(new RegExp(`rakenn\\w*[^.•]{0,40}?(?:alka\\w*|aloit\\w*|käynnisty\\w*)[^.•]{0,20}?\\b${KUUKAUSI}`, "i")),
    aikataulu.match(new RegExp(`^\\s*${KUUKAUSI}\\s*[–-]`, "i")),
  ]
  const osuma = osumat.find(Boolean)
  if (!osuma) return null
  const kk = MONTHS[osuma[1].toLowerCase()]
  return kk ? `${osuma[2]}-${String(kk).padStart(2, "0")}-01` : null
}

const kuunLoppu = (kuukausi: number, vuosi: number): string =>
  new Date(Date.UTC(vuosi, kuukausi, 0)).toISOString().slice(0, 10)

const KAUSI: Record<string, number> = { keväällä: 5, kesällä: 8, syksyllä: 11, talvella: 12, loppuvuonna: 12 }

/*
 * VALMISTUMINEN AIKATAULUKENTASTA: MYOHAISIN VOITTAA.
 *
 * Kentta voi kertoa useamman vaiheen ("B- ja C-rakennukset valmistuivat
 * elokuussa 2026. A-rakennus valmistuu kesalla 2027"). Ensimmainen osuma
 * olisi antanut menneen paivan, ja valmistumisajo olisi siirtanyt kesken
 * olevan hankkeen valmiiksi. Mennyt aikamuoto ("valmistuivat",
 * "paattyivat") kelpaa, koska kentta kertoo hankkeen omasta
 * aikataulusta eika naapurirakennuksesta.
 */
export function valmistuminen(aikataulu: string | undefined): string | null {
  if (!aikataulu) return null
  const paivat: string[] = []
  /* 80 merkkia: "valmistuivat elo-syyskuun vaihteessa ja vapaa-aikakeskuksen joulukuussa 2025". */
  const kuukausi = new RegExp(`(?:valmist\\w*|päätty\\w*|käyttöön)[^.•]{0,80}?\\b${KUUKAUSI}`, "gi")
  for (const m of aikataulu.matchAll(kuukausi)) {
    const kk = MONTHS[m[1].toLowerCase()]
    if (kk) paivat.push(kuunLoppu(kk, Number(m[2])))
  }
  const kausi = new RegExp(`(?:valmist\\w*|käyttöön)[^.•]{0,40}?\\b(${Object.keys(KAUSI).join("|")})\\s+(\\d{4})`, "gi")
  for (const m of aikataulu.matchAll(kausi)) paivat.push(kuunLoppu(KAUSI[m[1].toLowerCase()], Number(m[2])))
  /* Jakso "Elokuu 2026 – elokuu 2028": loppu. */
  const jakso = aikataulu.match(new RegExp(`[–-]\\s*${KUUKAUSI}`, "i"))
  if (jakso && MONTHS[jakso[1].toLowerCase()]) paivat.push(kuunLoppu(MONTHS[jakso[1].toLowerCase()], Number(jakso[2])))
  return paivat.sort().at(-1) ?? null
}

/*
 * VAIHE. Valmistuminen ensin (otsikko tai ingressi), sitten alkanut
 * rakentaminen, sitten valittu urakoitsija. "Tulevat"-luokassa oleva
 * hanke voi jo olla tyomaalla (Peltolammi: elokuu 2026 – elokuu 2028),
 * joten luokka ei yksin riita.
 */
export function vaihe(
  j: Pick<TilapalvelutJulkaisu, "otsikko" | "teksti" | "luokat">,
  alku: string | null,
  valmistuu: string | null,
  urakoitsija: string | null,
  nyt: Date = new Date()
): string {
  const tanaan = nyt.toISOString().slice(0, 10)
  const tuleva = j.luokat.includes(TULEVAT)
  const meneillaan = j.luokat.includes(MENEILLAAN)
  /*
   * Mennyt valmistumispaiva ratkaisee myos "Meneillaan"-luokassa:
   * Kissanmaan koulu on luokassa yha, vaikka tyot paattyivat lokakuussa
   * 2025. Otsikon "valmistui" ei riita sinne, koska Harjun koulun
   * otsikko kertoo vain ensimmaisen vaiheen valmistumisesta.
   */
  if (!tuleva && valmistuu && valmistuu < tanaan) return PHASE_LABELS.completed
  if (!tuleva && !meneillaan && onValmistunut(j.otsikko, j.teksti)) return PHASE_LABELS.completed
  if (alku && alku <= tanaan) return PHASE_LABELS.construction
  if (meneillaan) return PHASE_LABELS.construction
  if (tuleva) {
    if (alku || urakoitsija || /urakoitsija\w*\s+valik|yhteistyökumppaniksi valik/i.test(j.teksti))
      return PHASE_LABELS.contract_awarded
    return PHASE_LABELS.planning
  }
  /* Asiakastarina ilman aikataulua: kesken on pienempi virhe kuin piilotus. */
  return PHASE_LABELS.construction
}

/*
 * KOKONAISUUDEN VALMISTUMINEN, KUN VAIHEITA ON MONTA.
 *
 * Takahuhdin juttu (ei aikataulukenttaa) sanoo "Paivakotirakennus
 * valmistuu vuonna 2027" ja "Vuoteen 2029 mennessa koulun B-rakennus on
 * remontoitu"; otsikko "Valmista 2029". Tekstipoimija otti ensimmaisen,
 * ja valmistumisajo olisi sulkenut hankkeen kaksi vuotta liian aikaisin
 * (Johannes 24.10.2026). Myohaisin ilmoitettu vuosi voittaa.
 */
export function kokonaisuudenValmistuminen(otsikko: string, teksti: string): string | null {
  const vuodet = [
    ...`${otsikko} ${teksti}`.matchAll(/vuoteen\s+(20\d\d)\s+mennessä|valmista\w*\s+(?:vuonna\s+)?(20\d\d)/gi),
  ].map((m) => m[1] ?? m[2])
  const paivat = vuodet.map((v) => `${v}-12-31`)
  /* "Rakennustyöt kestävät kesäkuuhun 2027" (Turtola): kuun loppu. */
  for (const m of teksti.matchAll(/(?:kestävät|jatkuvat)\s+(\S+?kuu)hun\s+(20\d\d)/gi)) {
    const kk = MONTHS[m[1].toLowerCase()]
    if (kk) paivat.push(kuunLoppu(kk, Number(m[2])))
  }
  return paivat.sort().at(-1) ?? null
}

const SUUNNITTELU: [RegExp, string][] = [
  [/^(pää- ja )?arkkitehti(suunnittel\w*)?$/i, "architectural_design"],
  [/^rakennesuunnittel/i, "structural_design"],
  [/^lvia?-suunnittel/i, "hvac_design"],
  [/^sähkösuunnittel/i, "electrical_design"],
  [/^pohjarakennesuunnittel/i, "geotechnical_design"],
]

const PAAURAKOITSIJA =
  /^(pää- ja rakennusurakoitsija|pääurakoitsija|rakennusurakoitsija|kvr-urakoitsija|kokonaisurakoitsija|projektinjohtourakoitsija)$/i

export function tilapalvelutEhdokkaat(j: TilapalvelutJulkaisu, nyt: Date = new Date()) {
  const k = j.kentat
  const sijainti = k.get("sijainti") ?? null
  const aikataulu = k.get("aikataulu") ?? ""
  /*
   * Kunta vain sijaintikentasta ("Pallotie 5, Ylöjärvi"), muuten Tampere:
   * Tilapalvelut rakennuttaa Tampereen kaupungille. Otsikkoa ei kayteta,
   * koska Tampereen kaupunginosat ovat kuntien nimia ("Tammelan koulu"
   * -> Tammela, kuivaharjoitus 24.10.2026).
   */
  const city = (sijainti ? detectCityFromText(sijainti.toLowerCase()) : null) ?? "Tampere"
  const location = sijainti ? (/\d{5}|,/.test(sijainti) ? sijainti : `${sijainti}, ${city}`) : null

  const suunnittelijat: Record<string, string> = {}
  const aliurakoitsijat: { yritys: string; tyo: string; lahde: string }[] = []
  let builder: string | null = null
  for (const [otsake, arvo] of k) {
    const s = SUUNNITTELU.find(([re]) => re.test(otsake))
    if (s && !suunnittelijat[s[1]]) suunnittelijat[s[1]] = arvo
    else if (PAAURAKOITSIJA.test(otsake)) builder = builder ?? arvo
    /* "Sähköurakoitsija" -> "sähköurakka", sama muoto kuin kasin kirjatuissa. */
    else if (/urakoitsija$/i.test(otsake))
      aliurakoitsijat.push({ yritys: arvo, tyo: otsake.replace(/urakoitsija$/i, "urakka"), lahde: j.osoite })
  }

  const alku = aloitus(aikataulu)
  const pvm = j.pvm ? j.pvm.toISOString() : null
  const valmistuu = [
    valmistuminen(aikataulu) ?? parseEstimatedCompletionDate(j.teksti, pvm),
    kokonaisuudenValmistuminen(j.otsikko, j.teksti),
  ]
    .filter((p): p is string => Boolean(p))
    .sort()
    .at(-1) ?? null
  const phase = vaihe(j, alku, valmistuu, builder, nyt)
  const cost = kustannus(k.get("kustannusarvio"))

  return [
    {
      name: j.otsikko,
      description: j.teksti || null,
      city,
      region: getMunicipalityByName(city)?.region ?? null,
      location,
      developer: TILAPALVELUT,
      builder,
      phase,
      completed: phase === PHASE_LABELS.completed,
      property_type: inferBuildingType(j.otsikko, j.teksti),
      estimated_completion: valmistuu,
      construction_start: alku,
      ...(cost ? { estimated_cost: cost } : {}),
      source_url: j.osoite,
      confidence: 0.75,
      source_name: "tampereen_tilapalvelut",
      metadata: {
        ...suunnittelijat,
        ...(cost ? { estimated_cost: cost, cost_source: "text" } : {}),
        ...(aikataulu ? { rakentamisen_aikataulu: aikataulu } : {}),
        ...(aliurakoitsijat.length ? { aliurakoitsijat } : {}),
        related_companies: mergeCompanyNames([], [TILAPALVELUT, ...Object.values(suunnittelijat)]),
        contact_persons: j.yhteys
          ? [{ ...j.yhteys, organization: TILAPALVELUT, kind: "person", level: "project", source: j.osoite }]
          : [],
        field_sources: {
          developer: "julkaisija",
          builder: builder ? "kentta" : null,
          location: sijainti ? "kentta" : null,
          estimated_cost: cost ? "kentta" : null,
          phase: "luokitus+aikataulu",
        },
      },
    },
  ]
}

export async function haeTilapalveluidenJulkaisut(): Promise<TilapalvelutJulkaisu[]> {
  const ohjain = new AbortController()
  const kello = setTimeout(() => ohjain.abort(), AIKAKATKAISU_MS)
  try {
    const res = await fetch(RAJAPINTA, {
      signal: ohjain.signal,
      cache: "no-store",
      headers: { "user-agent": UA },
    })
    if (!res.ok) return []
    return jasennaJulkaisut(await res.json())
  } catch {
    return []
  } finally {
    clearTimeout(kello)
  }
}

export async function fetchTilapalvelutSource() {
  const julkaisut = await haeTilapalveluidenJulkaisut()
  const raja = julkaisunAikaraja()
  return julkaisut.filter((j) => lapaiseeSuodatuksen(j, raja)).flatMap((j) => tilapalvelutEhdokkaat(j))
}
