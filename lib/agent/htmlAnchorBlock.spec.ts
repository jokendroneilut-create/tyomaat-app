import { describe, expect, it } from "vitest"
import * as cheerio from "cheerio"

import {
  anchorBlockText,
  anchorMatches,
  anchorSlug,
  blockHeadings,
  blockTextsForSlug,
  blocksLookIdentical,
} from "./htmlAnchorBlock"

/* Pornaisten kaltainen sivu: kaikki kaavat yhdellä sivulla. */
const SIVU = `
<div class="content">
  <h2>Kartanorinne, asemakaava</h2>
  <p>Kaava koskee Kartanorinteen aluetta.</p>
  <p>28.5.2018 Kaava kuulutettu voimaan.</p>
  <h2>Uurastajantie, asemakaavan muutos</h2>
  <p>Muutos koskee Uurastajantien katualuetta.</p>
  <h3>Käsittelyvaiheet</h3>
  <p>12.9.2025 Voimaantulopäivä.</p>
  <h2>Koskitie, asemakaava</h2>
  <p>Ei vielä päätöksiä.</p>
</div>`

describe("anchorSlug", () => {
  it("muuntaa otsikon ankkuriksi", () => {
    expect(anchorSlug("Uurastajantie, asemakaavan muutos")).toBe("uurastajantie-asemakaavan-muutos")
  })
})

describe("anchorMatches", () => {
  it("hyvaksyy numeroliitteen samannimisille otsikoille", () => {
    expect(anchorMatches("itatalon-ranta-asemakaavan-muutos", "itatalon-ranta-asemakaavan-muutos-3")).toBe(true)
  })

  it("ei hyvaksy eri otsikkoa", () => {
    expect(anchorMatches("koskitie-asemakaava", "kartanorinne-asemakaava")).toBe(false)
    expect(anchorMatches("koskitie", "koskitie-suvanto")).toBe(false)
  })
})

describe("anchorBlockText", () => {
  /*
   * Tama oli vika: koko sivun lukeminen antoi Pornaisten viidelle eri
   * kaavalle saman voimaantulopaivan, koska se oli sivun VIIMEINEN.
   */
  it("rajaa tekstin oikeaan lohkoon", () => {
    const $ = cheerio.load(SIVU)
    const teksti = anchorBlockText($, "kartanorinne-asemakaava") ?? ""
    expect(teksti).toContain("28.5.2018")
    expect(teksti).not.toContain("12.9.2025")
  })

  it("ottaa mukaan alemmat otsikot mutta pysahtyy samantasoiseen", () => {
    const $ = cheerio.load(SIVU)
    const teksti = anchorBlockText($, "uurastajantie-asemakaavan-muutos") ?? ""
    expect(teksti).toContain("12.9.2025")
    expect(teksti).not.toContain("28.5.2018")
    expect(teksti).not.toContain("Ei vielä päätöksiä")
  })

  /* Tuntematon ankkuri ei saa palauttaa koko sivua. */
  it("palauttaa nullin kun ankkuria ei loydy", () => {
    const $ = cheerio.load(SIVU)
    expect(anchorBlockText($, "jokin-muu-kaava")).toBeNull()
    expect(anchorBlockText($, "")).toBeNull()
  })

  it("loytaa lohkon myos id-attribuutin perusteella", () => {
    const $ = cheerio.load(`<h2 id="oma-ankkuri">Otsikko</h2><p>13.4.2026 Voimaantulopäivä.</p><h2>Toinen</h2>`)
    expect(anchorBlockText($, "oma-ankkuri")).toContain("13.4.2026")
  })
})

/* Pornaisten sivu ei kayta otsikkoelementteja vaan lihavoituja kappaleita. */
const LIHAVA_SIVU = `
<div class="text">
  <p><strong>Kartanorinne, asemakaava</strong></p>
  <p>Kaava koskee Kartanorinteen aluetta.</p>
  <p>28.5.2018 Kaava kuulutettu voimaan.</p>
  <p><strong>Uurastajantie, asemakaavan muutos</strong></p>
  <p>12.9.2025 Voimaantulopäivä.</p>
  <p>Lisätietoja antaa <strong>kaavoittaja</strong> tarvittaessa.</p>
</div>`

