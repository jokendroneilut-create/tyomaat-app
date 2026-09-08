/*
 * PHOTON OSOITEHAKUUN.
 *
 * Nominatim ei löydä suomalaisia katuosoitteita luotettavasti ja putoaa
 * kaupunkihakuun, jolloin piste on keskusta. Mitattu 8.9.2026:
 * näkyvistä 5 954 hankkeesta 3 980 istuu jaetulla pisteellä ja 536
 * niistä Helsingin keskustassa.
 *
 * Photon (komoot, sama OSM-aineisto mutta parempi haku) ratkaisi
 * testissä juuri ne osoitteet jotka Nominatim hukkasi:
 *
 *   Tihtaalinkatu 4 Helsinki   -> 60.17820, 24.97520  (talo)
 *   Kolmihaarankatu 3 Tampere  -> 61.50185, 23.58335  (talo)
 *   Ilmarinkatu 17 Tampere     -> 61.50158, 23.78550  (talo)
 *
 * SE MYÖS ARVAA, ja siksi tässä on portti. "Kanalinsuu Rauma" (kaavan
 * nimi, ei osoite) palautti "Kanalinpuisto" — eri kohde, samalta
 * kuulostava nimi. Ilman tyyppitarkistusta se olisi kirjattu
 * osoitetarkaksi pisteeksi.
 *
 * Nominatim jää varalle: sitä käytetään kun Photon ei vastaa.
 */

export type PhotonTulos = {
  lat: number
  lon: number
  tarkkuus: "osoite" | "kaupunki"
  nimi: string
} | null

/*
 * Photonin `type` kertoo mihin osuttiin. Vain nämä kelpaavat:
 * "house" ja "street" ovat osoitetarkkoja, "city" ja "district" ovat
 * kaupunkitasoa. Kaikki muu ("other", "locality", POI-osumat) on
 * arvausta ja hylätään — sama linja kuin muualla: mieluummin tyhjä.
 */
const TARKAT = new Set(["house", "street"])
const KAUPUNKITASO = new Set(["city", "district"])

export function photonTulos(data: unknown): PhotonTulos {
  const features = (data as { features?: unknown[] })?.features
  if (!Array.isArray(features) || features.length === 0) return null

  const f = features[0] as {
    properties?: { type?: string; countrycode?: string; name?: string; street?: string }
    geometry?: { coordinates?: unknown }
  }

  const p = f?.properties ?? {}

  /* Ulkomainen osuma ei ole suomalainen hanke. */
  if (p.countrycode && p.countrycode !== "FI") return null

  const tyyppi = String(p.type ?? "")
  const tarkkuus = TARKAT.has(tyyppi) ? "osoite" : KAUPUNKITASO.has(tyyppi) ? "kaupunki" : null
  if (!tarkkuus) return null

  const koord = f?.geometry?.coordinates
  if (!Array.isArray(koord) || koord.length < 2) return null

  const lon = Number(koord[0])
  const lat = Number(koord[1])
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null

  return { lat, lon, tarkkuus, nimi: String(p.street || p.name || "") }
}

/*
 * TULOKSEN KADUN ON VASTATTAVA KYSYTTYÄ.
 *
 * Tyyppitarkistus ei riitä: Photon palauttaa mielellään tyypin "house"
 * myös naapurikadulta. Mitattu 8.9.2026 kuivaharjoituksessa, 23
 * tarkentuneesta kaksi oli eri katu:
 *
 *   "Luhtaniityntie 6, Kerava"   -> Sibeliuksentie
 *   "Pohjantie 2, 65380 Vaasa"   -> Kiitokaari
 *
 * Väärä katu on pahempi kuin kaupungin keskusta: keskusta on
 * rehellisesti karkea ja se myös merkitään sellaiseksi, mutta väärä
 * katuosoite näyttää tarkalta ja vie väärään paikkaan.
 *
 * Vertailu on tarkoituksella tiukka. "Taimistonpolku" vs
 * "Taimistopolku" hylätään, vaikka kyse on todennäköisesti samasta
 * kadusta — tyhjä on parempi kuin arvaus.
 */
function normalisoiKatu(teksti: string): string {
  return teksti.toLowerCase().replace(/[^a-zäöå]/g, "")
}

export function katuVastaa(kysely: string, tuloksenNimi: string): boolean {
  const tulos = normalisoiKatu(tuloksenNimi)
  if (tulos.length < 4) return false

  /* Kadunnimi on kyselyssä ennen talonumeroa. */
  const osa = String(kysely).split(/\d/)[0] ?? ""
  const kysytty = normalisoiKatu(osa)
  if (kysytty.length < 4) return false

  return kysytty.includes(tulos) || tulos.includes(kysytty)
}

export async function photonHaku(query: string): Promise<PhotonTulos> {
  if (!query.trim()) return null

  try {
    const url = `https://photon.komoot.io/api/?limit=1&q=${encodeURIComponent(query)}`
    const res = await fetch(url, {
      headers: { "User-Agent": "Tyomaat.fi Discovery Agent" },
      cache: "no-store",
    })
    if (!res.ok) return null

    const tulos = photonTulos(await res.json())

    /* Osoitetarkka tulos kelpaa vain jos katu vastaa kysyttya. */
    if (tulos?.tarkkuus === "osoite" && !katuVastaa(query, tulos.nimi)) return null

    return tulos
  } catch (error) {
    console.error("photonHaku failed (fail-open):", error)
    return null
  }
}
