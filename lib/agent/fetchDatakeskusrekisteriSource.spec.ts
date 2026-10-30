import { describe, expect, it } from "vitest"

import {
  datakeskusEhdokas,
  datakeskusKuvaus,
  jasennaMuutosloki,
  jasennaSivukartta,
  kunnaksi,
  vaiheeksi,
} from "./fetchDatakeskusrekisteriSource"

/* Muutoslokin oma muoto, lyhennettyna (mitattu 30.10.2026). */
const MUUTOSLOKI = {
  muutokset: [
    {
      kentta: "it_teho_mw",
      hanke: { id: "c23d46c9-5b9e-40ca-a78e-9e2fb4deaf01", nimi: "Magnora Hämeenlinna, MORE", kunta: "Hämeenlinna", vaihe: "lupamenettely" },
    },
    /* Sama hanke toistuu lokissa monta kertaa -- vain yksi ehdokas. */
    {
      kentta: "teho_mw",
      hanke: { id: "c23d46c9-5b9e-40ca-a78e-9e2fb4deaf01", nimi: "Magnora Hämeenlinna, MORE", kunta: "Hämeenlinna", vaihe: "lupamenettely" },
    },
    {
      kentta: "vaihe",
      hanke: { id: "3f87b996-6082-495c-8bba-40e2b6678a35", nimi: "Elisa Tapiola Center", kunta: "Espoo", vaihe: "toiminnassa" },
    },
  ],
}

const KITEE = { id: "aaaaaaaa-0000-0000-0000-000000000001", nimi: "Scale42 Kitee, Puhos", kunta: "Kitee", vaihe: "rakenteilla" }

describe("jasennaMuutosloki", () => {
  it("palauttaa jokaisen hankkeen kerran", () => {
    const hankkeet = jasennaMuutosloki(MUUTOSLOKI)
    expect(hankkeet).toHaveLength(2)
    expect(hankkeet[0].nimi).toBe("Magnora Hämeenlinna, MORE")
  })

  it("kestaa tyhjan ja rikkinaisen", () => {
    expect(jasennaMuutosloki(null)).toEqual([])
    expect(jasennaMuutosloki({ muutokset: [{}, { hanke: { id: "x" } }] })).toEqual([])
  })
})

describe("jasennaSivukartta", () => {
  it("poimii hankkeiden uuid:t", () => {
    const xml =
      "<url><loc>https://www.datakeskusrekisteri.fi/kartta</loc></url>" +
      "<url><loc>https://www.datakeskusrekisteri.fi/hankkeet/3f87b996-6082-495c-8bba-40e2b6678a35</loc></url>"
    expect(jasennaSivukartta(xml)).toEqual(["3f87b996-6082-495c-8bba-40e2b6678a35"])
  })
})

describe("vaiheeksi", () => {
  it("kuvaa rekisterin vaiheet meidan vaiheiksi", () => {
    expect(vaiheeksi("kaavoitus")).toBe("Kaavoitus")
    expect(vaiheeksi("esiselvitys")).toBe("Suunnittelu")
    expect(vaiheeksi("lupamenettely")).toBe("Rakennuslupa")
    expect(vaiheeksi("rakenteilla")).toBe("Rakenteilla")
  })

  /* YVA on suunnittelua, ei lupaa -- sama linja kuin Fingridilla (D-303). */
  it("ohjaa YVA:n suunnitteluun", () => {
    expect(vaiheeksi("yva_vireilla")).toBe("Suunnittelu")
    expect(vaiheeksi("yva_paattynyt")).toBe("Suunnittelu")
  })

  /* Valmis konesali ei ole liidi eika peruttu hanke ole hanke. */
  it("hylkaa toiminnassa ja peruttu", () => {
    expect(vaiheeksi("toiminnassa")).toBeNull()
    expect(vaiheeksi("peruttu")).toBeNull()
    expect(vaiheeksi("tuntematon")).toBeNull()
    expect(vaiheeksi(null)).toBeNull()
  })
})

