/*
 * Organisaation nimen kanoninen muoto täsmäytystä varten.
 *
 * Sama organisaatio kirjoitetaan lähteissä eri tavoin, ja merkkijonovertailu
 * pitää niitä eri yrityksinä. Mitattu tapaus: hankkeella "Pohjois-Pohjanmaan
 * hyvinvointialueen (Pohde)" ja ehdokkaalla "Pohjois-Pohjanmaan
 * hyvinvointialue Pohde" — sama organisaatio, mutta genetiivi ja sulut
 * estivät same_developer-osuman, jolloin koko täsmäytys jäi tekemättä
 * (rakennuttaja+kaupunki on yksi neljästä hyväksytystä todisteesta).
 *
 * Vertailu tehdään sanajoukkona eikä merkkijonona, koska sanajärjestys
 * vaihtelee ("Rakennus Oy Kallio" / "Kallio Rakennus Oy") ja sulkeissa oleva
 * lyhenne voi olla myös ilman sulkuja.
 */

/*
 * Yhtiömuodot pois: "X Oy" ja "X Oyj" ovat käytännössä sama toimija, eikä
 * muoto erota kahta eri yritystä toisistaan.
 */
const COMPANY_FORMS = new Set([
  "oy",
  "oyj",
  "ab",
  "abp",
  "ay",
  "ky",
  "ltd",
  "plc",
  "ry",
  "rf",
  "gmbh",
  "inc",
])

/*
 * Genetiivin purku. Suomen genetiivi lisää -n, ja e-loppuisilla vartalo
 * pitenee ("alue" -> "alueen").
 *
 * -nen-loppuisiin ei kosketa: "Virtanen" ei ole genetiivi, ja sen
 * typistäminen sekoittaisi eri yritykset keskenään. Konservatiivisuus on
 * tässä oikea suunta — väärä yhdistäminen on pahempi kuin osumatta jäänyt.
 */
function stripGenitive(word: string): string {
  if (word.length < 5) return word
  if (word.endsWith("nen")) return word
  if (word.endsWith("en") && word.length >= 6) return word.slice(0, -2)
  if (word.endsWith("n")) return word.slice(0, -1)
  return word
}

export function organizationTokens(
  name: string | null | undefined
): string[] {
  if (!name) return []

  return String(name)
    .toLowerCase()
    // Y-tunnukset pois ennen sanoiksi pilkkomista.
    .replace(/\b(?:fi)?\d{6,8}-?\d?\b/g, " ")
    .split(/[^a-zåäöüé]+/i)
    .map((word) => word.trim())
    .filter((word) => word.length > 1)
    .filter((word) => !COMPANY_FORMS.has(word))
    .map(stripGenitive)
    .filter(Boolean)
}

/*
 * Kanoninen muoto: normalisoidut sanat aakkosjärjestyksessä ilman
 * kaksoiskappaleita. Kaksi nimeä tarkoittavat samaa organisaatiota jos
 * kanoniset muodot ovat identtiset.
 */
export function canonicalOrganizationName(
  name: string | null | undefined
): string | null {
  const tokens = [...new Set(organizationTokens(name))].sort()
  return tokens.length > 0 ? tokens.join(" ") : null
}

export function isSameOrganization(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const canonicalA = canonicalOrganizationName(a)
  const canonicalB = canonicalOrganizationName(b)

  return Boolean(canonicalA && canonicalB && canonicalA === canonicalB)
}
