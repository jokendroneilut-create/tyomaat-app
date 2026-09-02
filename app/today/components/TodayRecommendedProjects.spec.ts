import { createElement } from "react"
import { describe, expect, it, vi } from "vitest"

/*
 * Komponentin RENDEROINTI, ei pelkkaa laskentaa. Nappi voi olla oikein
 * laskettu mutta jaada silti piiloon vaarasta ehdosta, ja se selviaa
 * vain renderoimalla.
 *
 * Modaali, peukut ja suosikit vievat mukanaan Supabase-asiakkaan joka
 * vaatii ymparistomuuttujat jo tuonnissa. Ne korvataan tyhjilla, koska
 * tama testi koskee listaa ja nappia.
 *
 * Testi on .ts eika .tsx, koska vitest lukee vain *.spec.ts (D-003).
 */
vi.mock("./TodayProjectModal", () => ({ default: () => null }))
vi.mock("./TodayFeedbackButtons", () => ({ default: () => null }))
vi.mock("./TodayFavoriteActions", () => ({ default: () => null }))

const hankkeet = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    name: `Hanke ${i}`,
    city: "Helsinki",
    region: "Uusimaa",
    phase: "Rakenteilla",
    metadata: {},
  }))

async function renderoi(props: Record<string, unknown>) {
  const { renderToStaticMarkup } = await import("react-dom/server")
  const { default: TodayRecommendedProjects } = await import("./TodayRecommendedProjects")
  return renderToStaticMarkup(createElement(TodayRecommendedProjects as any, props))
}

describe("TodayRecommendedProjects", () => {
  it("nayttaa ensimmaisen eran ja napin jaljella olevista", async () => {
    const html = await renderoi({ projects: hankkeet(100), initialCount: 20, totalCount: 100 })
    expect(html).toContain("Hanke 0")
    expect(html).toContain("Hanke 19")
    expect(html).not.toContain("Hanke 20")
    expect(html).toContain("Näytä lisää")
    expect(html).toContain("80 jäljellä")
  })

  it("ei nayta nappia kun kaikki mahtuu ensimmaiseen eraan", async () => {
    const html = await renderoi({ projects: hankkeet(8), initialCount: 20, totalCount: 8 })
    expect(html).toContain("Hanke 7")
    expect(html).not.toContain("Näytä lisää")
  })

  /* Ladattujen loputtua ohjataan hankelistaukseen, ei luvata lisaa. */
  it("ohjaa hankelistaukseen kun ladatut on naytetty mutta pisteytettyja on enemman", async () => {
    const html = await renderoi({ projects: hankkeet(20), initialCount: 20, totalCount: 950 })
    expect(html).not.toContain("Näytä lisää")
    expect(html).toContain("/projects")
  })
})