describe("anchorBlockText lihavoiduilla otsikoilla", () => {
  it("rajaa lohkon lihavoidun kappaleen kohdalta", () => {
    const $ = cheerio.load(LIHAVA_SIVU)
    const teksti = anchorBlockText($, "kartanorinne-asemakaava") ?? ""
    expect(teksti).toContain("28.5.2018")
    expect(teksti).not.toContain("12.9.2025")
  })

  /*
   * Lause jossa on yksi korostettu sana ei ole otsikko: muuten lohko
   * katkeaisi kesken ja tieto jaisi lukematta.
   */
  it("ei katkaise lohkoa yhden korostetun sanan kohdalta", () => {
    const $ = cheerio.load(LIHAVA_SIVU)
    const teksti = anchorBlockText($, "uurastajantie-asemakaavan-muutos") ?? ""
    expect(teksti).toContain("12.9.2025")
    expect(teksti).toContain("Lisätietoja antaa")
  })
})

describe("blockHeadings", () => {
  it("listaa lohko-otsikot samalla saannolla kuin ankkurin haku", () => {
    const $ = cheerio.load(SIVU)
    expect(blockHeadings($)).toContain("Kartanorinne, asemakaava")
    expect(blockHeadings($)).toContain("Käsittelyvaiheet")
  })

  /* Juuri tata varten: sama otsikko kahdesti tarkoittaa katoavaa kaavaa. */
  it("nayttaa saman otsikon kahdesti kun se on sivulla kahdesti", () => {
    const $ = cheerio.load(`<h2>Asemakaavan muutos Keskustassa</h2><p>a</p><h2>Asemakaavan muutos Keskustassa</h2><p>b</p>`)
    const otsikot = blockHeadings($).filter((t) => t === "Asemakaavan muutos Keskustassa")
    expect(otsikot.length).toBe(2)
  })

  it("ei laske lihavoimatonta kappaletta otsikoksi", () => {
    const $ = cheerio.load(`<p>Tavallinen kappale</p><h2>Otsikko</h2>`)
    expect(blockHeadings($)).toEqual(["Otsikko"])
  })
})

describe("blockTextsForSlug", () => {
  /*
   * Sama nimi kahdella otsikkotasolla on YKSI kaava, ei kaksi: sisallot
   * ovat samat tai toinen on tyhja. Nain on Vehmaalla (h3 ja h4) ja
   * Simossa (lihavoitu kappale ja tyhja h2).
   */
  it("nayttaa saman sisallon kun kyse on samasta kaavasta", () => {
    const $ = cheerio.load(
      `<h3>Lehtisaaren ranta-asemakaava</h3><p>Vireille 7.5.2012.</p>` +
        `<h4>Lehtisaaren ranta-asemakaava</h4><p>Vireille 7.5.2012.</p>`
    )
    const tekstit = blockTextsForSlug($, "lehtisaaren-ranta-asemakaava")
    expect(tekstit.length).toBe(2)
    /* Ylempi otsikko sisaltaa alemman, joten tekstit eivat ole identtiset. */
    expect(blocksLookIdentical(tekstit)).toBe(true)
  })

  /* Pietarsaaren Keskusta: kaksi eri kaavaa samalla nimella. */
  it("nayttaa eri sisallot kun kaavoja on kaksi", () => {
    const $ = cheerio.load(
      `<h2>Asemakaavan muutos Keskustassa</h2><p>Suunnittelualue sijaitsee keskustan pohjoisosassa historiallisesti tärkeässä ympäristössä, ja siihen kuuluu kortteli 15 jossa on Pietarsaaren kirkko vuodelta 1731.</p>` +
        `<h2>Asemakaavan muutos Keskustassa</h2><p>Suunnittelualue sijaitsee Runeberginpuiston ja ratapihan välisellä alueella. Alue käsittää ns. Maria Malm korttelin ja viereiset kadut.</p>`
    )
    const tekstit = blockTextsForSlug($, "asemakaavan-muutos-keskustassa")
    expect(blocksLookIdentical(tekstit)).toBe(false)
  })
})

