import { detectCityFromText } from "./detectCityFromText"

/*
 * Helsingin kaupungin uutissyöte (hel.fi/fi/uutiset/rss). Syöte on yleinen
 * kaupunkiuutisvirta jossa rakennus- ja kaavahankkeet ovat vähemmistö
 * (tapahtumat, puistot, kulttuuri, terveys yms. hallitsevat), joten
 * suodatus on tiukka: otsikossa/kuvauksessa on oltava selvä rakentamis- tai
 * kaavoitustermi EIKÄ yhtään poissulkevaa tapahtuma-/kulttuuritermiä.
 *
 * Sama muoto kuin muut yrityslähteet (lib/agent/sources.ts): palautetaan
 * candidate-objekteja jotka discover→import-putki vie potential_projects-
 * jonoon (dedup source_url:lla). Confidence on matala (0.45), koska uutinen
 * on heikompi ja vapaamuotoisempi signaali kuin kaava- tai Hilma-lähde;
 * ihminen tarkistaa TIC:issä.
 */

const FEED_URL = "https://www.hel.fi/fi/uutiset/rss"

// Rakentamis-/kaavoitustermit — vähintään yhden oltava mukana.
const PROJECT_KEYWORDS = [
  "asemakaav",
  "kaavaehdotus",
  "kaavaluonnos",
  "kaavoituskatsaus",
  "täydennysrakenta",
  "asuinrakenta",
  "asuntorakenta",
  "asuinkortteli",
  "kerrostalo",
  "uudisrakenn",
  "rakennushanke",
  "rakennustyöt",
  "rakentaminen alka",
  "rakentaminen käyn",
  "tornitalo",
  "toimitilarakenta",
  "liikerakenta",
  "asuinalue",
  "puret",
  "purka",
  "purku",
  "uusi päiväkoti",
  "uusi koulu",
  "hoivakoti",
  "asuntoja ja liiketil",
  "asuntoja ja palvelu",
]

// Poissulkevat termit — pudottavat vaikka jokin projektitermi osuisi.
const EXCLUDE_KEYWORDS = [
  "tapahtuma",
  "juhla",
  "juhli",
  "festivaal",
  "näyttely",
  "konsertti",
  "avoimet ovet",
  "kysely",
  "rekry",
  "kesätyö",
  "stipendi",
  "apuraha",
  "avustusta",
  "rokote",
  "terveysasema aukiolo",
  "liikuntapuisto",
  "leikkipuisto",
  "koronaa",
  "äänestä",
  "webinaari",
  "asukasilta",
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
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
}

export async function fetchHelsinkiUutisetSource() {
  const results: any[] = []

  const response = await fetch(FEED_URL, { cache: "no-store" })
  if (!response.ok) {
    throw new Error(
      `Helsingin uutissyötteen haku epäonnistui: ${response.status} ${response.statusText}`
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

    results.push({
      name: title,
      description,
      // Kaupungin oma uutissyöte -> Helsinki, ellei teksti viittaa muuhun kuntaan.
      city: detectCityFromText(haystack) ?? "Helsinki",
      region: "Uusimaa",
      location: null,
      phase: completed ? "Valmistunut" : "Suunnittelussa",
      source_url: link,
      confidence: 0.45,
      completed,
      source_name: "helsinki_uutiset",
    })
  }

  return results
}
