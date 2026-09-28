import { describe, expect, it } from "vitest"

import {
  savonlinnaSelostusLinkit,
  savonlinnaSelostusOtsikolle,
} from "./savonlinnaSelostus"

/* Rakenne Savonlinnan kaavoitussivulta 29.9.2026. */
const HTML = `
  <div class="page-content">
    <h2>Vireilla olevia kaavahankkeita:</h2>
    <h3>Asemakaavan muutos, Teknologiapuisto</h3>
    <p>Osallistumis- ja arviointisuunnitelma on nahtavilla.</p>
    <div class="wp-block-file"><a href="https://x.fi/teknologiapuisto-liite_a-asemakaava.pdf">Kaavakartta (pdf)</a></div>
    <div class="wp-block-file"><a href="https://x.fi/teknologiapuisto-liite_b-selostus.pdf">Kaavaselostus (pdf)</a></div>
    <h3>Asemakaavan muutos, Savola</h3>
    <div class="wp-block-file"><a href="https://x.fi/savola_liite-b_selostus.pdf">Kaavaselostus (pdf)</a></div>
    <h3>Asemakaavan muutos, Ilman selostusta</h3>
    <div class="wp-block-file"><a href="https://x.fi/vain-kartta.pdf">Kaavakartta (pdf)</a></div>
  </div>
`

describe("savonlinnaSelostusLinkit", () => {
  it("poimii selostuksen otsikoittain", () => {
    const linkit = savonlinnaSelostusLinkit(HTML)

    expect(linkit.size).toBe(2)
    expect(savonlinnaSelostusOtsikolle(linkit, "Asemakaavan muutos, Teknologiapuisto")).toBe(
      "https://x.fi/teknologiapuisto-liite_b-selostus.pdf"
    )
    expect(savonlinnaSelostusOtsikolle(linkit, "Asemakaavan muutos, Savola")).toBe(
      "https://x.fi/savola_liite-b_selostus.pdf"
    )
  })

  /* Kaavakartassa ei ole tekstia, joten sita ei saa ottaa selostukseksi. */
  it("ohittaa kaavan jolla on vain kartta", () => {
    const linkit = savonlinnaSelostusLinkit(HTML)
    expect(savonlinnaSelostusOtsikolle(linkit, "Asemakaavan muutos, Ilman selostusta")).toBeNull()
  })

  /* Kuulutuksen otsikko voi erota valilyonneilta ja kirjainkoolta. */
  it("tasmaa otsikon normalisoituna", () => {
    const linkit = savonlinnaSelostusLinkit(HTML)
    expect(savonlinnaSelostusOtsikolle(linkit, "ASEMAKAAVAN  MUUTOS, TEKNOLOGIAPUISTO")).toBe(
      "https://x.fi/teknologiapuisto-liite_b-selostus.pdf"
    )
  })

  it("sietaa tyhjan", () => {
    expect(savonlinnaSelostusLinkit("").size).toBe(0)
    expect(savonlinnaSelostusOtsikolle(new Map(), "Mika tahansa")).toBeNull()
    expect(savonlinnaSelostusOtsikolle(savonlinnaSelostusLinkit(HTML), null)).toBeNull()
  })
})
