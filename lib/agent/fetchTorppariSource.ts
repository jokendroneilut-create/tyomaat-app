import { tiedotteenAikaraja } from "@/lib/agent/tiedotteenIkkuna"
import { haeSquarespaceRss, sivuurakoitsijanEhdokas } from "./sivuurakoitsijaRss"

/*
 * TORPPARI YHTIOT: AJANKOHTAISTA (D-250).
 *
 * Johannes 8.10.2026 kuvakaappauksin: hankkeita puuttui kannasta tai ne
 * olivat vajaita, vaikka Torppari kertoo niista omalla sivullaan.
 * Esimerkki on Mt 180 Kurkela–Kuusisto: Torpparin juttu nimeaa sillan
 * (Vuolahden risteyssilta S8), paaurakoitsijan (Kreate Oy), tilaajan
 * (Vaylavirasto) ja aikataulun (liikenteelle 2027 loppupuolella).
 *
 * Torppari on betoni- ja siltarakenteiden ALIurakoitsija, joten se ei ole
 * hankkeen builder. Arvo on siina, etta se nimeaa muut osapuolet.
 *
 * Squarespace, joten RSS (`?format=rss`) eika sivun kaavinta.
 * robots.txt kieltaa vain `?format=json` ym. eika RSS:aa.
 *
 * MITATTU 8.10.2026. Sitemapissa 34 julkaisua, syotteessa 20 uusinta
 * (3/2024 - 10/2026). Niista 11 on rakennushanke ja 9 henkilo- tai
 * yritysjuttua. Viimeisen 12 kuukauden sisalla 6 julkaisua, KAIKKI
 * hankkeita:
 *
 *   6.10.2026  Mt 180 Kurkela–Kuusisto (Kaarina)
 *  11.9.2026   Hyrylan Sarma (Tuusula)
 *   7.8.2026   Makasiinilaituri (Helsinki)
 *  26.6.2026   GRK ja Torppari Karjalan radalla
 *  16.11.2025  Danfoss Editronin tehdas (Lappeenranta)
 *  17.10.2025  Hangonsillan koulu ja paivakoti (Hyvinkaa)
 *
 * Vanhemmat henkilojutut ("Tuulen Nopeudella", "Yksinkertainen
 * Maalaispoika, Tuomas Rautio") ovat 2024-alun blogikaudelta.
 */

const KOKOELMA = "https://www.torppariyhtiot.fi/ajankohtaista"

/*
 * HANKESIGNAALI OTSIKOSTA. Vuodesta 2025 alkaen Torppari otsikoi
 * hankejuttunsa samalla kaavalla: "Torppari mukana rakentamassa X",
 * "Torppari toteuttaa X". Henkilojutun otsikko on henkilon nimi tai
 * aforismi, eika siita saa poissulkulistaa joka ei olisi arvaus.
 *
 * Mitattu syotteen 20 julkaisulla: 8/11 hanketta lapi, 0/9 muuta.
 * Kolme ohitettua hanketta ("Innovatiivista betonitekniikkaa",
 * "Rykmentinpuiston kampus", "Kohti hiilineutraalia tulevaisuutta") ovat
 * 12/2024 - 2/2025 eli 12 kuukauden ikkunan ulkopuolella joka
 * tapauksessa.
 */
const HANKESIGNAALI = [
  "mukana",
  "toteuttaa",
  "toteuttamassa",
  "rakentamassa",
  "rakentaa",
  "hanke",
  "hankkee",
  "urakka",
  "urakan",
  "betonoi",
  "runkorakente",
  "silta",
  "sillan",
]

/*
 * POISSULKU KATSOO VAIN OTSIKKOA (D-236, D-241). Yritys- ja
 * henkilojutut, jotka osuisivat signaaliin sanalla "mukana".
 */
const POISSULKU = [
  "suorituskyky",
  "liikevaihto",
  "tilinpaatos",
  "tilinpäätös",
  "henkilöstö",
  "henkilosto",
  "työnjohtaja",
  "tyonjohtaja",
  "rekry",
  "messu",
  "seminaari",
]

/* Suodatus erillaan hausta, jotta sen voi mitata ilman verkkoa. */
export function lapaiseeSuodatuksen(otsikko: string): boolean {
  const pieni = otsikko.toLowerCase()
  if (POISSULKU.some((k) => pieni.includes(k))) return false
  return HANKESIGNAALI.some((k) => pieni.includes(k))
}

export const TORPPARI = {
  julkaisija: "Torppari Yhtiöt",
  sourceName: "torppari",
  omatNimet: ["torppari"],
}

export async function haeTorpparinJulkaisut() {
  return haeSquarespaceRss(KOKOELMA, tiedotteenAikaraja())
}

export async function fetchTorppariSource() {
  const julkaisut = await haeTorpparinJulkaisut()
  return julkaisut
    .filter((j) => lapaiseeSuodatuksen(j.otsikko))
    .map((j) => sivuurakoitsijanEhdokas(j, TORPPARI))
}
