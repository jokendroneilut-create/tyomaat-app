import { isPersonName } from "@/lib/agent/vaylaContacts"
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
  "Kaavan käyttötarkoitus",
  "Rakennusoikeus",
  "Kokonaisala",
  "Tilavuus",
  "Hankkeeseen ryhtyvä",
  "Toimenpide",
  "Lisäselvitykset",
  "Kerrosala",
  "Rakennuspaikka",
  "Poikkeamispäätös",
  "Rakentamismääräykset",
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
  "RAKENNELMAT",
  "Tarkemmat tiedot",
  "Ennakkokatselmus",
  /* Poikkeamispaatoksissa omat osionsa. */
  "Poikkeamiset",
  "Poikkeaminen",
  "Perustelut",
  "Sovelletut oikeusohjeet",
  "Voimassaolo",
]

/*
 * Hallinnollista vakiotekstia, ei hankkeen kuvausta. Naita paatyi
 * Lisaselvitykset-kenttaan: "Rakentamislupahakemuksen kasittelysta
 * veloitetaan 988 euroa" ei kerro tyosta mitaan.
 */
const BOILERPLATE =
  /^(rakentamislupahakemuksen|lupahakemuksen|hakemuksen)\s+k[aä]sittelyst[aä]|^maksu|^p[aä][aä]t[oö]ksest[aä]\s+peritt[aä]v[aä]/i

/*
 * Kentän enimmäispituus RIIPPUU KENTÄSTÄ.
 *
 * Yksi yhteinen 400 merkin katto oli virhe: `Lisäselvitykset` on
 * vapaata tekstiä jonka mediaanipituus on 440 merkkiä, joten katto
 * hylkäsi 66 kenttää 119:stä (55 %). Juuri se teksti kertoo mitä
 * työmaalla tehdään:
 *
 *   "Tontilta puretaan vanha ammattioppilaitos kesän ja alkusyksyn
 *    2026 aikana (erillinen purkulupa LP-092-2024-06575), purkamisen
 *    jälkeen tontilla aloitettaisiin puiden kaataminen…"
 *
 * Lyhyillä rakenteisilla kentillä katto on edelleen tiukka, koska
 * niissä pitkä arvo tarkoittaa katkaisuvirhettä.
 */
const MAX_FIELD_LENGTH = 400
const MAX_FREE_TEXT_LENGTH = 2500
const FREE_TEXT_LABELS = new Set(["Toimenpide", "Lisäselvitykset"])

/*
 * Numerokentän arvo alkaa numerolla tai tehokkuusluvulla ("e=0,5").
 * Ilman tätä arvo vuoti seuraavaan osioon: "300 Poikkeamispä…" ja
 * "Sallittu uudisrakentaminen…" päätyivät rakennusoikeudeksi.
 */
const NUMERIC_LABELS = new Set([
  "Pinta-ala",
  "Kerrosala",
  "Rakennusoikeus",
  "Kokonaisala",
  "Tilavuus",
])
const NUMERIC_VALUE = /^(\d|e\s*=)/i

/*
 * Numerokentasta otetaan VAIN luku ja yksikko. Katkaisu seuraavaan
 * otsikkoon ei riita, koska PDF:ssa yksikko on pilkottu ("102 m 2") ja
 * seuraava otsikko voi olla kiinni siina: "102 m 2 Rakennusoikeus…".
 */
const NUMERIC_HEAD = /^((?:\d[\d\s.,]*|e\s*=\s*[\d.,]+)\s*(?:k-?m\s*2|kem\s*2|m\s*2|m\s*3|m²|m³|ha|kpl)?)/i

function numericHead(value: string): string | null {
  const m = value.match(NUMERIC_HEAD)
  if (!m) return null
  const head = m[1].replace(/\s+/g, " ").trim()
  return head.length >= 1 ? head : null
}

