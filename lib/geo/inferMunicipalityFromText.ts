import { MUNICIPALITIES, type Municipality } from "./municipalities"

/*
 * Osa hankintailmoituksista ei sisällä rakenteista kuntatietoa lainkaan,
 * mutta kunta mainitaan usein otsikossa vapaana tekstinä (esim.
 * "Juva, tehtaan laajennus tilaelementteinä"). Tämä on parhaan yrityksen
 * teksti­haku — ei tunnista taivutettuja muotoja ("Riihimäen") eikä
 * epäsuoria viittauksia (esim. rakennuksen nimi ilman kuntaa), mutta
 * palauttaa oikean osuman kun kunnan nimi esiintyy sanana tekstissä.
 */

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/*
 * Yksinkertainen suomen genetiivimuotojen arvaus (esim. "Espoo" ->
 * "Espoon", "Lappajärvi" -> "Lappajärven"). Ei kata astevaihtelua
 * (esim. "Loppi" -> "Lopen"), mutta laajentaa kattavuutta ilman
 * täyttä kielioppimallia.
 */
function genitiveVariants(name: string): string[] {
  const variants = [name + "n"]

  if (name.endsWith("i")) {
    variants.push(name.slice(0, -1) + "en")
  }

  return variants
}

type CandidatePattern = { municipality: Municipality; pattern: RegExp }

const CANDIDATES: CandidatePattern[] = Object.values(MUNICIPALITIES)
  .filter((m) => m.name.length >= 4)
  .sort((a, b) => b.name.length - a.name.length)
  .map((municipality) => {
    const forms = [municipality.name, ...genitiveVariants(municipality.name)]
    const alternation = forms.map(escapeRegex).join("|")

    return {
      municipality,
      pattern: new RegExp(`(^|[^\\p{L}])(${alternation})([^\\p{L}]|$)`, "iu"),
    }
  })

export function inferMunicipalityFromText(
  text: string | null | undefined
): Municipality | null {
  if (!text) return null

  for (const candidate of CANDIDATES) {
    if (candidate.pattern.test(text)) {
      return candidate.municipality
    }
  }

  return null
}
