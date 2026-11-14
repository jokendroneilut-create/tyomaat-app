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

/*
 * PELKOSENNIEMI, KOLME POHJAA (D-415). Tekstit sellaisina kuin
 * pdf-parse ne antoi 14.11.2026, rivien valilyonnit mukaan lukien.
 */
describe("oasYhteystiedot: Pelkosenniemen pohjat (D-415)", () => {
  it("otsikko kaksoispisteellä, puhelin ja sähköposti samalla rivillä, yritys henkilön jälkeen", () => {
    const t = [
      "Yhteystiedot ",
      "Pelkosenniemen kunta: ",
      "Emmi Mäkelä, maankäyttöinsinööri ",
      "Puh. 040 704 4508, s.posti: emmi.makela@pelkosenniemi.fi ",
      " ",
      "Kaavanlaatija: ",
      "Johanna Ilola-Pesonen ",
      "Maankäyttö Pesonen Oy ",
      "Puh. 040 5931 569, s.posti: maankayttopesonen@outlook.com ",
      "",
      "10 ",
      " ",
      "Palaute: ",
      "Kirjalliset mielipiteet ja muistutukset tulee toimittaa osoitteeseen: ",
      "Pelkosenniemen kunta ",
      "Tekninen toimisto ",
      "Sodankyläntie 1 ",
      "98500 Pelkosenniemi  ",
      "Tai sähköpostitse: kirjaamo@pelkosenniemi.fi",
    ].join("\n")
    expect(oasYhteystiedot(t)).toEqual([
      {
        name: "Emmi Mäkelä",
        title: "Maankäyttöinsinööri",
        phone: "040 704 4508",
        email: "emmi.makela@pelkosenniemi.fi",
        organization: "Pelkosenniemen kunta",
      },
      {
        name: "Johanna Ilola-Pesonen",
        title: "Kaavanlaatija",
        phone: "040 5931 569",
        email: "maankayttopesonen@outlook.com",
        organization: "Maankäyttö Pesonen Oy",
      },
    ])
  })

  it("kaksipalstainen asettelu (KimmoKaava)", () => {
    const t = [
      "YHTEYSTIEDOT ",
      " ",
      "KAAVOITTAJA:  Kimmo Mustonen KimmoKaava       ",
      "",
      "DI (maanmittaus, YKS 124)  Kitkantie 34 F 40 ",
      "0400 703 521     93600 KUUSAMO ",
      "  ",
      "kimmo.mustonen@kimmokaava.fi   ",
      "  www.kimmokaava.fi ",
      " ",
      "KUNTA:  Emmi Mäkelä     Pelkosenniemen kunta ",
      "maankäyttöinsinööri Sodankyläntie 1 A ",
      "040 7044 508                              98500 PELKOSENNIEMI ",
      "  ",
      "emmi.makela@pelkosenniemi.fi  kirjaamo@pelkosenniemi.fi  ",
      "    www.pelkosenniemi.fi  ",
      " ",
      "PALAUTE OSALLISTUMIS- JA ARVIOINTISUUNNITELMASTA ",
      "Mielipiteet osallistumis- ja arviointisuunnitelmasta voi esittää kunnan virkamiehille tai kaavoittajalle. ",
      "Kuusamossa, 5.2.2025, päivitetty viimeksi 27.4.2026 ",
      "DI (maanmittaus, YKS 124) ",
      "  Kimmo Mustonen ",
    ].join("\n")
    expect(oasYhteystiedot(t)).toEqual([
      {
        name: "Kimmo Mustonen",
        title: "Kaavoittaja",
        phone: "0400 703 521",
        email: "kimmo.mustonen@kimmokaava.fi",
        organization: "KimmoKaava",
      },
      {
        name: "Emmi Mäkelä",
        title: "Maankäyttöinsinööri",
        phone: "040 7044 508",
        email: "emmi.makela@pelkosenniemi.fi",
        organization: "Pelkosenniemen kunta",
      },
    ])
  })

  it("rastilista: yritys ennen nimeä ja puhelin sulkeissa (Lokio)", () => {
    const t = [
      "14. Yhteystiedot ",
      " ",
      "Kaavoituksesta ja maankäytöstä vastaa Pelkosenniemen kunnassa  ",
      "✓ Maankäyttöinsinööri Emmi Mäkelä (puh. 040 7044 508) ",
      "emmi.makela@pelkosenniemi.fi, Sodankyläntie 1 A, 98500 Pelkosenniemi ",
      "Konsulttina ja kaavan laatijana toimii  ",
      "✓ Arkkitehtitoimisto Jarmo Lokio Oy, arkkitehti Jarmo Lokio (puh. 044 700 2155) ",
      "jarmo.lokio@lokio.fi, Ainonkatu 1, 96200 Rovaniemi  ",
      "  ",
      "Rovaniemellä 7.4.2025 ",
      "Jarmo Lokio ",
      "arkkitehti FISE YKS 122 ",
    ].join("\n")
    expect(oasYhteystiedot(t)).toEqual([
      {
        name: "Emmi Mäkelä",
        title: "Maankäyttöinsinööri",
        phone: "040 7044 508",
        email: "emmi.makela@pelkosenniemi.fi",
        organization: null,
      },
      {
        name: "Jarmo Lokio",
        title: "Arkkitehti, kaavan laatija",
        phone: "044 700 2155",
        email: "jarmo.lokio@lokio.fi",
        organization: "Arkkitehtitoimisto Jarmo Lokio Oy",
      },
    ])
  })
})

