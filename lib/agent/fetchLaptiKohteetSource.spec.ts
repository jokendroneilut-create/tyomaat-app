import { describe, expect, it } from "vitest"

import {
  kaupunkiOsoitteesta,
  onAjankohtainen,
  parseLaptiPage,
  vaihePortaasta,
  valmistumispaiva,
  type LaptiKohde,
} from "./fetchLaptiKohteetSource"

describe("vaihePortaasta", () => {
  it("lukee vaiheen portaan aktiivisesta askeleesta", () => {
    expect(vaihePortaasta("Suunnitteilla")).toBe("Suunnittelu")
    expect(vaihePortaasta("Ennakkomarkkinoinnissa ja varattavissa")).toBe("Suunnittelu")
    expect(vaihePortaasta("Rakenteilla ja myynnissä")).toBe("Rakenteilla")
  })

  /* Muuttovalmis = rakentaminen ohi, ei hankeloyto. */
  it("ei anna vaihetta valmiille", () => {
    expect(vaihePortaasta("Muuttovalmis ja myynnissä")).toBeNull()
    expect(vaihePortaasta(null)).toBeNull()
  })
})

describe("valmistumispaiva", () => {
  it("lukee kuukauden ja vuoden", () => {
    expect(valmistumispaiva("12/2027")).toBe("2027-12-31")
    expect(valmistumispaiva("11/2026")).toBe("2026-11-30")
    expect(valmistumispaiva("4/2028")).toBe("2028-04-30")
  })

  it("kelpuuttaa pelkan vuoden", () => {
    expect(valmistumispaiva("2027")).toBe("2027-12-31")
  })

  it("ei arvaa kelvottomasta", () => {
    expect(valmistumispaiva("kevaalla")).toBeNull()
    expect(valmistumispaiva("13/2027")).toBeNull()
    expect(valmistumispaiva(null)).toBeNull()
  })
})

describe("kaupunkiOsoitteesta", () => {
  /* Postinumero ei ole kaupunki, joten viimeinen pala ei yksin riita. */
  it("ohittaa postinumeron", () => {
    expect(kaupunkiOsoitteesta("Hämeenkatu 5, 40100, Jyväskylä")).toBe("Jyväskylä")
    expect(kaupunkiOsoitteesta("Asemantie 2, 90440, Kempele")).toBe("Kempele")
  })

  it("palauttaa nullin kun kaupunkia ei ole", () => {
    expect(kaupunkiOsoitteesta("Hämeenkatu 5")).toBeNull()
    expect(kaupunkiOsoitteesta(null)).toBeNull()
  })
})

/*
 * KAIKKI NELJA VAIHETTA PIIRRETAAN JOKA SIVULLE. Aktiivinen on
 * `orange-bg`, muut `lightgray-bg`. Tekstihaku antaisi siis joka
 * sivulla saman vastauksen - sama ansa kuin Lujakodilla (D-172).
 */
const SIVU = `
<h1><span class="name">Asunto Oy Oulun Valoisa</span></h1>
<div class="row" id="housingcompany-state">
  <ul>
    <li class="lightgray-bg"><span class="state-name">Suunnitteilla</span></li>
    <li class="lightgray-bg"><span class="state-name">Ennakkomarkkinoinnissa ja varattavissa</span></li>
    <li class="orange-bg white"><span class="state-name">Rakenteilla ja myynnissä</span></li>
    <li class="lightgray-bg"><span class="state-name">Muuttovalmis ja myynnissä</span></li>
  </ul>
</div>
<div class="col-md-4"><p>Taloyhtiön nimi</p></div>
<div class="col-md-8"><p>Asunto Oy Oulun Valoisa</p></div>
<div class="col-md-4"><p>Katuosoite</p></div>
<div class="col-md-8"><p>Kuviomarssi 1, 90670, Oulu</p></div>
<div class="col-md-4"><p>Rakentaja</p></div>
<div class="col-md-8"><p>Rakennusliike Lapti Oy</p></div>
<div class="col-md-4"><p>Rakennustyyppi</p></div>
<div class="col-md-8"><p>Rivitalo</p></div>
<div class="col-md-4"><p>Asuntojen määrä</p></div>
<div class="col-md-8"><p>29</p></div>
<div class="col-md-4"><p>Arvioitu valmistusaika</p></div>
<div class="col-md-8"><p>11/2026</p></div>
<div class="col-md-4"><p>Energialuokka</p></div>
<div class="col-md-8"><p>B</p></div>
`

describe("parseLaptiPage", () => {
  it("lukee kenttataulukon ja vaiheen", () => {
    const k = parseLaptiPage(SIVU)
    expect(k?.nimi).toBe("Asunto Oy Oulun Valoisa")
    expect(k?.osoite).toBe("Kuviomarssi 1, 90670, Oulu")
    expect(k?.kaupunki).toBe("Oulu")
    expect(k?.tila).toBe("Rakenteilla ja myynnissä")
    expect(k?.vaihe).toBe("Rakenteilla")
    expect(k?.tyyppi).toBe("Rivitalo")
    expect(k?.asuntoja).toBe(29)
    expect(k?.valmistuu).toBe("2026-11-30")
    expect(k?.energialuokka).toBe("B")
  })

  it("palauttaa nullin ilman nimea", () => {
    expect(parseLaptiPage("<div>ei mitaan</div>")).toBeNull()
  })
})

const kohde = (yli: Partial<LaptiKohde> = {}): LaptiKohde => ({
  nimi: "Asunto Oy Testi",
  osoite: null,
  kaupunki: null,
  vaihe: "Rakenteilla",
  tila: "Rakenteilla ja myynnissä",
  rakentaja: null,
  tyyppi: null,
  asuntoja: null,
  valmistuu: "2027-12-31",
  energialuokka: null,
  kuvaus: "",
  ...yli,
})

/*
 * Mitattu 6.9.2026: 18 "kesken" olevasta yhdeksalla ei ollut
 * valmistumisaikaa lainkaan - ne olivat korttelisivuja ja
 * autohallipaikkoja. Kumpikaan ehto ei yksin riita.
 */
describe("onAjankohtainen", () => {
  const nyt = new Date("2026-09-06T00:00:00Z")

  it("hyvaksyy paivatyn kesken olevan kohteen", () => {
    expect(onAjankohtainen(kohde(), nyt)).toBe(true)
  })

  it("hylkaa markkinointisivun ilman valmistumisaikaa", () => {
    expect(onAjankohtainen(kohde({ valmistuu: null }), nyt)).toBe(false)
  })

  it("hylkaa valmistuneen", () => {
    expect(onAjankohtainen(kohde({ vaihe: null }), nyt)).toBe(false)
    expect(onAjankohtainen(kohde({ valmistuu: "2020-12-31" }), nyt)).toBe(false)
  })
})
