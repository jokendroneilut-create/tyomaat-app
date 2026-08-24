import { describe, expect, it } from "vitest"

import {
  kreateCompletionToIso,
  parseKreateDescription,
  parseKreateFields,
} from "./kreateProject"

const KENTTALOHKO = `
  <div class="row"> <h4>Osoite</h4> <p>Lieksa</p> </div>
  <div class="row"> <h4>Valmistuminen</h4> <p>12/2026</p> </div>
  <div class="row"> <h4>Projektinjohtaja</h4> <p>Ari Välimaa</p> </div>
`

describe("kreateCompletionToIso", () => {
  it("antaa kuukauden viimeisen paivan", () => {
    expect(kreateCompletionToIso("12/2026")).toBe("2026-12-31")
    expect(kreateCompletionToIso("09/2027")).toBe("2027-09-30")
    expect(kreateCompletionToIso("1/2031")).toBe("2031-01-31")
  })

  it("osaa karkausvuoden", () => {
    expect(kreateCompletionToIso("02/2028")).toBe("2028-02-29")
    expect(kreateCompletionToIso("02/2027")).toBe("2027-02-28")
  })

  it("hylkaa kelvottoman", () => {
    for (const paha of ["13/2026", "0/2026", "12/1899", "12/2200", "joulukuu 2026", "", null, undefined]) {
      expect(kreateCompletionToIso(paha as any)).toBeNull()
    }
  })
})

describe("parseKreateFields", () => {
  it("poimii kenttalohkon", () => {
    const f = parseKreateFields(KENTTALOHKO)
    expect(f).toMatchObject({
      address: "Lieksa",
      completionText: "12/2026",
      estimatedCompletion: "2026-12-31",
      projectManager: "Ari Välimaa",
    })
  })

  it("kestaa puuttuvat kentat", () => {
    const f = parseKreateFields(`<div><h4>Valmistuminen</h4><p>10/2027</p></div>`)
    expect(f.estimatedCompletion).toBe("2027-10-31")
    expect(f.address).toBeNull()
    expect(f.projectManager).toBeNull()
  })

  it("ottaa ensimmaisen kun avain toistuu", () => {
    const f = parseKreateFields(
      `<h4>Valmistuminen</h4><p>10/2027</p><h4>Valmistuminen</h4><p>01/2030</p>`
    )
    expect(f.completionText).toBe("10/2027")
  })
})

describe("parseKreateDescription", () => {
  /*
   * TAMA ON KOKO MODUULIN TARKEIN TESTI. Sivun alalaidassa on "muut
   * hankkeet" -karuselli, jossa on TOISTEN hankkeiden nimia ja
   * valmistumisaikoja. Ensimmainen toteutukseni luki juuri sen.
   */
  it("EI lue muiden hankkeiden karusellia", () => {
    const html = `
      <section id="block-hero-x"><p>${"Kreate rakentaa Lieksanjoen ylittavan sillan ja purkaa vanhan kaarisillan. ".repeat(3)}</p></section>
      <section id="block-show-posts-x"><p>Kiilinkadun alikulkusillan uusiminen 10/2026</p></section>
    `
    const k = parseKreateDescription(html)
    expect(k).toContain("Lieksanjoen")
    expect(k).not.toContain("Kiilinkadun")
    expect(k).not.toContain("10/2026")
  })

  it("pudottaa murupolun tekstin keskelta", () => {
    const html = `<p>${"Alkuteksti hankkeesta jota kuvataan tarkemmin. ".repeat(2)}</p><div class="breadcrumbs"><a>Etusivu</a></div><p>${"Loppuosa kuvauksesta jatkuu tassa. ".repeat(2)}</p>`
    const k = parseKreateDescription(html) ?? ""
    expect(k).not.toContain("Etusivu")
    expect(k).toContain("Alkuteksti")
    expect(k).toContain("Loppuosa")
  })

  it("jattaa kenttalohkon pois kuvauksesta", () => {
    const html = `<p>${"Sillan uusiminen toteutetaan vaativassa ymparistossa. ".repeat(3)}</p>${KENTTALOHKO}`
    const k = parseKreateDescription(html) ?? ""
    expect(k).not.toContain("Ari Välimaa")
    expect(k).not.toContain("12/2026")
  })

  it("pudottaa alusta toistuvan otsikon", () => {
    const otsikko = "Uusi Mähkönsilta"
    const html = `<p>${otsikko} ${"palauttaa liikenneyhteyden Lieksanjoen yli ja korvaa vanhan sillan. ".repeat(2)}</p>`
    const k = parseKreateDescription(html, otsikko) ?? ""
    expect(k.startsWith(otsikko)).toBe(false)
    expect(k).toContain("palauttaa liikenneyhteyden")
  })

  /* Mieluummin tyhja kuin vaara: jaannos ei ole kuvaus. */
  it("palauttaa nullin liian lyhyesta", () => {
    expect(parseKreateDescription("<p>Lyhyt.</p>")).toBeNull()
    expect(parseKreateDescription("")).toBeNull()
    expect(parseKreateDescription(null)).toBeNull()
  })
})
