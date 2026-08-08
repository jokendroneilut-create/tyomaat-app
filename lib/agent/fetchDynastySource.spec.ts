import { describe, it, expect } from "vitest"
import { cdata, parseRssTitle, isConstructionSubject } from "./fetchDynastySource"

describe("cdata", () => {
  /*
   * Mitattu Joensuussa: purkamaton &ndash; jai hankkeen nimeen ja siita
   * edelleen tasmaytykseen.
   */
  it("purkaa muutkin kuin kolme perusentiteettia", () => {
    expect(cdata("<![CDATA[Tikkarinne 9 keitti&ouml;n peruskorjaus &ndash; hyv&auml;ksyminen]]>")).toBe(
      "Tikkarinne 9 keittiön peruskorjaus – hyväksyminen"
    )
  })

  it("sailyttaa linkin parametrit", () => {
    expect(cdata("<![CDATA[https://x.fi/cgi/D.PHP?page=meetingitem&amp;id=12]]>")).toBe(
      "https://x.fi/cgi/D.PHP?page=meetingitem&id=12"
    )
  })
})

describe("parseRssTitle", () => {
  /*
   * RSS-otsikko on "Toimielin PP.KK.VVVV / Asian otsikko". Toimielin on
   * erotettava, koska muuten jokainen hanke alkaisi lautakunnan nimellä
   * eikä täsmäytys löytäisi niitä.
   */
  it("erottaa toimielimen, päivän ja asian", () => {
    const p = parseRssTitle(
      "Kaupunginhallitus 10.08.2026 / Rantamäenpolku, asemakaavan muutoksen hyväksyminen"
    )
    expect(p.organization).toBe("Kaupunginhallitus")
    expect(p.subject).toBe("Rantamäenpolku, asemakaavan muutoksen hyväksyminen")
    expect(p.date?.getFullYear()).toBe(2026)
    expect(p.date?.getMonth()).toBe(7)
  })

  it("sietää otsikon ilman erotinta", () => {
    const p = parseRssTitle("Kaupunginvaltuusto 01.01.2026")
    expect(p.subject).toBe("Kaupunginvaltuusto 01.01.2026")
  })

  /*
   * Asian otsikossa voi olla oma kauttaviiva, joten jako tehdään vain
   * ensimmäisestä.
   */
  it("ei katkaise asiaa jossa on kauttaviiva", () => {
    const p = parseRssTitle(
      "Kaupunginhallitus 10.08.2026 / Koulun peruskorjaus / vaihe 2"
    )
    expect(p.subject).toBe("Koulun peruskorjaus / vaihe 2")
  })
})

describe("isConstructionSubject", () => {
  it("päästää läpi hankepäätökset", () => {
    expect(isConstructionSubject("Hankesuunnitelman hyväksyminen, Nöykkiön koulu")).toBe(
      true
    )
    expect(isConstructionSubject("Koulun peruskorjauksen urakkasopimus")).toBe(true)
  })

  it("pudottaa kokouksen vakioasiat", () => {
    expect(isConstructionSubject("Pöytäkirjan tarkastajien valinta")).toBe(false)
    expect(isConstructionSubject("Kokouksen laillisuuden toteaminen")).toBe(false)
  })

  /*
   * Lausunto on kannanotto toisen toimielimen valmisteluun, ei hankepäätös.
   * Mitattu muoto on lausunto KESKELLÄ otsikkoa, joten alkuun ankkuroitu
   * kuvio ei riittänyt: kolme viidestä ensimmäisestä osumasta pääsi läpi ja
   * ne olisivat kaksinkertaistaneet hankkeen jonossa.
   */
  it("pudottaa lausunnon myös otsikon keskeltä", () => {
    expect(
      isConstructionSubject(
        "Liikunta- ja hyvinvointilautakunnan lausunto Kivenlahden pukutilojen hankesuunnitelmasta"
      )
    ).toBe(false)
  })
})
