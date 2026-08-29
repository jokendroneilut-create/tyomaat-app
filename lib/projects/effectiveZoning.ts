import { normalizeLegacyPhase } from "@/lib/projects/phases"

/*
 * LAINVOIMAINEN KAAVA EI OLE ENÄÄ KAAVOITUSTA.
 *
 * Kun kaava on tullut voimaan, kaavoitus on ohi ja rakentaminen on
 * mahdollista: seuraavaksi tulevat suunnittelu, tontinluovutus ja
 * rakennuslupa. Se on myyjälle paras hetki — ja juuri se hetki jäi
 * meiltä näkymättömiin.
 *
 * Mitattu 29.–30.8.2026: 127 hanketta näkyi vaiheessa "Kaavoitus" vaikka
 * lähde kertoi kaavan tulleen voimaan. Ne olivat samassa kasassa kuin
 * juuri vireille tulleet kaavat, joten alkavia työmaita etsivä ei
 * löytänyt niitä lainkaan.
 *
 * KYNNYS 24 KUUKAUTTA. Tuore lainvoima tarkoittaa että hanke on
 * käynnistymässä; vuosikymmenen takainen kaava on joko rakennettu tai ei
 * toteudu koskaan. Kahden vuoden raja on harkittu, ei mitattu: kanta on
 * liian nuori kertomaan kuinka nopeasti lainvoimainen kaava johtaa
 * rakentamiseen. Se on mitattavissa myöhemmin, kun samoja hankkeita on
 * seurattu pidempään.
 *
 * VANHOJA EI KOSKETA TÄSSÄ. Se että vanha kaava kuuluisi pois näkyvistä
 * on eri päätös kuin tuoreen nostaminen eteenpäin, eikä niitä pidä tehdä
 * samalla säännöllä.
 */

export const TUORE_KUUKAUDET = 24

export type EffectiveZoningInput = {
  now: Date
  /* Hankkeen nykyinen vaihe. */
  phase: string | null
  /* Lähteen kertoma tila: voimassa | kumottu | kesken. */
  tila: string | null
  /* ISO-päivä (YYYY-MM-DD) tai null. */
  voimaantulo: string | null
}

export function evaluateEffectiveZoning(
  input: EffectiveZoningInput
): "advance" | "keep" {
  /*
   * Vain kaavoitusvaiheesta eteenpäin. Jos hanke on jo pidemmällä
   * (rakennuslupa, kilpailutus), tämä ei saa vetää sitä taaksepäin.
   */
  if (normalizeLegacyPhase(input.phase) !== "zoning") return "keep"

  /* Kumottu kaava ei toteudu, eikä keskeneräinen ole lainvoimainen. */
  if (input.tila !== "voimassa") return "keep"

  if (!input.voimaantulo) return "keep"

  const paiva = new Date(`${input.voimaantulo}T00:00:00Z`)
  if (Number.isNaN(paiva.getTime())) return "keep"

  /* Tulevaisuuden päivä on poimintavirhe, ei lainvoima. */
  if (paiva.getTime() > input.now.getTime()) return "keep"

  const kuukaudet =
    (input.now.getTime() - paiva.getTime()) / (86400000 * 365.25 / 12)

  return kuukaudet <= TUORE_KUUKAUDET ? "advance" : "keep"
}
