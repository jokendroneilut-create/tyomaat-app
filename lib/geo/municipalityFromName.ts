/*
 * Kunnan päättely vapaamuotoisesta nimestä: hankintayksikön nimestä
 * ("Janakkalan kunta") tai postitoimipaikasta ("14200 Turenki").
 *
 * Kuntarekisteri (municipalities.ts) tuntee vain perusmuotoiset kuntanimet,
 * mutta Hilman aineistossa kunta esiintyy lähes aina joko genetiivissä tai
 * postitoimipaikkana, joka ei ole kunta lainkaan. Tässä ne muunnetaan
 * takaisin rekisterin tuntemaan muotoon — aina rekisteriä vasten
 * validoiden, joten mitään ei arvata.
 */
import {
  MUNICIPALITIES,
  getMunicipalityByName,
  type Municipality,
} from "./municipalities"

const ALL_MUNICIPALITIES: Municipality[] = Object.values(MUNICIPALITIES)

/*
 * Postitoimipaikkoja jotka eivät ole omia kuntiaan. Hilman hankintayksikön
 * osoitteessa "kaupunki" on postitoimipaikka, ei kunta: "14200 Turenki" on
 * Janakkalan kirkonkylä, jolloin suora kuntarekisterihaku palauttaa tyhjän
 * ja koko hankkeen sijainti jää tunnistamatta. Laajennettavissa.
 */
const POSTAL_PLACE_MUNICIPALITIES: Record<string, string> = {
  turenki: "Janakkala",
  ivalo: "Inari",
  onttola: "Kontiolahti",
  immola: "Imatra",
  nauvo: "Parainen", // kuntaliitos 2009
}

/*
 * Genetiivit joissa vartalo muuttuu niin paljon, ettei alla oleva 5 merkin
 * yhteinen alku riitä (nimi on lyhyt): "Turun" -> Turku, "Lahden" -> Lahti.
 * Pidemmillä nimillä astevaihtelu ei haittaa, koska alku säilyy.
 */
const GENITIVE_EXCEPTIONS: Record<string, string> = {
  turun: "Turku",
  lahden: "Lahti",
  vihdin: "Vihti",
  hangon: "Hanko",
  liedon: "Lieto",
  lopen: "Loppi",
}

/*
 * Kuntarekisterihaku joka tuntee myös postitoimipaikat.
 */
export function getMunicipalityByPlaceName(
  name: string | null | undefined
): Municipality | null {
  const direct = getMunicipalityByName(name)
  if (direct) return direct

  if (!name) return null

  const alias = POSTAL_PLACE_MUNICIPALITIES[name.trim().toLowerCase()]
  return alias ? getMunicipalityByName(alias) : null
}

/*
 * Genetiivimuodosta kunnaksi: "Janakkalan" -> Janakkala.
 *
 * Kolme askelta järjestyksessä: poikkeuslista, säännöllinen genetiivi
 * (nimi + "n"), ja lopuksi vartalonmuutokset (Helsingin -> Helsinki,
 * Riihimäen -> Riihimäki) 5 merkin yhteisellä alulla. Viimeinen vaatii
 * yksikäsitteisen osuman: jos alku sopii kahteen kuntaan, palautetaan null
 * eikä arvata kumpaakaan.
 */
export function municipalityFromGenitive(
  word: string | null | undefined
): Municipality | null {
  if (!word) return null

  const w = word.trim().toLowerCase()
  if (w.length < 4 || !w.endsWith("n")) return null

  const exception = GENITIVE_EXCEPTIONS[w]
  if (exception) return getMunicipalityByName(exception)

  const direct = getMunicipalityByName(w.slice(0, -1))
  if (direct) return direct

  const matches = ALL_MUNICIPALITIES.filter(
    (m) =>
      m.name.length >= 5 && w.startsWith(m.name.slice(0, 5).toLowerCase())
  )

  return matches.length === 1 ? matches[0] : null
}

const BUYER_NAME_RE =
  /\b([A-Za-zÅÄÖåäö][A-Za-zÅÄÖåäö-]*n)\s+(kunta|kunnan|kaupunki|kaupungin)\b/i

/*
 * Kunta hankintayksikön nimestä: "Janakkalan kunta" -> Janakkala,
 * "Stara (Helsingin kaupungin rakentamispalveluliikelaitos)" -> Helsinki.
 *
 * Käytetään vasta viimeisenä keinona, kun työmaan kaupunkia ei löydy
 * ilmoituksen tekstistä eikä osoitteesta: kunta tilaajana rakennuttaa
 * käytännössä aina omalle alueelleen. Osalla hankkeista yhtä työmaaosoitetta
 * ei ole olemassakaan (esim. päällysteurakka kattaa kunnan koko katuverkon),
 * jolloin tilaajakunta on ainoa mielekäs sijainti.
 *
 * "kuntayhtymä" ei osu tähän (\b estää), ja se on tarkoituksellista:
 * kuntayhtymä kattaa useita kuntia eikä sen nimestä voi päätellä sijaintia.
 */
export function municipalityFromBuyerName(
  name: string | null | undefined
): Municipality | null {
  if (!name) return null

  const match = name.match(BUYER_NAME_RE)
  if (!match) return null

  return municipalityFromGenitive(match[1])
}

/*
 * Hankintayksikön osoite on Suomessa aina muotoa "<katu> <postinumero>
 * <kaupunki> FIN" — kaupunki on nimessä perusmuodossa, joten se on
 * poimittavissa luotettavasti toisin kuin vapaan tekstin taivutusmuodot.
 */
export function extractCityFromBuyerAddress(
  buyerAddress: string | null | undefined
): string | null {
  if (!buyerAddress) return null

  const match = buyerAddress.match(
    /\d{5}\s+([A-ZÅÄÖ][a-zåäöA-ZÅÄÖ\-]*(?:\s[A-ZÅÄÖ][a-zåäöA-ZÅÄÖ\-]*)*)\s+FIN\s*$/
  )

  return match?.[1]?.trim() ?? null
}

/*
 * Tukeeko ilmoituksen oma teksti samaa kaupunkia? Taivutusmuotojen takia
 * (esim. "Orivesi" -> "Orivedellä") verrataan vain nimen alkuosaa.
 */
export function isCityCorroboratedByText(
  city: string,
  ...texts: (string | null | undefined)[]
): boolean {
  const stem = city.toLowerCase().slice(0, Math.min(5, city.length))

  return texts.some((text) => text && text.toLowerCase().includes(stem))
}
