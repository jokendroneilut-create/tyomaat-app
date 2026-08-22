import { describe, expect, it } from "vitest"

import {
  isConstructionTender,
  parseTenderCalendar,
  parseTenderContact,
} from "./senaattiTenderCalendar"

/* Katkelma oikeasta sivusta 22.8.2026. */
const HTML = `
<table class="tender-calendar table table-striped">
<thead><tr><th>Kilpailutus</th><th>Hankintakategoria</th><th>Ennakoitu julkaisuajankohta</th><th>EU/Kansallinen</th><th>Yhteystiedot</th><th>Lisätietoja</th></tr></thead>
<tbody>
<tr>
  <td class="">   Rakennusurakka LC Pansion Poiju, Turku, varuskuntaravintola   </td>
  <td>Rakennuttaminen</td><td>2026/Q4</td><td>Kansallinen</td>
  <td><p><strong>Hanna Hagelberg</strong></p></td><td></td>
</tr>
<tr>
  <td class="">Johdon asiantuntijapalvelut</td>
  <td>Sisäiset palvelut</td><td>2026/Q3</td><td>EU</td>
  <td><p>kilpailutus@senaatti.fi</p></td><td></td>
</tr>
<tr>
  <td class="">Vaalimaa Toimitilan peruskorjaus</td>
  <td>Ylläpito</td><td>2027/Q3</td><td>Kansallinen</td>
  <td><p>Yhteyshenkilö: Mikael Nieminen</p></td><td></td>
</tr>
</tbody></table>
`

describe("parseTenderCalendar", () => {
  const rivit = parseTenderCalendar(HTML)

  it("lukee kaikki rivit", () => {
    expect(rivit).toHaveLength(3)
  })

  it("siistii otsikon välilyönnit", () => {
    expect(rivit[0].title).toBe("Rakennusurakka LC Pansion Poiju, Turku, varuskuntaravintola")
  })

  it("säilyttää ajankohdan neljänneksenä", () => {
    /* Ei muunneta päivämääräksi jota ei ole olemassa. */
    expect(rivit[0].expectedPublication).toBe("2026/Q4")
    expect(rivit[2].expectedPublication).toBe("2027/Q3")
  })

  it("lukee laajuuden", () => {
    expect(rivit[0].scope).toBe("Kansallinen")
    expect(rivit[1].scope).toBe("EU")
  })
})

describe("isConstructionTender", () => {
  it("hyväksyy rakennuttamiskategorian", () => {
    expect(isConstructionTender({ title: "Mikä tahansa", category: "Rakennuttaminen" })).toBe(true)
  })

  it("hyväksyy urakan otsikosta vaikka kategoria on ylläpito", () => {
    /* "Vaalimaa Toimitilan peruskorjaus" on Ylläpito-kategoriassa. */
    expect(isConstructionTender({ title: "Vaalimaa Toimitilan peruskorjaus", category: "Ylläpito" })).toBe(true)
    expect(isConstructionTender({ title: "Purku-urakka, Vanhan Hiukkavaaran rakennuksia", category: "Ylläpito" })).toBe(true)
  })

  it("hylkää tietohallinnon", () => {
    expect(isConstructionTender({ title: "Tempest-työasemat ja oheislaitteet", category: "Tietohallinto" })).toBe(false)
    expect(isConstructionTender({ title: "Johdon asiantuntijapalvelut", category: "Sisäiset palvelut" })).toBe(false)
  })
})

describe("parseTenderContact", () => {
  it("johtaa osoitteen nimestä Senaatin omalla mallilla", () => {
    const [c] = parseTenderContact("Hanna Hagelberg")
    expect(c.name).toBe("Hanna Hagelberg")
    expect(c.email).toBe("hanna.hagelberg@senaatti.fi")
    expect(c.kind).toBe("person")
  })

  it("riisuu Yhteyshenkilö-etuliitteen", () => {
    const [c] = parseTenderContact("Yhteyshenkilö: Mikael Nieminen")
    expect(c.name).toBe("Mikael Nieminen")
    expect(c.email).toBe("mikael.nieminen@senaatti.fi")
  })

  it("ottaa suoran osoitteen sellaisenaan ja merkitsee organisaatioksi", () => {
    const [c] = parseTenderContact("kilpailutus@senaatti.fi")
    expect(c.email).toBe("kilpailutus@senaatti.fi")
    expect(c.kind).toBe("organization")
    expect(c.name).toBeNull()
  })

  it("palauttaa tyhjän kun solussa ei ole henkilöä", () => {
    expect(parseTenderContact("")).toEqual([])
    expect(parseTenderContact("Hankintayksikkö")).toEqual([])
  })
})
