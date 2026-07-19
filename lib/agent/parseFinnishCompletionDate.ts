/*
 * Poimii vapaasta suomenkielisestä tekstistä arvion hankkeen
 * valmistumisajankohdasta (esim. "hanke valmistuu lokakuussa 2026").
 * Palauttaa ISO-päivämäärän (YYYY-MM-DD) tai null jos tekstissä ei ole
 * tunnistettavaa valmistumismainintaa.
 *
 * Valitsee aina kyseisen ajanjakson VIIMEISEN mahdollisen päivän (esim.
 * "lokakuussa 2026" -> 2026-10-31, "vuonna 2026" -> 2026-12-31), koska
 * arviota käytetään automaattiseen "valmistunut"-tilaan siirtoon — on
 * turvallisempi arvioida myöhäiseksi kuin siirtää hanke valmiiksi liian
 * aikaisin.
 */

const MONTHS: Record<string, number> = {
  tammikuu: 1,
  helmikuu: 2,
  maaliskuu: 3,
  huhtikuu: 4,
  toukokuu: 5,
  kesäkuu: 6,
  heinäkuu: 7,
  elokuu: 8,
  syyskuu: 9,
  lokakuu: 10,
  marraskuu: 11,
  joulukuu: 12,
}
const MONTH_ALTERNATION = Object.keys(MONTHS).join("|")

/*
 * Suomen vuodenajat eivät anna tarkkaa kuukautta — arvioidaan kauden
 * viimeiseksi kuukaudeksi (karkea heuristiikka). Adessiivimuodot
 * ("keväällä", "talvella") kirjoitettu suoraan taivutettuna, koska
 * kanta+pääte ei toimi säännöllisesti (esim. "kevät" -> "keväällä"
 * pudottaa t:n ja pidentää vokaalin, "talvi" -> "talvella" vaihtaa
 * i:n e:ksi) — helpompi luetella oikeat muodot kuin päätellä niitä.
 */
const SEASONS: Record<string, number> = {
  keväällä: 5, // huhti-toukokuu -> toukokuu
  kesällä: 8, // kesä-elokuu -> elokuu
  syksyllä: 11, // syys-marraskuu -> marraskuu
  talvella: 2, // joulu-helmikuu -> helmikuu (seuraavaa vuotta ei yritetä päätellä)
}
const SEASON_ALTERNATION = Object.keys(SEASONS).join("|")

// Keyword joka osoittaa VALMISTUMISTA (ei esim. rakentamisen alkua) —
// päivämäärä haetaan vain tämän sanan jälkeisestä lyhyestä ikkunasta,
// jottei tekstissä aiemmin mainittu esim. rakentamisen aloituspäivä
// poimiudu vahingossa valmistumispäiväksi.
const COMPLETION_KEYWORD =
  "valmistuu|valmistunee|valmistumassa|valmistuvat|valmistuminen|luovutetaan|käyttöönotto"

function lastDayOfMonth(year: number, month: number): string {
  const day = new Date(year, month, 0).getDate()
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

export function parseEstimatedCompletionDate(text: string): string | null {
  const normalized = text.replace(/\s+/g, " ")

  const monthYearRegex = new RegExp(
    `(?:${COMPLETION_KEYWORD})\\D{0,40}?(${MONTH_ALTERNATION})ssa\\s+(\\d{4})`,
    "i"
  )
  const monthYearMatch = normalized.match(monthYearRegex)
  if (monthYearMatch) {
    const month = MONTHS[monthYearMatch[1].toLowerCase()]
    const year = Number(monthYearMatch[2])
    return lastDayOfMonth(year, month)
  }

  const seasonYearRegex = new RegExp(
    `(?:${COMPLETION_KEYWORD})\\D{0,40}?(${SEASON_ALTERNATION})\\s+(\\d{4})`,
    "i"
  )
  const seasonYearMatch = normalized.match(seasonYearRegex)
  if (seasonYearMatch) {
    const month = SEASONS[seasonYearMatch[1].toLowerCase()]
    const year = Number(seasonYearMatch[2])
    return lastDayOfMonth(year, month)
  }

  const yearOnlyRegex = new RegExp(
    `(?:${COMPLETION_KEYWORD})\\D{0,40}?vuo(?:nna|den)\\s+(\\d{4})`,
    "i"
  )
  const yearOnlyMatch = normalized.match(yearOnlyRegex)
  if (yearOnlyMatch) {
    const year = Number(yearOnlyMatch[1])
    return lastDayOfMonth(year, 12)
  }

  return null
}
