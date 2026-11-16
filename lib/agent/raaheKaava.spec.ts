import { describe, expect, it } from "vitest"
import {
  jasennaRaahenHenkilosto,
  raahenKaavasivu,
  raahenKaavatunnus,
  raahenKuvaus,
  raahenVaihe,
  raahenYhteyshenkilot,
  taydennaRaahenYhteystiedot,
} from "./raaheKaava"

const sivu = (runko: string, oikea: string, vaihe = "luonnos") => `
<html><body>
<h1 class="node__title"></h1>
<h1>Pattijärvien teollisuusalueen asemakaava ja asemakaavan muutos (Akm 233)</h1>
<div id="field-blocknodekaavoitusbody"><div class="field-name-body"><div class="field__items"><div class="field__item">${runko}</div></div></div></div>
<div id="kaavoitusvaiheet"><h2>Käsittelyvaihe</h2>
  <div class="vaihe v_vireille tulo">vireille tulo</div>
  <div class="vaihe v_luonnos ${vaihe === "luonnos" ? "vaihe-active" : ""}">luonnos</div>
  <div class="vaihe v_ehdotus ${vaihe === "ehdotus" ? "vaihe-active" : ""}">ehdotus</div>
</div>
<div class="field-name-field-right-column"><div class="field__items"><div class="field__item">${oikea}</div></div></div>
<div class="field-name-body"><div class="field__item"><h2>Raahen kaupunki</h2><p>Rantakatu 50</p></div></div>
</body></html>`

describe("raahenKaavatunnus", () => {
  it("lukee tunnuksen nimen lopusta", () => {
    expect(raahenKaavatunnus("Pattijärvien teollisuusalueen asemakaava ja asemakaavan muutos (Akm 233)")).toBe("AKM233")
    expect(raahenKaavatunnus("Vihannin teollisuusalue (Ak 257)")).toBe("AK257")
    expect(raahenKaavatunnus("Lumimetsän energiaosayleiskaava")).toBeNull()
  })
})

describe("raahenKuvaus", () => {
  it("otsikoton runko: kaikki kappaleet, linkkikappaleet pois", () => {
    const html = sivu(
      `<p>Asemakaava koskee kaupunginosan 51 kortteleita 1002-1006.</p>
       <p>Alueen pinta-ala on 125 hehtaaria.</p>
       <h3>Suunnittelutyötä koskevia asiakirjoja</h3>
       <ul><li><a href="/x.pdf">Kaavaselostus (pdf)</a></li></ul>`,
      ""
    )
    expect(raahenKuvaus(html)).toBe("Asemakaava koskee kaupunginosan 51 kortteleita 1002-1006. Alueen pinta-ala on 125 hehtaaria.")
  })

  it("Ajankohtaista + kaavan osio: kaavan osio voittaa, alatunnisteen runko ei sekoitu", () => {
    const html = sivu(
      `<h2>Ajankohtaista</h2><h3>Vireilletulo ja OAS</h3>
       <p>Kaavatyötä varten on laadittu osallistumis- ja arviointisuunnitelma (OAS).</p>
       <p>Kehittämislautakunta päätti 27.10.2026 vireilletulosta.</p>
       <p>Osallistumis- ja arviointisuunnitelmassa kuvatussa kaavoitusmenettelystä on mahdollista jättää palautetta koko kaavaprosessin ajan.</p>
       <h2>Asemakaavamuutos</h2>
       <p>Tarkoituksena on mahdollistaa noin 1200 m2 päivittäistavarakaupan rakentuminen.</p>`,
      ""
    )
    expect(raahenKuvaus(html)).toBe("Tarkoituksena on mahdollistaa noin 1200 m2 päivittäistavarakaupan rakentuminen.")
  })

  it("pelkkä Ajankohtaista-osio kelpaa kuvaukseksi", () => {
    const html = sivu(
      `<h2>Ajankohtaista</h2>
       <p>Osayleiskaava on hyväksytty kaupunginvaltuustossa 26.1.2026.</p>
       <p><a href="/p.pdf">Pöytäkirjaote (pdf)</a></p>`,
      ""
    )
    expect(raahenKuvaus(html)).toBe("Osayleiskaava on hyväksytty kaupunginvaltuustossa 26.1.2026.")
  })

  it("useasta kaavaosiosta viimeinen (vaiheittain päivitetty sivu)", () => {
    const html = sivu(
      `<h2>Osittainen voimaantulo</h2><p>Kaava määrätään voimaan osittain.</p>
       <h2>Asemakaavamuutos</h2><p>Asemakaavaa on muutettu Vanhan Kaupungin alueella.</p>`,
      ""
    )
    expect(raahenKuvaus(html)).toBe("Asemakaavaa on muutettu Vanhan Kaupungin alueella.")
  })
})

describe("raahenVaihe", () => {
  it("lukee korostetun vaiheen kaaviosta", () => {
    expect(raahenVaihe(sivu("<p>x</p>", "", "ehdotus"))).toBe("Ehdotus")
    expect(raahenVaihe("<html></html>")).toBeNull()
  })
})

