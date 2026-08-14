import { extractReleaseBody } from "./companyRelease"
import { detectCityFromText } from "./detectCityFromText"
import { getMunicipalityByName } from "@/lib/geo/municipalities"

/*
 * Rakennuslehti (rakennuslehti.fi/feed) — alan uutislehden RSS. Kattaa juuri
 * ne isot yksityishankkeet (datakeskukset, tehtaat, toimitilat, sillat,
 * sähköasemat) jotka jäävät Hilman ja kaavalähteiden ulkopuolelle, koska
 * rakennuttaja on yksityinen eikä kilpailuta julkisesti.
 *
 * Syöte sisältää myös runsaasti kohinaa (yrityskaupat, osavuosikatsaukset,
 * suhdanneluvut, mielipiteet), joten suodatus on tiukka: otsikossa/kuvauksessa
 * on oltava selvä KONKREETTINEN rakennushanke-signaali EIKÄ yhtään poissulkevaa
 * talous-/yrityskauppa-/mielipidetermiä. Kaupunki päätellään tekstistä
 * (detectCityFromText, taivutukset mukana); jos ei löydy, jää tyhjäksi ja
 * ihminen täyttää. Confidence matala (0.5) — vapaamuotoinen uutinen,
 * tarkistetaan TIC:issä. Sama muoto kuin muut yrityslähteet (sources.ts).
 */

const FEED_URL = "https://www.rakennuslehti.fi/feed/"

// Konkreettinen rakennushanke — vähintään yhden oltava mukana.
const PROJECT_KEYWORDS = [
  "rakentaa",
  "rakennetaan",
  "rakennuttaa",
  "rakennushanke",
  "rakennustyöt",
  "rakennusurakka",
  "toteuttaa",
  "urakoi",
  "urakan",
  "urakka",
  "urakalle",
  "saneeraus",
  "peruskorjaus",
  "esirakenta",
  "datakeskus",
  "konesali",
  "tuotantolaitos",
  "tehdas",
  "tehtaan",
  "logistiikkakesk",
  "kerrostalo",
  "asuinkortteli",
  "asuntoja",
  "toimitilahanke",
  "toimitilat",
  "hotelli",
  "kampus",
  "sähköasema",
  "silta ",
  "tunneli",
  "laituri",
  "tiehank",
  "raitiotie",
  "ratikk",
  "päiväkoti",
  "hoivakoti",
  "uusi koulu",
  "kouluhanke",
  "sairaala",
  "kunnantoimisto",
]

// Poissulkevat termit — pudottavat vaikka jokin hanketermi osuisi
// (yrityskaupat, talousluvut, suhdanteet, mielipiteet, tapahtumat, henkilöuutiset).
const EXCLUDE_KEYWORDS = [
  "yrityskaup",
  "yritysost",
  "ostaa",
  "osti ",
  "myynnille",
  "myy tytär",
  "liikevaihto",
  "liikevaihdon",
  "liiketulos",
  "tilauskanta",
  "tilauskerty",
  "tilauskirja",
  "osavuosikats",
  "kvartaal",
  "neljänneksel",
  "vuosineljänn",
  "tulosohjeistus",
  "tulosvaroitus",
  "luottamus",
  "suhdann",
  "tilastokeskus",
  "hintaindeksi",
  "kustannusindeksi",
  "kustannukset nousi",
  "mielipide",
  "pääkirjoitus",
  "kolumni",
  "asiantuntija:",
  "tunnustus",
  "palkinto",
  "palkittiin",
  "maailmanperint",
  "messut",
  "mallitalo",
  "työntekijämäärä",
  "irtisano",
  "lomautt",
  "yt-neuvott",
  "konkurss",
  "nimitys",
  "uusi toimitusjohtaja",
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
    .replace(/&#0?39;/g, "'")
    .replace(/&#8211;/g, "–")
    .replace(/&#8221;|&#8220;/g, '"')
    .replace(/\s+/g, " ")
    .trim()
}

export async function fetchRakennuslehtiSource() {
  const results: any[] = []

  const response = await fetch(FEED_URL, {
    cache: "no-store",
    headers: { "user-agent": "Mozilla/5.0 (compatible; tyomaat.fi/1.0)" },
  })
  if (!response.ok) {
    throw new Error(
      `Rakennuslehden syötteen haku epäonnistui: ${response.status} ${response.statusText}`
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
    const city = detectCityFromText(haystack)
    const region = city ? getMunicipalityByName(city)?.region ?? null : null

    results.push({
      name: title,
      description,
      city, // valtakunnallinen syöte -> ei oletuskaupunkia; null jos ei tunnisteta
      region,
      location: null,
      phase: completed ? "Valmistunut" : "Suunnittelussa",
      source_url: link,
      confidence: 0.5,
      completed,
      source_name: "rakennuslehti",
    })
  }

  return results
}

/*
 * ARTIKKELIN LEIPÄTEKSTI RSS-INGRESSIN TILALLE.
 *
 * RSS antaa vain ingressin: mitattu 14.8.2026 "Nyab rakentaa sähköaseman
 * Forssaan" -rivillä kuvaus oli 56 merkkiä ("Rakentaminen alkaa
 * elokuussa ja valmista on vuonna 2028."). Artikkelin alusta löytyy
 * kaikki olennainen:
 *
 *   "Infrarakentaja Nyab on sopinut kantaverkkoyhtiö Fingridin kanssa
 *    Pikkumuolaan 400 kilovoltin sähköaseman rakentamisesta Forssassa.
 *    Projekti käynnistyy elokuussa 2026 ja valmistuu vuoden 2028 lopussa."
 *
 * eli urakoitsija, tilaaja, kohde, sijainti ja aikataulu.
 *
 * MAKSUMUURI ON KATKAISTAVA. Rakennuslehti näyttää vain alun, ja sen
 * jälkeen sivulla on kirjautumiskehotus ja lista MUIDEN artikkelien
 * otsikoita ("Luetuimmat artikkelit: Fira rakentaa ison datakeskuksen
 * hollantilaisyhtiölle..."). Ilman katkaisua ne päätyisivät hankkeen
 * kuvaukseen - sama saaste joka tuotti vääriä kohdetyyppejä ja
 * kustannuksia muissa lähteissä.
 */
const PAYWALL_MARKERS = [
  "Tämä artikkeli on tilaajille",
  "Kirjaudu sisään",
  "Luetuimmat artikkelit",
  "Hyödynnä 1kk",
  "Tilaa Rakennuslehti",
]

export function trimAtPaywall(text: string): string {
  let cut = text.length
  for (const marker of PAYWALL_MARKERS) {
    const at = text.indexOf(marker)
    if (at >= 0 && at < cut) cut = at
  }
  return text.slice(0, cut).trim()
}

export async function enrichRakennuslehtiCandidate(candidate: any): Promise<any> {
  if (!candidate?.source_url) return candidate

  try {
    const res = await fetch(candidate.source_url, {
      cache: "no-store",
      headers: { "user-agent": "Mozilla/5.0 (compatible; tyomaat.fi/1.0)" },
    })
    if (!res.ok) return candidate

    const body = trimAtPaywall(extractReleaseBody(await res.text()) ?? "")

    /*
     * Lyhyempi kuin RSS:n ingressi tarkoittaa että poiminta epäonnistui;
     * silloin pidetään se mitä oli.
     */
    if (body.length <= String(candidate.description ?? "").length) return candidate

    return { ...candidate, description: body }
  } catch {
    return candidate
  }
}
