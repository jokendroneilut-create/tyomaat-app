import { describe, it, expect } from "vitest"
import { extractContacts } from "./contacts"
import { merkitseRoolit, paatteleRooli } from "./contactRole"

/* Poiminta + merkinta yhdessa, kuten tuotannossa. */
function rooleiksi(teksti: string) {
  return merkitseRoolit(extractContacts(teksti), teksti)
}

describe("paatteleRooli – viranomainen", () => {
  it("merkitsee luvan ratkaisijan viranomaiseksi", () => {
    const c = rooleiksi(
      "Paatoksen teki rakennustarkastaja Matti Virtanen, matti.virtanen@vantaa.fi"
    )
    expect(c[0].role).toBe("authority")
  })

  it("merkitsee muutoksenhakuohjeen oikeusasteen viranomaiseksi", () => {
    /* Kunnan paatoksen lopussa oleva markkinaoikeuden osoite. */
    expect(
      paatteleRooli({
        name: "Radanrakentajantie Helsinki",
        title: null,
        organization: "oikeus",
        email: "markkinaoikeus@oikeus.fi",
        phone: "029 56 43314",
        kind: "person",
      })
    ).toBe("authority")
  })

  it("EI merkitse kunnan investointipaatoksen valmistelijaa viranomaiseksi", () => {
    /*
     * Kaupunki on itse rakennuttaja, joten valmistellut liikuntajohtaja
     * on hankkeen paras yhteyshenkilo - ei viranomainen jota vastaan
     * hanke tehdaan.
     */
    const c = rooleiksi(
      "Valmistelija Pekka Hamalainen, liikuntajohtaja, pekka.hamalainen@rovaniemi.fi"
    )
    expect(c[0].name).toBe("Pekka Hamalainen")
    expect(c[0].role).toBeUndefined()
  })
})

describe("paatteleRooli – viestintahenkilo", () => {
  it("merkitsee viestintapaallikon", () => {
    const c = rooleiksi(
      "Yhteyshenkilot Hanna-Kaisa Talvensaari viestinta- ja markkinointipaallikko Puh: 040 758 1572 hanna.talvensaari@hel.fi"
    )
    expect(c[0].role).toBe("media")
  })

  it("EI merkitse samassa lohkossa olevaa vastuuhenkiloa", () => {
    /*
     * SRV:n Suutarila: "Lisatiedot"-lohkossa on seka projektipaallikko
     * etta viestinnan asiantuntija. Osioon perustuva saanto olisi
     * pudottanut molemmat.
     */
    const c = rooleiksi(
      "Lisatiedot: Mika Karell, projektipaallikko, SRV, puh. 040 480 8781, mika.karell@srv.fi " +
        "Tii Salmela, viestinnan asiantuntija, SRV, p. 050 302 2507, tii.salmela@srv.fi"
    )
    const karell = c.find((x) => x.name === "Mika Karell")
    const salmela = c.find((x) => x.name === "Tii Salmela")
    expect(karell?.role).toBeUndefined()
    expect(salmela?.role).toBe("media")
  })
})

describe("merkitseRoolit", () => {
  it("ei pudota ketaan", () => {
    const teksti =
      "Lisatiedot: Jani Kuivamaki, johtaja, SRV, puh. 050 535 9122, jani.kuivamaki@srv.fi " +
      "Tii Salmela, viestinnan asiantuntija, SRV, p. 050 302 2507, tii.salmela@srv.fi"
    expect(rooleiksi(teksti)).toHaveLength(extractContacts(teksti).length)
  })

  it("lahteen oma rooli voittaa paatellyn", () => {
    const tulos = merkitseRoolit([
      {
        name: "Liisa Lupa",
        title: "viestintapaallikko",
        organization: null,
        email: "liisa@example.fi",
        phone: null,
        kind: "person",
        role: "winner",
      },
    ])
    expect(tulos[0].role).toBe("winner")
  })

  it("jattaa tavallisen yhteyshenkilon roolittomaksi", () => {
    const c = rooleiksi(
      "Yhteyshenkilot Mervi Takala tulosaluejohtaja Kymenlaakson hyvinvointialue Puh: 040 0677 570 mervi.takala@kymenhva.fi"
    )
    expect(c[0].name).toBe("Mervi Takala")
    expect(c[0].role).toBeUndefined()
  })
})
