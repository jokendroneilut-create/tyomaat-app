/*
 * GRANLUNDIN PROJEKTISIVUN SISÄLTÖ.
 *
 * Granlund on suunnittelutoimisto, ei urakoitsija — se on hankkeessa
 * mukana AIKAISEMMIN kuin rakentaja, usein vuosia ennen työmaata.
 * Prisma Hyllykallion sivulla lukee "Suunnittelu aloitettiin kesällä
 * 2024" ja rakentaminen alkoi 2026.
 *
 * Lähde löytyi kun Lujatalon referenssisivulta ei saatu samasta
 * hankkeesta juuri mitään: otsikko, laajuus ja urakkamuoto. Granlundin
 * sivulla oli tilaaja, aikataulu, pinta-ala, muut toimijat ja nimetty
 * yhteyshenkilö.
 *
 * WordPressin REST-rajapinta antaa kaiken kerralla
 * (`/wp-json/wp/v2/projects`, 211 hanketta). `acf` on tyhjä kuten
 * Kreatella, joten kentät luetaan `content.rendered`-tekstistä.
 *
 * KENTÄT OVAT LIIMATTUNA YHTEEN ilman erottimia:
 *
 *   "Paikkakunta Seinäjoki Tilaaja Eepee Kiinteistöt Oy Tyyppi
 *    Korjausrakentaminen Aloitus 2024 Valmistuminen 2027 …"
 *
 * Arvo luetaan siis otsikon jälkeen seuraavaan tunnettuun otsikkoon
 * asti — sama ratkaisu kuin Lupapisteen kuulutuksissa (D-115).
 */

/* Kaikki tunnetut otsikot, jotta arvo osataan katkaista oikeaan kohtaan. */
const LABELS = [
  "Paikkakunta",
  "Tilaaja",
  "Tyyppi",
  "Aloitus",
  "Valmistuminen",
  "Bruttoneliöt",
  "Laajuus",
  "Muut hankkeen toimijat",
  "Granlundin palvelut projektissa",
] as const

/* Kenttälohkon jälkeen alkaa sivun kalusteita, ei hankkeen tietoa. */
const BLOCK_END = /(Katso kaikki palvelumme|Tutustu muihin|Kysy lisää)/

export type GranlundFields = {
  city: string | null
  developer: string | null
  projectType: string | null
  startYear: number | null
  completionYear: number | null
  /* ISO-päivä, vuoden viimeinen — kuten muissakin vuositason arvioissa. */
  estimatedCompletion: string | null
  area: string | null
  otherCompanies: string[]
  granlundServices: string[]
}

export function htmlToText(html: string | null | undefined): string {
  return String(html ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#8217;|&#039;|&#8216;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
}

function readField(text: string, label: string): string | null {
  const i = text.indexOf(label)
  if (i < 0) return null

  const after = text.slice(i + label.length)
  let end = after.length

  for (const other of LABELS) {
    if (other === label) continue
    const j = after.indexOf(other)
    if (j >= 0 && j < end) end = j
  }

  const loppu = after.slice(0, end).search(BLOCK_END)
  if (loppu >= 0 && loppu < end) end = loppu

  const arvo = after.slice(0, end).trim()
  /* Tyhjä kenttä on yleinen: otsikkoa seuraa suoraan seuraava otsikko. */
  return arvo.length >= 2 && arvo.length <= 300 ? arvo : null
}

/* "2027" -> 2027. Muu muoto jätetään, jottei arvata väärin. */
function readYear(value: string | null): number | null {
  const m = String(value ?? "").match(/\b(19|20)(\d{2})\b/)
  if (!m) return null
  const vuosi = Number(`${m[1]}${m[2]}`)
  return vuosi >= 1900 && vuosi <= 2100 ? vuosi : null
}

function splitCompanies(value: string | null): string[] {
  if (!value) return []
  return value
    .split(/,|;/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1)
}

/*
 * Palvelut ovat liimattuna yhteen ilman erotinta
 * ("ArkkitehtisuunnitteluSähkösuunnittelu"), koska ne ovat HTML:ssä
 * omina elementteinään. Isolla alkava sana aloittaa uuden.
 */
function splitServices(value: string | null): string[] {
  if (!value) return []
  return value
    .replace(/([a-zåäö])([A-ZÅÄÖ])/g, "$1|$2")
    .split(/\||,/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3)
}

export function parseGranlundFields(html: string | null | undefined): GranlundFields {
  const t = htmlToText(html)

  const valmistuminen = readYear(readField(t, "Valmistuminen"))

  return {
    city: readField(t, "Paikkakunta"),
    developer: readField(t, "Tilaaja"),
    projectType: readField(t, "Tyyppi"),
    startYear: readYear(readField(t, "Aloitus")),
    completionYear: valmistuminen,
    estimatedCompletion: valmistuminen ? `${valmistuminen}-12-31` : null,
    area: readField(t, "Bruttoneliöt") ?? readField(t, "Laajuus"),
    otherCompanies: splitCompanies(readField(t, "Muut hankkeen toimijat")),
    granlundServices: splitServices(readField(t, "Granlundin palvelut projektissa")),
  }
}

/* Alle tämän jäävä teksti ei ole kuvaus vaan jäännös. */
const MIN_DESCRIPTION = 120

/*
 * Kuvaus on kenttälohkoa EDELTÄVÄ teksti: sivun alussa on hankkeen oma
 * kuvaus ja vasta sen jälkeen tiedot. Lohkon jälkeen tulee "Tutustu
 * muihin projekteihimme" -karuselli, jossa on TOISTEN hankkeiden nimiä —
 * sama ansa kuin Kreatella (D-121).
 */
export function parseGranlundDescription(html: string | null | undefined): string | null {
  const t = htmlToText(html)
  if (!t) return null

  const i = t.indexOf("Paikkakunta")
  const teksti = (i > MIN_DESCRIPTION ? t.slice(0, i) : t.split(BLOCK_END)[0]).trim()

  return teksti.length >= MIN_DESCRIPTION ? teksti : null
}
