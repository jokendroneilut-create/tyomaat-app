import { describe, expect, it } from "vitest"

import { oasYhteystiedot, osapuoletYhteystiedoista } from "./oasYhteystiedot"

/*
 * Huittisten Hiukkamaen teollisuusalueen OAS 9.11.2026, luku 6 ja
 * sisallysluettelon rivi, sellaisina kuin pdf-parse ne antoi
 * 14.11.2026 (rivien perassa olevat valilyonnit mukaan lukien).
 */
const HIUKKAMAKI = [
  "SISÄLLYSLUETTELO",
  "6. YHTEYSTIEDOT ............................................ 18 ",
  "1. OSALLISTUMIS- JA ARVIOINTISUUNNITELMAN TARKOITUS ",
  "Asemakaavan laatiminen on käynnistetty FCDC Corp Oy:n aloitteesta. ",
  "6. YHTEYSTIEDOT ",
  "Mielipiteet, muistutukset ja lausunnot tulee osoittaa Huittisten kaupunginhallitukselle: ",
  "kaupunki@huittinen.fi tai  ",
  "Huittisten kaupunki, kaupunginhallitus ",
  "Risto Rytin katu 36, 32700 Huittinen ",
  " ",
  "Kaavaa laativa asiantuntija ",
  "Arkkitehti Markus Makkonen, NOAR Oy ",
  "Olympiastadion, Paavo Nurmen tie 1, 00250 Helsinki ",
  "p. +358 40 582 41 34 ",
  "markus.makkonen@noar.fi ",
  " www.noar.fi ",
  " ",
  "Hanketoimija ",
  "Juha Pöntinen, FCDC Corp Oy ",
  "Mikonkatu 9, 00100 Helsinki ",
  "p. +358 40 843 9827 ",
  "juha.pontinen@fcdc.fi ",
  " ",
  "Huittisten kaupunki ",
  "Risto Rytin katu 36, 32700 Huittinen ",
  " www.huittinen.fi ",
  " ",
  "Kaavoitusarkkitehti Annamaria Puumala ",
  "p. +358 44 560 4195 ",
  "annamaria.puumala@huittinen.fi ",
  " ",
  "Tekninen johtaja Seija Holmi ",
  "p. +358 44 560 4341 ",
  "seija.holmi@huittinen.fi ",
].join("\n")

describe("oasYhteystiedot: Huittisten Hiukkamäki (D-413)", () => {
  const tulos = oasYhteystiedot(HIUKKAMAKI)

  it("löytää neljä henkilöä", () => {
    expect(tulos.map((h) => h.name)).toEqual([
      "Markus Makkonen",
      "Juha Pöntinen",
      "Annamaria Puumala",
      "Seija Holmi",
    ])
  })

  it("hanketoimija ilman omaa nimikettä saa roolin edeltävältä riviltä", () => {
    expect(tulos[1]).toEqual({
      name: "Juha Pöntinen",
      title: "Hanketoimija",
      phone: "+358 40 843 9827",
      email: "juha.pontinen@fcdc.fi",
      organization: "FCDC Corp Oy",
    })
  })

  it("yhdistää oman nimikkeen ja roolin, osoite ei valu nimikkeeseen", () => {
    expect(tulos[0]).toEqual({
      name: "Markus Makkonen",
      title: "Arkkitehti, kaavaa laativa asiantuntija",
      phone: "+358 40 582 41 34",
      email: "markus.makkonen@noar.fi",
      organization: "NOAR Oy",
    })
  })

  it("kaupungin väki saa organisaation väliotsikosta", () => {
    expect(tulos[2]).toMatchObject({
      title: "Kaavoitusarkkitehti",
      organization: "Huittisten kaupunki",
      email: "annamaria.puumala@huittinen.fi",
    })
    expect(tulos[3]).toMatchObject({ title: "Tekninen johtaja", organization: "Huittisten kaupunki" })
  })

  it("ei anna kaupungin yleistä postilaatikkoa kenellekään", () => {
    expect(tulos.some((h) => h.email === "kaupunki@huittinen.fi")).toBe(false)
  })
})

