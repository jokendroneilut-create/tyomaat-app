/*
 * ONKO HANKKEEN PISTE OIKEASSA PAIKASSA VAI KAUPUNGIN KESKUSTASSA?
 *
 * Geokoodari hakee ensin osoitteella ja putoaa sitten kaupunkiin ja
 * lopuksi maakuntaan (`lib/geo/geocode`). Kaupunkihaku palauttaa aina
 * saman pisteen, joten epäonnistuneet osoitehaut kasautuvat keskustaan.
 *
 * Mitattu 8.9.2026: näkyvistä 5 954 hankkeesta 3 980 (67 %) istuu
 * pisteellä jonka jakaa vähintään yksi toinen hanke, ja suurin kasa on
 * 536 hanketta Helsingin keskustassa (60.16662, 24.94354). Seuraavat
 * ovat Oulu 89, Rovaniemi 77, Seinäjoki 74.
 *
 * Kartalla piste näyttää yhtä täsmälliseltä riippumatta siitä
 * kummasta hausta se tuli, eikä mikään kerro eroa. Myyjä voi ajaa
 * pisteelle jossa ei ole työmaata.
 *
 * KYNNYS ON KOLME, EI KAKSI. Kahden hankkeen kasat ovat mitattuna
 * sekalaisia: osa on aidosti samaa osoitetta (Ilmarinkatu 17
 * Tampereella, Kiilakivenkuja 2 Oulussa — sama koulu tai sama
 * kiinteistö kahtena hankkeena), osa varajärjestelmää. Kolmesta
 * ylöspäin poikkeusta ei löytynyt. Kynnys 2 leimaisi siis aidosti
 * tarkat parit epävarmoiksi; ero on 148 hanketta.
 */

export type Sijaintipiste = {
  latitude?: number | string | null
  longitude?: number | string | null
  lat?: number | string | null
  lng?: number | string | null
  metadata?: { geocode_source?: string | null; [key: string]: unknown } | null
}

const KASAN_KYNNYS = 3

function numero(arvo: unknown): number | null {
  if (arvo == null) return null
  if (typeof arvo === "number") return Number.isFinite(arvo) ? arvo : null
  if (typeof arvo === "string") {
    const n = parseFloat(arvo)
    return Number.isFinite(n) ? n : null
  }
  return null
}

/*
 * Viisi desimaalia on noin metri. Varajärjestelmän piste toistuu
 * bitilleen samana, aito osoiteosuma ei käytännössä koskaan.
 */
export function pisteAvain(hanke: Sijaintipiste): string | null {
  const lat = numero(hanke.latitude ?? hanke.lat)
  const lng = numero(hanke.longitude ?? hanke.lng)
  if (lat == null || lng == null) return null
  return `${lat.toFixed(5)},${lng.toFixed(5)}`
}

export function karkeatPisteet(
  hankkeet: Sijaintipiste[],
  kynnys: number = KASAN_KYNNYS
): Set<string> {
  const laskuri = new Map<string, number>()

  for (const h of hankkeet) {
    const avain = pisteAvain(h)
    if (!avain) continue
    laskuri.set(avain, (laskuri.get(avain) ?? 0) + 1)
  }

  const karkeat = new Set<string>()
  for (const [avain, n] of laskuri) {
    if (n >= kynnys) karkeat.add(avain)
  }
  return karkeat
}

/*
 * Uusilla riveillä tarkkuus on tallessa (`metadata.geocode_source`) ja
 * se voittaa arvauksen: geokoodari tietää minkä kyselyn se sai osumaan,
 * kasaumapäättely vain päättelee sen jäljistä.
 */
export function onKarkeaSijainti(hanke: Sijaintipiste, karkeat: Set<string>): boolean {
  const lahde = hanke.metadata?.geocode_source
  if (lahde === "osoite") return false
  if (lahde === "kaupunki" || lahde === "maakunta") return true

  const avain = pisteAvain(hanke)
  return avain != null && karkeat.has(avain)
}

export function sijainninTarkkuusTeksti(hanke: Sijaintipiste): string {
  return hanke.metadata?.geocode_source === "maakunta"
    ? "Sijainti maakunnan tarkkuudella"
    : "Sijainti kaupungin tarkkuudella"
}

/*
 * ONKO SIJAINTI KATUOSOITE?
 *
 * Duplikaattien sijaintivertailu tarvitsee tiukemman ehdon kuin
 * naytolla kaytettava karkeusmerkinta. Syy on mitattu 8.9.2026:
 * pelkalla 50 metrin rajalla ja kolmen kasakynnyksella sivuun jai 233
 * paria, joista valtaosa oli kaupungin varajarjestelman kahden
 * hankkeen kasoja - "Aurinkopuisto Lappeenrantaan" ja "Monitoimiareena
 * Lappeenrantaan" olivat nollan metrin paassa toisistaan.
 *
 * Ero aitoon pariin on lahdeaineistossa: aidolla on katuosoite. Kun
 * molemmilta vaadittiin osoite, 233 putosi 52:een ja luetut rivit
 * olivat enimmakseen aitoja.
 */
const KATUOSOITE =
  /[A-ZÄÖÅ][\wÄÖÅäöå-]*(katu|tie|kuja|polku|ranta|kaari|väylä|vayla|mäki|maki|aukio|rinne|raitti|silta)\s+\d+/i

export function onKatuosoite(sijainti: string | null | undefined): boolean {
  return KATUOSOITE.test(String(sijainti ?? ""))
}
