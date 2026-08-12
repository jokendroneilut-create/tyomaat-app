import { describe, it, expect } from "vitest"
import { extractCostFromText } from "./extractCostFromText"

describe("extractCostFromText", () => {
  /* Mitatut muodot STT-tiedotteista 12.8.2026. */
  it("poimii hankkeen kustannuksen", () => {
    expect(
      extractCostFromText(
        "Hankkeen kokonaisarvon arvioidaan toteutuessaan olevan noin 44 miljoonaa euroa."
      )
    ).toBe(44_000_000)

    expect(
      extractCostFromText("Kokonaisuudessaan kyse on lähes 30 miljoonan euron rakennusinvestoinnista.")
    ).toBe(30_000_000)

    expect(
      extractCostFromText("Noin 20 miljoonan euron rakennushankkeen urakoitsijaksi valittiin...")
    ).toBe(20_000_000)

    expect(
      extractCostFromText("Urakan arvo Skanskalle on noin 100 miljoonaa euroa.")
    ).toBe(100_000_000)

    expect(
      extractCostFromText("Hankkeen kustannusarvio on 45 miljoonaa euroa vuosille 2025-2032.")
    ).toBe(45_000_000)
  })

  it("lukee desimaalit", () => {
    expect(
      extractCostFromText("Urakan arvo on 12,5 miljoonaa euroa.")
    ).toBe(12_500_000)
  })

  /*
   * EUROMÄÄRÄ YKSIN EI RIITÄ. Nämä kaksi ovat mitattuja tapauksia samasta
   * aineistosta: kumpikaan ei ole hankkeen kustannus, ja ilman
   * kontekstivaatimusta molemmat olisi kirjoitettu hankkeelle.
   */
  it("ei poimi summaa ilman rakentamiskontekstia", () => {
    expect(
      extractCostFromText(
        "Maksutapaetua maksettiin asiakasomistajille vuoden aikana yli 97 miljoonaa euroa."
      )
    ).toBeNull()

    expect(
      extractCostFromText(
        "Toistaiseksi voimassa olevan sopimuksen arvo on 10 miljoonaa euroa. Tiera Oy haki kilpailutuksella palvelua."
      )
    ).toBeNull()
  })

  it("ei poimi yrityksen lukuja vaikka rakentaminen mainittaisiin", () => {
    expect(
      extractCostFromText("Rakennusliikkeen liikevaihto oli 250 miljoonaa euroa.")
    ).toBeNull()
  })

  it("sietaa tyhjan ja summattoman tekstin", () => {
    expect(extractCostFromText(null)).toBeNull()
    expect(extractCostFromText("")).toBeNull()
    expect(extractCostFromText("Urakka alkaa keväällä.")).toBeNull()
  })

  /*
   * Epäuskottavan suuri luku on jäsennysvirhe, ei hanke: Suomen
   * suurimmatkin yksittäiset rakennushankkeet jäävät alle kolmen miljardin.
   */
  it("hylkaa epauskottavan suuren summan", () => {
    expect(extractCostFromText("Urakan arvo on 5000 miljoonaa euroa.")).toBeNull()
  })

  /*
   * KOONTILUKU EI OLE HANKKEEN KUSTANNUS. Mitatut tapaukset joissa
   * laheisyysehto antoi vaaran arvon.
   */
  it("ei poimi koontilukua", () => {
    expect(
      extractCostFromText(
        "Puolustusvoimien investoinnit valtakunnallisesti olivat viime vuonna 356 miljoonaa euroa."
      )
    ).toBeNull()

    expect(
      extractCostFromText(
        "Yksikko on voittanut useita hankkeita yhteensa noin 20 miljoonan euron arvosta."
      )
    ).toBeNull()

    expect(
      extractCostFromText("Asfalttiurakat ovat olleet suuruusluokkaa 1,2 milj.euroa/vuosi.")
    ).toBeNull()
  })

  it("ei poimi palveluhankinnan arvoa", () => {
    expect(
      extractCostFromText("Hankinnan ennakoitu kokonaisarvo on 1,3 miljoonaa euroa.")
    ).toBeNull()
  })

  /*
   * TIEDOTE VOI KASITELLA USEAA HANKETTA. Iin koulua koskevan tiedotteen
   * loppupuolella lukee Jyvaskylan toimistotalon urakkasumma; se ei ole
   * taman hankkeen kustannus, joten haku rajataan tekstin alkuun.
   */
  it("ei poimi summaa tekstin loppupuolelta", () => {
    const lead = "Iin kunnalle rakennetaan uusi koulu Valtariin. ".repeat(30)
    expect(
      extractCostFromText(`${lead} Urakan arvo Skanskalle on noin 29 miljoonaa euroa.`)
    ).toBeNull()
  })
})
