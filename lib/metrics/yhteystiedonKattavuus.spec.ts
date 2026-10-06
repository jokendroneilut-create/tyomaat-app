import { describe, expect, it } from "vitest"

import {
  kelpaaYhteyshenkiloksi,
  laskeKattavuus,
  onYhteyshenkilo,
} from "./yhteystiedonKattavuus"

describe("kelpaaYhteyshenkiloksi", () => {
  it("kelpuuttaa nimetyn henkilon sahkopostilla", () => {
    expect(kelpaaYhteyshenkiloksi({ name: "Mari Jaakonaho", email: "mari@example.fi" })).toBe(true)
  })

  it("kelpuuttaa nimetyn henkilon puhelimella", () => {
    expect(kelpaaYhteyshenkiloksi({ name: "Valtteri Tupala", phone: "044 740 1408" })).toBe(true)
  })

  /*
   * Mitattu 6.10.2026: tallaisia rivejä on aineistossa runsaasti, ja juuri
   * ne nostavat loysan mittarin 86 prosenttiin. Postilaatikolle ei soiteta.
   */
  it("ei kelpuuta nimetonta postilaatikkoa", () => {
    expect(kelpaaYhteyshenkiloksi({ name: null, email: "kaavoitus@vihti.fi" })).toBe(false)
  })

  it("ei kelpuuta nimea ilman yhteystapaa", () => {
    expect(kelpaaYhteyshenkiloksi({ name: "Matti Meikalainen" })).toBe(false)
  })

  /* Luvan ratkaissut rakennustarkastaja ei osta hankkeesta mitaan (D-207). */
  it("ei kelpuuta viranomaista", () => {
    expect(
      kelpaaYhteyshenkiloksi({ name: "Jaakko Pesonen", email: "jaakko@espoo.fi", role: "authority" })
    ).toBe(false)
  })

  it("sietaa tyhjan", () => {
    expect(kelpaaYhteyshenkiloksi(null)).toBe(false)
    expect(kelpaaYhteyshenkiloksi({})).toBe(false)
  })
})

describe("onYhteyshenkilo", () => {
  it("riittaa etta yksi kontakti kelpaa", () => {
    const metadata = {
      contact_persons: [
        { name: null, email: "kirjaamo@example.fi" },
        { name: "Aino Virtanen", phone: "0401234567" },
      ],
    }
    expect(onYhteyshenkilo(metadata)).toBe(true)
  })

  it("on epatosi kun kontakteja ei ole", () => {
    expect(onYhteyshenkilo({})).toBe(false)
    expect(onYhteyshenkilo(null)).toBe(false)
    expect(onYhteyshenkilo({ contact_persons: [] })).toBe(false)
  })
})

describe("laskeKattavuus", () => {
  const kelpo = { contact_persons: [{ name: "Aino Virtanen", email: "aino@example.fi" }] }

  /*
   * KAKSI KIRJOITUSASUA, YKSI VAIHE. Ilman normalisointia mittari
   * nayttaisi vain puolet rakentamisvaiheen hankkeista.
   */
  it("yhdistaa saman vaiheen kirjoitusasut", () => {
    const tulos = laskeKattavuus([
      { phase: "Rakenteilla", status: "active", is_public: true, metadata: kelpo },
      { phase: "Rakentaminen aloitettu", status: "active", is_public: true, metadata: {} },
      { phase: "Suunnittelussa", status: "active", is_public: true, metadata: kelpo },
      { phase: "Suunnittelu", status: "active", is_public: true, metadata: kelpo },
    ])

    const rakenteilla = tulos.find((t) => t.vaihe === "construction")!
    expect(rakenteilla.hankkeita).toBe(2)
    expect(rakenteilla.yhteystiedolla).toBe(1)
    expect(rakenteilla.osuus).toBe(0.5)

    const suunnittelu = tulos.find((t) => t.vaihe === "planning")!
    expect(suunnittelu.hankkeita).toBe(2)
    expect(suunnittelu.osuus).toBe(1)
  })

  /* Piilotetun hankkeen puuttuva yhteystieto ei ole puute. */
  it("jattaa piilotetut ja ei-aktiiviset pois", () => {
    const tulos = laskeKattavuus([
      { phase: "Rakenteilla", status: "active", is_public: false, metadata: {} },
      { phase: "Rakenteilla", status: "expired", is_public: true, metadata: {} },
      { phase: "Rakenteilla", status: "active", is_public: true, metadata: kelpo },
    ])
    const rakenteilla = tulos.find((t) => t.vaihe === "construction")!
    expect(rakenteilla.hankkeita).toBe(1)
    expect(rakenteilla.osuus).toBe(1)
  })

  it("ei jaa nollalla kun hankkeita ei ole", () => {
    const tulos = laskeKattavuus([])
    expect(tulos.every((t) => t.osuus === 0 && t.hankkeita === 0)).toBe(true)
  })
})
