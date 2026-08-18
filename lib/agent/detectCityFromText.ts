import { MUNICIPALITIES } from "@/lib/geo/municipalities"

/*
 * Suomen sijamuodot eivät taivu säännöllisellä liitteellä kaikissa
 * tapauksissa (esim. "Helsinki" -> "Helsingin", konsonanttivaihtelu
 * k -> g), joten epäsäännölliset/yhdyssanamuodot käsitellään erikseen
 * ennen yleistä kanta+pääte-tunnistusta. Yleinen tunnistus kattaa
 * suurimman osan ~300 kunnasta ilman että jokaista pitää luetella
 * erikseen.
 */
const IRREGULAR_ALIASES: Record<string, string> = {
  "helsingin": "Helsinki",
  "helsingistä": "Helsinki",
  "helsingissä": "Helsinki",
  "helsinkiin": "Helsinki",
  "turun": "Turku",
  "turussa": "Turku",
  "turkuun": "Turku",
  "tampereen": "Tampere",
  "tampereella": "Tampere",
  "tampereelle": "Tampere",
  "kaarinaan": "Kaarina",
  "kangasalan": "Kangasala",
  "siuntion": "Siuntio",
  "hyvinkäälle": "Hyvinkää",
  "hyvinkäällä": "Hyvinkää",
  "iissä": "Ii",
  "iihin": "Ii",
  "klaukkalaan": "Nurmijärvi",
  "klaukkalan": "Nurmijärvi",
  "nihdin": "Helsinki",
  "lahteen": "Lahti",
  "lahdessa": "Lahti",
  "lahden": "Lahti",
  "liedon": "Lieto",
  "ouluun": "Oulu",
  "oulussa": "Oulu",
  "valkeakoskelle": "Valkeakoski",
  "kirkkonummen": "Kirkkonummi",
  "kirkkonummelle": "Kirkkonummi",
  "ylöjärven": "Ylöjärvi",
  "ylöjärvellä": "Ylöjärvi",
  "raisioon": "Raisio",
  "raisiossa": "Raisio",
  "kempeleessä": "Kempele",
  "kempeleeseen": "Kempele",
  "porvoon": "Porvoo",
  "porvooseen": "Porvoo",
  "mynämäelle": "Mynämäki",
  "mynämäellä": "Mynämäki",
  "mynämäeltä": "Mynämäki",
}

/*
 * Rajattu suomen sijapäätelista (ei mielivaltainen \w-jokeri) — pelkkä
 * kanta+mikä-tahansa-pääte tuottaisi vääriä osumia (esim. kunta "Tervo"
 * täsmäisi sanaan "terveiset"). Sisältää sekä etu- että takavokaalimuodot
 * ja kahdentuvan illatiivin yleisimmät variantit.
 */
const SUFFIX_ALTERNATION =
  "ssa|ssä|sta|stä|seen|lla|ella|llä|lta|ltä|lle|aan|ään|oon|öön|uun|yyn|iin|een|an|än|na|nä|n|in|en|on|un|yn|ksi|ta|tä"
const SUFFIX_PATTERN = `(${SUFFIX_ALTERNATION})?`
// Pakollinen pääte lyhyille nimille — muuten esim. kunta "Ii" täsmäisi
// jokaiseen roomalaiseen numeroon "II" (esim. "vaihe II", "kortteli II").
const MANDATORY_SUFFIX_PATTERN = `(${SUFFIX_ALTERNATION})`

// "Kaavi" kannalla ("kaav") törmäisi jatkuvasti tämän sovelluksen omaan
// sanastoon ("kaava", "kaavan", "kaavoitus") — jätetään kantahaku pois
// tälle kunnalle, tarkka nimi + pääte riittää kattamaan oikeat osumat.
// "Loppi" kannalla ("lopp") tuotti osuman sanaan "loppuun" ("vuoden 2028
// loppuun mennessä"), ja mitattuna 19.8.2026 kolme kannan kahdeksasta
// Loppi-hankkeesta oli tällä tavoin väärässä kunnassa - mm. "JYSKin uudet
// liiketilat Järvenpäähän" ja "Ämttön silta Porissa". Poisto ei menetä
// mitään, koska astevaihtelun takia aidot muodot "Lopen" ja "Lopella"
// eivät osu kantaankaan; ne jäävät tunnistumatta joka tapauksessa.
const STEM_MATCH_EXCLUDED = new Set(["Kaavi", "Loppi"])

const sortedMunicipalities = Object.values(MUNICIPALITIES).sort(
  (a, b) => b.name.length - a.name.length
)

/*
 * JS:n \b perustuu \w-luokkaan, joka ei tunne ä/ö/å-kirjaimia sanan osaksi
 * — "Pyöreälahti" näyttäytyisi \b:lle kahtena sanana ("pyöre" + "älahti"),
 * jolloin "Lahti" täsmäisi virheellisesti keskeltä yhdyssanaa. Korvataan
 * omalla rajamäärittelyllä, joka sisällyttää myös suomen erikoiskirjaimet.
 */
const FI_WORD_CHAR = "\\wäöåÄÖÅ"
const LEFT_BOUNDARY = `(?<![${FI_WORD_CHAR}])`
const RIGHT_BOUNDARY = `(?![${FI_WORD_CHAR}])`

export function detectCityFromText(text: string): string | null {
  const lower = text.toLowerCase()

  for (const [alias, city] of Object.entries(IRREGULAR_ALIASES)) {
    /*
     * Sananrajattu — pelkkä .includes() täsmäisi myös yhdyssanan sisään
     * (esim. "lahteen" osana "Espoonlahteen", vaikka kyse on Espoosta).
     */
    const aliasRegex = new RegExp(
      `${LEFT_BOUNDARY}${escapeRegex(alias)}${RIGHT_BOUNDARY}`,
      "i"
    )
    if (aliasRegex.test(lower)) return city
  }

  for (const municipality of sortedMunicipalities) {
    const name = municipality.name.toLowerCase()
    const isShortName = name.length <= 4

    const exactPattern = isShortName ? MANDATORY_SUFFIX_PATTERN : SUFFIX_PATTERN
    const exactRegex = new RegExp(
      `${LEFT_BOUNDARY}${escapeRegex(name)}${exactPattern}${RIGHT_BOUNDARY}`,
      "i"
    )
    if (exactRegex.test(lower)) return municipality.name

    if (isShortName || STEM_MATCH_EXCLUDED.has(municipality.name)) continue

    /*
     * Kanta (nimen viimeinen kirjain pudotettu, usein vokaali joka
     * vaihtuu/katoaa sijataivutuksessa, esim. "Vaasa" -> "Vaasan",
     * "Iisalmi" -> "Iisalmen") + sama rajattu päätelista. Ei täydellinen
     * suomen kielioppi, mutta kattaa valtaosan taivutusmuodoista ilman
     * mielivaltaista jokerimerkkiä.
     */
    const stem = name.slice(0, -1)
    const stemRegex = new RegExp(
      `${LEFT_BOUNDARY}${escapeRegex(stem)}${SUFFIX_PATTERN}${RIGHT_BOUNDARY}`,
      "i"
    )
    if (stemRegex.test(lower)) return municipality.name
  }

  return null
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
