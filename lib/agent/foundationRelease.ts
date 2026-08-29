import type { PhaseKey } from "@/lib/projects/phases"

/*
 * AYY ASUNNOT: TIEDOTTEESTA HANKKEEKSI.
 *
 * Toisin kuin Granlund (D-131), tämä lähde ei julkaise hankesivuja vaan
 * TIEDOTTEITA. Suurin osa niistä ei koske rakentamista lainkaan:
 * asuntohakuja, järjestyssääntöjä, palovaroitinmuutoksia. Mitattuna
 * 29.8.2026 aidoista hanketiedotteista oli 9/47 — ja hakusanalaskenta
 * yliarvioi sielläkin, koska sana "asunto" esiintyy lähes joka
 * tiedotteessa.
 *
 * Siksi tunnistus vaatii TEON, ei aihetta: rakennus valmistuu,
 * harjannostajaisia vietetään, urakoitsija toteuttaa hankkeen. Ja
 * hylkäyslista on erikseen, koska "Kesäasuntojen haku on avattu"
 * sisältää sanan asunto mutta ei ole hanke.
 *
 * Periaate on sama kuin muualla: mieluummin tyhjä kuin väärä.
 */

export type FoundationRelease = {
  isProject: boolean
  /* Miksi hyväksyttiin tai hylättiin — näkyy ajolokissa. */
  reason: string
  projectName: string | null
  apartments: number | null
  floorArea: number | null
  builder: string | null
  estimatedCompletion: string | null
  phaseHint: PhaseKey | null
}

