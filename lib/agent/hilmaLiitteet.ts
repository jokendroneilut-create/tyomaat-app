/*
 * HILMAN TARJOUSASIAKIRJAT.
 *
 * MIKSI. Johannes 15.10.2026 Hämeenkyrön ikkunaremontista: kuvaus oli
 * 79 merkkiä (*"Kirkkokatu 14 ja 16 ikkuna- ja oviremontti."*), kun
 * urakkaohjelmassa lukee urakan laajuus — 212 ikkunaa, 64 parvekeovea,
 * seitsemän puuovea ja julkisivupaneloinnit.
 *
 * `19_KUVAUSTEN_KATTAVUUS.md` oli jo nimennyt tämän reitin — *"Lisäteksti
 * olisi tarjouspyyntöasiakirjoissa, ei ilmoituksessa"* — mutta sitä ei
 * ollut kokeiltu. Koodissa ei ollut yhtäkään mainintaa liitteistä.
 *
 * REITTI. Ilmoituksen liiteluettelo on julkisessa rajapinnassa, jota
 * Hilman oma sivu käyttää, ja tiedostot ovat avoimella CDN:llä ilman
 * kirjautumista:
 *
 *   GET /web/api/public/procedure/{procedureId}/enotice/{noticeId}
 *       -> attachments: [{ id, name }]
 *   GET https://cdn.hankintailmoitukset.fi/public-attachments/{id}
 *
 * Mitattu Hämeenkyrön ilmoituksella: rajapinta 433 ms, 6 liitettä,
 * urakkaohjelmasta 11 787 merkkiä tekstiä 3,4 sekunnissa.
 *
 * KATTAVUUS ON PIENI, JA SE SANOTAAN ETEEN. Otos 25 ohuesta
 * Hilma-rivistä (tasavälein 523:sta): **liite löytyi 1:llä**, 21:llä oli
 * nolla liitettä ja 3:lta puuttuivat tunnisteet. Syy on Hilman omalla
 * sivulla: jos ilmoitus on lähetetty toisesta järjestelmästä, Hilmassa
 * on vain ilmoituksen PDF ja asiakirjat ovat tilaajan omassa
 * kilpailutusjärjestelmässä (Cloudia, Tarjouspalvelu) kirjautumisen
 * takana. Tämä reitti ei siis ratkaise Hilman ohuita rivejä yleisesti —
 * se ratkaisee ne, joissa ilmoitus on tehty Hilmassa.
 */

/* Liitteen nimi kertoo sisällön; järjestys on valintajärjestys. */
const LIITE_PAREMMUUS = [
  /urakkaohjelma/i,
  /tarjouspyynt/i,
  /ty[öo]selostus|ty[öo]selitys/i,
  /hankekuvaus|hankeselostus|rakennusselostus/i,
]

/* Nämä eivät kerro hankkeesta: lomakkeita, ehtoja, piirustusluetteloita. */
const OHITA_LIITE = /tarjouslomake|turvallisuusasiakirja|urakkarajaliite|yse|sopimusluonnos|piirustusluettelo|tilaajavastuu/i

export type HilmaLiite = { id: string; name: string }

export function liiteUrl(id: string): string {
  return `https://cdn.hankintailmoitukset.fi/public-attachments/${id}`
}

export function liiteluettelonOsoite(procedureId: number | string, noticeId: number | string): string {
  return `https://www.hankintailmoitukset.fi/web/api/public/procedure/${procedureId}/enotice/${noticeId}`
}

export function jasennaLiitteet(json: unknown): HilmaLiite[] {
  const lista = (json as any)?.attachments
  if (!Array.isArray(lista)) return []
  return lista
    .map((l: any) => ({ id: String(l?.id ?? ""), name: String(l?.name ?? "") }))
    .filter((l) => l.id && l.name)
}

/*
 * Paras liite sisällön kannalta. Word-tiedostoja ei oteta: purkaja on
 * pdf-parse, eikä .docx:sta tule tekstiä.
 */
export function valitseLiite(liitteet: HilmaLiite[]): HilmaLiite | null {
  const kelpaavat = liitteet.filter(
    (l) => /\.pdf$/i.test(l.name) && !OHITA_LIITE.test(l.name)
  )
  for (const kuvio of LIITE_PAREMMUUS) {
    const osuma = kelpaavat.find((l) => kuvio.test(l.name))
    if (osuma) return osuma
  }
  return null
}

/*
 * URAKAN LAAJUUS ASIAKIRJAN TEKSTISTÄ.
 *
 * ANSA: SISÄLLYSLUETTELO. Urakkaohjelma alkaa sisällysluettelolla, jossa
 * sama otsikko esiintyy ensimmäisenä pistejonon ja sivunumeron kanssa:
 *
 *   "2. Rakennuskohde ja urakan laajuus ................ 3"
 *
 * Ensimmäinen osuma antaisi siis luettelon, ei tekstiä — ja
 * sisällysluettelo on yksi niistä kolmesta jota kuvaukseksi ei lasketa
 * (19_KUVAUSTEN_KATTAVUUS). Siksi osumista valitaan se, jonka perässä
 * on proosaa: pistejonoja ja sivunumeroita vähän, kirjaimia paljon.
 */
