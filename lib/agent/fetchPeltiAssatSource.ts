import { tiedotteenAikaraja } from "@/lib/agent/tiedotteenIkkuna"
import { haeSquarespaceRss, sivuurakoitsijanEhdokas } from "./sivuurakoitsijaRss"

/*
 * PELTI-ASSAT: BLOGIT JA JUTUT (D-250).
 *
 * Vesikattourakoitsija, eli hankkeessa ALIurakoitsija. Hankejutussa se
 * nimeaa kohteen, paaurakoitsijan ja usein rakennuttajan — esim. "Skanska
 * valitsi Pelti-Assien bitumikateurakoinnin vesikattourakoitsijaksi
 * Firdo-hankkeeseen".
 *
 * ARVIOITAVA, EI ITSESTAAN SELVA LAHDE. Blogi on paaosin markkinointia.
 * Mitattu 8.10.2026: sitemapissa 243 julkaisua; viimeisen 12 kuukauden
 * sisalla 32, joista 6 on rakennushanke (19 %):
 *
 *   30.7.2026  Elmo Areena, Vantaa (vesikatot, urakoitsija VRJ)
 *  20.1.2026   Hinthaaran sivistyskeskus, Porvoo (Varte Lahti)
 *   4.12.2025  Careeria, Porvoo
 *   6.11.2025  Firdo, Pasila (Skanska)
 *  28.10.2025  Lauttasaaren yhteiskoulu
 *  16.10.2025  Fashion Centerin laajennus
 *
 * Loput 26 ovat rekrytointeja, oppaita taloyhtioille, sertifikaatteja ja
 * kumppanuussopimuksia. Lahde rakennettiin silti, koska kuudesta neljaa
 * (Elmo Areena, Hinthaaran sivistyskeskus, Careeria, Fashion Center) ei
 * ollut kannassa lainkaan.
 *
 * SIKSI HANKESIGNAALI VAADITAAN OTSIKOSTA. Toisin kuin Keravan
 * uutisissa (D-247), tassa poissulkulista ei riita: markkinointijuttujen
 * otsikot ovat vapaata proosaa ("Isat ja pojat", "Veden seisonta
 * loivilla katoilla"), eika niita voi luetella. Hankejutut taas
 * otsikoidaan yhdenmukaisesti: "Hankeuutisia: ...", "toteuttaa ...",
 * "... urakoitsijaksi". Mitattu 40 julkaisulla (7/2025 - 8/2026):
 * 6/6 hanketta lapi, 0 muuta.
 */

const KOKOELMA = "https://www.peltiassat.fi/blogit-ja-jutut"

const HANKESIGNAALI = [
  "hankeuutisia",
  "toteuttaa",
  "urakoitsijaksi",
  "vesikattotyöt",
  "vesikattotyot",
]

/*
 * POISSULKU KATSOO VAIN OTSIKKOA (D-236, D-241). "Hankeuutisia: Pelti-
 * Assat Oy ja Toivo Group solmivat vuosisopimuksen" on puitesopimus eika
 * yksittainen hanke. Rekrytointi-ilmoitus voi mainita hankkeen
 * ("toteuttaa") houkuttimena.
 */
const POISSULKU = [
  "vuosisopimu",
  "puitesopimu",
  "kumppanuu",
  "rekry",
  "hakee",
  "haemme",
  "haku käynnissä",
  "haku kaynnissa",
  "kampanja",
  "sertifikaat",
]

/* Suodatus erillaan hausta, jotta sen voi mitata ilman verkkoa. */
export function lapaiseeSuodatuksen(otsikko: string): boolean {
  const pieni = otsikko.toLowerCase()
  if (POISSULKU.some((k) => pieni.includes(k))) return false
  return HANKESIGNAALI.some((k) => pieni.includes(k))
}

export const PELTI_ASSAT = {
  julkaisija: "Pelti-Ässät",
  sourceName: "pelti_assat",
  omatNimet: ["pelti-ässä", "pelti-ässi", "ässien", "pelti‑ässi", "kattokorjaamo"],
}

export async function haePeltiAssienJulkaisut() {
  return haeSquarespaceRss(KOKOELMA, tiedotteenAikaraja())
}

export async function fetchPeltiAssatSource() {
  const julkaisut = await haePeltiAssienJulkaisut()
  return julkaisut
    .filter((j) => lapaiseeSuodatuksen(j.otsikko))
    .map((j) => sivuurakoitsijanEhdokas(j, PELTI_ASSAT))
}
