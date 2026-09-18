import * as cheerio from "cheerio"
import { describe, expect, it } from "vitest"

import { VAYLA_MAX_SUBPAGES, vaylaSubprojectLinks } from "./vaylaSubprojects"

/* Rakenne Vt 9 Kanavuori-Hankasalmi -sivulta (D-199). */
describe("vaylaSubprojectLinks", () => {
  const html = `
    <header><a href="/haku">Haku</a><a href="/sv">Svenska</a></header>
    <nav><a href="/vaylista">Väylistä</a></nav>
    <main>
      <a href="#main-content">Hyppää sisältöön</a>
      <a href="/suunnittelu-rakentaminen">Takaisin hankehakuun</a>
      <a href="/vt-9-kanavuori-hankasalmi">Vt 9 Kanavuori-Hankasalmi</a>
      <a href="https://vayla.fi/vt-9-kanavuori-lievestuore">Vt 9 Kanavuori-Lievestuore</a>
      <a href="https://vayla.fi/vt-9-kanavuori-hankasalmi/vt-9-parantaminen-lievestuoreen-kohdalla">osa</a>
      <a href="https://example.com/muu">ulkoinen</a>
    </main>
    <footer><a href="/palaute">Palaute</a></footer>`

  it("palauttaa osahankkeet muttei navigaatiota, itseä, hakua eikä ulkoisia", () => {
    expect(vaylaSubprojectLinks(cheerio.load(html), "https://vayla.fi/vt-9-kanavuori-hankasalmi")).toEqual([
      "https://vayla.fi/vt-9-kanavuori-lievestuore",
      "https://vayla.fi/vt-9-kanavuori-hankasalmi/vt-9-parantaminen-lievestuoreen-kohdalla",
    ])
  })

  it("rajaa pyyntöjen määrän", () => {
    const monta = Array.from({ length: 12 }, (_, i) => `<a href="/osa-${i}">x</a>`).join("")
    expect(vaylaSubprojectLinks(cheerio.load(`<main>${monta}</main>`), "https://vayla.fi/katto")).toHaveLength(VAYLA_MAX_SUBPAGES)
  })
})
