import { detectCityFromText } from "./detectCityFromText"
import { extractStreetAddress } from "./extractStreetAddress"
import { extractExplicitClient } from "./fetchSttHakuSource"
import { inferBuildingType } from "./buildingType"
import { PHASE_LABELS } from "@/lib/projects/phases"

/*
 * NRC GROUP FINLANDIN PROJEKTISIVUT — infraa, sama kuvio kuin GRK:lla.
 *
 * MIKSI. Asiakas katsoi 15.10.2026 Turun raitiotietä eikä löytänyt NRC:tä
 * kunnolla. Hanke oli meillä, mutta vain GRK:n näkökulmasta
 * (`grk_projektit`): allianssin toinen rakentaja jäi yhden lauseen
 * sisään. NRC on iso rataan, siltoihin ja sähköasemiin erikoistunut
 * infratoimija, ja juuri infrassa kattavuutemme on ohuempi kuin
 * talonrakentamisessa.
 *
 * NRC:n oma hankesivu kertoo myös osapuolet täsmällisinä yhtiöniminä:
 * *"Turun kaupunki, Turun Raitiotie Oy, NRC Group Finland Oy, GRK Suomi
 * Oy, Ramboll Finland Oy ja Sweco Finland Oy ovat 28.9. allekirjoittaneet
 * sopimuksen..."* — GRK:n vastaavalla sivulla ne olivat vain proosana.
 *
 * SIVU ON NEXT.JS-SOVELLUS, JOTEN HTML:ÄÄ EI RAAVITA. Hankkeet ovat
 * valmiina sivun upotetussa `__NEXT_DATA__`-JSONissa (Craft CMS +
 * Apollo). Mitattu 15.10.2026: listaus antaa 47 hanketta 0,6 sekunnissa,
 * ja siinä on jo otsikko, kaupunki ja tila — joten tila voidaan suodattaa
 * ENNEN kuin yhtäkään hankesivua haetaan.
 *
 * VAIN KÄYNNISSÄ JA ALKAVAT. Mitattu jakauma: Käynnissä 26, Alkava 1,
 * Valmis 19, Valmistunut 1. Valmistunut referenssi ei ole mahdollisuus
 * ja hukuttaisi käynnissä olevat alleen — sama päätös kuin GRK:lla ja
 * Lujatalolla.
 */

const LISTAUS_URL = "https://www.nrcgroup.fi/projektit"

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

/* Hankesivuja haetaan korkeintaan parikymmentä; tämä pitää ajon sekunneissa. */
const CONCURRENCY = 6

/* Tilat jotka tarkoittavat "ei vielä valmis". */
const KAYNNISSA = new Set(["käynnissä", "alkava"])

export type NrcHanke = {
  otsikko: string
  url: string
  kaupunki: string | null
  tila: string | null
}

function lueNextData(html: string): Record<string, any> {
  const osuma = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/
  )
  if (!osuma) return {}
  try {
    const data = JSON.parse(osuma[1])
    return data?.props?.pageProps?.apolloState ?? {}
  } catch {
    return {}
  }
}

/*
 * Listaussivun hankkeet. Otsikko ei ole rivillä itsellään vaan
 * `hero`-viitteen takana samassa Apollo-välimuistissa.
 */
export function jasennaListaus(html: string): NrcHanke[] {
  const apollo = lueNextData(html)

  return Object.values(apollo)
    .filter((v: any) => v?.__typename === "projectItems_default_Entry")
    .map((v: any) => {
      const viite = Array.isArray(v.hero) ? v.hero[0]?.__ref : null
      const hero = viite ? apollo[viite] : null

      return {
        otsikko: String(hero?.moduleTitle ?? "").replace(/\s+/g, " ").trim(),
        url: String(v.url ?? ""),
        kaupunki: v.plainText ? String(v.plainText).trim() : null,
        tila: v.plainText2 ? String(v.plainText2).trim() : null,
      }
    })
    .filter((h) => h.otsikko && h.url)
}

export function onKaynnissa(tila: string | null | undefined): boolean {
  return KAYNNISSA.has(String(tila ?? "").trim().toLowerCase())
}

/*
 * Hankesivun leipäteksti — VAIN SEN OMAT LOHKOT.
 *
 * Ansa, joka jäi kiinni vasta kuivaharjoituksessa: jokaisen hankesivun
 * JSON sisältää myös muiden hankkeiden tekstilohkot ("Tutustu myös
 * näihin" ja listaus). Kun kaikki `textColumn_Entry`-lohkot luettiin,
 * Turun raitiotie sai kuvaukseksi Mäkelänkadun ajojohtojärjestelmän.
 * Näytti uskottavalta, oli väärä hanke.
 *
 * Siksi teksti haetaan sivun OMAN merkinnän kautta: etsitään entry jonka
 * `slug` vastaa osoitetta ja seurataan sen `modules`-viitteitä.
 * Toisten hankkeiden nostolohko (`modules_projects_BlockType`) jätetään
 * pois — se on linkkilista, ei tämän hankkeen sisältöä.
 */
