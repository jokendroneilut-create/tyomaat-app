/*
 * OSUNEEN HANKKEEN KUVAUS PAIVITTYY, KUN LAHDE ON TAYDENTYNYT.
 *
 * Johannes 18.11.2026: *"tee nuo kaikki kolme"* (YVA-lahteen selvitys).
 * Osumapolku paivitti metadataa, osapuolia ja yhteyshenkiloita, mutta ei
 * koskaan asiakkaalle nakyvaa kuvausta (`additional_info`). YVA-sivu
 * julkaistaan usein tynkana ("Tama sivu taydentyy myohemmin") ja
 * taydentyy vasta arviointiohjelman myota. Mitattu 18.11.2026: 26
 * YVA-rivin kuvaus oli moninkertaisesti lyhyempi kuin sivu nyt
 * (Mustakorven datakeskus 87 vs. 4 038 merkkia), ja 24 niista oli
 * koskemattomia.
 *
 * KASIN KIRJOITETTU KUVAUS EI KORVAUDU. Kuvaus on "koskematon", kun se
 * on yha sama kuin lahteen edellinen teksti (`metadata.description`),
 * tyhja tai tunnettu tynka. Kasin muokattu (myos verkkohaulla
 * taydennetty) eroaa lahteen tekstista ja jaa ennalleen.
 *
 * VAIN SAMA LAHDE. Toisen lahteen pidempi teksti ei korvaa kuvausta:
 * jalleenjulkaisija on aina viimesijainen (D-354), ja eri lahteen
 * kuvauksen vaihtaminen on eri paatos kuin saman sivun paivittyminen.
 *
 * EI LYHENNYSTA. Kuivaharjoitus 18.11.2026: paattyneen YVA:n sivu
 * supistuu (Jokelan datakeskus 5 398 -> 4 658, Arctic Sisu 5 512 ->
 * 4 448), ja 80 %:n raja olisi pudottanut tekstia asiakkaalta. Uusi
 * teksti ei siis saa olla lyhyempi kuin nykyinen, ellei nykyinen ole
 * tynka. Tilarivi ("YVA-menettelyn tila: ...") paivittyy silti, koska
 * se lisaa tekstia.
 */

export const TYNKAKUVAUS = /täydentyy myöhemmin|sivu täydentyy|sivu päivittyy myöhemmin/i

const tiivis = (s: string | null | undefined) => String(s ?? "").replace(/\s+/g, " ").trim()

export function paivitettyKuvaus(input: {
  nykyinen: string | null | undefined
  lahteenEdellinen: string | null | undefined
  uusi: string | null | undefined
  samaLahde: boolean
}): string | null {
  if (!input.samaLahde) return null
  const uusi = tiivis(input.uusi)
  const nykyinen = tiivis(input.nykyinen)
  if (!uusi || uusi === nykyinen) return null
  if (TYNKAKUVAUS.test(uusi)) return null

  const koskematon =
    !nykyinen || nykyinen === tiivis(input.lahteenEdellinen) || TYNKAKUVAUS.test(nykyinen)
  if (!koskematon) return null

  if (nykyinen && !TYNKAKUVAUS.test(nykyinen) && uusi.length < nykyinen.length) return null

  /* Alkuperainen muotoilu (kappalejaot) sailyy, tiivistys on vain vertailua varten. */
  return String(input.uusi).trim()
}
