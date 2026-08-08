import { describe, it, expect } from "vitest"
import {
  cdata,
  parseRssTitle,
  isConstructionSubject,
  upgradePermitTitle,
} from "./fetchDynastySource"

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
  /*
   * Kaksi kuviota jotka positiivinen lista paasti lapi vaarin perustein.
   * Molemmat oikeista otsikoista: Kouvola ja Porvoo.
   */
  it("pudottaa yksityistien avustuksen ja sopimuksen purkamisen", () => {
    expect(
      isConstructionSubject(
        "Perusparannusavustuksen myöntäminen valtion avustuspäätöksen saaneelle yksityistielle: Amerikan yksityistie"
      )
    ).toBe(false)
    expect(
      isConstructionSubject(
        "Työllistymistä edistävän monialaisen tuen yhteistyösopimuksen (TYM) purkaminen ja uuden yhteistyösopimuksen valmistelu"
      )
    ).toBe(false)
  })

  it("ei pudota rakennuksen purkamista", () => {
    expect(isConstructionSubject("Puuppolan hoivasairaalan purkaminen")).toBe(true)
    expect(
      isConstructionSubject("Kouvolan teatterin laajennus sekä vanhan teatterin purkaminen")
    ).toBe(true)
  })

  it("pudottaa lausunnon myös otsikon keskeltä", () => {
    expect(
      isConstructionSubject(
        "Liikunta- ja hyvinvointilautakunnan lausunto Kivenlahden pukutilojen hankesuunnitelmasta"
      )
    ).toBe(false)
  })
})

describe("upgradePermitTitle", () => {
  /*
   * Lupapaatoksen otsikko on pelkka lupatunnus ja osoite, josta ei nae
   * mista hankkeessa on kyse. Mitattu tapaus Espoosta: otsikko
   * "Laajennuslupa 49-2024-260, Pohjantie 3", kun tekstissa luki
   * toimenpiteena toimistorakennuksen muuttaminen asuinkerrostaloksi.
   */
  const BODY =
    "Rakennuspaikka 49-12-2-17 Pohjantie 3 TAPIOLA Hakija Kiinteistö Oy Raitinlukko " +
    "Toimenpide Toimistorakennuksen muuttaminen asuinkerrostaloksi " +
    "Pääsuunnittelija: arkkitehti Rakenteellinen paloturvallisuus"

  it("nostaa toimenpiteen otsikoksi ja sailyttaa osoitteen", () => {
    expect(upgradePermitTitle("Laajennuslupa 49-2024-260, Pohjantie 3", BODY)).toBe(
      "Toimistorakennuksen muuttaminen asuinkerrostaloksi, Pohjantie 3"
    )
  })

  it("jattaa muun kuin lupaotsikon rauhaan", () => {
    expect(
      upgradePermitTitle("Espoonlahden uintikeskuksen tarveselvitys", BODY)
    ).toBe("Espoonlahden uintikeskuksen tarveselvitys")
  })

  it("sailyttaa otsikon kun toimenpidetta ei loydy", () => {
    const title = "Rakennuslupa 49-2024-999, Testitie 1"
    expect(upgradePermitTitle(title, "Ei toimenpidekenttaa tassa tekstissa.")).toBe(title)
  })
})
