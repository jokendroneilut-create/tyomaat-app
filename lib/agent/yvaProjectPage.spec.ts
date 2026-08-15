import { describe, it, expect } from "vitest"
import { parseYvaFields, yvaDeveloperFromHtml } from "./yvaProjectPage"

/* Todellinen markkinointi ymparisto.fi:stä (haettu 15.8.2026). */
const HERVA = `
<div class="accordion-item__content" id="">
  <div class="yva_content__accordion_wrapper">
    <div class="yva_content__item">
      <span class="yva_content__title">Hankkeesta vastaava:</span>
      Valoa Networks Oy, Dominic Marshall
    </div>
    <div class="yva_content__item">
      <span class="yva_content__title">Konsultti:</span>
      Ove Arup &amp; Partners Ireland Limited, Sinead Whyte, sinead.whyte@arup.com<br /> <br /> Sitowise Oy, Tiina Kumpula
    </div>
    <div class="yva_content__item">
      <span class="yva_content__title">Yhteysviranomainen:</span>
      Lupa- ja valvontavirasto, Emma Keränen, emma.keranen@lvv.fi, puh. 0295 254 529
    </div>
    <div class="yva_content__item">
      <span class="yva_content__title">Diaarinumero:</span>
      LVV-U/25822/2026
    </div>
  </div>
</div>`

describe("parseYvaFields", () => {
  it("lukee nimetyt kentät nimi → arvo", () => {
    const fields = parseYvaFields(HERVA)

    expect(fields["Hankkeesta vastaava"]).toBe("Valoa Networks Oy, Dominic Marshall")
    expect(fields["Diaarinumero"]).toBe("LVV-U/25822/2026")
    expect(fields["Yhteysviranomainen"]).toContain("Lupa- ja valvontavirasto")
  })

  it("purkaa HTML-entiteetit ja rivinvaihdot", () => {
    expect(parseYvaFields(HERVA)["Konsultti"]).toContain(
      "Ove Arup & Partners Ireland Limited"
    )
  })

  it("tyhjä syöte -> tyhjä tulos", () => {
    expect(parseYvaFields(null)).toEqual({})
    expect(parseYvaFields("<p>ei kenttiä</p>")).toEqual({})
  })
})

describe("yvaDeveloperFromHtml", () => {
  it("poimii organisaation, ei yhteyshenkilöä", () => {
    expect(yvaDeveloperFromHtml(HERVA)).toBe("Valoa Networks Oy")
  })

  it("toimii myös rahastomuotoisella nimellä", () => {
    const html = `<span class="yva_content__title">Hankkeesta vastaava:</span>
      Erikoissijoitusrahasto UB Uusiutuva Energia, Niina Kotomäki, p. 040 922 6943</div>`

    expect(yvaDeveloperFromHtml(html)).toBe(
      "Erikoissijoitusrahasto UB Uusiutuva Energia"
    )
  })

  /*
   * Mieluummin tyhjä kuin väärä rakennuttaja — sama periaate kuin
   * `extractYvaDeveloper`issa ja D-072:ssa.
   */
  it("ei palauta yhteystietoa organisaationa", () => {
    const email = `<span class="yva_content__title">Hankkeesta vastaava:</span>
      etunimi@yritys.fi, Matti Meikäläinen</div>`
    const phone = `<span class="yva_content__title">Hankkeesta vastaava:</span>
      p. 040 123 4567</div>`

    expect(yvaDeveloperFromHtml(email)).toBeNull()
    expect(yvaDeveloperFromHtml(phone)).toBeNull()
  })

  it("kenttä puuttuu -> null", () => {
    expect(yvaDeveloperFromHtml("<p>ei kenttiä</p>")).toBeNull()
  })
})

/*
 * Nämä ovat todellisia hankevastaava-kenttiä, jotka luettiin 15 YVA-sivulta
 * 15.8.2026. Viidessä niistä kenttä ALKAA yhteyshenkilöllä, ja yhdessä
 * organisaation nimi sisältää pilkun. Ensimmäinen versio otti vain
 * ensimmäisen pilkkuun asti, jolloin viiden hankkeen rakennuttajaksi olisi
 * kirjoittunut henkilön nimi ja ELY-keskuksesta katkelma "Uudenmaan
 * elinkeino-".
 */
const field = (value: string) =>
  `<span class="yva_content__title">Hankkeesta vastaava:</span>${value}</div>`

describe("organisaation valinta mitatuista kentistä", () => {
  it("ottaa organisaation vaikka henkilö on ensin", () => {
    expect(
      yvaDeveloperFromHtml(field("Annemarie Kallström, Myrsky Energia Oy, puh. 050 360 1983"))
    ).toBe("Myrsky Energia Oy")

    expect(
      yvaDeveloperFromHtml(field("Niina Kotomäki, Erikoissijoitusrahasto UB Uusiutuva Energia, p. 040"))
    ).toBe("Erikoissijoitusrahasto UB Uusiutuva Energia")

    expect(
      yvaDeveloperFromHtml(field("Sisko Kotzschmar, Honkamaan Tuulivoima Oy, p. 044 759 5050"))
    ).toBe("Honkamaan Tuulivoima Oy")
  })

  it("säilyttää organisaation nimessä olevan pilkun", () => {
    expect(
      yvaDeveloperFromHtml(
        field("Uudenmaan elinkeino-, liikenne- ja ympäristökeskus, PL 36, 00521 Helsinki")
      )
    ).toBe("Uudenmaan elinkeino-, liikenne- ja ympäristökeskus")
  })

  it("tunnistaa julkiset toimijat ilman yhtiömuotoa", () => {
    expect(yvaDeveloperFromHtml(field("Metsähallitus, Johanna Hätälä, p. +358 445"))).toBe(
      "Metsähallitus"
    )
    expect(yvaDeveloperFromHtml(field("Väylävirasto , PL 33, 00521 Helsinki"))).toBe(
      "Väylävirasto"
    )
    expect(yvaDeveloperFromHtml(field("Fortum, Ville Uusimaa, Puh. 0400 800 815"))).toBe(
      "Fortum"
    )
  })

  it("katkaisee kahden yrityksen listan ensimmäiseen", () => {
    expect(
      yvaDeveloperFromHtml(field("Ilpo Wennström, Bull Team Oy ja WeKas Oy, p. 050 586 4248"))
    ).toBe("Bull Team Oy")
  })

  it("pelkkä henkilö ilman organisaatiota -> null", () => {
    expect(yvaDeveloperFromHtml(field("Matti Meikäläinen, p. 040 123 4567"))).toBeNull()
  })
})
