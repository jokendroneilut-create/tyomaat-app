export type NegativeProjectKnowledge = {
  keyword: string
  severity: "low" | "medium" | "high"
  reason: string
}

export const negativeProjects: NegativeProjectKnowledge[] = [
  {
    keyword: "omakotitalo",
    severity: "high",
    reason: "Yksittäiset omakotitalot eivät yleensä kuulu Työmaat.fi:n kohderyhmään",
  },
  {
    keyword: "autotalli",
    severity: "high",
    reason: "Autotallit ovat yleensä pieniä yksityisiä kohteita",
  },
  {
    keyword: "autokatos",
    severity: "high",
    reason: "Autokatokset ovat yleensä pieniä yksityisiä kohteita",
  },
  {
    keyword: "terassi",
    severity: "high",
    reason: "Terassit ovat yleensä pieniä yksityisiä kohteita",
  },
  {
    keyword: "sauna",
    severity: "high",
    reason: "Saunat ovat yleensä pieniä yksityisiä kohteita",
  },
  {
    keyword: "piharakennus",
    severity: "high",
    reason: "Piharakennukset ovat yleensä pieniä yksityisiä kohteita",
  },
  {
    keyword: "varasto",
    severity: "medium",
    reason: "Varastot voivat olla pieniä kohteita, ellei kyse ole hallista tai logistiikkarakennuksesta",
  },
  {
    keyword: "julkisivuremontti",
    severity: "medium",
    reason: "Julkisivuremontit ovat usein korjaushankkeita, eivät uusia rakennusmahdollisuuksia",
  },
  {
    keyword: "ikkunaremontti",
    severity: "medium",
    reason: "Ikkunaremontit ovat yleensä rajattuja korjaushankkeita",
  },
  {
    keyword: "kattoremontti",
    severity: "medium",
    reason: "Kattoremontit ovat yleensä rajattuja korjaushankkeita",
  }
]

/*
 * Pienet yksityiskohteet joita ei oteta TICin katselmointijonoon lainkaan —
 * vapaa-ajan asunnot, omakotitalot, piharakennukset yms. ovat hankkeina liian
 * pieniä Työmaat.fi:n kohderyhmälle. Käytetään lupapisteResolverissa
 * suodattamaan rakennusluvat ennen ehdokkaan luontia.
 */
/*
 * Vartaloita (ei koko sanoja), jotta suomen taivutusmuodot osuvat myös
 * (esim. "loma-asunnon", "talousrakennuksen", "autokatoksen").
 */
const SMALL_PRIVATE_KEYWORDS = [
  "vapaa-ajanasu",
  "vapaa-ajan asu",
  "loma-asu",
  "lomarakennu",
  "mökki",
  "omakotitalo",
  "talousrakennu",
  "piharakennu",
  "autotalli",
  "autokato",
  "sauna",
  "terassi",
  "grillikato",
  "aitta",
]

export function isSmallPrivateProject(
  text: string | null | undefined
): boolean {
  if (!text) return false
  const t = text.toLowerCase()
  return SMALL_PRIVATE_KEYWORDS.some((k) => t.includes(k))
}

/*
 * Kaavan "ajantasaistaminen" (vanhan asemakaavan päivitys vastaamaan jo
 * rakennettua tilannetta) EI ole rakennushanke — se ei tuo uutta rakentamista,
 * vaan mahdolliset muutokset vaativat aina erillisen asemakaavamuutoksen. Näitä
 * ei nosteta TICin katselmointijonoon. Sama koskee ajantasakaavaa (kunnan
 * yhdistelmäkaava-arkisto). Vartaloita, jotta taivutusmuodot osuvat
 * (ajantasaistaminen/-us/-etaan). Täsmätään lähteen NIMEEN/operaatioon, koska
 * kaavan nimi kertoo sen tarkoituksen luotettavasti.
 */
const NON_CONSTRUCTION_ZONING_KEYWORDS = ["ajantasaist", "ajantasakaav"]

export function isNonConstructionZoning(
  text: string | null | undefined
): boolean {
  if (!text) return false
  const t = text.toLowerCase()
  return NON_CONSTRUCTION_ZONING_KEYWORDS.some((k) => t.includes(k))
}

/*
 * Osa hallinnollisista kaavamuutoksista ei tuo rakentamista lainkaan, ja kuvaus
 * usein sanoo sen suoraan. Nämä lauseet ovat turvallisia tunnisteita myös
 * kuvaukseen, koska oikea rakennushanke ei totea näin (varmistettu koko datasta:
 * ei yhtään väärää osumaa oikeisiin hankkeisiin):
 *
 * 1. Kaavan ajantasaistaminen — "…ei koske uudisrakentamisen hankkeita".
 *    (Osa näistä on nimetty pelkän kaupunginosan mukaan, esim. "Kaartinkaupunki,
 *    Kaartinkaupungin alueita", jolloin nimessä ei ole "ajantasaist"-vartaloa.)
 * 2. Tiealueen kaavatekninen muutos kaduksi (esim. "Itäväylän katukaava") —
 *    "kaavatekninen ja hallinnollinen muutos" / "ei aiheuta muutostarpeita
 *    … liikennejärjestelyihin (tai ympäristöön)". Pelkkä "tiealue katualueeksi"
 *    tai "kadunpitopäätös" EI riitä signaaliksi, koska ne esiintyvät myös
 *    oikeissa katu-/risteyshankkeissa (perusparannus, pysäkin rakentaminen).
 */
export function hasNonConstructionZoningDisclaimer(
  text: string | null | undefined
): boolean {
  if (!text) return false
  return (
    /ei koske uudisrakentamis/i.test(text) ||
    /kaavatekninen ja hallinnollinen muutos/i.test(text) ||
    /ei aiheuta muutostarpeita[^.]{0,80}(liikennejärjest|ympäristö)/i.test(text)
  )
}