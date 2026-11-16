import { describe, expect, it } from "vitest"
import { aloitteentekija, jasennaTervolanYhteystiedot, tervolanKaavasivu } from "./tervolaKaava"

/* Laatikot Tervolan kaavasivuilta 16.11.2026 (tyylit poistettu). */
const PUKINSELKA = [
  `<p><strong>TERVOLAN KUNTA<br> </strong>Mika Simoska, kunnanjohtaja<br> p. 040 506 2928<br> mika.simoska@tervola.fi</p> <p>&nbsp;</p> <p>Janne Pekkarinen, tekninen johtaja<br> p. 0400 466 705<br> janne.pekkarinen@tervola.fi</p>`,
  `<p><strong>HANKETOIMIJA<br> Helios Nordic Energy Finland Oy<br> </strong>Jenny Hölttä, hankekehityspäällikkö<br> p. 050 585 4646<br> jenny.holtta@heliosnordic.com</p> <p>&nbsp;</p> <p>Markus Ehrström, hankekehitysjoht.<br> p. 0400 428 823<br> markus.ehrstrom@heliosnordic.com</p>`,
  `<p><strong>KAAVAKONSULTTI<br> Alusta Consulting Oy<br> </strong>Heta Tuunanen, projektipäällikkö<br> p. 040 734 0239<br> heta.tuunanen@alustaconsulting.fi</p>`,
]

describe("jasennaTervolanYhteystiedot (D-429)", () => {
  it("Pukinselkä: hanketoimija rakennuttajaksi, henkilöt yhtiöineen, konsultti agentiksi", () => {
    const o = jasennaTervolanYhteystiedot(PUKINSELKA)
    expect(o.developer).toBe("Helios Nordic Energy Finland Oy")
    expect(o.consultants).toEqual(["Alusta Consulting Oy"])
    expect(o.contacts.map((c) => [c.name, c.organization, c.phone, c.email, c.role])).toEqual([
      ["Mika Simoska", "Tervolan kunta", "040 506 2928", "mika.simoska@tervola.fi", null],
      ["Janne Pekkarinen", "Tervolan kunta", "0400 466 705", "janne.pekkarinen@tervola.fi", null],
      ["Jenny Hölttä", "Helios Nordic Energy Finland Oy", "050 585 4646", "jenny.holtta@heliosnordic.com", null],
      ["Markus Ehrström", "Helios Nordic Energy Finland Oy", "0400 428 823", "markus.ehrstrom@heliosnordic.com", null],
      ["Heta Tuunanen", "Alusta Consulting Oy", "040 734 0239", "heta.tuunanen@alustaconsulting.fi", "agent"],
    ])
    expect(o.contacts[2].title).toBe("Hankevastaava, hankekehityspäällikkö")
  })

  it("nimike ennen nimeä ja yhtiö+henkilö samalla rivillä (Pitkämaa)", () => {
    const o = jasennaTervolanYhteystiedot([
      `<p><strong>TERVOLAN KUNTA:<br> </strong>Kunnanjohtaja Mika Simoska<br> puh. 040 506 2928<br> mika.simoska@tervola.fi</p>`,
      `<p><strong>HANKKEESTA VASTAAVA:<br> </strong>ABO Energy Suomi Oy, Kalle Oiva<br> puh. 050 537 8950<br> kalle.oiva@aboenergy.fi</p>`,
    ])
    expect(o.developer).toBe("ABO Energy Suomi Oy")
    expect(o.contacts[0]).toMatchObject({ name: "Mika Simoska", title: "Kunnanjohtaja" })
    expect(o.contacts[1]).toMatchObject({ name: "Kalle Oiva", organization: "ABO Energy Suomi Oy", phone: "050 537 8950" })
  })

  it("yhtiön numero ilman henkilöä (Lokio) ja puhelin+sähköposti samalla rivillä", () => {
    const o = jasennaTervolanYhteystiedot([
      `<p><strong>Kaavakonsultti<br> </strong>Arkkitehtitoimisto Jarmo Lokio Oy<br> p. 044 700 2155</p>`,
      `<p><strong>KAAVAKONSULTTI:</strong><br> Sitowise Oy<br> Sanna Matkaselkä<br> puh. 044 427 9931 sanna.matkaselka@sitowise.com</p>`,
    ])
    expect(o.contacts[0]).toMatchObject({ kind: "organization", organization: "Arkkitehtitoimisto Jarmo Lokio Oy", phone: "044 700 2155" })
    expect(o.contacts[1]).toMatchObject({ name: "Sanna Matkaselkä", phone: "044 427 9931", email: "sanna.matkaselka@sitowise.com" })
  })

  /* Vitsakangas: "Seppänen" a + U+0308, nimi jäi ensin pois. */
  it("hajotettu ä ei pudota nimeä", () => {
    const o = jasennaTervolanYhteystiedot([
      `<p><strong>KAAVAKONSULTTI:<br> </strong>ONE Architects Oy<br> <strong>Tuomas Seppänen<br> </strong>puh. 0400 575&nbsp;517<br> tuomas.seppanen@onearchitects.fi</p>`,
    ])
    expect(o.contacts[0]).toMatchObject({ name: "Tuomas Seppänen", phone: "0400 575 517" })
  })

  it("yhtiö ilman rooliotsikkoa liittyväksi, ei rakennuttajaksi (FCG)", () => {
    const o = jasennaTervolanYhteystiedot([
      `<p><strong>FCG Finnish Consulting Group Oy</strong><br> Kalle Rautavuori, projektijohtaja<br> p 041 731 3542<br> kalle.rautavuori@fcg.fi</p>`,
    ])
    expect(o.developer).toBeNull()
    expect(o.consultants).toEqual(["FCG Finnish Consulting Group Oy"])
    expect(o.contacts[0]).toMatchObject({ name: "Kalle Rautavuori", phone: "041 731 3542" })
  })
})

describe("aloitteentekija", () => {
  it("lukee yhtiön ingressistä ilman päiväystä", () => {
    expect(
      aloitteentekija(
        "Tervolan kunnanvaltuusto on käynnistänyt 24.9.2026 Helios 1 Cranberry Oy:n pyynnöstä datakeskuksen osayleis- ja asemakaavoituksen."
      )
    ).toBe("Helios 1 Cranberry Oy")
    expect(aloitteentekija("…osayleiskaavan laatimisen Myrsky Energia Oy:n kaavoitusaloitteesta.")).toBe("Myrsky Energia Oy")
    expect(aloitteentekija("Kunnanvaltuusto on 4.5.2023 käynnistänyt kaavamuutoksen.")).toBeNull()
  })
})

describe("tervolanKaavasivu", () => {
  it("ingressi kuvaukseen, sivun yhteiset moduulit pois", () => {
    const html = `<div class="ingress"><p>Kunnanvaltuusto käynnisti kaavan.</p></div>
      <div class="module-width-content-area-wrapper"><div class="editor-container">Kaava-alue sijoittuu Pisavaaran itäpuolelle.</div></div>
      <div class="child-module-wrapper"><div class="editor-container">Jaa sivu eteenpäin</div></div>
      <div class="child-module-wrapper"><div class="editor-container">Ota yhteyttä Vaihde 040 124 2411</div></div>`
    expect(tervolanKaavasivu(html).kuvaus).toBe(
      "Kunnanvaltuusto käynnisti kaavan. Kaava-alue sijoittuu Pisavaaran itäpuolelle."
    )
  })
})