export function htmlToText(html: string | null | undefined): string {
  return String(html ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8211;|&#8212;/g, "-")
    .replace(/&#8217;|&#039;/g, "'")
    .replace(/&quot;|&#8221;|&#8220;/g, '"')
    .replace(/\s+/g, " ")
    .trim()
}

/*
 * TEKO, ei aihe. Jokainen näistä tarkoittaa että jotain oikeasti
 * rakennetaan tai on rakennettu.
 */
const TEKO =
  /(harjannostajai|rakenteilla|uudiskohde|uudisrakenn|peruskorjau|perusparannu|purkuty|rakennusty[öo]t|rakentaminen (?:on )?(?:alkanut|edennyt|kaynniss|käynniss)|toteuttaa hankkeen|rakennuttaa|valmistui|valmistuu|tontinvaraus|aiesopimu|rakennuslupa|urakoitsij|urakan)/i

/*
 * HYLKÄYSLISTA. Nämä sisältävät sanan "asunto" tai "kiinteistö" mutta
 * eivät ole hankkeita. Mitattu todellisista otsikoista 29.8.2026.
 */
const EI_HANKE =
  /(kesäasunto|kesäasuntojen|asuntojen haku|haku on avattu|vapautuvia asuntoja|jälleenvuokra|edelleenluovut|sisäänmuutto|muutto-ohje|järjestyssään|palovaroitin|internet-yhteyd|asuntotilanteesta|vuokrasopimu|asukasvalinta|hakuaika)/i

/*
 * Kiinteistökauppa EI ole rakennushanke. "AYY on myynyt Tuhkimontie 2
 * -kiinteistön" kertoo omistajanvaihdoksesta, ei rakentamisesta. Ostaja
 * voi kyllä remontoida, mutta sitä ei tiedetä - eikä sitä keksitä.
 */
const KIINTEISTOKAUPPA = /\bon myynyt\b|\bmyi\b.{0,30}kiinteist/i

/* Suomalaiset kadunnimien päätteet, joilla osoite tunnistuu tekstistä. */
const KATU_PAATE =
  "(?:kaari|katu|kuja|tie|polku|väylä|vayla|raitti|rinne|puisto|aukio|kylä|kyla|ranta|silta|mäki|maki|laita|penger|tori)"

const OSOITE_RE = new RegExp(
  `\\b([A-ZÄÖÅ][a-zäöåA-ZÄÖÅ-]*${KATU_PAATE}\\s?\\d+(?:\\s?[-–]\\s?\\d+)?[a-zA-Z]?)`,
)

/*
 * Hankkeen nimi on käytännössä osoite: "Otakaari 15". Etsitään ensin
 * otsikosta, sitten tekstistä - otsikko voi olla pelkkä "Uusi
 * opiskelijatalo valmistui Otaniemeen", jolloin osoite on leipätekstissä.
 */
export function parseProjectName(title: string, text: string): string | null {
  for (const lahde of [title, text]) {
    const m = OSOITE_RE.exec(String(lahde ?? ""))
    if (m?.[1]) return m[1].replace(/\s+/g, " ").trim()
  }
  return null
}

/*
 * "153 uutta opiskelija-asuntoa" tai "153 modernia asuntoa".
 *
 * LUKU EI SAA HYPÄTÄ KAHDEN LUVUN YLI. Ensimmäinen versio luki
 * tekstistä "valmistuu elokuussa 2026 153 modernia asuntoa" luvun
 * "2026 153", koska välilyönti kelpasi osaksi lukua rajattomasti.
 * Siksi tuhaterotin sallitaan vain kolmen numeron ryhmissä, ja
 * takautuva tarkistus estää aloittamisen keskeltä toista lukua.
 */
export function parseApartments(text: string): number | null {
  const m = /(?<!\d)(\d{1,3}(?:\s\d{3})*)\s*(?:uutta\s+|modernia\s+|upeaa\s+)?(?:opiskelija-)?asuntoa/i.exec(
    String(text ?? "")
  )
  if (!m) return null
  const n = Number(m[1].replace(/\s/g, ""))
  /* Yli tuhat asuntoa yhdessä kohteessa on lukuvirhe, ei hanke. */
  return Number.isFinite(n) && n > 0 && n <= 1000 ? n : null
}

/* "huoneistoala on yhteensä 4 465 neliömetriä" */
export function parseFloorArea(text: string): number | null {
  const m = /(?:huoneistoala|kerrosala|pinta-ala|bruttoala)[^\d]{0,40}?(?<!\d)(\d{1,3}(?:\s\d{3})*)\s*(?:neliömetri|neliömetriä|m2|m²|k-m2|brm)/i.exec(
    String(text ?? "")
  )
  if (!m) return null
  const n = Number(m[1].replace(/\s/g, ""))
  return Number.isFinite(n) && n > 0 ? n : null
}

/*
 * "Varte Oy toteuttaa hankkeen AYY:lle" — urakoitsija on tämän lähteen
 * arvokkain kenttä, koska rakennuttaja (AYY) tiedetään jo lähteestä.
 */
export function parseBuilder(text: string): string | null {
  const s = String(text ?? "")

  const kuviot = [
    /([A-ZÄÖÅ][\wÄÖÅäöå.&-]*(?:\s+[A-ZÄÖÅ][\wÄÖÅäöå.&-]*){0,3}\s+Oy(?:j)?)\s+(?:toteuttaa|rakentaa|urakoi)/,
    /*
     * EI /i-LIPPUA. Se mitatoi ison alkukirjaimen vaatimuksen, jolloin
     * "Urakoitsijana oli Varte Lahti Oy" tuotti nimen "oli Varte Lahti
     * Oy". Avainsanan kirjainkoko hoidetaan merkkiluokilla ja
     * yhdyssanat erikseen.
     */
    /(?:[Pp]ää)?[Uu]rakoitsija(?:na|ksi)?\s+(?:on\s+|oli\s+|toimii\s+|toimi\s+)?([A-ZÄÖÅ][\wÄÖÅäöå.&-]*(?:\s+[A-ZÄÖÅ][\wÄÖÅäöå.&-]*){0,3}\s+Oy(?:j)?)/,
  ]

  for (const re of kuviot) {
    const m = re.exec(s)
    if (m?.[1]) return m[1].trim()
  }
  return null
}

const KUUKAUDET: Record<string, number> = {
  tammi: 1, helmi: 2, maalis: 3, huhti: 4, touko: 5, kesä: 6, kesa: 6,
  heinä: 7, heina: 7, elo: 8, syys: 9, loka: 10, marras: 11, joulu: 12,
}

function kuunViimeinen(vuosi: number, kk: number): string {
  /* UTC, jottei aikavyöhyke siirrä päivää edelliseen kuukauteen. */
  const d = new Date(Date.UTC(vuosi, kk, 0))
  return d.toISOString().slice(0, 10)
}

/*
 * Kolme muotoa todellisissa tiedotteissa:
 *   "valmistui 31.7.2026"          tarkka päivä
 *   "valmistuu elokuussa 2026"     kuukausi -> kuun viimeinen
 *   "valmistuu 2027"               vuosi    -> vuoden viimeinen
 */
export function parseCompletion(text: string): string | null {
  const s = String(text ?? "")

  const tarkka = /valmistu[a-z]*\s+(\d{1,2})\.(\d{1,2})\.(\d{4})/i.exec(s)
  if (tarkka) {
    const [, p, k, v] = tarkka
    const d = new Date(Date.UTC(Number(v), Number(k) - 1, Number(p)))
    /* Torjutaan mahdoton päivä kuten 31.2. */
    if (d.getUTCMonth() === Number(k) - 1 && d.getUTCDate() === Number(p)) {
      return d.toISOString().slice(0, 10)
    }
    return null
  }

  const kk = /valmistu[a-z]*\s+([a-zäöå]+)kuu(?:ssa|lla|n)?\s+(\d{4})/i.exec(s)
  if (kk) {
    const nimi = kk[1].toLowerCase()
    const numero = KUUKAUDET[nimi]
    if (numero) return kuunViimeinen(Number(kk[2]), numero)
  }

  const vuosi = /valmistu[a-z]*\s+(?:vuonna\s+)?(20\d{2})/i.exec(s)
  if (vuosi) return `${vuosi[1]}-12-31`

  return null
}

/*
 * Vaihe päätellään teosta. Valmistunut on tärkeä tunnistaa, koska se ei
 * ole liidi - mutta se ei silti ole syy hylätä tiedotetta: sama hanke on
 * voinut olla meillä jo rakenteilla, ja valmistuminen on päivitys.
 */
export function parsePhase(text: string): PhaseKey | null {
  const s = String(text ?? "")

  if (/valmistui\b|on valmistunut|otettiin k[aä]ytt[oö][oö]n/i.test(s)) return "completed"
  if (/harjannostajai|rakenteilla|rakennusty[öo]t (?:ovat )?(?:alkaneet|k[aä]ynniss)|rakentaminen (?:on )?(?:alkanut|edennyt|k[aä]ynniss)/i.test(s)) return "construction"
  if (/valmistuu|muutto ajoittuu|ensihaku/i.test(s)) return "construction"
  if (/rakennuslupa|lupahakemus/i.test(s)) return "permit"
  if (/aiesopimu|tontinvaraus|suunnitell(?:aan|un)/i.test(s)) return "planning"

  return null
}

export function parseFoundationRelease(
  titleHtml: string | null | undefined,
  contentHtml: string | null | undefined
): FoundationRelease {
  const title = htmlToText(titleHtml)
  const text = htmlToText(contentHtml)
  const kaikki = `${title} ${text}`

  const tyhja: FoundationRelease = {
    isProject: false,
    reason: "",
    projectName: null,
    apartments: null,
    floorArea: null,
    builder: null,
    estimatedCompletion: null,
    phaseHint: null,
  }

  if (!title && !text) return { ...tyhja, reason: "tyhjä tiedote" }

  /* Hylkäys ratkaistaan OTSIKOSTA: leipäteksti voi mainita ohimennen. */
  if (EI_HANKE.test(title)) return { ...tyhja, reason: "asukasviestintä, ei hanke" }
  if (KIINTEISTOKAUPPA.test(title)) return { ...tyhja, reason: "kiinteistökauppa, ei rakennushanke" }

  if (!TEKO.test(kaikki)) return { ...tyhja, reason: "ei rakentamisen tekoa" }

  const projectName = parseProjectName(title, text)

  /*
   * Ilman osoitetta hanketta ei voi täsmäyttää eikä nimetä, joten
   * tiedote jää poimimatta. Tämä on tietoinen menetys: yleisluontoinen
   * tiedote ei kelpaa hankkeeksi.
   */
  if (!projectName) return { ...tyhja, reason: "ei tunnistettavaa osoitetta" }

  return {
    isProject: true,
    reason: "hanke",
    projectName,
    apartments: parseApartments(kaikki),
    floorArea: parseFloorArea(kaikki),
    builder: parseBuilder(kaikki),
    estimatedCompletion: parseCompletion(kaikki),
    phaseHint: parsePhase(kaikki),
  }
}