describe("oasYhteystiedot: rajaukset", () => {
  it("ei poimi mitään ilman YHTEYSTIEDOT-lukua", () => {
    expect(oasYhteystiedot("Arkkitehti Markus Makkonen, NOAR Oy\np. 040 123 4567")).toEqual([])
  })

  it("ei käytä sisällysluettelon riviä otsikkona", () => {
    expect(oasYhteystiedot("6. YHTEYSTIEDOT ........ 18\nArkkitehti Markus Makkonen\np. 040 123 4567")).toEqual([])
  })

  it("pysähtyy seuraavaan numeroituun lukuun", () => {
    const t = "6. YHTEYSTIEDOT\nKaavoittaja Anna Aho\np. 040 111 2222\n7. LIITTEET\nInsinööri Pekka Puu\np. 040 333 4444"
    expect(oasYhteystiedot(t).map((h) => h.name)).toEqual(["Anna Aho"])
  })

  it("ei tallenna malliosoitetta", () => {
    const t = "YHTEYSTIEDOT\nKaavoittaja Anna Aho\np. 040 111 2222\netunimi.sukunimi@kunta.fi"
    expect(oasYhteystiedot(t)[0].email).toBeNull()
  })

  it("tyhjä syöte ei kaadu", () => {
    expect(oasYhteystiedot(null)).toEqual([])
    expect(oasYhteystiedot("")).toEqual([])
  })
})

/*
 * Huittisten Lintukankaan tuulivoiman OAS 6.5.2024, luku 9: toinen
 * pohja. Nimike pilkun JALKEEN, yritys omalla rivillaan roolin alla,
 * vaihdenumero. Teksti sellaisena kuin pdf-parse sen antoi 14.11.2026.
 */
const LINTUKANGAS = [
  "9 YHTEYSTIEDOT ",
  " ",
  "Muut yhteystiedot ",
  "Huittisten kaupunki ",
  "Risto Rytin katu 36,  ",
  "32700 Huittinen ",
  "Seija Holmi, tekninen johtaja ",
  "Puh. 044 560 4341  ",
  "seija.holmi@huittinen.fi",
  " ",
  "Kaavaa laativa konsultti ",
  "A-  Insinöörit ",
  "Bertel Jungin aukio 9, 02600 Espoo ",
  "Annina Vainio, projektipäällikkö ",
  "Puh. vaihde 0207 911 888 ",
  "annina.vainio@ains.fi",
  " ",
  "YVA-konsultti ",
  "Ecobio Oy ",
  "Runeberginkatu 5, 00100 Helsinki ",
  "Marja Savolainen, johtava konsultti ",
  "Puh. 020 756 6149 ",
  "marja.savolainen@ecobio.fi",
  " ",
  "Hankkeesta vastaava  ",
  "Myrsky Energia Oy ",
  "Salomonkatu 17 A 15, 00100 Helsinki ",
  "Ilkka Oikarinen, hankekehityspäällikkö ",
  "Puh. 044 508 1981 ",
  "ilkka.oikarinen@myrsky.fi",
  " ",
  "Aineistoon voi tutustua Huittisten kaupungin verkkosivulla: ",
  "https://www.huittinen.fi/palvelut/kaupunkisuunnittelu/kaavoitus/vireilla_olevat_kaavat  ",
  "sähköpostitse osoitteeseen: kaupunki@huittinen.fi  ",
  "tai postitse ",
  "Huittisten kaupunki, kaupunginhallitus ",
].join("\n")

describe("oasYhteystiedot: Huittisten Lintukangas, toinen pohja (D-413)", () => {
  const tulos = oasYhteystiedot(LINTUKANGAS)

  it("löytää neljä henkilöä eikä tee yrityksestä henkilöä", () => {
    expect(tulos.map((h) => h.name)).toEqual([
      "Seija Holmi",
      "Annina Vainio",
      "Marja Savolainen",
      "Ilkka Oikarinen",
    ])
  })

  it("nimike pilkun jälkeen on nimike, ei organisaatio", () => {
    expect(tulos[0]).toEqual({
      name: "Seija Holmi",
      title: "Tekninen johtaja",
      phone: "044 560 4341",
      email: "seija.holmi@huittinen.fi",
      organization: "Huittisten kaupunki",
    })
  })

  it("yritys roolin alla ilman yhtiömuotoa, ja vaihdenumero merkitään", () => {
    expect(tulos[1]).toEqual({
      name: "Annina Vainio",
      title: "Projektipäällikkö, kaavaa laativa konsultti",
      phone: "0207 911 888 (vaihde)",
      email: "annina.vainio@ains.fi",
      organization: "A-Insinöörit",
    })
  })

  it("hankkeesta vastaava saa yrityksen ja roolin", () => {
    expect(tulos[3]).toMatchObject({
      title: "Hankekehityspäällikkö, hankkeesta vastaava",
      organization: "Myrsky Energia Oy",
    })
  })

  it("lyhenne roolissa säilyy", () => {
    expect(tulos[2].title).toBe("Johtava konsultti, YVA-konsultti")
  })
})

