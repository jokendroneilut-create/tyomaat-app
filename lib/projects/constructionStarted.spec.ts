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

/*
 * MITATUT SANAMUODOT (D-250).
 *
 * Lauseet ovat tuotannon kuvauksista 8.10.2026, eivat keksittyja.
 * Hylattavat ovat yhta tarkeita kuin osuvat: valjempi hahmo paastaa
 * lapi kieltomuodon ja aikomuksen.
 */
describe("constructionHasStarted: mitatut sanamuodot", () => {
  const alkanut = [
    "Maatyöt ovat jo käynnistyneet tontilla ja hoivakodin arvioidaan valmistuvan syksyllä 2027.",
    "Maanrakennustyöt ovat käynnistyneet tontilla, ja hankkeen arvioidaan valmistuvan syksyllä 2027.",
    "Rakennustyöt ovat käynnistyneet työmaan perustamisella ja valmistelevilla töillä.",
    "Rakentaminen on jo käynnistynyt valmistelevilla työvaiheilla.",
    "Hitas-uudiskohteena myytävän Asunto Oy Helsingin Hellikin rakentaminen on nyt alkanut.",
    "Kohteen urakoitsijaksi on valittu Jatke Toimitilat Oy ja rakennustyöt ovat aloitettu viikolla 49.",
    "Myös mallihuoneiden rakentaminen on aloitettu.",
    "Rakennuksen sisätyöt ovat jo pitkällä, ja myös piharakentaminen on käynnissä.",
    "Päätöksen mukaiset porras- ja hissikuilujen rakennustyöt ovat jo käynnissä.",
    "Rovaniemen uuden pääpoliisiaseman varsinaiset rakennustyöt ovat käynnistyneet Verstaantiellä.",
  ]

  for (const lause of alkanut) {
    it(`tunnistaa alkaneeksi: ${lause.slice(0, 45)}`, () => {
      expect(constructionHasStarted(lause, new Date("2026-10-08"))).toBe(true)
    })
  }

  const eiAlkanut = [
    /* Tulevaisuus: vuosi ratkaisee. */
    "Rakentaminen käynnistyy aikaisintaan kesällä 2027, ja kirjasto avaa ovensa 2029.",
    "Purkutyöt alkavat vuoden 2026 lopussa, ja uuden talon rakentaminen käynnistyy alkuvuonna 2027.",
    /* Aikomus ja toive, ei tapahtuma. */
    "Odotamme innolla, että rakentaminen pääsee käynnistymään pitkän suunnittelutyön jälkeen.",
    "Rakentamisen on määrä alkaa, kun lupa on lainvoimainen.",
    /* Kieltomuoto: kahden sanan vali paastaisi taman lapi ilman porttia. */
    "Rakentaminen ei ole alkanut, koska valitus on kesken.",
    /* Sudenkuoppa: "edennyt suunnittelussa" tarkoittaa paivastaista. */
    "Olemme tyytyväisiä, että hankkeen rakentaminen on edennyt suunnittelussa aikataulussa.",
  ]

  for (const lause of eiAlkanut) {
    it(`ei merkitse alkaneeksi: ${lause.slice(0, 45)}`, () => {
      expect(constructionHasStarted(lause, new Date("2026-10-08"))).toBe(false)
    })
  }
})

/*
 * EHTOMUOTO (D-250). Lauseet ovat tuotannosta; kuivaharjoitus loysi ne
 * ennen kuin takautuva korjaus ajettiin.
 */
describe("constructionHasStarted: ehtomuoto ei ole aloitus", () => {
  const ehdollinen = [
    "Jätkäsaaren uima- ja liikuntahallin rakentaminen voi alkaa viimeistään alkuvuonna 2027.",
    "Nopeimmalla mahdollisella aikataululla rakennustyöt voisivat käynnistyä kesällä 2021.",
    "Korttelin ensimmäisen kerrostalon rakentaminen käynnistyisi vuoden 2026 aikana.",
  ]
  for (const lause of ehdollinen) {
    it(`ei merkitse alkaneeksi: ${lause.slice(0, 45)}`, () => {
      expect(constructionHasStarted(lause, new Date("2026-10-08"))).toBe(false)
    })
  }
})

/*
 * Paate -isivat katkesi ennen SANAMERKKI-korjausta, koska JS:n \w ei
 * kata a:ta eika o:ta. Tama testi pitaa korjauksen paikallaan.
 */
describe("constructionHasStarted: ehtomuoto aantein", () => {
  it("ei merkitse alkaneeksi: rakennustyot kaynnistyisivat", () => {
    expect(
      constructionHasStarted(
        "Alustavan arvion mukaan laajennuksen rakennustyöt käynnistyisivät syksyllä 2026.",
        new Date("2026-10-08")
      )
    ).toBe(false)
  })
})
