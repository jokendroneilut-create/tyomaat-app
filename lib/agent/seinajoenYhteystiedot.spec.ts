import { describe, it, expect } from "vitest"
import * as cheerio from "cheerio"

import { jarjestaNimi, seinajoenYhteyshenkilot } from "./seinajoenYhteystiedot"

/*
 * Otos on Rahkolan kaavasivun oikeasta rakenteesta 8.11.2026, myos
 * sahkopostin numeroentiteetit ja `tel:`-arvon valilyonti.
 */
const SIVU = `
<article><h1>Rahkola, Laulateentien länsipuoli (57004)</h1>
<p class="wp-block-paragraph"></p></article>
<aside class="sidebar-right">
  <section class="s-sidebar-contact-card">
    <div class="s-sidebar-contact-card__wrapper">
      <h2 class="s-sidebar-contact-card__full-name"> Kuusinen Jyrki </h2>
      <div class="s-sidebar-contact-card__title-wrap">
        <span class="s-sidebar-contact-card__title"> yleiskaavapäällikkö </span>
        <span class="s-sidebar-contact-card__unit-delimiter"> , </span>
        <span class="s-sidebar-contact-card__unit"> Kaupunkisuunnittelu ja kaavoitus </span>
      </div>
      <div class="s-sidebar-contact-card__phone-wrap">
        <a class="s-sidebar-contact-card__mobile-number" href="tel: 044 754 1645"> 044 754 1645 </a>
      </div>
      <a class="s-sidebar-contact-card__email" href="mailTo: &#106;&#121;r&#107;i&#046;&#107;uus&#105;n&#101;n&#064;&#115;&#101;in&#097;joki.f&#105;"> jyrki&#046;&#107;&#117;&#117;&#115;&#105;nen&#064;sei&#110;&#097;&#106;&#111;&#107;i&#046;&#102;i </a>
    </div>
  </section>
  <section class="s-sidebar-contact-card">
    <div class="s-sidebar-contact-card__wrapper">
      <h2 class="s-sidebar-contact-card__full-name"> Ström Jenni </h2>
      <div class="s-sidebar-contact-card__title-wrap">
        <span class="s-sidebar-contact-card__title"> kaavasuunnittelija </span>
      </div>
      <a class="s-sidebar-contact-card__email" href="mailTo: x"> jenni.strom@seinajoki.fi </a>
    </div>
  </section>
</aside>`

describe("seinajoenYhteyshenkilot", () => {
  it("poimii kortista nimen, nimikkeen, puhelimen ja sähköpostin", () => {
    const henkilot = seinajoenYhteyshenkilot(cheerio.load(SIVU))
    expect(henkilot).toHaveLength(2)
    expect(henkilot[0]).toEqual({
      kind: "person",
      name: "Jyrki Kuusinen",
      title: "yleiskaavapäällikkö",
      email: "jyrki.kuusinen@seinajoki.fi",
      phone: "044 754 1645",
      organization: "Seinäjoen kaupunki",
    })
  })

  it("purkaa numeroentiteeteillä hämäytetyn sähköpostin", () => {
    /*
     * Sivulla osoite on muodossa `&#106;&#121;r&#107;i&#046;…`, ja
     * `href` alkaa lisäksi "mailTo: " välilyönnillä. Linkin TEKSTI
     * riittää, koska cheerio purkaa entiteetit.
     */
    const henkilot = seinajoenYhteyshenkilot(cheerio.load(SIVU))
    expect(henkilot[0].email).toBe("jyrki.kuusinen@seinajoki.fi")
  })

  it("jättää puhelimen tyhjäksi kun korttiin ei ole merkitty numeroa", () => {
    const henkilot = seinajoenYhteyshenkilot(cheerio.load(SIVU))
    expect(henkilot[1].name).toBe("Jenni Ström")
    expect(henkilot[1].phone).toBeNull()
  })

  it("ei palauta mitään kun sivulla ei ole kortteja", () => {
    expect(seinajoenYhteyshenkilot(cheerio.load("<article><p>ei kortteja</p></article>"))).toEqual([])
  })
})

describe("jarjestaNimi", () => {
  /*
   * Kortissa nimi on sukunimi ensin. Järjestys päätellään
   * sähköpostista eikä arvata.
   */
  it("kääntää sukunimi-etunimi sähköpostin perusteella", () => {
    expect(jarjestaNimi("Kuusinen Jyrki", "jyrki.kuusinen@seinajoki.fi")).toBe("Jyrki Kuusinen")
  })

  it("jättää oikean järjestyksen rauhaan", () => {
    expect(jarjestaNimi("Jyrki Kuusinen", "jyrki.kuusinen@seinajoki.fi")).toBe("Jyrki Kuusinen")
  })

  it("sietää ääkköset ja yhdysviivan osoitteessa", () => {
    expect(jarjestaNimi("Ström Jenni", "jenni.strom@seinajoki.fi")).toBe("Jenni Ström")
    expect(jarjestaNimi("Prinkkilä Veli-Matti", "veli-matti.prinkkila@seinajoki.fi")).toBe(
      "Veli-Matti Prinkkilä"
    )
  })

  it("kääntää kaksi sanaa myös ilman sähköpostia", () => {
    expect(jarjestaNimi("Norja Martti", null)).toBe("Martti Norja")
  })

  it("ei arvaa kolmen sanan nimen järjestystä ilman sähköpostia", () => {
    /* Kaksiosainen sukunimi menisi yhtä usein väärin kuin oikein. */
    expect(jarjestaNimi("von Hertzen Maija", null)).toBe("von Hertzen Maija")
  })
})
