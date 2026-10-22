import { extractYvaDeveloper } from "@/lib/agent/fetchYvaSource"
import { kaavanOsapuoli } from "@/lib/projects/kaavanOsapuolet"

/*
 * KAAVAN RAKENNUTTAJA KUVAUKSESTA (D-195).
 *
 * Kaavasivu nimeaa hankkeen omistajan usein suoraan: "Neoen Renewables
 * Finland Oy suunnittelee tuulivoimapuistoa...", "YH-Kodit Oy hakee
 * kaavamuutosta...". Poimintasaanto (`extractYvaDeveloper`) oli olemassa
 * YVA:a varten, mutta kaavalahteille sita ei ajettu lainkaan.
 *
 * Mitattu 19.9.2026: kaavariveista ~6 100:lta puuttui rakennuttaja, ja
 * saanto loysi 103 rivilta - luettuna kaikki oikein yhta lukuun ottamatta
 * (i-lippu paasti lauseen nimeen, korjattu). Mukana mm. kymmenia
 * tuulivoimapuistoja ja Planmecan paakonttorin laajennus.
 *
 * RAJATTU KAAVOIHIN. Uutisissa "X toteuttaa" tarkoittaa usein urakoitsijaa,
 * joten sama saanto kaikille lahteille kirjoittaisi rakentajan
 * rakennuttajaksi. Kaavassa aloitteen tekija on maanomistaja tai
 * hankeyhtio. Lahteen nimi kertoo kaavalahteen: mitattu 242/322 lahdetta,
 * eika yksikaan osuma ollut muu kuin kaava.
 */
const KAAVALAHDE = /kaav|planl|detaljplan|generalplan|tuulivoimahank/i

export function onKaavalahde(sourceName: string | null | undefined): boolean {
  return KAAVALAHDE.test(String(sourceName ?? ""))
}

/*
 * LUOKKASANA EI OLE RAKENNUTTAJA (D-338).
 *
 * Vantaan kaavasivun "Hakija"-kentassa lukee useimmiten vain
 * maanomistuksen laji, ja se tallentui rakennuttajaksi: asiakas nakee
 * *"Rakennuttaja: Yksityinen"*. Mitattu 23.10.2026 kaavariveilta:
 * Kaupunki 86, Yksityinen 62, Muu 16, naiden yhdistelmia 10,
 * Seurakunta 2 -- yhteensa 176 rivia. Yhtiomuodottomia AITOJA nimia oli
 * samassa joukossa vain kahdeksan (Metsahallitus, Joensuun kaupunki,
 * Lempaalan kunta, Bonava, ...), joten lista on lueteltu eika paatelty
 * "ei yhtiomuotoa" -saannolla -- muuten ne kahdeksan korvautuisivat.
 *
 * Hakijan nimi lukee naissa kuvauksessa ("Lisatietoja hakijasta: Sato-
 * Asunnot Oy"), joten luokkasana kasitellaan tyhjana.
 */
const LUOKKASANA = /^(?:kaupunki|kunta|yksityinen|muu|yritys|valtio|seurakunta)$/i

export function onLuokkasana(arvo: string | null | undefined): boolean {
  const teksti = String(arvo ?? "").trim()
  if (!teksti) return false
  const osat = teksti.split(/\s*[;,/]\s*/).filter(Boolean)
  return osat.length > 0 && osat.every((osa) => LUOKKASANA.test(osa))
}

/*
 * Palauttaa rakennuttajan vain kun kentta on tyhja tai luokkasana -
 * lahteen oma NIMI voittaa aina.
 *
 * Kaksi poimijaa jarjestyksessa: YVA-sanasto ensin (D-195, mitattu
 * 151 osumaa) ja kaavan oma sanasto sen jalkeen (D-338, 70 lisaosumaa
 * tyhjille + 41 luokkasanan paalle).
 */
export function kaavanRakennuttaja({
  sourceName,
  description,
  nykyinen,
}: {
  sourceName: string | null | undefined
  description: string | null | undefined
  nykyinen: string | null | undefined
}): string | null {
  const nyt = String(nykyinen ?? "").trim()
  if (nyt && !onLuokkasana(nyt)) return null
  if (!onKaavalahde(sourceName)) return null
  return extractYvaDeveloper(description) ?? kaavanOsapuoli(description)
}
