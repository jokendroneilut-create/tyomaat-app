import { getMunicipalityByName } from "@/lib/geo/municipalities"
import { municipalityFromBuyerName, municipalityFromGenitive } from "@/lib/geo/municipalityFromName"
import { regionFromOrganisationName } from "@/lib/geo/regionFromName"

/*
 * MAAKUNTA PÄÄTELLÄÄN KUNNASTA, JOS LÄHDE EI SITÄ KERRO.
 *
 * Osa lähteistä kirjoittaa maakunnan metadataan (kaavalähteet), osa ei
 * (Espoon kuulutukset, Hilma). Hyväksyntä on aina päätellyt puuttuvan
 * maakunnan kunnasta, mutta TIC:n esikatselu luki pelkkää
 * `metadata.region`-kenttää — joten se näytti tyhjää maakuntaa vaikka
 * hyväksyntä olisi täyttänyt sen oikein.
 *
 * Mitattu 1.9.2026: Espoon kuulutuksista hyväksytyistä 18 hankkeesta
 * 18:lla maakunta on "Uusimaa", mutta katselmoinnissa kenttä näytti
 * tyhjältä. Vika oli siis vain näytössä — mutta se on juuri se näyttö
 * jonka perusteella hanke hyväksytään, joten tyhjä kenttä näyttää
 * puuttuvalta tiedolta.
 *
 * Sama funktio kummassakin, jotta esikatselu ja hyväksyntä eivät voi
 * erota toisistaan.
 */
export function resolveRegion(input: {
  metadataRegion?: string | null
  city?: string | null
  /*
   * Tilaajan nimi ("Iitin kunta"). Osalla Hilman ilmoituksista kuntaa ei
   * ole omana kenttänään, mutta tilaaja on kunta itse — ja kunta
   * rakennuttaa käytännössä aina omalle alueelleen. Yksityinen tilaaja
   * ("YIT Oyj") ei osu kaavaan, joten se palauttaa tyhjän.
   */
  buyerName?: string | null
  /*
   * Otsikko viimeisena keinona. Hilman ilmoituksissa kohde on usein
   * vain otsikossa ("Kiteen alueen tyokone- ja kuljetuspalvelut"), kun
   * rakenteinen kuntakentta on tyhja.
   */
  title?: string | null
}): string | null {
  const merkitty = String(input.metadataRegion ?? "").trim()
  if (merkitty) return merkitty

  const kunta = String(input.city ?? "").trim()
  if (kunta) {
    const osuma = getMunicipalityByName(kunta)?.region
    if (osuma) return osuma
  }

  const tilaaja = String(input.buyerName ?? "").trim()
  if (tilaaja) {
    const kunnasta = municipalityFromBuyerName(tilaaja)?.region
    if (kunnasta) return kunnasta

    /*
     * MAAKUNNALLINEN TILAAJA. "Pohjois-Karjalan hankintatoimi",
     * "Varsinais-Suomen ELY-keskus" ja hyvinvointialueet eivat ole
     * kuntia, joten kunnasta paattely ei osu - mutta nimi kertoo
     * maakunnan suoraan. Se on juuri se tieto jota asiakas suodattaa.
     */
    const nimesta = regionFromOrganisationName(tilaaja)
    if (nimesta) return nimesta
  }

  /*
   * OTSIKON ENSIMMAINEN SANA GENETIIVISSA. Heikoin keino ja siksi
   * viimeisena: "Kiteen alueen tyokone- ja kuljetuspalvelut" antaa
   * Kitee -> Pohjois-Karjala. Hyvaksytaan vain jos genetiivi ratkeaa
   * yksikasitteisesti kunnaksi (`municipalityFromGenitive`), jolloin
   * kadun- ja yritysnimet eivat osu.
   */
  const ensimmainen = String(input.title ?? "").trim().split(/\s+/)[0]
  if (ensimmainen) return municipalityFromGenitive(ensimmainen)?.region ?? null

  return null
}
