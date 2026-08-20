/*
 * LUPAPISTEEN KUULUTUKSEN PÄÄTÖS-PDF.
 *
 * MIKSI TÄMÄ ON PAKKO TEHDÄ HETI KERÄYSVAIHEESSA. Kuulutus poistetaan
 * verkosta muutoksenhakuajan päätyttyä ("Julkaisu poistuu verkosta"), ja
 * sen mukana PDF. Mitattu 21.8.2026 otoksesta 25 tallennettua kuulutusta:
 * 15:ltä PDF irtosi vielä, 10:ltä ei enää. Jos tekstiä ei oteta talteen
 * silloin kun se on saatavilla, sitä ei saa myöhemmin mistään.
 *
 * MITÄ SE TUO. Rajapinta antaa vain lyhyen toimenpidetekstin (mitattu
 * 15–119 merkkiä), PDF keskimäärin 6 554 merkkiä. Ero ei ole kosmeettinen:
 * Vantaan LP-092-2026-02341 on rajapinnassa "Rakentamista valmistelevat
 * työt", mutta PDF kertoo että kyse on TULEVIEN DATAKESKUSRAKENNUSTEN ja
 * lämmöntalteenottorakennuksen pohjatöistä, kaivualue 42 465 m² ja
 * louhinta-alue 22 621 m². Ilman PDF:ää iso datakeskushanke näyttää
 * rutiinikaivuulta.
 *
 * OSOITE LÖYTYI SOVELLUKSEN OMASTA KOODISTA. Arvatut polut palauttivat
 * 404/401; oikea muoto on bulletins.js:ssä.
 */

const BULLETINS_PAGE = "https://julkipano.lupapiste.fi/app/fi/bulletins"

/* Yksi PDF on satoja kilotavuja, joten hidas vastaus ei saa jumittaa ajoa. */
const TIMEOUT_MS = 20000

export type LupapisteCsrf = { token: string; cookie: string }

export async function fetchLupapisteCsrf(): Promise<LupapisteCsrf | null> {
  try {
    const response = await fetch(BULLETINS_PAGE, { cache: "no-store" })
    const match = (response.headers.get("set-cookie") ?? "").match(/anti-csrf-token=([^;]+)/)
    if (!match) return null
    return { token: decodeURIComponent(match[1]), cookie: `anti-csrf-token=${match[1]}` }
  } catch {
    return null
  }
}

export function bulletinPdfUrl(bulletinId: string): string {
  return `https://julkipano.lupapiste.fi/api/raw/download-bulletin-doc?bulletinId=${encodeURIComponent(bulletinId)}`
}

/*
 * Siivoaa PDF-tekstin vertailukelpoiseksi. Päätösasiakirjassa rivit
 * katkeavat kesken lauseen, ja henkilötiedot on peitetty mustilla
 * palkeilla, jotka tulevat tekstiin täyttömerkkeinä.
 */
export function cleanBulletinPdfText(text: string): string {
  return text
    .replace(/\r/g, "")
    /* Peitetyt henkilötiedot: pitkä jono täyttömerkkejä. */
    .replace(/[█▉▊▋▌▍▎▏]{2,}/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/*
 * Palauttaa null myös virhetilanteessa: PDF on lisätieto, eikä sen
 * puuttuminen saa estää kuulutuksen tallentamista. Poistunut kuulutus
 * vastaa 404:llä, mikä on normaali tilanne eikä virhe.
 */
export async function fetchLupapisteBulletinPdfText(
  bulletinId: string,
  csrf: LupapisteCsrf
): Promise<string | null> {
  if (!bulletinId) return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(bulletinPdfUrl(bulletinId), {
      headers: { "x-anti-forgery-token": csrf.token, cookie: csrf.cookie },
      cache: "no-store",
      signal: controller.signal,
    })
    if (!response.ok) return null

    const buffer = Buffer.from(await response.arrayBuffer())
    /* Poistunut kuulutus voi vastata 200:lla mutta HTML-sivulla. */
    if (buffer.slice(0, 4).toString("latin1") !== "%PDF") return null

    const { default: pdfParse } = await import("pdf-parse/lib/pdf-parse.js")
    const parsed = await pdfParse(buffer)
    const text = cleanBulletinPdfText(String(parsed?.text ?? ""))

    return text.length > 0 ? text : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/*
 * HANKKEEN KUVAUS PÄÄTÖSTEKSTISTÄ.
 *
 * Päätös on lomake, jossa kentän otsikko ja sisältö ovat samalla rivillä
 * ("LisäselvityksetHankkeen kuvaus hakemuksella"). Kuvaus on lainausmerkeissä
 * hakemuksesta siteerattuna — se on hakijan oma teksti ja siksi paras kuvaus
 * hankkeesta. Otsikko vaihtelee kunnittain, joten lainaus poimitaan sieltä
 * mistä se löytyy eikä kiinnitetä yhteen otsikkoon.
 */
export function extractApplicationDescription(pdfText: string | null): string | null {
  if (!pdfText) return null

  /*
   * ANKKUROIDAAN OTSIKKOON, EI PITUUTEEN. Ensimmäinen versio otti pisimmän
   * lainausmerkeissä olevan jakson. Mitattu 21.8.2026 viidellätoista
   * päätöksellä: se osui yhteen, ja sekin oli väärä kohta — poikkeamis-
   * päätöksen perustelu ("Autosuojan nykyinen sijainti ei muutu"), ei
   * hankkeen kuvaus. Päätöksissä on lainauksia muuallakin, joten pituus ei
   * erota niitä.
   *
   * Otsikkoon sidottuna poiminta on harvinaisempi mutta oikea: se osuu vain
   * kun päätöksessä oikeasti on hakijan kuvaus. Muissa tapauksissa
   * kuvaukseksi ei keksitä mitään — koko teksti jää silti talteen.
   */
  /*
   * Otsikon loppuosa vaihtelee kunnittain: "Hankkeen kuvaus hakemuksella"
   * (Vantaa) ja "Hankkeen kuvaus hakemuksessa" (mitattu 21.8.2026 toisessa
   * kunnassa). Ilman jalkimmaista poiminta alkoi sanoilla `hakemuksessa: "`.
   */
  const label =
    /(?:hankkeen kuvaus|rakennushankkeen kuvaus|hankekuvaus)(?:\s+hakemukse(?:lla|ssa|n mukaan))?\s*:?\s*/i
  const match = pdfText.match(label)
  if (!match || match.index == null) return null

  const after = pdfText.slice(match.index + match[0].length)

  /* Kuvaus on lainausmerkeissä siteerattuna hakemuksesta. */
  const quoted = after.match(/^\s*"([^"]{40,4000})"/)
  if (quoted) return quoted[1].replace(/\s*\n\s*/g, " ").trim()

  /* Ilman lainausmerkkejä: seuraava kappale tyhjään riviin asti. */
  const paragraph = after.split(/\n\s*\n/)[0]?.replace(/\s*\n\s*/g, " ").trim() ?? ""

  return paragraph.length >= 40 ? paragraph.slice(0, 4000) : null
}