function slugista(url: string): string {
  /*
   * Vain hakuosa ja ankkuri pois — EI merkkiluokkaa [/?#], joka katkaisi
   * osoitteen ensimmaiseen kauttaviivaan ja jatti slugiksi "https:".
   */
  return String(url).split(/[?#]/)[0].split("/").filter(Boolean).pop() ?? ""
}

function tekstiLohkosta(lohko: any, apollo: Record<string, any>): string[] {
  if (!lohko || lohko.__typename === "modules_projects_BlockType") return []

  const omat = Object.entries(lohko)
    .filter(([avain, arvo]) =>
      typeof arvo === "string" &&
      arvo.length > 10 &&
      /^(moduleTitle|text|plainText)/.test(avain)
    )
    .map(([, arvo]) => String(arvo))

  const lapset = Object.values(lohko)
    .filter((v: any): v is { __ref: string }[] => Array.isArray(v) && !!v[0]?.__ref)
    .flatMap((lista) => lista.flatMap((v) => tekstiLohkosta(apollo[v.__ref], apollo)))

  return [...omat, ...lapset]
}

export function jasennaHankesivu(html: string, url: string): string {
  const apollo = lueNextData(html)
  const slug = slugista(url)
  if (!slug) return ""

  const oma: any = Object.values(apollo).find(
    (v: any) => v?.__typename === "projectItems_default_Entry" && v?.slug === slug
  )
  if (!oma) return ""

  const viitteet = Object.entries(oma)
    .filter(([avain]) => avain.startsWith("modules("))
    .flatMap(([, arvo]: [string, any]) =>
      Array.isArray(arvo) ? arvo.map((v: any) => v?.__ref).filter(Boolean) : []
    )

  /* Sama lohko voi olla usean avaimen takana; luetaan kerran. */
  const nahdyt = new Set<string>()
  const palat: string[] = []
  for (const ref of viitteet) {
    if (nahdyt.has(ref)) continue
    nahdyt.add(ref)
    palat.push(...tekstiLohkosta(apollo[ref], apollo))
  }

  return palat
    .join(" ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
}

async function haeHtml(url: string): Promise<string | null> {
  try {
    const vastaus = await fetch(url, {
      cache: "no-store",
      headers: { "user-agent": UA },
    })
    if (!vastaus.ok) return null
    return await vastaus.text()
  } catch {
    return null
  }
}

export async function fetchNrcProjectsSource() {
  const listaus = await haeHtml(LISTAUS_URL)
  if (!listaus) return []

  const hankkeet = jasennaListaus(listaus).filter((h) => onKaynnissa(h.tila))

  const results: any[] = []
  const jono = [...hankkeet]

  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (jono.length) {
        const hanke = jono.shift()
        if (!hanke) break

        const html = await haeHtml(hanke.url)
        if (!html) continue

        const kuvaus = jasennaHankesivu(html, hanke.url)
        /*
         * Tyhjä sivu ei ole hanke. Raja on matala tarkoituksella: NRC:n
         * sivut ovat lyhyitä, eikä puuttuva teksti tee hankkeesta
         * olematonta — mutta ilman mitään tekstiä ei ole mitä katselmoida.
         */
        if (kuvaus.length < 80) continue

        results.push({
          name: hanke.otsikko,
          /*
           * Kaupunki tulee listauksesta, mutta se voi olla alue
           * ("Etelä-Suomi", "Luumäki–Imatra-rata"), joten se varmistetaan
           * kuntatunnistuksella ennen kuin se kelpaa kaupungiksi.
           */
          city:
            detectCityFromText(hanke.kaupunki ?? "") ??
            detectCityFromText(hanke.otsikko) ??
            detectCityFromText(kuvaus),
          region: null,
          location: extractStreetAddress(kuvaus),
          phase: PHASE_LABELS.construction,
          description: kuvaus.slice(0, 4000),
          /* Tilaaja vain yksiselitteisestä maininnasta, ei arvauksesta. */
          developer: extractExplicitClient(kuvaus),
          /* Julkaisija on urakoitsija omilla projektisivuillaan. */
          builder: "NRC Group Finland Oy",
          property_type: inferBuildingType(hanke.otsikko, kuvaus),
          source_url: hanke.url,
          confidence: 0.65,
          completed: false,
          source_name: "nrc_projektit",
        })
      }
    })
  )

  return results
}