function labelValue(pdfText: string, label: string): string | null {
  const maxLength = FREE_TEXT_LABELS.has(label) ? MAX_FREE_TEXT_LENGTH : MAX_FIELD_LENGTH
  const i = pdfText.indexOf(label)
  if (i < 0) return null

  const after = pdfText.slice(i + label.length)

  /*
   * Katkaisu seuraavaan otsikkoon; ilman sitä arvo jatkuisi loppuun asti.
   *
   * VERTAILU ON KIRJAINKOKORIIPPUMATON. PDF:ssä otsikko voi olla
   * versaalina ("Eikaavaa TOIMENPIDE Vä…"), jolloin tarkka vertailu ei
   * osunut ja arvo vuoti seuraavaan osioon.
   */
  const afterLower = after.toLowerCase()
  let end = after.length
  for (const other of BULLETIN_LABELS) {
    if (other === label) continue
    const j = afterLower.indexOf(other.toLowerCase())
    if (j >= 0 && j < end) end = j
  }

  const value = after.slice(0, end).replace(/\s+/g, " ").trim()

  /*
   * Tyhjä arvo on yleinen: "Hankkeeseen ryhtyvä" on kuulutuksissa
   * poistettu (D-102), jolloin otsikkoa seuraa suoraan seuraava otsikko.
   */
  if (value.length < 3 || value.length > maxLength) return null
  if (BOILERPLATE.test(value)) return null
  if (NUMERIC_LABELS.has(label)) {
    if (!NUMERIC_VALUE.test(value)) return null
    return numericHead(value)
  }

  return value
}

export type BulletinFields = {
  toimenpide: string | null
  lisaselvitykset: string | null
  kaavatilanne: string | null
  /* "T-6; teollisuus- ja varastorakennusten korttelialue" */
  kaavanKayttotarkoitus: string | null
  pintaAla: string | null
  kerrosala: string | null
  rakennusoikeus: string | null
  kokonaisala: string | null
  tilavuus: string | null
}

