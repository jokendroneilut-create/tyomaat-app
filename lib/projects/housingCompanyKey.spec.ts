import { describe, expect, it } from "vitest"

import { housingCompanyKey, normalizeHousingCompany } from "./housingCompanyKey"

describe("normalizeHousingCompany", () => {
  /* Sijamuoto ei saa erottaa samaa yhtiota. */
  it("yhdistaa sijamuodot", () => {
    const a = normalizeHousingCompany("Asunto Oy Oulun Valoisa")
    expect(normalizeHousingCompany("Asunto Oy Oulun Valoisan")).toBe(a)
    expect(normalizeHousingCompany("Asunto Oy Oulun Valoisaan")).toBe(a)
  })

  it("pudottaa yhtiomuodon ja kirjoitusasun", () => {
    expect(normalizeHousingCompany("As. Oy Nihdin Skyline")).toBe(
      normalizeHousingCompany("Asunto Oy Nihdin Skyline")
    )
  })

  /* Paikannimen genetiivi kuuluu nimeen, sita ei riisuta. */
  it("sailyttaa paikannimen genetiivin", () => {
    expect(normalizeHousingCompany("Asunto Oy Oulun Valoisa")).toContain("oulun")
  })

  it("erottaa eri yhtiot", () => {
    expect(normalizeHousingCompany("Asunto Oy Helsingin Pyy")).not.toBe(
      normalizeHousingCompany("Asunto Oy Helsingin Evia")
    )
  })
})

describe("housingCompanyKey", () => {
  it("lukee otsikosta", () => {
    expect(housingCompanyKey("As Oy Nihdin Skyline, Helsinki")).toBe("nihdin skylin")
  })

  /*
   * STT:n tiedote johtaa yleisella lauseella ja nimeaa taloyhtion
   * vasta toisessa virkkeessa. Yhden virkkeen rajaus hukkasi juuri sen
   * parin jonka takia avain tehtiin.
   */
  it("lukee yhtion toisesta virkkeesta", () => {
    const kuvaus =
      "Lapti on aloittanut rakentamisen Oulun Hiukkavaarassa. Asunto Oy Oulun Valoisaan valmistuu 29 asuntoa."
    expect(housingCompanyKey("Hiukkavaaran uudet rivitalokodit", kuvaus)).toBe("oulun valois")
  })

  /* Kolmas virke on jo liian kaukana: siella alkavat muut kohteet. */
  it("ei lue kolmatta virketta", () => {
    const kuvaus =
      "Hanke etenee. Rakentaminen jatkuu kesaan. Asunto Oy Kempeleen Loistetta rakennetaan myos."
    expect(housingCompanyKey("Palvelukeskus Ouluun", kuvaus)).toBeNull()
  })

  it("lukee yhtion kun se on ensimmaisessa virkkeessa", () => {
    const kuvaus = "Asunto Oy Oulun Valoisaan valmistuu 29 asuntoa loppuvuodesta 2026."
    expect(housingCompanyKey("Hiukkavaaran uudet rivitalokodit", kuvaus)).toBe("oulun valois")
  })

  /*
   * TAMA ON SE ANSA JOTA VASTAAN RAJAUS ON OLEMASSA.
   *
   * Tiedotteet luettelevat LOPUSSA yrityksen muita kohteita. Koko
   * kuvauksesta poimittuna vaaria pareja oli 472; kahden virkkeen
   * ikkuna pudotti ne kahteen.
   *
   * JAANNOSRISKI ON TIEDOSSA: jos toinen kohde mainitaan jo toisessa
   * virkkeessa, se poimitaan. Mittaus osoitti sen harvinaiseksi, ja
   * ehdotuslistassa vaara pari maksaa yhden silmayksen.
   */
  it("ei poimi tiedotteen lopun muita kohteita", () => {
    const kuvaus =
      "Palvelukeskus valmistuu Oulun Kynsilehtoon. Rakentaminen alkoi keväällä. " +
      "Lapti rakentaa myös Asunto Oy Kempeleen Loistetta."
    expect(housingCompanyKey("Palvelukeskus Oulun Kynsilehtoon", kuvaus)).toBeNull()
  })

  it("palauttaa nullin kun yhtiota ei ole", () => {
    expect(housingCompanyKey("Kerrostalo Hiukkavaaraan", "Rakentaminen alkoi.")).toBeNull()
    expect(housingCompanyKey(null, null)).toBeNull()
    expect(housingCompanyKey("", "")).toBeNull()
  })

  /* Pelkka paikannimi ilman erottavaa osaa osuisi kaikkiin. */
  it("hylkaa liian lyhyen avaimen", () => {
    expect(housingCompanyKey("Asunto Oy Oulun")).toBeNull()
  })

  it("sama hanke kahdesta lahteesta antaa saman avaimen", () => {
    const lapti = housingCompanyKey(
      "Hiukkavaaran uudet rivitalokodit",
      "Asunto Oy Oulun Valoisan rivitalokodit valmistuvat marraskuussa."
    )
    const stt = housingCompanyKey(
      "Lapti aloittanut uuden RS-kohteen rakentamisen Oulun Hiukkavaarassa",
      "Asunto Oy Oulun Valoisaan valmistuu 29 asuntoa."
    )
    expect(lapti).toBe(stt)
    expect(lapti).toBe("oulun valois")
  })
})
