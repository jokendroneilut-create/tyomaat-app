/*
 * HILMAN SUORITUSPAIKKA (eForms BT-5101).
 *
 * Työmaan osoite on poimittu tähän asti vain vapaasta kuvaustekstistä.
 * Ilmoituksessa on kuitenkin oma rakenteinen kenttä `realizedLocation`,
 * jota emme lukeneet — se on tarkempi kuin tekstistä arvattu osoite.
 *
 * MIKSI ERILLINEN HAKU. Käyttämämme hakurajapinta (avp/eformnotices) ei
 * palauta tätä kenttää lainkaan; tarkistettu tallennetuista raw_payloadeista
 * 21.8.2026: 4/4 riviltä puuttui. Kenttä on vain ilmoitussivun omassa
 * rajapinnassa, joka palauttaa koko eForms-dokumentin.
 *
 * MITATTU HYÖTY 21.8.2026: otoksesta 59 ehdokasta, joilta osoite puuttui,
 * 16:lla oli katuosoite ja 6:lla pelkkä kaupunki. Loput olivat tyhjiä tai
 * "anyw-cou" — moni tilaaja jättää kentän täyttämättä.
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

/* Tuontibudjetti on 70 s koko ajolle, joten yksi ilmoitus ei saa jäädä roikkumaan. */
const TIMEOUT_MS = 8000

export type HilmaRealizedLocation = {
  address: string | null
  city: string | null
}

const EMPTY: HilmaRealizedLocation = { address: null, city: null }

/*
 * "anyw-cou" = missä tahansa maassa, "anyw" = missä tahansa. Nämä ovat
 * eForms-koodeja sille, ETTEI paikkaa ole ilmoitettu — eivät osoitteita.
 */
function isAnywhere(region: unknown): boolean {
  return String(region ?? "").startsWith("anyw")
}

/*
 * Pelkkä postilokero ei ole työmaan osoite. Mitattu 21.8.2026: kaksi
 * päällystysurakkaa olisi saanut osoitteekseen "PL 125" eli tilaajan
 * postilokeron. Kadun sisältävä osoite kelpaa, vaikka siinä olisi myös
 * postilokero ("Rasintie 1A, PL 25").
 */
export function isPostBoxOnly(street: string): boolean {
  return /^p\.?\s*l\.?\s*\d+$/i.test(street.replace(/\s+/g, " ").trim())
}

/*
 * Suomalainen postinumero on viisi numeroa. Ilmoituksessa 55152 oli
 * "123390" — tilaajan lyöntivirhe, joka ei kuulu osoitteeseen.
 */
function validPostalCode(value: string | null): string | null {
  return value && /^\d{5}$/.test(value) ? value : null
}

function textOf(node: any): string | null {
  const value = String(node?.value ?? "").trim()
  return value.length > 0 ? value : null
}

/*
 * Ilmoituksella voi olla useampi osa (lot) ja jokaisella oma sijaintinsa.
 * Ehdokas on kuitenkin yksi rivi, joten kahta eri työmaata ei voi esittää.
 * Silloin osoite jätetään tyhjäksi — väärä osoite on pahempi kuin puuttuva.
 * Kaupunki säilytetään, jos kaikki osat ovat samassa kaupungissa.
 */
export function parseRealizedLocation(eForm: any): HilmaRealizedLocation {
  if (!eForm) return EMPTY

  const locations: any[] = []
  for (const lot of eForm?.procurementProjectLot ?? []) {
    for (const location of lot?.procurementProject?.realizedLocation ?? []) locations.push(location)
  }
  for (const location of eForm?.procurementProject?.realizedLocation ?? []) locations.push(location)

  const addresses: string[] = []
  const cities: string[] = []

  for (const location of locations) {
    const address = location?.address
    if (!address || isAnywhere(address?.region?.value)) continue

    const street = textOf(address.streetName)
    const postal = validPostalCode(textOf(address.postalZone))
    const city = textOf(address.cityName)

    if (city) cities.push(city)

    /* Pelkkä postinumero, postilokero tai kaupunki ei ole osoite. */
    if (!street || isPostBoxOnly(street)) continue

    const tail = [postal, city].filter(Boolean).join(" ")
    addresses.push(tail ? `${street}, ${tail}` : street)
  }

  const distinctAddresses = [...new Set(addresses)]
  const distinctCities = [...new Set(cities)]

  return {
    address: distinctAddresses.length === 1 ? distinctAddresses[0] : null,
    city: distinctCities.length === 1 ? distinctCities[0] : null,
  }
}

export function hilmaNoticeApiUrl(procedureId: string, noticeId: string): string {
  return `https://www.hankintailmoitukset.fi/web/api/public/procedure/${procedureId}/enotice/${noticeId}`
}

/*
 * Palauttaa tyhjän myös virhetilanteessa: suorituspaikka on lisätieto, eikä
 * sen hakeminen saa kaataa koko ilmoituksen käsittelyä.
 */
export async function fetchHilmaRealizedLocation(
  procedureId: unknown,
  noticeId: unknown
): Promise<HilmaRealizedLocation> {
  const procedure = String(procedureId ?? "").trim()
  const notice = String(noticeId ?? "").trim()
  if (!procedure || !notice) return EMPTY

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(hilmaNoticeApiUrl(procedure, notice), {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: controller.signal,
    })
    if (!response.ok) return EMPTY

    const json = await response.json()
    return parseRealizedLocation(json?.eForm)
  } catch {
    return EMPTY
  } finally {
    clearTimeout(timer)
  }
}
