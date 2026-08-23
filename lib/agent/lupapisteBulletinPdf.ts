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

  /*
   * VAIN LAINAUSMERKEISSÄ. Kuvaus on siteerattu hakemuksesta, ja lainaus-
   * merkit ovat ainoa luotettava loppumerkki.
   *
   * Kappalehaara kokeiltiin ja poistettiin. Mitattu 21.8.2026 takautuvassa
   * ajossa: kuudesta poiminnasta kolme tuli kappalehaarasta ja KAIKKI KOLME
   * jatkuivat kuvauksen ohi päätösmääräyksiin ja sivunumeroon asti
   * ("...Kuusamon kaupunkiPäätösRAKENTAMISLUPA §21422.7.2026Sivu 1").
   * Syy on että näissä päätöksissä ei ole tyhjiä rivejä, joten kappaleen
   * loppua ei voi tunnistaa. Lainaushaaran kolme olivat puhtaita.
   */
  const quoted = after.match(/^\s*"([^"]{40,4000})"/)
  if (quoted) return quoted[1].replace(/\s*\n\s*/g, " ").trim()

  return null
}

/*
 * LOMAKEKENTÄT KUULUTUS-PDF:STÄ.
 *
 * `extractApplicationDescription` lukee kenttää "Hankkeen kuvaus", ja se
 * on oikea kenttä silloin kun se on olemassa — mutta mitattu 23.8.2026:
 * sitä on **3 dokumentissa 264:stä (1 %)**. Hyödyllinen teksti on
 * lähes aina muualla:
 *
 *   Toimenpide          244   92 %
 *   Kaavatilanne        210   80 %
 *   Pinta-ala           201   76 %
 *   Lisäselvitykset     114   43 %
 *   Kerrosala            86   33 %
 *
 * PDF-teksti on sarakkeetonta: otsikko ja arvo ovat kiinni toisissaan
 * ("LisäselvityksetToimistorakennus, LVI-muutos…"), joten arvo luetaan
 * otsikon jälkeen seuraavaan tunnettuun otsikkoon asti.
 */

/* Kaikki tunnetut otsikot, jotta arvo osataan katkaista oikeaan kohtaan. */
const BULLETIN_LABELS = [
  "Lupatunnus",
  "Kiinteistötunnus",
  "Kiinteistön osoite",
  "Pinta-ala",
  "Kaavatilanne",
  "Hankkeeseen ryhtyvä",
  "Toimenpide",
  "Lisäselvitykset",
  "Kerrosala",
  "Rakennuspaikka",
  "Hankkeen vaativuus",
  "Suunnittelun vaativuus",
  "Pääsuunnittelija",
  "Rakennustoimenpiteen yhteydessä",
  "Hakija",
  "Naapurien kuuleminen",
  "Lausunnot",
  "Päätös",
  "Muutoksenhaku",
  /*
   * Naita ei ollut ensimmaisessa listassa, ja arvo vuoti niiden yli:
   * "Toimistorakennus... Luvan rakennukset7529104289167Nuudisrakennus".
   */
  "Luvan rakennukset",
  "Luvan rakennelmat",
  "Rakennuksen tiedot",
  "Rakennelman tiedot",
  "Suunnittelijat",
  "Vastaava työnjohtaja",
  "Katselmukset",
  "Liitteet",
  "Maksut",
  "RAKENNUKSET",
  "Tarkemmat tiedot",
]

/*
 * Lomakekentän arvo on lyhyt. Pidempi tarkoittaa etta katkaisu ei osunut
 * ja teksti jatkuu seuraaviin osioihin - silloin on parempi jattaa
 * poimimatta kuin nayttaa asiakkaalle sekavaa jaannosta.
 */
const MAX_FIELD_LENGTH = 400

function labelValue(pdfText: string, label: string): string | null {
  const i = pdfText.indexOf(label)
  if (i < 0) return null

  const after = pdfText.slice(i + label.length)

  /* Katkaisu seuraavaan otsikkoon; ilman sitä arvo jatkuisi loppuun asti. */
  let end = after.length
  for (const other of BULLETIN_LABELS) {
    if (other === label) continue
    const j = after.indexOf(other)
    if (j >= 0 && j < end) end = j
  }

  const value = after.slice(0, end).replace(/\s+/g, " ").trim()

  /*
   * Tyhjä arvo on yleinen: "Hankkeeseen ryhtyvä" on kuulutuksissa
   * poistettu (D-102), jolloin otsikkoa seuraa suoraan seuraava otsikko.
   */
  return value.length >= 3 && value.length <= MAX_FIELD_LENGTH ? value : null
}

export type BulletinFields = {
  toimenpide: string | null
  lisaselvitykset: string | null
  kaavatilanne: string | null
  pintaAla: string | null
  kerrosala: string | null
}

export function extractBulletinFields(pdfText: string | null): BulletinFields {
  const t = cleanBulletinPdfText(pdfText ?? "")
  if (!t) {
    return { toimenpide: null, lisaselvitykset: null, kaavatilanne: null, pintaAla: null, kerrosala: null }
  }

  return {
    toimenpide: labelValue(t, "Toimenpide"),
    lisaselvitykset: labelValue(t, "Lisäselvitykset"),
    kaavatilanne: labelValue(t, "Kaavatilanne"),
    pintaAla: labelValue(t, "Pinta-ala"),
    kerrosala: labelValue(t, "Kerrosala"),
  }
}

/*
 * Kuvaus parhaasta saatavilla olevasta lähteestä, järjestyksessä:
 * hakijan oma kuvaus > lisäselvitykset > toimenpide.
 */
export function bestBulletinDescription(pdfText: string | null): string | null {
  const oma = extractApplicationDescription(pdfText)
  if (oma) return oma

  const f = extractBulletinFields(pdfText)
  return f.lisaselvitykset ?? f.toimenpide ?? null
}
