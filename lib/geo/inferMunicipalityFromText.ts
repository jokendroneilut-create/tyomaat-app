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
 * Yksinkertainen suomen sijamuotojen arvaus (genetiivi ja inessiivi),
 * mukaan lukien yleisimmät astevaihtelutapaukset (esim. "Riihimäki" ->
 * "Riihimäen", "Loppi" -> "Lopen"). Ei kata kaikkia poikkeuksia, mutta
 * laajentaa kattavuutta ilman täyttä kielioppimallia.
 */
function genitiveVariants(name: string): string[] {
  const variants = [name + "n", name + "ssa", name + "ssä"]

  const lastChar = name.slice(-1).toLowerCase()
  if ("aeiouyäöå".includes(lastChar)) {
    variants.push(name + lastChar + "n")
  }

  if (name.endsWith("ppi")) {
    variants.push(name.slice(0, -3) + "pen")
  } else if (name.endsWith("kki")) {
    variants.push(name.slice(0, -3) + "kin")
  } else if (name.endsWith("ki")) {
    variants.push(name.slice(0, -2) + "en")
  } else if (name.endsWith("i")) {
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
