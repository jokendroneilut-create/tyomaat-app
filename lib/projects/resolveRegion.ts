import { getMunicipalityByName } from "@/lib/geo/municipalities"

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
}): string | null {
  const merkitty = String(input.metadataRegion ?? "").trim()
  if (merkitty) return merkitty

  const kunta = String(input.city ?? "").trim()
  if (!kunta) return null

  return getMunicipalityByName(kunta)?.region ?? null
}