export function extractBulletinFields(pdfText: string | null): BulletinFields {
  const t = cleanBulletinPdfText(pdfText ?? "")
  const tyhja: BulletinFields = {
    toimenpide: null, lisaselvitykset: null, kaavatilanne: null,
    kaavanKayttotarkoitus: null, pintaAla: null, kerrosala: null,
    rakennusoikeus: null, kokonaisala: null, tilavuus: null,
  }
  if (!t) return tyhja

  return {
    toimenpide: labelValue(t, "Toimenpide"),
    lisaselvitykset: labelValue(t, "Lisäselvitykset"),
    kaavatilanne: labelValue(t, "Kaavatilanne"),
    kaavanKayttotarkoitus: labelValue(t, "Kaavan käyttötarkoitus"),
    pintaAla: labelValue(t, "Pinta-ala"),
    kerrosala: labelValue(t, "Kerrosala"),
    rakennusoikeus: labelValue(t, "Rakennusoikeus"),
    kokonaisala: labelValue(t, "Kokonaisala"),
    tilavuus: labelValue(t, "Tilavuus"),
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

/*
 * VIRANOMAISET KUULUTUS-PDF:STÄ.
 *
 * D-102 totesi ettei kuulutuksista saa yhteystietoja, ja se pitää
 * paikkansa HAKIJASTA — se on peitetty. Mutta päätöksen tekijä on
 * nimetty, ja mitattu 23.8.2026:
 *
 *   Päättäjä      258 / 309   83 %
 *   Valmistelija   61 / 309   20 %
 *
 *   "Rakennustarkastaja Tero Hietala Kuusamon kaupunki"
 *   "LVI-insinööri Miranda Kyllönen Tampereen kaupunki"
 *
 * Nämä eivät ole myyntikontakteja vaan viranomaisia: he tuntevat
 * hankkeen muttei osta mitään. Siksi ne merkitään `role: "authority"`,
 * jotta käyttäjä näkee eron ennen kuin soittaa.
 *
 * Sähköpostia tai puhelinta ei ole. Pelkkä nimi ei muuten riitä
 * yhteystiedoksi, mutta näillä hankkeilla on jo kunnan kirjaamo (D-104),
 * ja pari "kirjaamo@kunta.fi + pyydä rakennustarkastaja Hietalaa" on
 * käyttökelpoisempi kuin pelkkä kirjaamo.
 */

/* Organisaation alku: tästä eteenpäin arvo ei ole enää henkilön nimi. */
/*
 * GENETIIVI ON OTETTAVA MUKAAN. Ensimmäinen versio katkaisi sanasta
 * "kaupunki", jolloin "Tampereen" jäi nimeen ja tulokseksi tuli
 * "Kyllönen Tampereen" — nimi ja organisaatio sekaisin. Organisaatio on
 * lähes aina muotoa "<paikka>n kaupunki", joten edeltävä n-loppuinen
 * sana kuuluu siihen.
 */
const OFFICIAL_ORG =
  /\b((?:[A-ZÅÄÖ][A-ZÅÄÖa-zåäö-]+n\s+)?[A-ZÅÄÖa-zåäö-]*(?:kaupunki|kunta|kaupungin|kunnan|rakennusvalvonta|lupayksikk|viranhaltija|lautakunta|jaosto|viranomainen)[A-ZÅÄÖa-zåäö-]*\b[\s\S]*)$/i

function parseOfficial(raw: string): { name: string; title: string | null; organization: string | null } | null {
  const arvo = String(raw ?? "").replace(/\s+/g, " ").trim()
  if (!arvo) return null

  const orgMatch = arvo.match(OFFICIAL_ORG)
  const organization = orgMatch ? orgMatch[1].trim() : null
  const ennenOrgia = orgMatch ? arvo.slice(0, arvo.length - orgMatch[1].length).trim() : arvo

  const sanat = ennenOrgia.split(/\s+/).filter(Boolean)
  if (sanat.length < 2) return null

  /*
   * Sotkuinen PDF tuottaa sanoja joissa valilyonnit ovat kadonneet
   * ("RakennustarkastajaRakentamislupa"). Niista ei saa nimea.
   */
  if (sanat.some((w) => w.length > 24)) return null

  /*
   * NIMESSÄ EI SAA OLLA ORGANISAATIOSANAA. Ilman tätä poiminta tuotti
   * nimiä "Neuvonen Rakennusvalvonta" ja "Laiteenmäki KURIKAN" —
   * organisaatio vuoti nimeen kun katkaisu ei osunut. Väärin kirjoitettu
   * ihmisen nimi on käyttäjälle pahempi kuin puuttuva.
   */
  const kaksiViimeista = sanat.slice(-2)
  if (
    kaksiViimeista.some(
      (w) =>
        /(valvonta|yksikk|virasto|kaupunki|kunta|lautakunta|viranhaltija|palvelut)$/i.test(w) ||
        (w.length > 2 && w === w.toUpperCase()) ||
        /*
         * Katkennut sana ei ole nimi: "Tavaststjerna Ää" syntyi kun
         * organisaation raja osui keskelle sanaa "Äänekosken".
         */
        w.length < 3
    )
  ) {
    return null
  }

  const name = sanat.slice(-2).join(" ")
  if (!isPersonName(name)) return null

  const title = sanat.slice(0, -2).join(" ").replace(/[,;:]$/, "").trim() || null

  return { name, title, organization: organization || null }
}

export type BulletinOfficial = {
  name: string
  title: string | null
  organization: string | null
  source: "Päättäjä" | "Valmistelija"
}

export function extractBulletinOfficials(pdfText: string | null): BulletinOfficial[] {
  const t = cleanBulletinPdfText(pdfText ?? "")
  if (!t) return []

  const tulos: BulletinOfficial[] = []
  const nahdyt = new Set<string>()

  for (const label of ["Valmistelija", "Päättäjä"] as const) {
    const arvo = labelValue(t, label)
    if (!arvo) continue

    const h = parseOfficial(arvo)
    if (!h) continue

    const avain = h.name.toLowerCase()
    if (nahdyt.has(avain)) continue
    nahdyt.add(avain)

    tulos.push({ ...h, source: label })
  }

  return tulos
}
