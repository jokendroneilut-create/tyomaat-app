import { describe, expect, it } from "vitest"
import {
  jasennaVihtiYhteystiedot,
  kaavanValmistelija,
  valmistelijaYhteyshenkiloksi,
  vihtiLaatikonYhteyshenkilot,
} from "./vihtiKaavaYhteys"

/* Lyhennetty Vihdin kaavoituksen yhteystietosivusta 18.8.2026. */
const SIVU = `<p>Sähköpostit ovat muotoa etunimi.sukunimi@vihti.fi</p>
<p><em><span style="color: #000000">Kaav</span>asuunnittelija, asemakaavoitus</em><br><strong>Janne Oittinen</strong><br><span style="color:#999"><span>p. </span></span>040 670 2093<br><br><em><span style="color: #000000"><span>Kaav</span></span>asuunnittelija, asemakaavoitus</em><br><strong>Tarja Johansson</strong><br><span style="color: #999999"><span style="color: #000000">p. </span></span>050 302 4695</p>`

describe("kaavanValmistelija (D-428)", () => {
  it("lukee nimen yhteystietolaatikosta", () => {
    expect(
      kaavanValmistelija(
        "Kaavatiedustelut: kaavoitus(ät)vihti.fi Kaavan valmistelija: Tarja Johansson Kaavasuunnittelijat tavoittaa parhaiten sähköpostilla."
      )
    ).toBe("Tarja Johansson")
    expect(kaavanValmistelija("Kaavan laatija: Janne Oittinen")).toBe("Janne Oittinen")
    expect(kaavanValmistelija("Kaavatiedustelut: kaavoitus(ät)vihti.fi")).toBeNull()
  })
})

describe("jasennaVihtiYhteystiedot", () => {
  it("lukee nimikkeen ja puhelimen, sähköpostin sivun ilmoittamassa muodossa", () => {
    const h = jasennaVihtiYhteystiedot(SIVU)
    expect(h.get("tarja johansson")).toEqual({
      nimike: "Kaavasuunnittelija, asemakaavoitus",
      puhelin: "050 302 4695",
      sahkoposti: "tarja.johansson@vihti.fi",
    })
    expect(h.get("janne oittinen")?.puhelin).toBe("040 670 2093")
  })

  it("ei muodosta sähköpostia jos sivu ei ilmoita muotoa", () => {
    const h = jasennaVihtiYhteystiedot(SIVU.replace("Sähköpostit ovat muotoa etunimi.sukunimi@vihti.fi", ""))
    expect(h.get("tarja johansson")?.sahkoposti).toBeNull()
  })

  it("lukee roolikappaleet (N163b)", () => {
    const laatikko = `<div class="s-content-box__content"><p class="wp-block-paragraph"><strong>Asemakaavan laatiminen</strong><br>Tarja Johansson<br><em>kaavasuunnittelija</em><br>puh. 050 302 4695</p> <p class="wp-block-paragraph"><strong>Liikennesuunnittelu</strong><br>Tu Nguyen<br><em>liikenneinsinööri</em><br>p. 040 669 2074</p></div>`
    const h = vihtiLaatikonYhteyshenkilot(laatikko, jasennaVihtiYhteystiedot(SIVU))
    expect(h.map((c) => [c.name, c.title, c.phone, c.email])).toEqual([
      ["Tarja Johansson", "Asemakaavan laatiminen (kaavasuunnittelija)", "050 302 4695", "tarja.johansson@vihti.fi"],
      ["Tu Nguyen", "Liikennesuunnittelu (liikenneinsinööri)", "040 669 2074", null],
    ])
  })

  it("muoto 1: valmistelija nimellä, numero yhteystietosivulta", () => {
    const laatikko = `<p>Kaavatiedustelut: kaavoitus(ät)vihti.fi</p><p><strong>Kaavan valmistelija:</strong><br>Tarja Johansson</p><p>Kaavasuunnittelijat tavoittaa parhaiten sähköpostilla.</p>`
    expect(vihtiLaatikonYhteyshenkilot(laatikko, jasennaVihtiYhteystiedot(SIVU))).toEqual([
      expect.objectContaining({ name: "Tarja Johansson", phone: "050 302 4695", email: "tarja.johansson@vihti.fi" }),
    ])
  })

  it("tuntematon valmistelija tulee nimellä ilman numeroa", () => {
    expect(valmistelijaYhteyshenkiloksi("Uusi Henkilö", new Map())).toMatchObject({
      name: "Uusi Henkilö",
      title: "Kaavan valmistelija",
      phone: null,
      email: null,
    })
  })
})
