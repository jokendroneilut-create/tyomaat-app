import { describe, it, expect } from "vitest"
import {
  getMunicipalityByPlaceName,
  getMunicipalityByAnyForm,
  municipalityFromGenitive,
  municipalityFromBuyerName,
  isCityCorroboratedByText,
  isSinglePropertyCompany,
  PLACE_ALIASES,
} from "./municipalityFromName"
import { getMunicipalityByName } from "./municipalities"

describe("PLACE_ALIASES", () => {
  /*
   * Alias ratkaistaan kuntarekisteriä vasten, joten kirjoitusvirhe kohteessa
   * palauttaisi hiljaa tyhjän eikä mikään kaatuisi. Siksi jokainen kohde
   * tarkistetaan erikseen.
   */
  it("jokainen alias osoittaa olemassa olevaan kuntaan", () => {
    const rikki = Object.entries(PLACE_ALIASES).filter(
      ([, target]) => !getMunicipalityByName(target)
    )
    expect(rikki).toEqual([])
  })

  /*
   * Suora rekisterihaku tehdään ensin, joten kuntanimeä vastaava alias olisi
   * kuollutta koodia — ja merkki siitä että jotain on ymmärretty väärin.
   */
  it("yksikään alias ei ole jo kuntarekisterissä", () => {
    const turhat = Object.keys(PLACE_ALIASES).filter((key) => getMunicipalityByName(key))
    expect(turhat).toEqual([])
  })

  it("avaimet ovat pieniä kirjaimia", () => {
    expect(Object.keys(PLACE_ALIASES).filter((k) => k !== k.toLowerCase())).toEqual([])
  })
})

describe("getMunicipalityByPlaceName – laajennetut nimet", () => {
  /* Mitattu 21.8.2026: 26 riviä jäi ilman kuntaa, koska rekisterissä on
   * virallinen nimi "Pedersören kunta". */
  it("tunnistaa rekisterin viralliset erikoisnimet", () => {
    expect(getMunicipalityByPlaceName("Pedersöre")?.name).toBe("Pedersören kunta")
    expect(getMunicipalityByPlaceName("Maarianhamina")?.name).toBe("Maarianhamina - Mariehamn")
    expect(getMunicipalityByPlaceName("Mariehamn")?.name).toBe("Maarianhamina - Mariehamn")
  })

  /* Hilman suorituspaikkakentässä esiintyi "JAKOBSTAD" isoin kirjaimin. */
  it("tunnistaa ruotsinkieliset kuntanimet kirjainkoosta riippumatta", () => {
    expect(getMunicipalityByPlaceName("JAKOBSTAD")?.name).toBe("Pietarsaari")
    expect(getMunicipalityByPlaceName("Vasa")?.name).toBe("Vaasa")
    expect(getMunicipalityByPlaceName("Åbo")?.name).toBe("Turku")
    expect(getMunicipalityByPlaceName("Karleby")?.name).toBe("Kokkola")
  })

  it("tunnistaa lakanneet kunnat", () => {
    expect(getMunicipalityByPlaceName("Haukipudas")?.name).toBe("Oulu")
    expect(getMunicipalityByPlaceName("Noormarkku")?.name).toBe("Pori")
    expect(getMunicipalityByPlaceName("Eno")?.name).toBe("Joensuu")
    expect(getMunicipalityByPlaceName("Mänttä")?.name).toBe("Mänttä-Vilppula")
  })

  it("tunnistaa mitatut kylät ja postitoimipaikat", () => {
    expect(getMunicipalityByPlaceName("Ylämylly")?.name).toBe("Liperi")
    expect(getMunicipalityByPlaceName("Sirkka")?.name).toBe("Kittilä")
    expect(getMunicipalityByPlaceName("Nummela")?.name).toBe("Vihti")
    expect(getMunicipalityByPlaceName("Vekaranjärvi")?.name).toBe("Kouvola")
  })

  /*
   * Tuntematon, monitulkintainen tai ulkomainen nimi jää tyhjäksi.
   * "Kuivasjärvi" on sekä Oulussa että Parkanossa, "Venice" ei ole Suomessa,
   * ja "Kirkonummi" on kirjoitusvirhe jota ei pidä legitimoida aliaksena.
   */
  it("palauttaa tyhjän kun nimi on tuntematon tai monitulkintainen", () => {
    expect(getMunicipalityByPlaceName("Kuivasjärvi")).toBeNull()
    expect(getMunicipalityByPlaceName("Venice")).toBeNull()
    expect(getMunicipalityByPlaceName("Kirkonummi")).toBeNull()
    expect(getMunicipalityByPlaceName("Kemijoki")).toBeNull()
  })
})

