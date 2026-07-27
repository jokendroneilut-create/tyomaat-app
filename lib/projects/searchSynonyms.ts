/*
 * Hakusynonyymit karttasivun (ja mahdollisesti muidenkin näkymien) hakua varten.
 * Kukin ryhmä on joukko keskenään vaihtoehtoisia termejä: kun käyttäjä hakee
 * yhtä, haku osuu myös muihin. Näin esim. "konesali" löytää datakeskuksen ja
 * "terveyskeskus" löytää sairaalan, vaikka hankkeen kuvauksessa lukisi eri sana.
 *
 * Pidä ryhmissä VAIN aidosti vaihtoehtoisia termejä — liian löysät synonyymit
 * tuovat vääriä osumia. Osamerkkijonohaku hoitaa jo taivutukset ja
 * yhdyssanat (esim. "koulu" löytyy sanasta "koulurakennus"), joten tänne
 * riittävät ne synonyymit jotka EIVÄT jaa yhteistä sanaosaa.
 */
export const SEARCH_SYNONYM_GROUPS: string[][] = [
  ["datakeskus", "konesali", "palvelinkeskus", "laskentakeskus", "data center"],
  ["tehdas", "tuotantolaitos", "teollisuushalli", "teollisuusrakennus"],
  ["logistiikkakeskus", "jakelukeskus", "varastohalli", "logistiikkahalli"],
  ["hoivakoti", "palvelutalo", "vanhainkoti", "hoivakeskus", "senioritalo"],
  ["koulu", "oppilaitos", "lukio"],
  ["päiväkoti", "lastentarha"],
  ["sairaala", "terveyskeskus", "terveysasema", "hyvinvointikeskus"],
  ["toimitila", "toimisto", "liiketila", "liikerakennus"],
  ["sähköasema", "muuntamo", "muuntoasema"],
  ["aurinkovoimala", "aurinkopuisto", "aurinkosähkö", "aurinkopaneeli"],
  ["tuulivoima", "tuulipuisto", "tuulivoimala"],
  ["peruskorjaus", "saneeraus", "remontti"],
  ["kerrostalo", "asuinkerrostalo", "asuintalo"],
  ["hotelli", "majoitusrakennus"],
]

/*
 * Laajentaa yhden hakusanan itsensä + synonyymiensä joukoksi. Synonyymit
 * lisätään vain jos hakusana liittyy ryhmään (on jonkin jäsenen osa tai
 * päinvastoin) ja on tarpeeksi pitkä (>= 4), ettei lyhyt sana laajene liikaa.
 */
export function expandSearchTerm(term: string): string[] {
  const t = term.toLowerCase().trim()
  const expanded = new Set<string>([t])
  if (t.length < 4) return [...expanded]

  for (const group of SEARCH_SYNONYM_GROUPS) {
    if (group.some((member) => member.includes(t) || t.includes(member))) {
      for (const member of group) expanded.add(member)
    }
  }

  return [...expanded]
}
