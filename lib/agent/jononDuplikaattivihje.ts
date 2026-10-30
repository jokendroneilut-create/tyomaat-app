/*
 * JONORIVIN DUPLIKAATTIVIHJE: SAMA PAIKKA, ERI NIMI (D-365).
 *
 * Tasmaytin loytaa osuman nimesta, osoitteesta, lupanumerosta tai
 * kiinteistotunnuksesta. Datakeskusrekisterilla ei ole niista yhtaan:
 * nimet ovat sen omia ("Hyperco Lohja, Virkkala"), meidan nimet
 * lahteidemme omia ("Lohjan datakeskus"), eika katuosoitetta ole.
 * Mitattu 30.10.2026: koordinaatti loysi 32 ehdokasta 150:sta jo
 * kannasta, tasmaytin nimen perusteella 0.
 *
 * Vihje ei yhdista mitaan. Se kertoo katselmoijalle etta samassa
 * paikassa on jo hanke, ja antaa etaisyyden perusteeksi.
 *
 * LAHEISYYS YKSIN EI OLE TODISTE SAMUUDESTA. Tama mitattiin, koska
 * ensimmainen versio vertasi koordinaattia kaikkiin hankkeisiin:
 *
 *   kaikki koordinaatilliset rivit      73 osumaa  -- roskaa
 *   vain ne joilla katuosoite           71 osumaa  -- yha roskaa
 *   vain samaa lajia                    32 osumaa  -- mielekasta
 *
 * Roska oli silmiinpistavaa: "Polarnode Kuopio, Mustakorpi" <->
 * "Hoivakoti Kuopioon" 0,0 km:n paassa. Datakeskus ja hoivakoti VOIVAT
 * olla samassa korttelissa. Katuosoitteen vaatiminen ei auttanut, eli
 * osoite ei takaa tarkkaa koordinaattia -- lajirajaus on se mika
 * ratkaisee.
 *
 * Osoitetta ei silti vaadita: se olisi pudottanut 32:sta 30:een eli
 * havittanyt kaksi oikeaa paria. Suodatin poistaa vain sen minka
 * tiedamme, ei sita mita emme tieda ([[never-hide-on-missing-data]]).
 */

/* Kolme kilometria on kunnan sisalla loysa, ja se on tarkoitus: vihje
 * menee ihmiselle, joka hylkaa vaaran yhdella silmayksella. Tiukempi
 * sade pudottaisi oikeita pareja (Forssa osui 2,8 km:n paasta). */
export const SADE_KM = 3

/* Enemman kuin kolme osumaa ei auta paatoksessa vaan hautaa sen. */
export const OSUMIA_ENINTAAN = 3

export type Vihjehanke = {
  id: string
  name: string | null
  city: string | null
  phase: string | null
  developer: string | null
  property_type: string | null
  latitude: number | null
  longitude: number | null
}

export type Vihjeosuma = {
  hanke_id: string
  nimi: string
  kunta: string | null
  vaihe: string | null
  tilaaja: string | null
  etaisyys_km: number
}

export type Duplikaattiehdotus = {
  peruste: "koordinaatti"
  sade_km: number
  luotu: string
  osumat: Vihjeosuma[]
}

/* Kahden pisteen etaisyys kilometreina (haversine). */
export function etaisyysKm(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number
): number {
  const R = 6371
  const rad = (x: number) => (x * Math.PI) / 180
  const dLat = rad(bLat - aLat)
  const dLon = rad(bLon - aLon)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

/*
 * LAJIN TUNNUSMERKIT TYYPPIA KOHTI.
 *
 * `property_type` on meilla epataysi: moni rivi on luotu ennen kuin
 * tyyppi oli kaytossa, ja silloin lajin kertoo vain nimi. Siksi kumpi
 * tahansa riittaa.
 *
 * Lista on tahallaan lyhyt. Uutta tyyppia ei lisata arvaamalla vaan
 * mittaamalla, montako paria se tuottaa ja montako niista on roskaa --
 * juuri sen mittauksen takia tama rajaus on olemassa.
 */
const LAJIN_SANAT: Record<string, RegExp> = {
  Datakeskus: /datakeskus|palvelinkeskus|konesali|data ?cent/i,
}

export function samaLaji(
  ehdokkaanTyyppi: string | null,
  hanke: Vihjehanke
): boolean {
  if (!ehdokkaanTyyppi) return false
  if (hanke.property_type === ehdokkaanTyyppi) return true
  const sanat = LAJIN_SANAT[ehdokkaanTyyppi]
  return sanat ? sanat.test(String(hanke.name ?? "")) : false
}

/*
 * Kunta on pakollinen lisaehto. Ilman sita kolmen kilometrin sade
 * ylittaa kuntarajan siella missa hankkeet ovat lahella rajaa, ja
 * kunta on ainoa kentta joka meilla on molemmilla puolilla varmasti.
 * Jos kunta puuttuu toiselta, sita ei kayteta hylkaykseen.
 */
function kuntaKelpaa(ehdokkaanKunta: string | null, hanke: Vihjehanke): boolean {
  if (!ehdokkaanKunta || !hanke.city) return true
  return ehdokkaanKunta === hanke.city
}

export function etsiVihjeet(
  ehdokas: {
    kunta: string | null
    property_type: string | null
    lat: number | null
    lon: number | null
  },
  hankkeet: Vihjehanke[]
): Vihjeosuma[] {
  if (ehdokas.lat == null || ehdokas.lon == null) return []

  return hankkeet
    .filter(
      (h) =>
        h.latitude != null &&
        h.longitude != null &&
        kuntaKelpaa(ehdokas.kunta, h) &&
        samaLaji(ehdokas.property_type, h)
    )
    .map((h) => ({
      h,
      d: etaisyysKm(ehdokas.lat!, ehdokas.lon!, h.latitude!, h.longitude!),
    }))
    .filter((x) => x.d <= SADE_KM)
    .sort((a, b) => a.d - b.d)
    .slice(0, OSUMIA_ENINTAAN)
    .map(({ h, d }) => ({
      hanke_id: h.id,
      nimi: String(h.name ?? ""),
      kunta: h.city,
      vaihe: h.phase,
      tilaaja: h.developer,
      /* Yksi desimaali: tarkempi luku esittaisi tarkkuutta jota ei ole. */
      etaisyys_km: Math.round(d * 10) / 10,
    }))
}

export function duplikaattiehdotus(osumat: Vihjeosuma[]): Duplikaattiehdotus | null {
  if (!osumat.length) return null
  return {
    peruste: "koordinaatti",
    sade_km: SADE_KM,
    luotu: new Date().toISOString(),
    osumat,
  }
}
