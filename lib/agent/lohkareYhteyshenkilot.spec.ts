import { describe, it, expect } from "vitest"
import { lohkareenYhteyshenkilot, korjaaKatkennutDomain } from "./lohkareYhteyshenkilot"

/* Kappaleet S2-laiturin tiedotteesta 21.10.2026, sellaisenaan. */
const KAPPALEET = [
  "Lohkare Infra -konserniin kuuluva Oteran Oy ja Turun Satama ovat allekirjoittaneet sopimuksen Ferry Terminal Turku (FTT) -hankkeen S2-laituriurakasta.",
  "S2-laiturin on määrä valmistua vuonna 2028.",
  "Lisätiedot :",
  "Turun Satama Oy",
  "Minna Pirkkanen, Toimitusjohtaja",
  "Puh. 050 5533 100",
  "minna.pirkkanen@portofturku.fi",
  "Markku Alahäme, Tekninen johtaja",
  "Puh. 050 5533 109",
  "markku.alahame@portofturku.fi",
  "Oteran Oy",
  "Jukka Seeslinna, Toimitusjohtaja",
  "puh. 040 069 4497",
  "jukka.seeslinna@oteran.fi",
  "Timo Luukkonen, Työpäällikkö",
  "puh. 040 596 0331",
  "timo.luukkonen@oteran.f",
  "Oteran Oy on kotimainen infran rakentaja, joka kuuluu Lohkare Infra Groupiin. Oteran toteuttaa vaativia infrarakentamisen hankkeita eri puolilla Suomea.",
]

describe("lohkareenYhteyshenkilot", () => {
  const henkilot = lohkareenYhteyshenkilot(KAPPALEET)

  it("lukee kaikki neljä yhteyshenkilöä", () => {
    expect(henkilot).toHaveLength(4)
    expect(henkilot.map((h) => h.name)).toEqual([
      "Minna Pirkkanen",
      "Markku Alahäme",
      "Jukka Seeslinna",
      "Timo Luukkonen",
    ])
  })

  it("liittää jokaisen oikeaan organisaatioon", () => {
    expect(henkilot[0].organization).toBe("Turun Satama Oy")
    expect(henkilot[1].organization).toBe("Turun Satama Oy")
    expect(henkilot[2].organization).toBe("Oteran Oy")
    expect(henkilot[3].organization).toBe("Oteran Oy")
  })

  it("lukee nimikkeen, puhelimen ja sähköpostin", () => {
    expect(henkilot[3].title).toBe("Työpäällikkö")
    expect(henkilot[3].phone).toBe("040 596 0331")
  })

  it("korjaa katkenneen verkkotunnuksen saman lohkon todisteella", () => {
    /* Lähteessä lukee "@oteran.f"; sama lohko antaa "@oteran.fi". */
    expect(henkilot[3].email).toBe("timo.luukkonen@oteran.fi")
  })

  it("ei ota yrityksen esittelytekstiä mukaan", () => {
    expect(henkilot.some((h) => h.name.includes("kotimainen"))).toBe(false)
  })

  it("palauttaa tyhjän kun lohkoa ei ole", () => {
    expect(lohkareenYhteyshenkilot(["Pelkkä tiedote ilman yhteystietoja."])).toEqual([])
  })

  it("ei pudota henkilöä jolta puuttuu sähköposti mutta on puhelin", () => {
    const vain = lohkareenYhteyshenkilot([
      "Lisätiedot:",
      "Maalinja Oy",
      "Matti Meikäläinen, Työpäällikkö",
      "puh. 040 123 4567",
    ])
    expect(vain).toHaveLength(1)
    expect(vain[0].email).toBeNull()
    expect(vain[0].phone).toBe("040 123 4567")
  })
})

describe("korjaaKatkennutDomain", () => {
  it("täydentää vain kun pidempi tunnus on samassa lohkossa", () => {
    const k = korjaaKatkennutDomain(["a@oteran.f", "b@oteran.fi"])
    expect(k.get("a@oteran.f")).toBe("a@oteran.fi")
  })

  it("ei keksi tunnusta ilman todistetta", () => {
    expect(korjaaKatkennutDomain(["a@oteran.f"]).size).toBe(0)
    expect(korjaaKatkennutDomain(["a@oteran.f", "b@muuyritys.fi"]).size).toBe(0)
  })

  it("jättää kelvolliset rauhaan", () => {
    expect(korjaaKatkennutDomain(["a@oteran.fi", "b@oteran.fi"]).size).toBe(0)
  })
})