/* Pelkosenniemen Kotitunturin OAS 2023: puhelin keskella solua (D-415). */
describe("oasYhteystiedot: puhelin keskellä solua ja pätevyystunnus (D-415)", () => {
  const KOTITUNTURI = [
    "YHTEYSTIEDOT: ",
    "Pelkosenniemen kunnassa kaavoituksen vastuuhenkilö on: ",
    "Elinvoimajohtaja Sari Niemi puh.040-4809187,  ",
    "email, sari.niemi@pelkosenniemi.fi ",
    " ",
    "Pelkosenniemen kunta  ",
    "               Sodankyläntie 1 A ",
    "               98500 Pelkosenniemi ",
    "emai, kirjaamo@pelkosenniemi.fi ",
    " ",
    "Kaavan laatija:  ",
    "Seitap Oy, www.seitap.fi ",
    "Tapani Honkanen, maanmittausteknikko, YKS 282, puh. 0400-391 468 ",
    "email, tapani.honkanen@seitap.fi ",
  ].join("\n")

  it("irrottaa puhelimen nimen perästä ja pilkkulistan lopusta", () => {
    expect(oasYhteystiedot(KOTITUNTURI)).toEqual([
      {
        name: "Sari Niemi",
        title: "Elinvoimajohtaja",
        phone: "040-4809187",
        email: "sari.niemi@pelkosenniemi.fi",
        organization: null,
      },
      {
        name: "Tapani Honkanen",
        title: "Maanmittausteknikko, kaavan laatija",
        phone: "0400-391 468",
        email: "tapani.honkanen@seitap.fi",
        organization: "Seitap Oy",
      },
    ])
  })
})