describe("municipalityFromGenitive", () => {
  it("tunnistaa säännöllisen genetiivin", () => {
    expect(municipalityFromGenitive("Janakkalan")?.name).toBe("Janakkala")
    expect(municipalityFromGenitive("Raaseporin")?.name).toBe("Raasepori")
    expect(municipalityFromGenitive("Nokian")?.name).toBe("Nokia")
    expect(municipalityFromGenitive("Vantaan")?.name).toBe("Vantaa")
  })

  it("tunnistaa vartalonmuutokset yhteisen alun perusteella", () => {
    expect(municipalityFromGenitive("Helsingin")?.name).toBe("Helsinki")
    expect(municipalityFromGenitive("Riihimäen")?.name).toBe("Riihimäki")
    expect(municipalityFromGenitive("Tampereen")?.name).toBe("Tampere")
    expect(municipalityFromGenitive("Lappeenrannan")?.name).toBe("Lappeenranta")
    expect(municipalityFromGenitive("Seinäjoen")?.name).toBe("Seinäjoki")
    expect(municipalityFromGenitive("Kirkkonummen")?.name).toBe("Kirkkonummi")
  })

  it("tunnistaa lyhyet poikkeukset", () => {
    expect(municipalityFromGenitive("Turun")?.name).toBe("Turku")
    expect(municipalityFromGenitive("Lahden")?.name).toBe("Lahti")
  })

  it("palauttaa maakunnan kunnan mukana", () => {
    expect(municipalityFromGenitive("Janakkalan")?.region).toBe("Kanta-Häme")
  })

  it("ei arvaa tuntemattomasta sanasta", () => {
    expect(municipalityFromGenitive("Rakennusliikkeen")).toBeNull()
    expect(municipalityFromGenitive("Kiinteistön")).toBeNull()
    expect(municipalityFromGenitive(null)).toBeNull()
    expect(municipalityFromGenitive("")).toBeNull()
  })

  it("vaatii genetiivin, ei osu perusmuotoon", () => {
    expect(municipalityFromGenitive("Janakkala")).toBeNull()
  })
})

describe("municipalityFromBuyerName", () => {
  it("poimii kunnan tilaajan nimestä", () => {
    expect(municipalityFromBuyerName("Janakkalan kunta")?.name).toBe("Janakkala")
    expect(municipalityFromBuyerName("Nokian kaupunki")?.name).toBe("Nokia")
    expect(
      municipalityFromBuyerName("Helsingin kaupunki, kaupunkiympäristön toimiala")
        ?.name
    ).toBe("Helsinki")
  })

  it("löytää kunnan myös nimen keskeltä", () => {
    expect(
      municipalityFromBuyerName(
        "Stara (Helsingin kaupungin rakentamispalveluliikelaitos)"
      )?.name
    ).toBe("Helsinki")
  })

  it("ei osu kuntayhtymään, joka kattaa useita kuntia", () => {
    expect(municipalityFromBuyerName("Etelä-Savon kuntayhtymä")).toBeNull()
  })

  it("ei osu yrityksiin eikä valtakunnallisiin toimijoihin", () => {
    expect(municipalityFromBuyerName("Kiinteistökehitys Naistinki Oy")).toBeNull()
    expect(municipalityFromBuyerName("Väylävirasto")).toBeNull()
    expect(municipalityFromBuyerName(null)).toBeNull()
  })
})