describe("raahenYhteyshenkilot", () => {
  it("Lisätietoja omassa kappaleessaan, henkilöt omissaan (Pattijärvi)", () => {
    const html = sivu(
      "<p>x</p>",
      `<p><strong>Lisätietoja</strong></p> <p>Kaavoituspäällikkö<br>Anu Syrjäpalo</p>
       <div class="hoxbox2"><p><a href="/h">Raahen kaupungin henkilöstöhaku</a></p></div>`
    )
    expect(raahenYhteyshenkilot(html)).toEqual([
      { kind: "person", name: "Anu Syrjäpalo", title: "Kaavoituspäällikkö", phone: null, email: null, organization: "Raahen kaupunki", role: null },
    ])
  })

  it("kaikki samassa kappaleessa <br>:llä ja &nbsp;-täytteellä, nimi span-kääreessä", () => {
    const html = sivu(
      "<p>x</p>",
      `<p><strong>Lisätietoja</strong>&nbsp;<br><br>Kaavoituspäällikkö&nbsp;<br>Anu Syrjäpalo<br><br>Kaavasuunnittelija&nbsp;<br>Outi <span>Ingerttilä</span><br><br><a href="/h"><span>Raahen kaupungin henkilöstöhaku</span></a></p>`
    )
    expect(raahenYhteyshenkilot(html).map((c) => `${c.title}: ${c.name}`)).toEqual([
      "Kaavoituspäällikkö: Anu Syrjäpalo",
      "Kaavasuunnittelija: Outi Ingerttilä",
    ])
  })

  it("Lisätietoja ja ensimmäinen henkilö samassa, toinen omassa kappaleessa", () => {
    const html = sivu(
      "<p>x</p>",
      `<p><strong>Lisätietoja</strong>&nbsp;<br>Kaavasuunnittelija<br>Riku Miettusvaara</p> <p>Kaavoituspäällikkö&nbsp;<br>Anu Syrjäpalo</p>`
    )
    expect(raahenYhteyshenkilot(html).map((c) => c.name)).toEqual(["Riku Miettusvaara", "Anu Syrjäpalo"])
  })
})

describe("raahenKaavasivu", () => {
  it("otsikko on sisältö-h1, ei tyhjä node__title", () => {
    expect(raahenKaavasivu(sivu("<p>x</p>", "")).title).toBe(
      "Pattijärvien teollisuusalueen asemakaava ja asemakaavan muutos (Akm 233)"
    )
  })
})

const henkilosto = (ingressi: string) => `
<html><body>
<div class="field-name-field-ingressi">${ingressi}</div>
<table class="table views-table"><thead><tr class="table__row"><th>Nimi</th><th>Puhelin</th><th>Tehtävä</th></tr></thead>
<tbody class="table__body">
<tr class="table__row odd"><td class="views-field views-field-title">Holmén Mathias </td><td class="views-field views-field-field-gsm">040 830 3159 </td><td class="views-field views-field-field-tehtava">kaavasuunnittelija </td></tr>
<tr class="table__row even"><td class="views-field views-field-title">Syrjäpalo Anu </td><td class="views-field views-field-field-gsm">044 439 3575 </td><td class="views-field views-field-field-tehtava">kaavoituspäällikkö </td></tr>
</tbody></table></body></html>`

describe("jasennaRaahenHenkilosto", () => {
  it("kääntää nimen, poimii puhelimen ja muodostaa osoitteen ilmoitetusta muodosta", () => {
    const m = jasennaRaahenHenkilosto(henkilosto("Henkilöstön sähköpostiosoitteet ovat muotoa etunimi.sukunimi [at] raahe.fi."))
    expect(m.get("Anu Syrjäpalo")).toEqual({ puhelin: "044 439 3575", tehtava: "kaavoituspäällikkö", sahkoposti: "anu.syrjapalo@raahe.fi" })
  })

  it("é:tä ei muunneta arvaamalla: puhelin kyllä, osoite ei", () => {
    const m = jasennaRaahenHenkilosto(henkilosto("muotoa etunimi.sukunimi [at] raahe.fi"))
    expect(m.get("Mathias Holmén")).toEqual({ puhelin: "040 830 3159", tehtava: "kaavasuunnittelija", sahkoposti: null })
  })

  it("ilman ilmoitettua muotoa ei osoitetta", () => {
    expect(jasennaRaahenHenkilosto(henkilosto("Hae henkilöä.")).get("Anu Syrjäpalo")?.sahkoposti).toBeNull()
  })
})

describe("taydennaRaahenYhteystiedot", () => {
  it("täydentää vain puuttuvat, olemassa oleva arvo voittaa", () => {
    const m = jasennaRaahenHenkilosto(henkilosto("muotoa etunimi.sukunimi [at] raahe.fi"))
    expect(
      taydennaRaahenYhteystiedot(
        [
          { name: "Anu Syrjäpalo", phone: null, email: null },
          { name: "Mathias Holmén", phone: "050 1", email: null },
          { name: "Tuntematon Henkilö", phone: null, email: null },
        ],
        m
      )
    ).toEqual([
      { name: "Anu Syrjäpalo", phone: "044 439 3575", email: "anu.syrjapalo@raahe.fi" },
      { name: "Mathias Holmén", phone: "050 1", email: null },
      { name: "Tuntematon Henkilö", phone: null, email: null },
    ])
  })
})
