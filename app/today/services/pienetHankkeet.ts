/*
 * "LIIAN PIENI HANKE" -PALAUTE PIILOTTAA PIENET (D-442).
 *
 * Johannes 20.11.2026: *"tuntuisi järkevältä että käyttäjä joka on valinnut
 * alapeukun ja 'liian pieni hanke' ei näkisi noita omassa tänään
 * näkymässään"* — "noita" = hankkeet, jotka TIC:n hyväksynnässä on merkitty
 * valinnalla "⏳ Aseta vanhenemaan vuoden kuluttua (pienet hankkeet…)",
 * eli `metadata.pieni_hanke = true`.
 *
 * Ennen tätä palautteen syytä ei luettu mihinkään: alapeukku piilotti vain
 * sen yhden hankkeen, ja kokoluokka (`size_class`) on julkisilla
 * hankkeilla aina tyhjä, joten suosittelu ei oppinut koosta mitään.
 *
 * Yksi "liian pieni" -alapeukku riittää: valinta on käyttäjän nimenomainen
 * kanta kokoon, ei satunnainen.
 */

export const LIIAN_PIENI = "Liian pieni hanke"

export function piilottaaPienet(
  palautteet: { rating?: string | null; reason_category?: string | null }[]
): boolean {
  return palautteet.some((p) => p.rating === "down" && p.reason_category === LIIAN_PIENI)
}

/* Metadata luetaan Tänään-haussa tekstinä (`metadata->>pieni_hanke`), muualla totuusarvona. */
export function onPieniHanke(project: { metadata?: Record<string, unknown> | null }): boolean {
  const arvo = project?.metadata?.pieni_hanke
  return arvo === true || arvo === "true"
}
