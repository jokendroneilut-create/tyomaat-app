import { describe, expect, it } from "vitest"

import { housingCompanyName, housingCompanyKey, normalizeHousingCompany } from "./housingCompanyKey"

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
/*
 * Kaksi mitattua vikaa 6.9.2026. Kumpikaan ei saa palata: molemmat
 * naytttivat toimivalta mutta tuottivat vaaria pareja.
 */
describe("korjatut viat", () => {
  it("karsii sanan kiinteisto vaikka siina on skandimerkki", () => {
    /*
     * `\b` ei tunnista o-umlauttia sananmerkiksi, joten vanha kuvio
     * jatti sanan paikalleen ja avaimeksi tuli "kiinteisto turun lyse".
     * Kaupungin kiinteistoyhtio omistaa satoja rakennuksia, joten avain
     * yhdisti Turun Lyseon ja Luolavuoren koulun.
     */
    expect(housingCompanyKey("Kiinteistö Oy Turun Lyseo", null)).toBe("turun lyse")
    expect(housingCompanyKey("Kiinteistö Oy Turun Kaupunkitilat", null)).toBe("turun kaupunkitilat")
  })

  it("tunnistaa Koy-alkuisen nimen ilman erillista Oy:ta", () => {
    expect(housingCompanyKey("Koy Tampereen Hymni", null)).toBe("tampereen hymn")
  })

  it("ei yksiloi pelkalla paikannimella", () => {
    expect(housingCompanyKey("Asunto Oy Oulun", null)).toBeNull()
  })
})

describe("housingCompanyName", () => {
  it("palauttaa nimen sellaisenaan naytettavaksi", () => {
    expect(housingCompanyName("Asunto Oy Oulun Valoisa valmistuu", null)).toBe(
      "Asunto Oy Oulun Valoisa"
    )
    expect(
      housingCompanyName("Lapti aloitti kohteen.", "Asunto Oy Oulun Valoisaan valmistuu 29 asuntoa.")
    ).toBe("Asunto Oy Oulun Valoisaan")
  })

  /*
   * Lahteissa nimen perassa ei ole pistetta, joten seuraavan virkkeen
   * tai kentan ensimmainen sana on kuviolle nimen jatko. Mitattu
   * 6.9.2026: 30 luetusta rivista kaikilla oli sama vika.
   */
  it("katkaisee nimen kun edellinen sana ei ole genetiivi", () => {
    expect(housingCompanyName("Asunto Oy Espoon Luhtavehka SRV aloittaa", null)).toBe(
      "Asunto Oy Espoon Luhtavehka"
    )
    expect(housingCompanyName("As Oy Helsingin Kruunuvouti Vastaava tyonjohtaja", null)).toBe(
      "As Oy Helsingin Kruunuvouti"
    )
    expect(housingCompanyName("Asunto Oy Tampereen Okra Bonava kaynnisti", null)).toBe(
      "Asunto Oy Tampereen Okra"
    )
  })

  /* Genetiivimaareet kuuluvat nimeen: "Turun Kirstinpuiston Solina". */
  it("sailyttaa moniosaisen nimen genetiivimaareet", () => {
    expect(housingCompanyName("Asunto Oy Turun Kirstinpuiston Solina 13", null)).toBe(
      "Asunto Oy Turun Kirstinpuiston Solina"
    )
    expect(housingCompanyName("Asunto Oy Espoon Hannusrannan Aurea Pohjola Rakennus", null)).toBe(
      "Asunto Oy Espoon Hannusrannan Aurea"
    )
  })

  /* Paasana ottaa peraansa nimen: "Villa Stenius", "Kauppakeskus Sello". */
  it("jatkaa nimea paasanan jalkeen", () => {
    expect(housingCompanyName("Kerrostalo Etela-Haagaan As Oy Helsingin Villa Stenius Kylatie 3A", null)).toBe(
      "As Oy Helsingin Villa Stenius"
    )
  })

  /*
   * Tiedote voi kertoa kahdesta kohteesta. Otsikko ratkaisee kumpi
   * yhtio on tama hanke (mitattu 6.9.2026: Nihdin Skyline ja Horizon).
   */
  it("valitsee otsikon mukaisen yhtion kun tiedotteessa on kaksi", () => {
    const kuvaus =
      "Hausia Oy kaynnistaa Nihdissa kaksi kohdetta: Asunto Oy Nihdin Skylinen rakentaminen alkaa huhtikuussa ja As Oy Nihdin Horizonin elokuussa 2026."
    expect(housingCompanyName("Kerrostalo Nihdin Horizon", kuvaus)).toBe("As Oy Nihdin Horizonin")
    expect(housingCompanyName("Kerrostalo Nihdin Skyline", kuvaus)).toBe("Asunto Oy Nihdin Skylinen")
  })

  /* Kumpikaan ei ole otsikossa: tyhja on parempi kuin vaara yhtio. */
  it("jattaa tyhjaksi kun kahdesta ei voi valita", () => {
    expect(
      housingCompanyName(
        "Kaksi kerrostaloa Nihtiin",
        "Asunto Oy Nihdin Skylinen rakentaminen alkaa ja As Oy Nihdin Horizonin elokuussa."
      )
    ).toBeNull()
  })

  /* Sama kynnys kuin avaimella, jottei nayttoon jaa nimea jota ei tasmayteta. */
  it("noudattaa samaa kynnysta kuin avain", () => {
    expect(housingCompanyName("Asunto Oy Oulun", null)).toBeNull()
    expect(housingCompanyName("Ei yhtiota tassa", null)).toBeNull()
  })
})
