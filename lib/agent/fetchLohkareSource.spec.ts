import { describe, it, expect } from "vitest"
import {
  onSuomeksi,
  onHankejuttu,
  hankkeenNimi,
  tekijaYritys,
  tilaaja,
  lohkareenVaihe,
  jasennaKappaleet,
  lohkareEhdokas,
  type LohkareJuttu,
} from "./fetchLohkareSource"

/*
 * LOHKARE INFRA (D-341). Otsikot ovat kaikki 12 suomenkielista juttua
 * 24.10.2026, ja hanke-esimerkki on S2-laiturin tiedote.
 */
const OTSIKOT = [
  "Lohkare Infraan kuuluva Oteran toteuttaa Turun sataman mittavan S2-laituriurakan",
  "VM Suomalainen vahvistaa johtamistaan – Teemu Lantto uudeksi toimitusjohtajaksi, Santtu Kajahde tekniseksi johtajaksi",
  "Nordic Electro Power vahvistaa Lohkare Infran energiaosaamista",
  "Ylöjärven Kiviset liittyy osaksi Lohkare Infraa",
  "Oulun Lämpöputkitus liittyy Lohkare Infraan",
  "Infra Kiri liittyy Lohkare Infraan – vahvistaa osaamista infrarakentamisessa Pirkanmaalla",
  "Länsi-Suomen Verkkopalvelut liittyy osaksi Lohkare Infra -konsernia",
  "Lauri Utriainen Maalinja Oy:n toimitusjohtajaksi",
  "Janika Vilkman on nimitetty Lohkare Infra -konsernin yrityskauppa-, lakiasiain- ja vastuullisuusjohtajaksi",
  "Maalinja Oy ja EPR-Asennus Oy liittyvät Lohkare Infraan",
  "Jussi Niemelä Lohkare Infra Oy:n toimitusjohtajaksi",
  "Suomeen syntyy uusi infrarakentaja: Lohkare Infra Oy nousee suoraan alansa suurimpien joukkoon",
]

const HTML = `
<p>Lohkare Infra -konserniin kuuluva Oteran Oy ja Turun Satama ovat allekirjoittaneet sopimuksen Ferry Terminal Turku (FTT) -hankkeen S2-laituriurakasta. Syys&#8211;lokakuun vaihteessa k&auml;ynnistynyt urakka on merkitt&auml;v&auml; osa Turun matkustajasataman uudistamista.</p>
<p>Oteran toimii p&auml;&auml;urakoitsijana Fregatti-terminaalin toisen laiturin (S2) uudistamisessa.</p>
<p>S2-laiturin on m&auml;&auml;r&auml; valmistua vuonna 2028.</p>
<p>Lis&auml;tiedot :</p>
<p>Turun Satama Oy</p>
<p>Minna Pirkkanen, Toimitusjohtaja</p>
<p>Puh. 050 5533 100</p>
<p>minna.pirkkanen@portofturku.fi</p>
<p>Oteran Oy</p>
<p>Jukka Seeslinna, Toimitusjohtaja</p>
<p>puh. 040 069 4497</p>
<p>jukka.seeslinna@oteran.fi</p>
<p>Timo Luukkonen, Ty&ouml;p&auml;&auml;llikk&ouml;</p>
<p>puh. 040 596 0331</p>
<p>timo.luukkonen@oteran.f</p>
`

const JUTTU: LohkareJuttu = {
  id: 598,
  otsikko: OTSIKOT[0],
  osoite: "https://lohkare.fi/lohkare-infraan-kuuluva-oteran-toteuttaa-turun-sataman-mittavan-s2-laituriurakan/",
  pvm: new Date("2026-10-21T06:00:00Z"),
  kappaleet: jasennaKappaleet(HTML),
}

describe("kielen erottelu", () => {
  it("pudottaa englanninkielisen rinnakkaisjulkaisun", () => {
    expect(onSuomeksi("https://lohkare.fi/en/oteran-part-of-lohkare-infra/")).toBe(false)
    expect(onSuomeksi(JUTTU.osoite)).toBe(true)
  })
})

describe("hankesuodatus", () => {
  it("päästää läpi vain hankejutun", () => {
    const lapi = OTSIKOT.filter(onHankejuttu)
    expect(lapi).toEqual([OTSIKOT[0]])
  })

  it("pudottaa yritysoston vaikka otsikossa olisi hankesana", () => {
    expect(onHankejuttu("Infra Kiri liittyy Lohkare Infraan – toteuttaa urakoita Pirkanmaalla")).toBe(
      false
    )
  })
})

describe("kenttien poiminta", () => {
  it("pudottaa konsernin otsikon alusta", () => {
    expect(hankkeenNimi(OTSIKOT[0])).toBe(
      "Oteran toteuttaa Turun sataman mittavan S2-laituriurakan"
    )
  })

  it("tunnistaa tekijäksi jäsenyrityksen, ei konsernia", () => {
    expect(tekijaYritys(OTSIKOT[0])).toBe("Oteran Oy")
    expect(tekijaYritys("Lohkare Infra tiedottaa")).toBeNull()
  })

  it("lukee tilaajan sopimuslauseesta", () => {
    const teksti = jasennaKappaleet(HTML).join(" ")
    expect(tilaaja(teksti, "Oteran Oy")).toBe("Turun Satama")
  })

  it("lukee vaiheen tekstistä", () => {
    expect(lohkareenVaihe("Syys–lokakuun vaihteessa käynnistynyt urakka")).toBe("Rakenteilla")
    expect(lohkareenVaihe("Sopimus on allekirjoitettu.")).toBe("Sopimus myönnetty")
  })
})

describe("lohkareEhdokas", () => {
  const e = lohkareEhdokas(JUTTU)

  it("täyttää hankkeen kentät", () => {
    expect(e.city).toBe("Turku")
    expect(e.builder).toBe("Oteran Oy")
    expect(e.phase).toBe("Rakenteilla")
    expect(e.estimated_completion).toBe("2028-12-31")
    expect(e.source_name).toBe("lohkare")
  })

  it("täydentää tilaajan nimen yhteystietolohkosta", () => {
    /* Leipätekstissä "Turun Satama", yhteystiedoissa "Turun Satama Oy". */
    expect(e.developer).toBe("Turun Satama Oy")
  })

  it("jättää yhteystietolohkon pois kuvauksesta", () => {
    expect(e.description).toContain("S2-laituriurakasta")
    expect(e.description).not.toContain("Lisätiedot")
    expect(e.description).not.toContain("@portofturku.fi")
  })

  it("poimii yhteyshenkilöt rakenteisina", () => {
    const henkilot = (e.metadata as any).contact_persons
    expect(henkilot).toHaveLength(3)
    /* Katkennut "@oteran.f" korjataan samassa lohkossa olevalla todisteella. */
    expect(henkilot[2]).toMatchObject({
      name: "Timo Luukkonen",
      title: "Työpäällikkö",
      organization: "Oteran Oy",
      phone: "040 596 0331",
      email: "timo.luukkonen@oteran.fi",
    })
  })

  it("merkitsee konsernin liittyväksi yritykseksi", () => {
    expect((e.metadata as any).related_companies).toContain("Lohkare Infra Oy")
    expect((e.metadata as any).related_companies).toContain("Oteran Oy")
  })
})
