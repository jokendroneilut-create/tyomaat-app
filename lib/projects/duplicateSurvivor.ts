/*
 * KUMPI KAKSOISKAPPALEISTA JÄÄ.
 *
 * Kaksoiskappaleen vahvistus kirjasi aiemmin vain päätöksen eikä
 * piilottanut kumpaakaan, joten molemmat jäivät näkyviin. Mitattu
 * 29.8.2026: 47 vahvistetusta parista neljällä molemmat olivat yhä
 * julkisia — mm. Klaukkalan vesitorni, joka näkyi asiakkaalle kahdesti.
 *
 * Valinta on tässä erillisenä ja testattuna, koska väärä valinta
 * hävittää tietoa: piilotettu hanke katoaa kartalta ja hauista.
 */

export type DuplicateProject = {
  id: string
  name?: string | null
  created_at?: string | null
  developer?: string | null
  builder?: string | null
  location?: string | null
  lat?: number | null
  lng?: number | null
  apartments?: number | null
  floor_area?: number | null
  estimated_cost?: number | null
  construction_start?: string | null
  property_type?: string | null
  metadata?: Record<string, any> | null
}

/*
 * Täytetyt kentät kertovat kumpi tietää hankkeesta enemmän. Kaikki
 * painavat saman verran: yksikään ei ole niin ratkaiseva että se yksin
 * voittaisi, ja painotus olisi arvaus.
 */
const KENTAT: (keyof DuplicateProject)[] = [
  "developer",
  "builder",
  "location",
  "lat",
  "lng",
  "apartments",
  "floor_area",
  "estimated_cost",
  "construction_start",
  "property_type",
]

export function completeness(p: DuplicateProject): number {
  let n = 0

  for (const k of KENTAT) {
    const v = p[k]
    if (v === null || v === undefined || v === "") continue
    n++
  }

  /* Kuvaus ja yhteyshenkilöt ovat metatiedoissa mutta yhtä arvokkaita. */
  const meta = p.metadata ?? {}
  if (typeof meta.description === "string" && meta.description.trim().length > 80) n++
  if (Array.isArray(meta.contact_persons) && meta.contact_persons.length > 0) n++

  return n
}

export type SurvivorChoice = {
  keepId: string
  hideId: string
  reason: string
}

/*
 * Palauttaa kumpi jää ja kumpi piilotetaan.
 *
 * Tasapelissä VANHEMPI jää: siihen on ehtinyt kertyä historiaa,
 * suosikkeja ja mahdollisesti asiakkaan omia muistiinpanoja.
 */
export function chooseDuplicateSurvivor(
  a: DuplicateProject,
  b: DuplicateProject
): SurvivorChoice {
  const pisteetA = completeness(a)
  const pisteetB = completeness(b)

  if (pisteetA !== pisteetB) {
    const voittaja = pisteetA > pisteetB ? a : b
    const haviaja = pisteetA > pisteetB ? b : a
    return {
      keepId: voittaja.id,
      hideId: haviaja.id,
      reason: `enemmän täytettyjä kenttiä (${Math.max(pisteetA, pisteetB)} vs ${Math.min(pisteetA, pisteetB)})`,
    }
  }

  const aikaA = new Date(a.created_at ?? "").getTime()
  const aikaB = new Date(b.created_at ?? "").getTime()

  /* Puuttuva aikaleima ei saa voittaa: tuntematon ei ole vanhempi. */
  const aVanhempi =
    Number.isFinite(aikaA) && (!Number.isFinite(aikaB) || aikaA <= aikaB)

  return {
    keepId: aVanhempi ? a.id : b.id,
    hideId: aVanhempi ? b.id : a.id,
    reason: `yhtä täydelliset (${pisteetA}), vanhempi jää`,
  }
}
