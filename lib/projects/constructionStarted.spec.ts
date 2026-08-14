import { describe, it, expect } from "vitest"
import { constructionHasStarted } from "./constructionStarted"

const NOW = new Date("2026-08-14T00:00:00Z")

describe("constructionHasStarted", () => {
  /* Mitatut osumat jotka ovat aidosti kaynnissa. */
  it("tunnistaa alkaneen rakentamisen", () => {
    expect(constructionHasStarted("Ahvenisjärven koulun rakennustyöt käynnistyvät Tampereella", NOW)).toBe(true)
    expect(constructionHasStarted("Rakentaminen alkaa kesäkuussa 2026, ja kohde valmistuu 2027.", NOW)).toBe(true)
    expect(constructionHasStarted("Maanrakennustyöt käynnistyvät kesällä 2026.", NOW)).toBe(true)
    expect(constructionHasStarted("Rakentaminen alkoi jo 2025.", NOW)).toBe(true)
  })

  /*
   * TULEVA PAIVA EI OLE TILA. Mitattu tapaus: "Oulun elamysareenan
   * rakentaminen alkaa suunnitelmien mukaan 2028" merkitsisi hankkeen
   * rakenteilla olevaksi nelja vuotta etuajassa.
   */
  it("ei merkitse tulevaa alkua kaynnissa olevaksi", () => {
    expect(constructionHasStarted("Elämysareenan rakentaminen alkaa suunnitelmien mukaan 2028 ja valmista on 2030.", NOW)).toBe(false)
    expect(constructionHasStarted("Rakentaminen alkaa syksyllä 2026.", NOW)).toBe(false)
    expect(constructionHasStarted("Rakennustyöt käynnistyvät ensi vuonna.", NOW)).toBe(false)
  })

  it("ei osu muuhun tekstiin", () => {
    expect(constructionHasStarted("Hankesuunnitelma hyväksyttiin.", NOW)).toBe(false)
    expect(constructionHasStarted(null, NOW)).toBe(false)
    expect(constructionHasStarted("", NOW)).toBe(false)
  })
})

describe("lauseenosan katkaisu", () => {
  const NOW2 = new Date("2026-08-14T00:00:00Z")

  /*
   * MITATTU TAPAUS. "Nyab rakentaa sahkoaseman Forssaan": teksti on
   * "Rakentaminen alkaa elokuussa ja valmista on vuonna 2028."
   * Ilman katkaisua vuosihaku poimi 2028:n eli VALMISTUMISvuoden, ja
   * saanto paatteli rakentamisen alkavan kahden vuoden paasta.
   */
  it("ei sekoita valmistumisvuotta aloitusvuoteen", () => {
    expect(
      constructionHasStarted("Rakentaminen alkaa elokuussa ja valmista on vuonna 2028.", NOW2)
    ).toBe(true)
  })

  it("lukee silti aloitusvuoden kun se on omassa lauseenosassaan", () => {
    expect(
      constructionHasStarted("Rakentaminen alkaa 2028 ja valmista on vuonna 2030.", NOW2)
    ).toBe(false)
    expect(
      constructionHasStarted("Rakentaminen alkaa kesäkuussa 2026, ja kohde valmistuu 2027.", NOW2)
    ).toBe(true)
  })
})