/* Kittilan OAS 23.9.2026: proosaa, rivi katkeaa nimen keskelta (D-415). */
describe("oasYhteystiedot: proosa (Kittilä, D-415)", () => {
  const KITTILA = [
    "13. Yhteystiedot ",
    " ",
    "Kittilän kunta, maanmittausinsinööri Mika Palovaara, puh. 040 7622 917 tekninen johtaja Roni Jän-",
    "kälä, puh. 040 5406 357 ja maanmittausteknikko Veli-Matti Virtanen, puh. 040 5811 889 ",
    "Osoite: Valtatie 15, 99100 Kittilä ",
    "kirjaamo@kittila.fi ",
    " ",
    "Kittilässä, 23.9.2026 ",
    " ",
    "Mika Palovaara ",
    "Mika Palovaara ",
  ].join("\n")

  it("jokainen henkilö saa oman numeronsa", () => {
    expect(oasYhteystiedot(KITTILA).map((h) => [h.name, h.title, h.phone])).toEqual([
      ["Mika Palovaara", "Maanmittausinsinööri", "040 7622 917"],
      ["Roni Jänkälä", "Tekninen johtaja", "040 5406 357"],
      ["Veli-Matti Virtanen", "Maanmittausteknikko", "040 5811 889"],
    ])
  })

  it("organisaatio periytyy virkkeen alusta", () => {
    expect(oasYhteystiedot(KITTILA).every((h) => h.organization === "Kittilän kunta")).toBe(true)
  })
})

/* Loviisan Länsiportin OAS: nimike nimen ALLA (D-415). */
describe("oasYhteystiedot: nimike nimen alla (Loviisa, D-415)", () => {
  const LOVIISA = [
    "7 YHTEYSTIEDOT ",
    "Kirjalliset mielipiteet ja muistutukset voi jättää Loviisan kaupungin asiakaspalvelupiste Lovinfoon tai ",
    "Loviisan kaupunki, Lovinfo sähköposti: kaupunki@loviisa.fi ",
    "Mariankatu 12 A puh. 019 555 555 ",
    "07900 LOVIISA  Avoinna  ma–ke, pe klo 9–11.30 ja 12.30–15 ",
    "Loviisan kaupunki, kaupunkikehitys    sähköposti: etunimi.sukunimi@loviisa.fi ",
    " ",
    "Perttu Huhtiniemi      puh. 040 671 7674 ",
    "kaavoitusinsinööri ",
    " ",
    "Marko Luukkonen ",
    "kaupunkisuunnittelupäällikkö      puh. 0440 555 403",
  ].join("\n")

  it("nimike kuuluu nimen yläpuoliselle henkilölle, ei seuraavalle", () => {
    expect(oasYhteystiedot(LOVIISA).map((h) => [h.name, h.title, h.phone])).toEqual([
      ["Perttu Huhtiniemi", "Kaavoitusinsinööri", "040 671 7674"],
      ["Marko Luukkonen", "Kaupunkisuunnittelupäällikkö", "0440 555 403"],
    ])
  })
})

/* Tarkkuuskerros (D-415): roska jaa pois, ei asiakkaalle. */
describe("oasYhteystiedot: tarkkuuskerros (D-415)", () => {
  it("lause ei kelpaa nimikkeeksi, osoitelohko ei ole henkilö", () => {
    const t = [
      "YHTEYSTIEDOT",
      "Pasi Hyvärilä, kaavoitusarkkitehti, kaavamuutos laaditaan Paraisten kaupungin kaavoituksessa",
      "puh. 040 488 5918, pasi.hyvarila@parainen.fi",
      "FCG Rakennettu Ympäristö Oy",
      "Kotipaikka Helsinki, puh. 010 4090",
    ].join("\n")
    expect(oasYhteystiedot(t)).toEqual([
      {
        name: "Pasi Hyvärilä",
        title: "Kaavoitusarkkitehti",
        phone: "040 488 5918",
        email: "pasi.hyvarila@parainen.fi",
        organization: null,
      },
    ])
  })

  it("välilyönneillä kirjoitettu osoite liitetään nimen mukaan", () => {
    const t = [
      "YHTEYSTIEDOT",
      "Kaavasuunnittelija Matti Piispanen, Saarijärven kaupunki",
      "puh. 044 459 8225",
      "Matti.piispanen @ saarijarvi.fi",
    ].join("\n")
    expect(oasYhteystiedot(t)[0].email).toBe("Matti.piispanen@saarijarvi.fi")
  })
})