/* Hattulan Niinimaen tuulivoiman OAS 26.3.2024, luku 10 (D-413). */
describe("oasYhteystiedot: tutkintolyhenne pilkun jälkeen (D-413)", () => {
  const NIINIMAKI = [
    "10 YHTEYSTIEDOT ",
    "Muut yhteystiedot ",
    "Hattulan kunta ",
    "Pappilanniementie 9, 13880 Hattula ",
    "Hans Nielsen, maankäyttöpäällikkö ",
    "Puh. 040 620 1946 ",
    "hans.nielsen@hattula.fi ",
    "Kaavaa laativa konsultti ",
    "A-Insinöörit Civil Oy ",
    "Bertel Jungin aukio 9, 02600 Espoo ",
    "Annina Vainio, arkkitehti YKS-562 ",
    "Puh. vaihde 0207 911 888 ",
    "annina.vainio@ains.fi ",
    "YVA-konsultti ",
    "Ecobio Oy ",
    "Malminrinne 3 B, 00100 Helsinki ",
    "Masi Mailammi, FM, johtava konsultti ",
    "Puh. 020 756 2300 ",
    "masi.mailammi@ecobio.fi  ",
  ].join("\n")
  const tulos = oasYhteystiedot(NIINIMAKI)

  it("tutkinto ja nimike eivät mene organisaatioksi", () => {
    expect(tulos[2]).toEqual({
      name: "Masi Mailammi",
      title: "FM, johtava konsultti, YVA-konsultti",
      phone: "020 756 2300",
      email: "masi.mailammi@ecobio.fi",
      organization: "Ecobio Oy",
    })
  })

  it("nimike lyhenteineen säilyy", () => {
    expect(tulos[1]).toMatchObject({
      title: "Arkkitehti YKS-562, kaavaa laativa konsultti",
      organization: "A-Insinöörit Civil Oy",
    })
  })

  it("lyhenteenä kirjoitettu yritys yhtiömuodon kanssa on yhä yritys", () => {
    const t = "YHTEYSTIEDOT\nArkkitehti Markus Makkonen, NOAR Oy\np. 040 123 4567"
    expect(oasYhteystiedot(t)[0].organization).toBe("NOAR Oy")
  })
})

/*
 * YRITYKSET ROOLEINEEN (D-414). Johannes: *"liittyvat yritykset
 * pitaisi viela poimia esim fcdc ja noar."*
 */
describe("osapuoletYhteystiedoista (D-414)", () => {
  it("hanketoimija on rakennuttaja, kaavakonsultti liittyvä yritys, kaupunki ei kumpikaan", () => {
    expect(osapuoletYhteystiedoista(oasYhteystiedot(HIUKKAMAKI))).toEqual({
      developer: "FCDC Corp Oy",
      related: ["NOAR Oy"],
    })
  })

  it("hankkeesta vastaava on rakennuttaja, konsultit liittyviä", () => {
    expect(osapuoletYhteystiedoista(oasYhteystiedot(LINTUKANGAS))).toEqual({
      developer: "Myrsky Energia Oy",
      related: ["A-Insinöörit", "Ecobio Oy"],
    })
  })

  it("tunnistaa hankevastaavan ja hankekehityspäällikön (40 OAS:n otos)", () => {
    const y = (title: string, org: string) => ({ name: "A B", title, phone: "1", email: null, organization: org })
    expect(osapuoletYhteystiedoista([y("Hankevastaava", "Energiequelle Oy")]).developer).toBe("Energiequelle Oy")
    expect(osapuoletYhteystiedoista([y("Hankekehityspäällikkö", "Ilmatar Energy Oy")]).developer).toBe("Ilmatar Energy Oy")
  })

  it("ilman roolia yritys on liittyvä, ei rakennuttaja", () => {
    const y = { name: "Tomi Mäkipelto", title: null, phone: "1", email: null, organization: "Pohjan Voima Oy" }
    expect(osapuoletYhteystiedoista([y])).toEqual({ developer: null, related: ["Pohjan Voima Oy"] })
  })
})
