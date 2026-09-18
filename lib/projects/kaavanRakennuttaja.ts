import { extractYvaDeveloper } from "@/lib/agent/fetchYvaSource"

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

/* Palauttaa rakennuttajan vain kun kentta on tyhja - lahteen oma arvo voittaa. */
export function kaavanRakennuttaja({
  sourceName,
  description,
  nykyinen,
}: {
  sourceName: string | null | undefined
  description: string | null | undefined
  nykyinen: string | null | undefined
}): string | null {
  if (String(nykyinen ?? "").trim()) return null
  if (!onKaavalahde(sourceName)) return null
  return extractYvaDeveloper(description)
}
