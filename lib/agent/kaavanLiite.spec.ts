import * as cheerio from "cheerio"
import { describe, expect, it } from "vitest"

import { liitelinkit, taydennaKuvausLiitteesta } from "./kaavanLiite"

/*
 * Kaavasivun lohkorakenne listasivulla: jokaisella kaavalla on oma
 * osionsa omine liitteineen (Nokian rakenne, haettu 19.10.2026).
 */
const LISTASIVU = `
<div class="block-child-accordion-item" id="kerhokatu">
  <div class="child-content">
    <p>Kerhokatu 4-8 asemakaavan muutos.</p>
    <a href="/wp-content/uploads/Kerhokatu-selostus.pdf">Kaavaselostus</a>
  </div>
</div>
<div class="block-child-accordion-item" id="sarpatintie">
  <div class="child-content">
    <p>Sarpatintie 10 ja 12.</p>
    <a href="/wp-content/uploads/Sarpatintie-selostus.pdf">Kaavaselostus</a>
  </div>
</div>`

describe("liitelinkit", () => {
  it("täydentää suhteellisen osoitteen sivun osoitteella", () => {
    const $ = cheerio.load(LISTASIVU)
    const linkit = liitelinkit($, "https://www.nokiankaupunki.fi/kaavoitus/vireilla/")
    expect(linkit[0].href).toBe("https://www.nokiankaupunki.fi/wp-content/uploads/Kerhokatu-selostus.pdf")
  })

  it("rajaa linkit annettuun lohkoon, ei koko listasivuun", () => {
    const $ = cheerio.load(LISTASIVU)
    const osa = $("#sarpatintie")
    const linkit = liitelinkit($, "https://www.nokiankaupunki.fi/kaavoitus/vireilla/", osa)
    expect(linkit).toHaveLength(1)
    expect(linkit[0].href).toContain("Sarpatintie-selostus.pdf")
  })
})

describe("taydennaKuvausLiitteesta", () => {
  const selostus = [{ href: "https://kunta.fi/Kaavaselostus.pdf", teksti: "Selostus" }]

  it("ei hae liitettä kun kuvaus on jo riittävä", async () => {
    const budjetti = { haettu: 0, raja: 5 }
    const pitka = "a".repeat(400)
    expect(await taydennaKuvausLiitteesta(pitka, selostus, budjetti)).toBe(pitka)
    expect(budjetti.haettu).toBe(0)
  })

  it("ei hae liitettä kun budjetti on käytetty", async () => {
    const budjetti = { haettu: 5, raja: 5 }
    expect(await taydennaKuvausLiitteesta("lyhyt", selostus, budjetti)).toBe("lyhyt")
    expect(budjetti.haettu).toBe(5)
  })

  it("ei kuluta budjettia kun sivulla ei ole liitettä", async () => {
    const budjetti = { haettu: 0, raja: 5 }
    const vain_kartta = [{ href: "https://kunta.fi/kaavakartta.pdf", teksti: "Kaavakartta" }]
    expect(await taydennaKuvausLiitteesta("lyhyt", vain_kartta, budjetti)).toBe("lyhyt")
    expect(budjetti.haettu).toBe(0)
  })
})
