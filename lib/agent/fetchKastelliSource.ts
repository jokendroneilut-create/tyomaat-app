import { YRITYSTIEDOTTEEN_IKKUNA_KK } from "@/lib/agent/tiedotteenIkkuna"
import { detectCityFromText } from "./detectCityFromText"
import { extractStreetAddress } from "./extractStreetAddress"

/*
 * KASTELLI-TALOT: AJANKOHTAISTA (D-236).
 *
 * Johannes 6.10.2026 Kaarinan perhevuokra-asunnoista: *"lisataan
 * lahteeksi kastelli, tama olisi loydettavissa myos sielta."* Hanke tuli
 * Rakennuslehdesta; yhtion oma tiedote on kaksi paivaa vanhempi.
 *
 * WP REST API eika sivun kaavinta: www.kastelli.fi on WordPress ja
 * `/wp-json/wp/v2/posts` antaa otsikon, paivamaaran, ingressin ja
 * osoitteen valmiina. Sama ratkaisu kuin Firassa ja KAS Asunnoissa.
 * robots.txt kieltaa vain /wp-admin/.
 *
 * SUODATUS ON TAMAN LAHTEEN KOKO TYO. Kastelli myy talopaketteja
 * kuluttajille, joten "ajankohtaista" on paaosin markkinointia ja
 * henkilouutisia. Mitattu 6.10.2026: 71 julkaisua, joista 12 viimeisen
 * 12 kuukauden sisalla ja niista kaksi on rakennushanke:
 *
 *   30.9.2026  "Kastelli-talot rakentaa yli 50 laadukasta
 *               perhevuokra-asuntoa Kaarinaan"
 *   25.2.2026  "Kastelli-talot Oy rakentaa 65 rivitalovuokra-asuntoa
 *               Espoon Suurpeltoon"
 *
 * Loput ovat talomallien julkistuksia, hinnastoja, asuntomessuja ja
 * nimityksia. Siksi avainsanoissa vaaditaan MONEN ASUNNON kohde: yhden
 * perheen talopaketti ei ole urakoitsijalle liidi, ja juuri sita tama
 * sivu on enimmakseen tayna.
 */

const API_URL = "https://www.kastelli.fi/wp-json/wp/v2/posts"

/*
 * Monen asunnon kohde. "rakentaa" yksin paastaisi lapi jokaisen
 * talomallitiedotteen ("Kastelli rakentaa unelmiesi kodin").
 */
const PROJECT_KEYWORDS = [
  "vuokra-asunto",
  "vuokra-asuntoa",
  "vuokra-asuntoja",
  "perhevuokra-asunto",
  "rivitalovuokra-asunto",
  "asuntoa",
  "asuntoja",
  "rivitalo",
  "paritalo",
  "kerrostalo",
  "kortteli",
  "asuinalue",
  "hoivakoti",
  "palvelutalo",
  "urakka",
  "urakan",
  "urakoi",
]

/*
 * Kuluttajamarkkinointi ja yhtiouutiset. Nama on mitattu samasta
 * otoksesta: ilman niita suodattimen lapi menivat mm.
 * "Ennakkomarkkinoinnissa Espoossa muuttovalmis paritalo" ja
 * "Kastelli mukana Lempaalan Asuntomessuilla kahdella kohteella".
 *
 * POISSULKU KATSOO VAIN OTSIKKOA. Ingressiin osuessaan se hylkasi aidon
 * hankkeen: "Kastelli-talot Oy rakentaa 65 rivitalovuokra-asuntoa Espoon
 * Suurpeltoon" putosi sanasta "pientalobrandi", joka oli ingressin
 * ensimmaisessa lauseessa markkinointifraasina. Markkinointitiedote
 * kertoo luonteensa otsikossa, joten sielta se myos tunnistetaan.
 */
const EXCLUDE_KEYWORDS = [
  "ennakkomarkkinoin",
  "asuntomessu",
  "talomalli",
  "mallisto",
  "hinnat",
  "hinnasto",
  "ostopolku",
  "verkkosivu",
  "verkossa",
  "brandi",
  "brändi",
  "nimity",
  "toimitusjohtaja",
  "myyntijohtaja",
  "liiketoimintajohtaja",
  "osavuosikatsaus",
  "tilinpaatos",
  "tilinpäätös",
  "liikevaihto",
  "tulos kaantyi",
  "tulos kääntyi",
  "markkinajohtaja",
  "kampanja",
  "arvonta",
  "messuilla",
  "inspiroidu",
  "tutustu",
  "kastellibot",
]

const COMPLETED_KEYWORDS = [
  "valmistui",
  "valmistunut",
  "valmistuivat",
  "luovutettiin",
  "luovutti",
  "otettu käyttöön",
]

const puhdista = (teksti: unknown) =>
  String(teksti ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#8211;/g, "–")
    .replace(/&#8217;|&#039;|&#39;/g, "'")
    .replace(/&#8220;|&#8221;|&quot;/g, '"')
    .replace(/&#038;|&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()

export async function fetchKastelliSource() {
  const results: any[] = []

  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - YRITYSTIEDOTTEEN_IKKUNA_KK)

  const res = await fetch(
    `${API_URL}?per_page=50&_fields=id,date,link,title,excerpt`,
    { headers: { "user-agent": "Mozilla/5.0 (compatible; tyomaat.fi/1.0)" } }
  )
  if (!res.ok) return results

  const posts = (await res.json()) as any[]
  if (!Array.isArray(posts)) return results

  for (const post of posts) {
    const title = puhdista(post?.title?.rendered)
    const href = String(post?.link ?? "")
    if (!title || !href) continue

    const paivays = post?.date ? new Date(post.date) : null
    if (paivays && paivays < cutoff) continue

    const description = puhdista(post?.excerpt?.rendered) || null
    const haystack = `${title} ${description ?? ""}`.toLowerCase()

    if (!PROJECT_KEYWORDS.some((k) => haystack.includes(k))) continue
    if (EXCLUDE_KEYWORDS.some((k) => title.toLowerCase().includes(k))) continue

    const completed = COMPLETED_KEYWORDS.some((k) => haystack.includes(k))

    results.push({
      name: title,
      description,
      city: detectCityFromText(haystack),
      region: null,
      location: extractStreetAddress(description ?? ""),
      phase: completed ? "Valmistunut" : "Suunnittelussa",
      source_url: href,
      confidence: 0.6,
      completed,
      source_name: "kastelli",
    })
  }

  return results
}