describe("kunnaksi", () => {
  it("tarkistaa nimen kuntarekisterista", () => {
    expect(kunnaksi("Kitee")).toBe("Kitee")
    expect(kunnaksi("Ei-mikaan-kunta")).toBeNull()
  })
})

describe("datakeskusEhdokas", () => {
  /*
   * Toimija EI mene developer-kenttaan: osumahaara kirjoittaisi sen
   * olemassa olevan paalle, ja rekisteri on koostaja (D-354).
   * Hyvaksyntareitti lukee metadata.developerin sarakkeeseen.
   */
  it("jattaa developer-kentan tyhjaksi mutta kirjaa toimijan metadataan", () => {
    const e = datakeskusEhdokas(KITEE, { toimija: { nimi: "Scale42" }, teho_mw: 200 })
    expect(e.developer).toBeNull()
    expect(e.metadata.developer).toBe("Scale42")
  })

  it("kirjaa tyypiksi Datakeskus ja vaiheen rekisterista", () => {
    const e = datakeskusEhdokas(KITEE, { toimija: { nimi: "Scale42" }, teho_mw: 200 })
    expect(e.property_type).toBe("Datakeskus")
    expect(e.phase).toBe("Rakenteilla")
    expect(e.phase_authoritative).toBe(true)
    expect(e.metadata.related_companies).toContain("Scale42")
  })

  /*
   * Kunta yksin ei kelpaa sijainniksi: `same_location` on tarkoitettu
   * katuosoitteen todisteeksi ja kaupunkitason arvo teki kahdesta eri
   * hankkeesta osuman.
   */
  it("jattaa sijainnin tyhjaksi, koska osoitetta ei ole", () => {
    expect(datakeskusEhdokas(KITEE, null).location).toBeNull()
  })

  it("toimii myos ilman taydennysta", () => {
    const e = datakeskusEhdokas(KITEE, null)
    expect(e.metadata.developer).toBeNull()
    expect(e.name).toBe("Scale42 Kitee, Puhos")
  })
})

describe("datakeskusKuvaus", () => {
  it("kertoo luvut vain kun ne ovat olemassa", () => {
    const kuvaus = datakeskusKuvaus(KITEE, { teho_mw: 200, pinta_ala_ha: 15 })
    expect(kuvaus).toContain("Teho 200 MW.")
    expect(kuvaus).toContain("Tontin pinta-ala 15 ha.")
    expect(kuvaus).not.toContain("IT-teho")
    expect(kuvaus).not.toContain("Kortteli")
  })

  /*
   * Suomen paikallissijat ja yhtiomuodon genetiivi eivat taivu
   * merkkijonoa liittamalla: ensimmainen versio kirjoitti
   * "Saarijarvilla", "Mikkelilla" ja "Oyn". Nimet perusmuodossa.
   */
  it("ei taivuta kunnan eika toimijan nimea", () => {
    const kuvaus = datakeskusKuvaus(
      { id: "x", nimi: "Eddu Energy Saarijärvi", kunta: "Saarijärvi", vaihe: "rakenteilla" },
      { toimija: { nimi: "Aurora Core Technology Oy" } }
    )
    expect(kuvaus).toContain("kunta Saarijärvi")
    expect(kuvaus).toContain("toimija Aurora Core Technology Oy")
    expect(kuvaus).not.toMatch(/Saarijärvilla|Saarijärvellä|Oyn/)
  })

  /* CC BY 4.0 vaatii maininnan, ja koostajan asema kerrotaan asiakkaalle. */
  it("sisaltaa lisenssimaininnan ja varauksen", () => {
    const kuvaus = datakeskusKuvaus(KITEE, null)
    expect(kuvaus).toContain("Datakeskushankkeiden kansallinen rekisteri")
    expect(kuvaus).toContain("CC BY 4.0")
    expect(kuvaus).toContain("tarkista alkuperäinen lähde")
  })
})
