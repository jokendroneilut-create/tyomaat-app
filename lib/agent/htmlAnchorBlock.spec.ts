import { describe, expect, it } from "vitest"
import * as cheerio from "cheerio"

import { anchorBlockText, anchorMatches, anchorSlug } from "./htmlAnchorBlock"

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