describe("getMunicipalityByPlaceName", () => {
  it("tunnistaa kunnan suoraan", () => {
    expect(getMunicipalityByPlaceName("Janakkala")?.name).toBe("Janakkala")
  })

  it("tunnistaa postitoimipaikan joka ei ole kunta", () => {
    expect(getMunicipalityByPlaceName("Turenki")?.name).toBe("Janakkala")
    expect(getMunicipalityByPlaceName("Turenki")?.region).toBe("Kanta-Häme")
  })

  it("tunnistaa kylät ja kuntaliitoksessa hävinneet nimet", () => {
    expect(getMunicipalityByPlaceName("Ivalo")?.name).toBe("Inari")
    expect(getMunicipalityByPlaceName("Onttola")?.name).toBe("Kontiolahti")
    expect(getMunicipalityByPlaceName("Immola")?.name).toBe("Imatra")
    expect(getMunicipalityByPlaceName("Nauvo")?.name).toBe("Parainen")
    expect(getMunicipalityByPlaceName("Kuusankoski")?.name).toBe("Kouvola")
  })

  it("ei tunnista tuntematonta paikkaa", () => {
    expect(getMunicipalityByPlaceName("Mordor")).toBeNull()
    expect(getMunicipalityByPlaceName(null)).toBeNull()
  })
})

describe("getMunicipalityByAnyForm", () => {
  it("hyväksyy perusmuodon, kylän ja genetiivin", () => {
    expect(getMunicipalityByAnyForm("Helsinki")?.name).toBe("Helsinki")
    expect(getMunicipalityByAnyForm("Kuusankoski")?.name).toBe("Kouvola")
    expect(getMunicipalityByAnyForm("Helsingin")?.name).toBe("Helsinki")
  })

  it("ei arvaa tuntemattomasta", () => {
    expect(getMunicipalityByAnyForm("Rakennuksen")).toBeNull()
    expect(getMunicipalityByAnyForm(null)).toBeNull()
  })
})

describe("isCityCorroboratedByText", () => {
  it("hyväksyy taivutetun muodon tekstistä", () => {
    expect(isCityCorroboratedByText("Orivesi", "työ tehdään Orivedellä")).toBe(true)
    expect(
      isCityCorroboratedByText("Janakkala", null, "Janakkalan kunnan tekninen")
    ).toBe(true)
  })

  it("hylkää kun teksti ei mainitse kaupunkia", () => {
    expect(isCityCorroboratedByText("Vantaa", "urakka Turussa")).toBe(false)
    expect(isCityCorroboratedByText("Vantaa", null, undefined)).toBe(false)
  })
})

describe("isSinglePropertyCompany", () => {
  /*
   * Kiinteistöyhtiön rekisteriosoite ON kohde, joten tilaajan osoitteesta
   * saa kunnan ilman että ilmoituksen teksti mainitsisi kaupunkia.
   * Mitattu tapaus: 13 Englantilaisen koulun urakkaa jäi ilman kuntaa,
   * koska kuvaus ei sano "Helsinki" kertaakaan.
   */
  it("tunnistaa yhden kohteen kiinteistöyhtiön", () => {
    expect(isSinglePropertyCompany("Kiinteistö Oy Eliel Saarisen tie 41-45")).toBe(true)
    expect(isSinglePropertyCompany("Kiinteistö Oy Auroranlinna")).toBe(true)
    expect(isSinglePropertyCompany("Asunto Oy Helsingin Pyy")).toBe(true)
    expect(isSinglePropertyCompany("Kotkan Julkiset Kiinteistöt Oy")).toBe(true)
  })

  /*
   * VALTAKUNNALLINEN VOITTAA. Puolustuskiinteistöt sisältää sanan
   * "kiinteistö" mutta rakennuttaa koko maahan: sen Helsingin-osoite veisi
   * hankkeet väärään kuntaan.
   */
  it("ei pidä valtakunnallista toimijaa paikallisena", () => {
    expect(isSinglePropertyCompany("Puolustuskiinteistöt")).toBe(false)
    expect(isSinglePropertyCompany("Senaatti-kiinteistöt")).toBe(false)
    expect(isSinglePropertyCompany("Metsähallitus")).toBe(false)
    expect(isSinglePropertyCompany("Väylävirasto")).toBe(false)
  })

  it("ei osu tavalliseen yritykseen tai tyhjään", () => {
    expect(isSinglePropertyCompany("Lemminkäinen Oy")).toBe(false)
    expect(isSinglePropertyCompany("Isonkyrön kunta")).toBe(false)
    expect(isSinglePropertyCompany(null)).toBe(false)
    expect(isSinglePropertyCompany("")).toBe(false)
  })
})