/*
 * SANARAJA PAKOLLINEN. Ilman sitä `rakennuskohteet?` osui sanan
 * "rakennuskohteeseen" sisään, ja poiminta alkoi kesken virkettä
 * keskeltä YSE-vakiotekstiä:
 *
 *   "rakennuskohteeseen sopimuksessa määritetyn työntuloksen ja
 *    luovuttamaan sen sopimusasiakirjojen mukaisesti…"
 */
const OTSIKKO =
  /(?<![\wåäöÅÄÖ])(?:rakennuskohde ja urakan laajuus|urakan laajuus|rakennuskohde ja sen sijainti|hankkeen kuvaus|rakennuskohteet?)(?![\wåäöÅÄÖ])/gi

/* Seuraava numeroitu otsikko päättää osion. */
const SEURAAVA_OTSIKKO = /\s\d{1,2}\.\s*[A-ZÅÄÖ][a-zåäö]/

const VAHIMMAISPITUUS = 120
const ENIMMAISPITUUS = 2000

/*
 * SISÄLLYSLUETTELO ILMAN PISTEJONOA.
 *
 * Pistejono ei riitä tunnusmerkiksi. TVT Jyrkkälänrinteen urakkaohjelmassa
 * luettelo läpäisi suojan, koska sivunumerot ovat kiinni sanoissa:
 *
 *   "Urakan laajuus ja tekniset rajaukset4 7 Haitta-aineet ja
 *    erityistyöt5 8 Työturvallisuus ja viranomaismenettelyt5 9 …"
 *
 * Kirjainosuus on korkea ja pistejonoa ei ole, joten luettelo näytti
 * proosalta. Kirjaimeen kiinni liimattu numero sen sijaan on luettelon
 * varma merkki: leipätekstissä numeroa edeltää välilyönti ("vuonna 1979",
 * "212 ikkunaa", "3.1 Luonnossuunnitelmat").
 */
const LUETTELON_SIVUNUMERO = /[a-zåäö]\d/gi
const LUETTELON_RAJA = 2

function onProosaa(pala: string): boolean {
  if (pala.length < VAHIMMAISPITUUS) return false
  /* Pistejono on sisällysluettelon tunnusmerkki. */
  if (/\.{4,}/.test(pala)) return false
  if ((pala.match(LUETTELON_SIVUNUMERO) ?? []).length >= LUETTELON_RAJA) return false
  const kirjaimet = (pala.match(/[a-zåäöA-ZÅÄÖ]/g) ?? []).length
  return kirjaimet / pala.length > 0.6
}

/*
 * SIVUN ALATUNNISTE POIS.
 *
 * Osio päättyy usein PDF:n sivutunnisteeseen, joka ei kerro hankkeesta:
 *
 *   "… urakkarajaliitteen perusteella. Hämeenkyrön Asunnonhankinta Oy |
 *    Kirkkokatu 14 ja 16 | Urakkaohjelma – Liite 1"
 *
 * Tunnusmerkki on toisto: alatunniste on joka sivulla, joten se esiintyy
 * koko tekstissä useamman kerran. Sitä ei siis tarvitse tunnistaa
 * muodosta, mikä olisi hauraampaa.
 */
function karsiAlatunniste(pala: string, kokoTeksti: string): string {
  const viimeinenPiste = pala.lastIndexOf(". ")
  if (viimeinenPiste < 0) return pala

  const hanta = pala.slice(viimeinenPiste + 1).trim()
  if (hanta.length < 10 || hanta.length > 160) return pala
  /* Virke päättyy pisteeseen; alatunniste ei. */
  if (hanta.endsWith(".")) return pala

  const osumat = kokoTeksti.split(hanta).length - 1
  return osumat >= 2 ? pala.slice(0, viimeinenPiste + 1).trim() : pala
}

export function urakanLaajuus(teksti: string | null | undefined): string | null {
  if (!teksti) return null
  const siisti = teksti.replace(/\s+/g, " ").trim()

  for (const osuma of siisti.matchAll(OTSIKKO)) {
    const alku = osuma.index ?? -1
    if (alku < 0) continue

    const jaljessa = siisti.slice(alku)
    const loppu = jaljessa.slice(40).search(SEURAAVA_OTSIKKO)
    const raaka = (loppu >= 0 ? jaljessa.slice(0, 40 + loppu) : jaljessa.slice(0, ENIMMAISPITUUS)).trim()
    const pala = karsiAlatunniste(raaka, siisti)

    if (onProosaa(pala)) return pala.slice(0, ENIMMAISPITUUS)
  }
  return null
}