describe("oasYhteystiedot: henkilö ei ole organisaatio (D-415)", () => {
  it("nimikkeen sisällä oleva 'kaupunki' ei tee henkilöstä organisaatiota", () => {
    const t = [
      "YHTEYSTIEDOT",
      "Kaupunkisuunnittelupäällikkö Marko Luukkonen",
      "Kaavoittaja Heta Tuunanen, Alusta Consulting Oy",
      "puh. 040 734 0239, heta.tuunanen@alustaconsulting.fi",
    ].join("\n")
    expect(oasYhteystiedot(t)).toEqual([
      {
        name: "Heta Tuunanen",
        title: "Kaavoittaja",
        phone: "040 734 0239",
        email: "heta.tuunanen@alustaconsulting.fi",
        organization: "Alusta Consulting Oy",
      },
    ])
  })
})

describe("oasYhteystiedot: kunnan otsikko ei periydy konsultille (D-415)", () => {
  it("jättää organisaation tyhjäksi kun sähköposti on toisen talon", () => {
    const t = [
      "YHTEYSTIEDOT",
      "Loviisan kaupunki",
      "Kaavoittaja Heta Tuunanen",
      "puh. 040 734 0239, heta.tuunanen@alustaconsulting.fi",
      "Kaavoitusinsinööri Perttu Huhtiniemi",
      "puh. 040 671 7674, perttu.huhtiniemi@loviisa.fi",
    ].join("\n")
    expect(oasYhteystiedot(t).map((h) => [h.name, h.organization])).toEqual([
      ["Heta Tuunanen", null],
      ["Perttu Huhtiniemi", "Loviisan kaupunki"],
    ])
  })
})

describe("oasYhteystiedot: nimiot ja maatunnus (Inari, Ikaalinen, D-415)", () => {
  it("nimio ei kuulu nimikkeeseen eikä organisaatioon", () => {
    const t = [
      "YHTEYSTIEDOT",
      "Toimeksi: kaavoitus",
      "Reetta-Mari Tammela, Lisätietoja: tekninen johtaja",
      "puh. 040 655 1611",
    ].join("\n")
    expect(oasYhteystiedot(t)[0]).toMatchObject({ title: "Tekninen johtaja", organization: null })
  })

  it("maatunnukseen lisätään plusmerkki", () => {
    const t = ["YHTEYSTIEDOT", "Kaavaa laativa konsultti", "Petri Tuormala, Projoplan Oy", "puh. 358 40 575 61 07"].join("\n")
    expect(oasYhteystiedot(t)[0].phone).toBe("+358 40 575 61 07")
  })
})

/* Huittisten Kallon OAS 6.9.2021: kaksipalstainen (D-415). */
describe("oasYhteystiedot: kaksipalstainen rivi (Kallo, D-415)", () => {
  const KALLO = [
    "Yhteyshenkilöt: ",
    " ",
    "Kaavoitusinsinööri Katariina Viiri   Suunnitteluavustaja Anne Rämö ",
    "p. 044 5604 195   p. 044 5604 386 ",
    "katariina.viiri@huittinen.fi   anne.ramo@huittinen.fi  ",
  ].join("\n")

  it("ensimmäinen numero ensimmäiselle, ei viimeksi luodulle", () => {
    expect(oasYhteystiedot(KALLO).map((h) => [h.name, h.phone, h.email])).toEqual([
      ["Katariina Viiri", "044 5604 195", "katariina.viiri@huittinen.fi"],
      ["Anne Rämö", "044 5604 386", "anne.ramo@huittinen.fi"],
    ])
  })
})

/* Hattulan Katinalan OAS 18.9.2024 (D-415). */
describe("oasYhteystiedot: tutkinto nimen perässä ja liian lyhyt numero (Katinala, D-415)", () => {
  const KATINALA = [
    "YHTEYSTIEDOT",
    "Kaavakonsultti ",
    "Markku Niemi DI ",
    "05067757 ",
    "markku.t.niemi@outlook.com ",
  ].join("\n")

  it("tutkinto on nimike, ja vajaa matkapuhelinnumero jätetään pois", () => {
    expect(oasYhteystiedot(KATINALA)).toEqual([
      {
        name: "Markku Niemi",
        title: "DI, kaavakonsultti",
        phone: null,
        email: "markku.t.niemi@outlook.com",
        organization: null,
      },
    ])
  })
})

