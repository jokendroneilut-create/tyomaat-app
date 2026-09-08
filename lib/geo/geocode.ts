import { photonHaku } from "./photon"

export type GeocodeResult = {
  lat: number | null
  lon: number | null
}

export async function geocodeAddress(query: string): Promise<GeocodeResult> {
  if (!query) return { lat: null, lon: null }

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`

    const res = await fetch(url, {
      headers: {
        "Accept-Language": "fi,en;q=0.8",
        "User-Agent": "Tyomaat.fi Discovery Agent",
      },
      cache: "no-store",
    })

    const data = await res.json()

    if (Array.isArray(data) && data.length > 0 && data[0]?.lat && data[0]?.lon) {
      return {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon),
      }
    }

    return { lat: null, lon: null }
  } catch (error) {
    console.error("Geocoding error:", error)
    return { lat: null, lon: null }
  }
}

/*
 * PELKKÄ "Finland" EI OLE SIJAINTI.
 *
 * Kysely rakennettiin muodossa [location, city, region, "Finland"]. Kun
 * kolme ensimmäistä puuttuu, jäljelle jäi pelkkä "Finland", ja
 * Nominatim vastaa siihen maan solmupisteellä 63.247, 25.921.
 *
 * Mitattu 8.9.2026: kolme hanketta ilman mitään sijaintitietoa
 * ("Skanska sai uuden mittavan datakeskusurakan", "Suunnittelun
 * tukipalvelut", OX2:n investointipäätös) sai näin koordinaatit
 * Haapajärven kohdalta. Kartalla piste näyttää täsmälliseltä eikä
 * mikään kerro että se on keksitty — se on pahempi kuin puuttuva
 * koordinaatti (ks. piilotuskynnyksen sama linja).
 *
 * Vaaditaan siis vähintään yksi oikea sijaintitieto. "Finland" on
 * pelkkä maarajaus kyselyssä, ei koskaan kyselyn ainoa sisältö.
 */
export function onSijaintitietoa(input: {
  location?: string | null
  city?: string | null
  region?: string | null
}): boolean {
  return Boolean(input.location?.trim() || input.city?.trim() || input.region?.trim())
}

export async function geocodeProjectLocation(input: {
  location?: string | null
  city?: string | null
  region?: string | null
}) {
  if (!onSijaintitietoa(input)) return { lat: null, lon: null, tarkkuus: null }

  /*
   * OSOITEHAKU PHOTONILLA ENSIN.
   *
   * Nominatim hukkaa suomalaiset katuosoitteet ja putoaa kaupunkiin,
   * jolloin piste on keskusta (ks. `lib/geo/photon`). Photon osaa ne,
   * ja sen tulos hyväksytään vain jos tyyppi on talo tai katu.
   *
   * Vain jos osoite on olemassa: kaupunki- ja maakuntahaut hoidetaan
   * alla entiseen tapaan, koska niissä Nominatim on riittävä eikä
   * kahta palvelua kannata pitää samasta työstä.
   */
  if (input.location?.trim()) {
    const osoite = [input.location, input.city].map((v) => v?.trim()).filter(Boolean).join(", ")
    const photon = await photonHaku(osoite)

    if (photon?.tarkkuus === "osoite") {
      return { lat: photon.lat, lon: photon.lon, tarkkuus: "osoite" }
    }
  }

  const q1 = [input.location, input.city, input.region, "Finland"]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(", ")

  let coords = await geocodeAddress(q1)

  /*
   * TARKKUUS KERTOO MIKÄ KYSELY OSUI, ei mitä kenttiä oli olemassa.
   *
   * Ero ei ole kosmeettinen: "Hopeasalmentien silta, Helsinki" ei
   * ratkennut osoitteena vaan putosi kaupunkihakuun, jolloin piste on
   * Helsingin keskustassa eikä Lauttasaaressa. Jos tarkkuus
   * päätellään kentistä, tuo piste merkittäisiin osoitetarkaksi ja
   * kartalla se väittäisi enemmän kuin tietää.
   */
  let tarkkuus: "osoite" | "kaupunki" | "maakunta" | null =
    coords.lat != null ? (input.location?.trim() ? "osoite" : input.city?.trim() ? "kaupunki" : "maakunta") : null

  if ((coords.lat == null || coords.lon == null) && input.city?.trim()) {
    coords = await geocodeAddress(`${input.city.trim()}, Finland`)
    tarkkuus = coords.lat != null ? "kaupunki" : null
  }

  if ((coords.lat == null || coords.lon == null) && input.region?.trim()) {
    coords = await geocodeAddress(`${input.region.trim()}, Finland`)
    tarkkuus = coords.lat != null ? "maakunta" : null
  }

  return { ...coords, tarkkuus }
}