import * as cheerio from "cheerio"
import { detectCityFromText } from "./detectCityFromText"
import { inferBuildingType } from "./buildingType"
import { PHASE_LABELS } from "@/lib/projects/phases"

/*
 * NCC:N PROJEKTISIVUT — mitattuna rikkain yrityslähde.
 *
 * Mitattu 19.8.2026 kaikilta 21 hankesivulta:
 *   osoite            20/21   (katuosoite postinumeroineen)
 *   suunnittelijoita  20/21   (arkkitehti, rakenne, TATE, sähkö, geo)
 *   rakennuttaja      15/21
 *   käynnissä         18/21   (valmistuneita 0)
 *
 * KAKSI KENTTÄÄ JOITA MIKÄÄN MUU LÄHDE EI TUOTA:
 *
 * 1. Katuosoite postinumeroineen ("Rauhankatu 17, 00170 Helsinki"). Se on
 *    duplikaattitäsmäytyksen vahvin avain ja puuttuu käytännössä kaikilta
 *    muilta lähteiltä.
 * 2. Suunnittelijat urakkalajeittain. Kannassa on jo sarakkeet
 *    arkkitehti-, rakenne-, LVIA-, sähkö- ja pohjarakennesuunnittelulle
 *    (ks. projectCompanies.ts), mutta yksikään lähde ei ole täyttänyt
 *    niitä. Nämä eivät kulje `importCandidate`in läpi omina sarakkeinaan,
 *    joten ne tallennetaan metadataan ja liittyviin yrityksiin.
 *
 * TIETOLOHKO ON YKSI <ul>. Sivulla voi olla sisäkkäisiä lohkoja, jolloin
 * kaikkien <strong>-osumien kerääminen toistaa samat kentät moneen kertaan
 * (todettu OYS-sivulla). Siksi valitaan se yksi lista jossa kenttiä on
 * eniten.
 */

const LISTING_URL = "https://www.ncc.fi/projektit/"

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

/* Kenttänimen vaihtelevat muodot samaan avaimeen. */
const DESIGN_FIELDS: [RegExp, string][] = [
  [/^arkkitehtisuunnittel/i, "architectural_design"],
  [/^rakennesuunnittel/i, "structural_design"],
  [/^(tate|lvia|lvis|lvisa|lvias)[-\s]/i, "hvac_design"],
  [/^sähkösuunnittel/i, "electrical_design"],
  [/^(pohjarakenne|geo)[-\s]?suunnittel/i, "geotechnical_design"],
]

export function parseNccBuildTime(value: string): {
  startsAt: string | null
  endsAt: string | null
} {
  /* "5/2026 - 9/2028", "10/2025 – syksy 2030", "03/2025 – 04/2027" */
  const parts = value.split(/[-–]/).map((p) => p.trim())

  const toIso = (part: string | undefined): string | null => {
    if (!part) return null
    const withMonth = part.match(/(\d{1,2})\s*\/\s*(20\d\d)/)
    if (withMonth) {
      const month = String(Number(withMonth[1])).padStart(2, "0")
      return `${withMonth[2]}-${month}-01`
    }
    const yearOnly = part.match(/(20\d\d)/)
    return yearOnly ? `${yearOnly[1]}-12-31` : null
  }

  return { startsAt: toIso(parts[0]), endsAt: toIso(parts[parts.length - 1]) }
}

/*
 * Otsikko on muotoa "Kansallisarkiston peruskorjaus, Helsinki" — kaupunki
 * on viimeisen pilkun jälkeen. Se on luotettavampi kuin leipätekstistä
 * arvaaminen, koska NCC nimeää sivut näin järjestelmällisesti.
 */
export function cityFromNccTitle(title: string): string | null {
  const tail = title.split(",").pop()?.trim()
  return tail ? detectCityFromText(tail) : null
}

