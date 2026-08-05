import { describe, it, expect } from "vitest"
import {
  buildComparisonBuckets,
  comparisonPartners,
} from "./comparisonBuckets"
import type { MatchableProject } from "@/lib/agent/projectMatcher"

function project(
  id: string,
  fields: Partial<MatchableProject> & { metadata?: Record<string, any> } = {}
): MatchableProject {
  return {
    id,
    name: fields.name ?? `Hanke ${id}`,
    city: fields.city ?? null,
    region: fields.region ?? null,
    location: fields.location ?? null,
    phase: null,
    completed_at: null,
    status: "active",
    developer: fields.developer ?? null,
    property_type: null,
    metadata: fields.metadata ?? {},
  } as MatchableProject
}

describe("comparisonPartners", () => {
  it("vertaa vain saman kaupungin hankkeisiin", () => {
    const projects = [
      project("a", { city: "Kajaani" }),
      project("b", { city: "Kajaani" }),
      project("c", { city: "Oulu" }),
    ]
    const buckets = buildComparisonBuckets(projects)

    const partners = comparisonPartners(projects[0], buckets).map((p) => p.id)
    expect(partners).toEqual(["b"])
  })

  /*
   * Laatuportti hyväksyy lupanumero-/kiinteistötunnusosuman ilman kaupunkia,
   * joten ryhmittely ei saa pudottaa niitä pareja.
   */
  it("ottaa mukaan saman lupanumeron myös eri kaupungista", () => {
    const projects = [
      project("a", { city: "Kajaani", metadata: { permit_number: "2026-123" } }),
      project("b", { city: "Oulu", metadata: { permit_number: "2026-123" } }),
      project("c", { city: "Oulu" }),
    ]
    const buckets = buildComparisonBuckets(projects)

    expect(comparisonPartners(projects[0], buckets).map((p) => p.id)).toEqual(["b"])
  })

  it("ottaa mukaan saman kiinteistötunnuksen", () => {
    const projects = [
      project("a", { city: "Espoo", metadata: { property_id: "049-401-1-1" } }),
      project("b", { city: "Vantaa", metadata: { property_id: "049-401-1-1" } }),
    ]
    const buckets = buildComparisonBuckets(projects)

    expect(comparisonPartners(projects[0], buckets).map((p) => p.id)).toEqual(["b"])
  })

  it("ei koskaan palauta hanketta itseään", () => {
    const projects = [project("a", { city: "Turku" }), project("b", { city: "Turku" })]
    const buckets = buildComparisonBuckets(projects)

    expect(comparisonPartners(projects[0], buckets).map((p) => p.id)).not.toContain("a")
  })

  it("ei palauta samaa paria kahdesti vaikka useampi avain täsmää", () => {
    const projects = [
      project("a", { city: "Pori", metadata: { permit_number: "X1", property_id: "Y1" } }),
      project("b", { city: "Pori", metadata: { permit_number: "X1", property_id: "Y1" } }),
    ]
    const buckets = buildComparisonBuckets(projects)

    expect(comparisonPartners(projects[0], buckets)).toHaveLength(1)
  })

  /*
   * Kaupungiton hanke ei voi saada same_cityä, joten se voi osua vain
   * tunnisteella - eikä sitä pidä verrata kaikkiin muihin kaupungittomiin.
   */
  it("ei ryhmittele kaupungittomia hankkeita keskenään", () => {
    const projects = [project("a"), project("b"), project("c", { city: "Lahti" })]
    const buckets = buildComparisonBuckets(projects)

    expect(comparisonPartners(projects[0], buckets)).toHaveLength(0)
  })

  it("sietää kaupungin kirjoitusasun vaihtelun samoin kuin matcher", () => {
    const projects = [
      project("a", { city: " Kajaani " }),
      project("b", { city: "kajaani" }),
    ]
    const buckets = buildComparisonBuckets(projects)

    expect(comparisonPartners(projects[0], buckets).map((p) => p.id)).toEqual(["b"])
  })
})