/* Huittisten Taraskallion OAS 31.1.2024, FCG-taulukko (D-415). */
describe("oasYhteystiedot: taulukko nimikeriveineen (Taraskallio, D-415)", () => {
  const TARASKALLIO = [
    "Yhteystiedot ",
    " ",
    "Huittisten kaupunki  ",
    "Huittisten kaupunki ",
    "Tekninen johtaja    Maankäyttöpäällikkö ",
    "Ulla Ojala    Seija Holmi ",
    "puh: +358 44 560 4341      puh: +358 44 560 4395 ",
    "ulla.ojala@huittinen.fi   mailto: seija.holmi@huittinen.fi",
    "  ",
    "Risto Rytin katu 36 ",
    "32700 HUITTINEN ",
    "kaupunki@huittinen.fi  ",
    "Kaavoituksesta vastaava konsultti  ",
    " FCG Finnish Consulting Group Oy ",
    " Projektipäällikkö Seurantaryhmän koordinointi ",
    " Marjo Kirillow    Olli Poutanen ",
    " puh: +358 41 732 0391      puh. +358 50 370 2693 ",
    " marjo.kirillow@fcg.fi  olli.poutanen@fcg.fi",
  ].join("\n")
  const tulos = oasYhteystiedot(TARASKALLIO)

  it("nimikkeet ja numerot palstoittain", () => {
    expect(tulos.slice(0, 2).map((h) => [h.name, h.title, h.phone, h.email])).toEqual([
      ["Ulla Ojala", "Tekninen johtaja", "+358 44 560 4341", "ulla.ojala@huittinen.fi"],
      ["Seija Holmi", "Maankäyttöpäällikkö", "+358 44 560 4395", "seija.holmi@huittinen.fi"],
    ])
  })

  it("konsulttien numerot eivät mene ristiin", () => {
    expect(tulos.slice(2).map((h) => [h.name, h.phone])).toEqual([
      ["Marjo Kirillow", "+358 41 732 0391"],
      ["Olli Poutanen", "+358 50 370 2693"],
    ])
  })

  it("nimike ei ole organisaatio", () => {
    expect(tulos.map((h) => h.organization)).not.toContain("Maankäyttöpäällikkö")
    expect(tulos.map((h) => h.organization)).not.toContain("Seurantaryhmän koordinointi")
  })
})

describe("oasYhteystiedot: Vt.-etuliite ja palstan nimike (Taraskallio 14.8.2024, D-415)", () => {
  it("nimikerivi palstoittain myös etuliitteen kanssa", () => {
    const t = [
      "Yhteystiedot",
      "Huittisten kaupunki ",
      "Tekninen johtaja   Vt. Maankäyttöpäällikkö ",
      "Seija Holmi   Juha Mustanoja ",
      "puh: +358 44 560 4341   puh: +358 44 560 4388 ",
      "seija.holmi@huittinen.fi    juha.mustanoja@huittinen.fi  ",
    ].join("\n")
    expect(oasYhteystiedot(t).map((h) => [h.name, h.title, h.phone])).toEqual([
      ["Seija Holmi", "Tekninen johtaja", "+358 44 560 4341"],
      ["Juha Mustanoja", "Vt. Maankäyttöpäällikkö", "+358 44 560 4388"],
    ])
  })

  it("roolista peritty nimike ei koske kahta palstaa", () => {
    const t = [
      "YHTEYSTIEDOT",
      "Tekninen johtaja",
      "Seija Holmi   Juha Mustanoja",
      "puh. 044 560 4341   puh. 044 560 4388",
    ].join("\n")
    expect(oasYhteystiedot(t).map((h) => h.title)).toEqual([null, null])
  })
})