export async function fetchNccProjectsSource() {
  const response = await fetch(LISTING_URL, { headers: { "User-Agent": UA } })
  if (!response.ok) return []

  const $ = cheerio.load(await response.text())

  const seen = new Set<string>()
  const results: any[] = []

  $('a[href*="/projektit/"]').each((_, el) => {
    const href = $(el).attr("href") ?? ""
    if (!href || /\/projektit\/?$/.test(href)) return

    const url = href.startsWith("http") ? href : `https://www.ncc.fi${href}`
    if (seen.has(url)) return
    seen.add(url)

    /*
     * Nimi luetaan hankesivulta rikastuksessa; listauksesta saatava
     * polkunimi kelpaa tunnisteeksi siihen asti.
     */
    const slug = url.split("/projektit/")[1]?.replace(/\/$/, "") ?? ""
    if (!slug) return

    const name = slug
      .replace(/-/g, " ")
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")

    results.push({
      name,
      city: null,
      region: null,
      location: null,
      phase: PHASE_LABELS.construction,
      source_url: url,
      confidence: 0.75,
      completed: false,
      source_name: "ncc_projektit",
    })
  })

  return results
}

export function extractNccFields($: cheerio.CheerioAPI): Map<string, string> {
  const isField = (text: string) => /:$/.test(text.trim()) && text.trim().length < 44

  /*
   * TUOREIN LOHKO, EI RIKKAIN.
   *
   * Osa sivuista kuvaa useaa vaihetta samasta hankkeesta omina
   * listoinaan: OYS 2030 -sivulla on kolme (10/2025-2030, 1/2022-6/2025,
   * 1/2019-5/2023). Pelkkä "eniten kenttiä" osui vanhimpaan, jolloin
   * käynnissä oleva hanke merkittiin valmistuneeksi (mitattu 19.8.2026).
   *
   * Valitaan siksi se lohko jonka rakennusaika päättyy myöhimmin — se on
   * hankkeen nykyinen vaihe.
   */
  let best: any = null
  let bestKey = ""

  $("ul").each((_, el) => {
    const fieldCount = $(el)
      .find("strong")
      .filter((__, s) => isField($(s).text()))
      .length

    if (fieldCount === 0) return

    const time = $(el)
      .find("li")
      .filter((__, li) => /rakennusaika/i.test($(li).find("strong").first().text()))
      .first()
      .text()

    const years = Array.from(time.matchAll(/(20\d\d)/g)).map((m) => m[1])
    const latest = years.length ? years.sort().at(-1)! : "0000"

    /* Ensisijaisesti myöhäisin loppuvuosi, tasapelissä eniten kenttiä. */
    const key = `${latest}-${String(fieldCount).padStart(3, "0")}`

    if (key > bestKey) {
      bestKey = key
      best = el
    }
  })

  const fields = new Map<string, string>()
  if (!best) return fields

  $(best)
    .find("li")
    .each((_, li) => {
      const label = $(li).find("strong").first().text().trim()
      if (!isField(label)) return

      const value = $(li).text().replace(label, "").replace(/\s+/g, " ").trim()
      const key = label.replace(/:$/, "").toLowerCase()

      /*
       * ENSIMMÄINEN ARVO VOITTAA. Osa sivuista luettelee saman hankkeen
       * useita vaiheita peräkkäin samassa listassa (OYS 2030: 10/2025-2030,
       * 1/2022-6/2025, 1/2019-5/2023). Ylikirjoittava set() jätti voimaan
       * VIIMEISEN eli vanhimman, jolloin käynnissä oleva hanke merkittiin
       * valmistuneeksi. Sivun ylin lohko on tuorein.
       */
      if (!value) return

      /*
       * RAKENNUSAIKA: MYÖHÄISIN VOITTAA, MUUT: ENSIMMÄINEN.
       *
       * Sivu voi luetella saman hankkeen useita vaiheita samassa listassa
       * (OYS 2030: 1/2019-5/2023, 1/2022-6/2025, 10/2025-syksy 2030), eikä
       * niiden JÄRJESTYS kerro tuoreutta — tällä sivulla ylin on vanhin.
       * Vaihe on kuitenkin asiakkaalle näkyvä tieto, joten se ratkaistaan
       * päivämäärästä eikä sijainnista: käynnissä oleva hanke ei saa näkyä
       * valmistuneena (mitattu 19.8.2026).
       */
      if (key === "rakennusaika") {
        const previous = fields.get(key)
        const latest = (text: string) =>
          Array.from(text.matchAll(/(20\d\d)/g)).map((m) => m[1]).sort().at(-1) ?? ""

        if (!previous || latest(value) > latest(previous)) fields.set(key, value)
        return
      }

      if (!fields.has(key)) fields.set(key, value)
    })

  return fields
}

