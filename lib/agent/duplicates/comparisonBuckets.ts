import type { MatchableProject } from "@/lib/agent/projectMatcher"
import { naapurisolut, solu, type Piste } from "@/lib/geo/etaisyys"
import { projectHousingKey } from "@/lib/projects/housingCompanyKey"
import {
  normalizeAddress,
  normalizeIdentifierValue,
} from "@/lib/projects/identity"

/*
 * Vertailujoukon rajaus duplikaattiskannaukselle.
 *
 * Laatuportti (passesDuplicateQualityBar) hyväksyy parin vain jos sillä on
 * sama lupanumero tai kiinteistötunnus, TAI nimitodiste JA sama kaupunki.
 * Kahden eri kaupungissa olevan, tunnisteettoman hankkeen vertailu ei siis
 * voi koskaan tuottaa ehdokasta — se on puhdasta hukkatyötä.
 *
 * Mitattuna ennen ryhmittelyä: 386 muuttunutta hanketta x 4 272 julkista =
 * 1,57 miljoonaa vertailua ja 358 sekuntia, kun reitin maxDuration on 60.
 * Viikkocron ei siis ehtinyt koskaan loppuun asti.
 *
 * Normalisointiin käytetään samoja funktioita kuin calculateMatch sisällään
 * (normalizeAddress kaupungille, normalizeIdentifierValue tunnisteille),
 * jottei ryhmittely voi pudottaa paria jonka matcher olisi hyväksynyt.
 *
 * Omassa tiedostossaan, koska scanForDuplicates luo Supabase-clientin
 * moduulitasolla eikä olisi tuotavissa testiin.
 */
export type ComparisonBuckets = {
  byCity: Map<string, MatchableProject[]>
  byPermit: Map<string, MatchableProject[]>
  byProperty: Map<string, MatchableProject[]>
  byHousing: Map<string, MatchableProject[]>
  /*
   * Sijaintisolu (~100 m). Kumppanit haetaan naapurisoluista, koska
   * kaksi metrien paassa olevaa pistetta voi osua solurajan eri
   * puolille (D-180).
   */
  byCoords: Map<string, MatchableProject[]>
}

export function projectPiste(project: MatchableProject): Piste | null {
  const lat = Number(project.latitude ?? project.lat)
  const lon = Number(project.longitude ?? project.lng)
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null
}

/*
 * Taloyhtiö on oma ryhmänsä eikä kaupungin varassa: sama yhtiö voi olla
 * kirjattu eri kaupungilla tai ilman kaupunkia, jolloin kaupunkiryhmä ei
 * koskaan toisi paria vertailuun (D-171).
 */
function bucketKeys(project: MatchableProject) {
  return {
    city: normalizeAddress(project.city),
    permit: normalizeIdentifierValue(project.metadata?.permit_number),
    property: normalizeIdentifierValue(project.metadata?.property_id),
    housing: projectHousingKey(project),
  }
}

export function buildComparisonBuckets(
  projects: MatchableProject[]
): ComparisonBuckets {
  const buckets: ComparisonBuckets = {
    byCity: new Map(),
    byPermit: new Map(),
    byProperty: new Map(),
    byHousing: new Map(),
    byCoords: new Map(),
  }

  function add(
    map: Map<string, MatchableProject[]>,
    key: string | null | undefined,
    project: MatchableProject
  ) {
    if (!key) return
    const list = map.get(key)
    if (list) list.push(project)
    else map.set(key, [project])
  }

  for (const project of projects) {
    const keys = bucketKeys(project)
    add(buckets.byCity, keys.city, project)
    add(buckets.byPermit, keys.permit, project)
    add(buckets.byProperty, keys.property, project)
    add(buckets.byHousing, keys.housing, project)

    const piste = projectPiste(project)
    if (piste) add(buckets.byCoords, solu(piste), project)
  }

  return buckets
}

export function comparisonPartners(
  project: MatchableProject,
  buckets: ComparisonBuckets
): MatchableProject[] {
  const keys = bucketKeys(project)
  const partners = new Map<string, MatchableProject>()

  for (const [map, key] of [
    [buckets.byCity, keys.city],
    [buckets.byPermit, keys.permit],
    [buckets.byProperty, keys.property],
    [buckets.byHousing, keys.housing],
  ] as const) {
    if (!key) continue
    for (const other of map.get(key) ?? []) {
      if (other.id !== project.id) partners.set(other.id, other)
    }
  }

  /* Sijainti: oma solu ja sen kahdeksan naapuria. */
  const piste = projectPiste(project)
  if (piste) {
    for (const s of naapurisolut(piste)) {
      for (const other of buckets.byCoords.get(s) ?? []) {
        if (other.id !== project.id) partners.set(other.id, other)
      }
    }
  }

  return [...partners.values()]
}
