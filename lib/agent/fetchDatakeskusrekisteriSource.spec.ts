import { describe, expect, it } from "vitest"

import {
  datakeskusEhdokas,
  datakeskusKonsultit,
  datakeskusKuvaus,
  datakeskusLiittyvat,
  datakeskusPaatokset,
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

/* Mitattu rekisterin vastauksesta 31.10.2026. */
const ORGANISAATIOT = [
  {
    rooli: "yva_konsultti",
    rooli_meta: { nimi: "YVA-konsultti" },
    organisaatio: { nimi: "Ramboll" },
    lahde_url: "https://www.ymparisto.fi/sites/default/files/x.pdf",
    lahde_kohta: "s. 1",
  },
  {
    rooli: "kaavan_laatija",
    rooli_meta: { nimi: "Kaavan laatija" },
    organisaatio: { nimi: "Sweco Finland Oy" },
  },
  { rooli: "hankeyhtio", organisaatio: { nimi: "Pikku-Muolaan Kehitys Oy" } },
  /* Valvova viranomainen ei ole hankkeen tekija. */
  { rooli: "yhteysviranomainen", organisaatio: { nimi: "Lupa- ja valvontavirasto" } },
  /* Rooli tuntematon: sille ei saa keksia sellaista. */
  { rooli: "muu", organisaatio: { nimi: "Joku Oy" } },
]

describe("datakeskusKonsultit", () => {
  it("poimii konsultit rooleineen", () => {
    const k = datakeskusKonsultit({ organisaatiot: ORGANISAATIOT } as any)
    expect(k).toEqual([
      { name: "Ramboll", role: "YVA-konsultti" },
      { name: "Sweco Finland Oy", role: "Kaavan laatija" },
    ])
  })

  it("jattaa pois viranomaisen ja tuntemattoman roolin", () => {
    const nimet = datakeskusKonsultit({ organisaatiot: ORGANISAATIOT } as any).map((x) => x.name)
    expect(nimet).not.toContain("Lupa- ja valvontavirasto")
    expect(nimet).not.toContain("Joku Oy")
  })

  it("kayttaa rekisterin omaa roolinimea kun se on", () => {
    const k = datakeskusKonsultit({
      organisaatiot: [
        { rooli: "kaavan_laatija", rooli_meta: { nimi: "Kaavan laatija (konsultti)" }, organisaatio: { nimi: "X Oy" } },
      ],
    } as any)
    expect(k[0].role).toBe("Kaavan laatija (konsultti)")
  })

  it("ei toista samaa nimea ja roolia", () => {
    const kahdesti = [ORGANISAATIOT[0], { ...ORGANISAATIOT[0] }]
    expect(datakeskusKonsultit({ organisaatiot: kahdesti } as any)).toHaveLength(1)
  })

  it("kestaa tyhjan", () => {
    expect(datakeskusKonsultit(null)).toEqual([])
    expect(datakeskusKonsultit({} as any)).toEqual([])
  })
})

describe("datakeskusLiittyvat", () => {
  it("poimii hankeyhtion muttei konsulttia eika viranomaista", () => {
    const l = datakeskusLiittyvat({ organisaatiot: ORGANISAATIOT } as any)
    expect(l).toEqual(["Pikku-Muolaan Kehitys Oy"])
  })
})

describe("datakeskusPaatokset", () => {
  const PAATOKSET = [
    { pvm: "2026-05-02", kuvaus: "Vanhempi paatos." },
    { pvm: "2026-08-07", kuvaus: "Uusin paatos." },
    { pvm: "2026-07-01", kuvaus: "Keskimmainen." },
    { pvm: "2026-01-01", kuvaus: "Neljas jaa pois." },
    { pvm: "2026-09-09", kuvaus: "   " },
  ]

  it("jarjestaa tuoreimman ensin ja rajaa kolmeen", () => {
    const r = datakeskusPaatokset({ paatokset: PAATOKSET } as any)
    expect(r).toHaveLength(3)
    expect(r[0]).toBe("7.8.2026: Uusin paatos.")
    expect(r.join(" ")).not.toContain("Neljas")
  })

  it("jattaa tyhjan kuvauksen pois", () => {
    expect(datakeskusPaatokset({ paatokset: PAATOKSET } as any).join(" ")).not.toMatch(/\s{3}/)
  })

  /* Paiva kirjoitetaan suomeksi, ei ISO-muodossa. */
  it("muotoilee paivan suomeksi", () => {
    expect(datakeskusPaatokset({ paatokset: [{ pvm: "2026-08-07", kuvaus: "X." }] } as any)[0]).toBe("7.8.2026: X.")
  })

  /* Moni paatos aloittaa omalla paivallaan; etuliite toisti sen. */
  it("ei toista paivaa jonka teksti kertoo itse", () => {
    const r = datakeskusPaatokset({
      paatokset: [{ pvm: "2026-08-07", kuvaus: "Virasto antoi 7.8.2026 lausunnon." }],
    } as any)
    expect(r[0]).toBe("Virasto antoi 7.8.2026 lausunnon.")
    expect(r[0]).not.toMatch(/7\.8\.2026.*7\.8\.2026/)
  })

  it("kelpuuttaa kuvauksen ilman paivaa", () => {
    expect(datakeskusPaatokset({ paatokset: [{ pvm: null, kuvaus: "X." }] } as any)[0]).toBe("X.")
  })
})