describe("blocksLookIdentical", () => {
  it("pitaa tyhjaa lohkoa samana kaavana", () => {
    expect(blocksLookIdentical(["Sisältöä tässä", ""])).toBe(true)
  })

  /*
   * Lyhyt teksti ei ole todiste. Asiakirjalista ja paivamaarahuomautus
   * eroavat toisistaan sanoina mutta kertovat samasta kaavasta, ja
   * niiden perusteella tarkistus halytti aluksi viidesta lahteesta
   * turhaan.
   */
  it("ei pida lyhyita lohkoja todisteena kahdesta kaavasta", () => {
    expect(blocksLookIdentical(["Kirkon kortteli 15", "Maria Malmin kortteli"])).toBe(true)
  })

  it("kestaa yhden ja nollan lohkon", () => {
    expect(blocksLookIdentical([])).toBe(true)
    expect(blocksLookIdentical(["vain yksi"])).toBe(true)
  })
})

/*
 * Nama ovat oikeita sivuja 30.8.2026, ja jokainen niista oli aluksi
 * vaara halytys: tarkistus sanoi "kaksi kaavaa" vaikka kyse oli samasta.
 */
describe("blocksLookIdentical oikeilla sivuilla", () => {
  it("Keuruu: lyhyt paivamaarahuomautus ja kuvaus ovat sama kaava", () => {
    expect(
      blocksLookIdentical([
        "Osallistumis- ja arviointisuunnitelma oli nähtävillä 28.1.-18.2.2026.",
        "Asemakaavan muutos koskee venesatamaksi/venevalkamaksi sekä vesialueeksi osoitettua aluetta ja laajennusalue Keurusselän vesialuetta. Suunnittelualue on pinta-alaltaan noin kolme hehtaaria.",
      ])
    ).toBe(true)
  })

  it("Sakyla: asiakirjaryhmat ovat sama kaava", () => {
    expect(
      blocksLookIdentical([
        "Kuulutus, kaava lainvoimainen Kaavakartta Kaavaselostus Osallistumis- ja arviointisuunnitelma",
        "Kuulutus kaavan voimaantulosta Kaavakartta Kaavaselostus Osallistumis- ja arviointisuunnitelma",
      ])
    ).toBe(true)
  })

  it("Tohmajarvi: otsikollinen ja otsikoton sama kuvaus ovat sama kaava", () => {
    const kuvaus =
      "Asemakaavalla muodostuu yhdyskuntateknistä huoltoa palvelevien rakennusten ja laitosten alue (ET). Alue käsittää jätevedenpuhdistamon alueen ja sen lähiympäristön."
    expect(blocksLookIdentical([`Jätevedenpuhdistamon asemakaava ${kuvaus}`, kuvaus])).toBe(true)
  })

  /* Ja tama on se aito: kaksi eri kaavaa samalla nimella. */
  it("Pietarsaari: kaksi eri kuvausta on kaksi kaavaa", () => {
    expect(
      blocksLookIdentical([
        "Suunnittelualue sijaitsee keskustan pohjoisosassa historiallisesti tärkeässä ympäristössä. Suunnittelualueeseen kuuluu kolme korttelia, joista yhdessä on Pietarsaaren kirkko vuodelta 1731.",
        "Suunnittelualue sijaitsee Runeberginpuiston ja ratapihan välisellä alueella. Alue käsittää ns. Maria Malm korttelin ja viereiset kadut, joissa oli virastotalo ja linja-autoasema.",
      ])
    ).toBe(false)
  })
})
