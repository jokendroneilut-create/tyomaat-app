import { describe, it, expect } from "vitest"
import { calculateMatch, type MatchableProject } from "./projectMatcher"

function project(overrides: Partial<MatchableProject>): MatchableProject {
  return {
    id: "p1",
    name: null,
    city: null,
    region: null,
    location: null,
    phase: null,
    ...overrides,
  }
}

describe("calculateMatch – otsikkomuunnelmat", () => {
  it("löytää saman hankkeen kun näkyvä otsikko on muokattu mutta source_title säilytetty", () => {
    // Lähde A julkaisi hankkeen, jonka otsikko muokattiin käsin. Alkuperäinen
    // otsikko on säilössä metadata.source_title-kentässä.
    const edited = project({
      name: "Rantatie 5 – Premium-kerrostalo",
      city: "Oulu",
      metadata: { source_title: "As Oy Oulun Rantatie" },
    })

    // Lähde B tuo saman hankkeen raakaotsikolla.
    const match = calculateMatch(edited, {
      name: "As Oy Oulun Rantatie",
      city: "Oulu",
    })

    expect(match).not.toBeNull()
    expect(match!.reasons).toContain("exact_title")
  })

  it("ilman source_titleä muokattu otsikko ei tuota tarkkaa osumaa (kontrolli)", () => {
    const editedNoSourceTitle = project({
      name: "Rantatie 5 – Premium-kerrostalo",
      city: "Oulu",
    })

    const match = calculateMatch(editedNoSourceTitle, {
      name: "As Oy Oulun Rantatie",
      city: "Oulu",
    })

    // Ilman säilytettyä alkuperäisotsikkoa jää korkeintaan heikko
    // similar_title — ei exact_title, joka nostaisi luottamuksen selvästi
    // duplikaattiportin yli. source_title muuttaa tämän tarkaksi osumaksi.
    expect(match?.reasons ?? []).not.toContain("exact_title")
  })

  it("hyödyntää ehdokkaan sourceTitleä kun ehdokkaan näkyvä nimi on muokattu", () => {
    const existing = project({
      name: "As Oy Oulun Rantatie",
      city: "Oulu",
    })

    const match = calculateMatch(existing, {
      name: "Rantatie 5 – Premium-kerrostalo",
      sourceTitle: "As Oy Oulun Rantatie",
      city: "Oulu",
    })

    expect(match).not.toBeNull()
    expect(match!.reasons).toContain("exact_title")
  })

  it("osuu myös also_known_as -aliakseen", () => {
    const merged = project({
      name: "Toriparkki",
      city: "Kuopio",
      metadata: { also_known_as: ["Keskustan liikekeskus"] },
    })

    const match = calculateMatch(merged, {
      name: "Keskustan liikekeskus",
      city: "Kuopio",
    })

    expect(match).not.toBeNull()
    expect(match!.reasons).toContain("exact_title")
  })

  it("tavallinen nimi-osuma toimii yhä ilman metadataa (regressio)", () => {
    const existing = project({
      name: "As Oy Tampereen Ratina",
      city: "Tampere",
    })

    const match = calculateMatch(existing, {
      name: "As Oy Tampereen Ratina",
      city: "Tampere",
    })

    expect(match).not.toBeNull()
    expect(match!.reasons).toContain("exact_title")
  })
})
