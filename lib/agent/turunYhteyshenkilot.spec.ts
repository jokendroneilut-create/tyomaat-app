import { describe, it, expect } from "vitest"
import { turunYhteyshenkilot } from "./turunYhteyshenkilot"

/*
 * Tunnistetiedot ovat oikealta sivulta
 * (turku.fi/kaavoitus/kaharin-puistotie-2019-2019, 23.10.2026), jotta
 * kenttien nimet ja jarjestys ovat tarkistettavissa jos sivu muuttuu.
 */
const KAHARI = {
  Diaarinumero: "2019-2019",
  Kaavatunnus: "4/2019",
  "Kaavan tyyppi": "Asemakaava",
  "Hyväksyvä taho": "Valtuusto",
  Vastuuhenkilö: "Christiane Eskolin",
  "Vastuuhenkilön sähköposti": "christiane.eskolin@turku.fi",
  Piirtäjä: "Karin Kekkonen",
  "Piirtäjän sähköposti": "karin.kekkonen@turku.fi",
  Liikennesuunnittelija: "Harry Jaakkola",
  "Liikennesuunnittelijan sähköposti": "harry.jaakkola@turku.fi",
}

describe("turunYhteyshenkilot", () => {
  it("poimii kolme henkiloa rooleineen ja osoitteineen", () => {
    expect(turunYhteyshenkilot(KAHARI)).toEqual([
      {
        kind: "person",
        name: "Christiane Eskolin",
        title: "Vastuuhenkilö",
        email: "christiane.eskolin@turku.fi",
        phone: null,
        organization: "Turun kaupunki",
      },
      {
        kind: "person",
        name: "Karin Kekkonen",
        title: "Piirtäjä",
        email: "karin.kekkonen@turku.fi",
        phone: null,
        organization: "Turun kaupunki",
      },
      {
        kind: "person",
        name: "Harry Jaakkola",
        title: "Liikennesuunnittelija",
        email: "harry.jaakkola@turku.fi",
        phone: null,
        organization: "Turun kaupunki",
      },
    ])
  })

  /*
   * "Hyvaksyva taho: Valtuusto" ja "Kaavan tyyppi: Asemakaava" eivat ole
   * henkiloita. Aiemmin ne paatyivat nimikkeiksi, kun kentat liitettiin
   * kuvaustekstiin ja yleinen poimija luki ne.
   */
  it("ei ota tunnistetietoa henkiloksi", () => {
    const nimet = turunYhteyshenkilot(KAHARI).map((h) => h.name)
    expect(nimet).not.toContain("Valtuusto")
    expect(nimet).not.toContain("Asemakaava")
    expect(nimet).not.toContain("2019-2019")
  })

  /* Genetiivia ei mallinneta: pari luetaan jarjestyksesta. */
  it("lukee parin jarjestyksesta eika roolin taivutuksesta", () => {
    const h = turunYhteyshenkilot({
      Kaavoitusarkkitehti: "Matti Meikäläinen",
      "Kaavoitusarkkitehdin sähköposti": "matti.meikalainen@turku.fi",
    })
    expect(h).toHaveLength(1)
    expect(h[0].title).toBe("Kaavoitusarkkitehti")
    expect(h[0].email).toBe("matti.meikalainen@turku.fi")
  })

  it("jattaa osoitteen tyhjaksi kun sita ei ole", () => {
    const h = turunYhteyshenkilot({ Vastuuhenkilö: "Päivi Siponen", Kaavatunnus: "9/2020" })
    expect(h).toHaveLength(1)
    expect(h[0].name).toBe("Päivi Siponen")
    expect(h[0].email).toBeNull()
  })

  /* Nimen a-umlaut sailyy, toisin kuin tekstipoiminnassa. */
  it("sailyttaa aakkoset nimessa", () => {
    const h = turunYhteyshenkilot({
      Vastuuhenkilö: "Jani Eteläkoski",
      "Vastuuhenkilön sähköposti": "jani.etelakoski@turku.fi",
    })
    expect(h[0].name).toBe("Jani Eteläkoski")
  })

  it("kestaa tyhjan", () => {
    expect(turunYhteyshenkilot({})).toEqual([])
    expect(turunYhteyshenkilot(null)).toEqual([])
  })
})
