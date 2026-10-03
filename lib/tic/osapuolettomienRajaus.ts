import type { SupabaseClient } from "@supabase/supabase-js"

/*
 * JONO RAJATAAN NIIHIN JOILLE TYO ON MAHDOLLISTA (D-234).
 *
 * Johannes 3.10.2026: *"rajaa jono niille joille se on mahdollista.
 * muuten se vaan paisuu maailman tappiin asti."*
 *
 * Osapuolettomien jono listasi hankkeet joilla `developer` ja `builder`
 * ovat tyhjia. Se niputti kaksi eri asiaa:
 *
 *   1. poiminta meni ohi — lahde kertoo osapuolen, meilta jai lukematta
 *   2. lahde ei kerro osapuolta koskaan
 *
 * Toisessa ryhmassa ei ole tyota. Rakennusvalvonnan lupapaatos nimeaa
 * kiinteistotunnuksen, osoitteen, toimenpiteen ja paatoksen tehneen
 * virkamiehen — ei hakijaa eika urakoitsijaa. Urakoitsijaa ei usein ole
 * lupaa haettaessa edes valittu.
 *
 * MITATTU 3.10.2026 (koko kanta, ei otos):
 *
 *   Espoon kuulutukset    0/29  hankkeesta on saanut osapuolen
 *   Lupapiste kuulutukset 0/156 hankkeesta on saanut osapuolen
 *
 * Vertailuksi samalta ajolta: STT-tiedotteet 99 %, YVA 95 %, kasin
 * lisatyt 94 %, Rakennuslehti 69 %.
 *
 * RAJAUS TEHDAAN KATEGORIAN MUKAAN, EI NIMILISTALLA. Nimilista vanhenee
 * heti kun uusi kunta tuo lupapaatoksensa; kategoria kulkee mukana
 * lahteen perustamisesta. Tama on myos se syy miksi jono muuten paisuu:
 * lupapaatoksia tulee joka viikko eika yksikaan niista poistu jonosta
 * tekemalla tyota.
 *
 * TAMA EI PIILOTA HANKETTA. Hanke nakyy asiakkaalle ja loytyy TIC:n
 * nimihaulla tasan kuten ennenkin — vain tyojonosta se jaa pois.
 */
export const EI_OSAPUOLTA_KATEGORIAT = ["building_permits", "municipality_notices"]

/*
 * Rajattujen lahteiden nimet. Hankkeen `metadata.source_name` on
 * lahteen nimi, joten vertailu tehdaan nimilla — mutta lista itse
 * johdetaan kategoriasta, ei kasin kirjoiteta.
 */
export async function haeRajatutLahteet(
  db: Pick<SupabaseClient, "from">
): Promise<string[]> {
  const { data, error } = await db
    .from("discovery_sources")
    .select("name")
    .in("category", EI_OSAPUOLTA_KATEGORIAT)

  /*
   * Virheessa ei rajata mitaan: liian laaja jono on parempi kuin
   * hiljaa kadonnut tyo.
   */
  if (error) {
    console.error("haeRajatutLahteet:", error.message)
    return []
  }

  return (data ?? []).map((r) => String((r as { name: unknown }).name))
}

export function kuuluuJonoon(
  sourceName: string | null | undefined,
  rajatutLahteet: string[]
): boolean {
  const nimi = String(sourceName ?? "").trim()
  /* Lahteeton hanke on useimmiten kasin lisatty — se kuuluu jonoon. */
  if (!nimi) return true
  return !rajatutLahteet.includes(nimi)
}