export async function enrichNccProject(candidate: any): Promise<any> {
  if (!candidate?.source_url) return candidate

  const response = await fetch(candidate.source_url, { headers: { "User-Agent": UA } })
  if (!response.ok) return candidate

  const $ = cheerio.load(await response.text())

  const title =
    $("h1").first().text().replace(/\s+/g, " ").trim() ||
    $('meta[property="og:title"]').attr("content") ||
    candidate.name

  const fields = extractNccFields($)

  $("script, style, noscript, nav, header, footer").remove()
  /* Koko runko vaihepäättelyyn, katkaistu vain talletusta varten. */
  const fullText = $("body").text().replace(/\s+/g, " ").trim()
  const description = fullText.slice(0, 4000)

  const address = fields.get("osoite") ?? null
  const developer = fields.get("rakennuttaja") ?? fields.get("tilaaja") ?? null
  const buildTime = fields.get("rakennusaika") ?? null
  const scope = fields.get("laajuus") ?? null

  const { startsAt, endsAt } = buildTime
    ? parseNccBuildTime(buildTime)
    : { startsAt: null, endsAt: null }

  /* Suunnittelijat urakkalajeittain omiin avaimiinsa. */
  const designers: Record<string, string> = {}
  for (const [label, value] of fields) {
    const match = DESIGN_FIELDS.find(([pattern]) => pattern.test(label))
    if (match && !designers[match[1]]) designers[match[1]] = value
  }

  /*
   * VAIHE PÄÄTELLÄÄN KOKO SIVUN RAKENNUSAJOISTA.
   *
   * Osa sivuista kokoaa saman hankkeen useita vaiheita (OYS 2030 kattaa
   * 2019-2030 kolmena jaksona), eikä yksittäinen lohko kerro hankkeen
   * tilaa. Jos MIKÄ TAHANSA sivulla mainittu rakennusaika ulottuu
   * tulevaisuuteen, hanke on kesken — valmistuneeksi merkitseminen
   * piilottaisi käynnissä olevan työmaan asiakkaalta.
   */
  const now = new Date().toISOString().slice(0, 10)
  const currentYear = now.slice(0, 4)

  const latestYearOnPage =
    Array.from(fullText.matchAll(/Rakennusaika:\s*([^A-ZÅÄÖ]{4,40})/g))
      .flatMap((m) => Array.from(m[1].matchAll(/(20\d\d)/g)).map((y) => y[1]))
      .sort()
      .at(-1) ?? null

  const stillRunning = Boolean(latestYearOnPage && latestYearOnPage >= currentYear)

  const phase = stillRunning
    ? startsAt && startsAt > now
      ? PHASE_LABELS.contract_awarded
      : PHASE_LABELS.construction
    : endsAt && endsAt < now
      ? PHASE_LABELS.completed
      : PHASE_LABELS.construction

  return {
    ...candidate,
    name: title,
    description,
    city: candidate.city ?? cityFromNccTitle(title) ?? detectCityFromText(address ?? ""),
    location: candidate.location ?? address,
    developer: candidate.developer ?? developer,
    /* Julkaisija on pääurakoitsija omilla projektisivuillaan. */
    builder: candidate.builder ?? "NCC",
    phase,
    property_type: candidate.property_type ?? inferBuildingType(title, description),
    estimated_completion: candidate.estimated_completion ?? endsAt,
    metadata: {
      ...(candidate.metadata ?? {}),
      ...designers,
      ...(scope ? { laajuus: scope } : {}),
      ...(startsAt ? { construction_starts_at: startsAt } : {}),
      related_companies: Object.values(designers),
      field_sources: {
        developer: developer ? "teksti" : null,
        builder: "julkaisija",
        location: address ? "teksti" : null,
        phase: buildTime ? "teksti" : null,
        estimated_completion: endsAt ? "teksti" : null,
      },
    },
  }
}
