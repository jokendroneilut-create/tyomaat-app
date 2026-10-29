import { describe, expect, it } from "vitest"

import {
  jasennaKohde,
  jasennaSivukartta,
  jmEhdokas,
  jmKuvaus,
  katkaiseEnglanti,
  kunnaksi,
  paikallinenPaiva,
  siivoaTeksti,
} from "./fetchJmSource"

/* Sivukartan oma muoto, lyhennettyna (mitattu 29.10.2026). */
const SIVUKARTTA = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.jmoy.fi/asunnot/espoo/tapiola/asunto-oy-espoon-vellamonneito/</loc></url>
  <url><loc>https://www.jmoy.fi/asunnot/nokia/kartanonranta/asunto-oy-kartanonrannan-kuunlilja/</loc></url>
  <url><loc>https://www.jmoy.fi/asunnot/espoo/tapiola/asunto-oy-espoon-vellamonneito/</loc></url>
  <url><loc>https://muu-sivusto.fi/kohde/</loc></url>
</urlset>`

/* GetViewModelin oma muoto, lyhennettyna. */
const VASTAUS = {
  dataLayer: { projectPageStatus: "forsale" },
  template: {
    viewModel: {
      header: "Asunto Oy Espoon Vellamonneito",
      address: "Kalevalantie 5 B-C",
      postalCode: "02130",
      city: "Espoo",
      nrOfObjects: 52,
      energyClass: "A",
      inhabitDate: "2027-05-18T21:00:00+00:00",
      inhabitDateDetermined: true,
      intro: "Tervetuloa Eepos-kotikortteliin! Read in English below!",
      body: "<p>Kodit on suunniteltu kest&auml;m&auml;&auml;n aikaa.</p>",
      realEstateAgents: [
        {
          name: "JM Asuntomyynti",
          phone: "020 751 4730",
          email: "asuntomyynti@jmoy.fi",
        },
      ],
    },
  },
}

const NYT = new Date("2026-10-29T12:00:00Z")

describe("jasennaSivukartta", () => {
  it("palauttaa uniikit jmoy.fi-osoitteet", () => {
    expect(jasennaSivukartta(SIVUKARTTA)).toEqual([
      "https://www.jmoy.fi/asunnot/espoo/tapiola/asunto-oy-espoon-vellamonneito/",
      "https://www.jmoy.fi/asunnot/nokia/kartanonranta/asunto-oy-kartanonrannan-kuunlilja/",
    ])
  })
})

describe("paikallinenPaiva", () => {
  /*
   * Kentta on paikallinen keskiyo, joten UTC-paiva on AINA edellinen.
   * Suora slice(0, 10) antaisi 18.5. vaikka muuttopaiva on 19.5.
   */
  it("lukee kesaajan paivan Suomen aikavyohykkeella", () => {
    expect(paikallinenPaiva("2027-05-18T21:00:00+00:00")).toBe("2027-05-19")
  })

  it("lukee talviajan paivan Suomen aikavyohykkeella", () => {
    expect(paikallinenPaiva("2026-01-25T22:00:00+00:00")).toBe("2026-01-26")
  })

  it("palauttaa nullin tyhjasta ja roskasta", () => {
    expect(paikallinenPaiva(null)).toBeNull()
    expect(paikallinenPaiva("ei paiva")).toBeNull()
  })
})

describe("siivoaTeksti", () => {
  it("purkaa nimetyt entiteetit eika pyyhi niita", () => {
    /* D-341:n hiljainen virhe: &auml; -> valilyonti tuottaa "kest m n". */
    expect(siivoaTeksti("<p>kest&auml;m&auml;&auml;n</p>")).toBe("kestämään")
    expect(siivoaTeksti("<p>ty&ouml;maa</p>")).toBe("työmaa")
  })

  it("poistaa Wordista liitetyn xml- ja tyyliroskan", () => {
    const html =
      "<p><!-- [if gte mso 9]><xml><o:OfficeDocumentSettings/></xml><![endif]-->" +
      "<style>table.MsoNormalTable {mso-style-name:\"Normaali\";}</style>Oikea teksti.</p>"
    expect(siivoaTeksti(html)).toBe("Oikea teksti.")
  })

  it("sailyttaa tuntemattoman entiteetin ennallaan", () => {
    expect(siivoaTeksti("<p>a &zzz; b</p>")).toBe("a &zzz; b")
  })
})

describe("katkaiseEnglanti", () => {
  it("katkaisee englanninkielisen kappaleen kohdalta", () => {
    const teksti = "Suomenkielinen kuvaus kohteesta ja sen kodeista.\nThe apartments are designed for efficient everyday living with smart layouts."
    expect(katkaiseEnglanti(teksti)).toBe("Suomenkielinen kuvaus kohteesta ja sen kodeista.")
  })

  it("ei katkaise suomea jossa on yksi lainasana", () => {
    const teksti = "Ylimmissa kerroksissa on penthouse-asunto ja oma sauna jokaisessa kodissa."
    expect(katkaiseEnglanti(teksti)).toBe(teksti)
  })
})

describe("kunnaksi", () => {
  it("tarkistaa nimen kuntarekisterista", () => {
    expect(kunnaksi("Espoo")).toBe("Espoo")
    expect(kunnaksi("Ei-mikaan-kunta")).toBeNull()
    expect(kunnaksi(null)).toBeNull()
  })
})

describe("jasennaKohde", () => {
  it("lukee kentat rakenteisesta vastauksesta", () => {
    const k = jasennaKohde(VASTAUS, "https://www.jmoy.fi/x/")!
    expect(k).toMatchObject({
      nimi: "Asunto Oy Espoon Vellamonneito",
      osoite: "Kalevalantie 5 B-C",
      postinumero: "02130",
      kunta: "Espoo",
      asuntoja: 52,
      energialuokka: "A",
      muuttopaiva: "2027-05-19",
      muuttopaivaVarma: true,
      tila: "forsale",
    })
    expect(k.myynti).toMatchObject({ puhelin: "020 751 4730", sahkoposti: "asuntomyynti@jmoy.fi" })
  })

  it("hylkaa vastauksen jossa ei ole viewModelia", () => {
    expect(jasennaKohde({}, "https://www.jmoy.fi/x/")).toBeNull()
  })
})

describe("jmKuvaus", () => {
  it("kertoo osapuolen, osoitteen, asuntomaaran ja muuttopaivan", () => {
    const kuvaus = jmKuvaus(jasennaKohde(VASTAUS, "https://www.jmoy.fi/x/")!)
    expect(kuvaus).toContain("JM Suomi Oy rakennuttaa ja rakentaa")
    expect(kuvaus).toContain("Kalevalantie 5 B-C, 02130 Espoo")
    expect(kuvaus).toContain("Yhtiöön tulee 52 asuntoa.")
    expect(kuvaus).toContain("Arvioitu muuttopäivä 19.5.2027.")
    /* Kehotus lukea englanniksi ei ole kuvausta. */
    expect(kuvaus).not.toMatch(/in english/i)
  })

  it("merkitsee varmistamattoman paivan alustavaksi", () => {
    const data = {
      ...VASTAUS,
      template: {
        viewModel: { ...VASTAUS.template.viewModel, inhabitDateDetermined: false },
      },
    }
    expect(jmKuvaus(jasennaKohde(data, "https://www.jmoy.fi/x/")!)).toContain("Alustava muuttopäivä")
  })
})

describe("jmEhdokas", () => {
  it("kirjaa JM:n seka rakennuttajaksi etta rakentajaksi", () => {
    const e = jmEhdokas(jasennaKohde(VASTAUS, "https://www.jmoy.fi/x/")!, NYT)
    expect(e.developer).toBe("JM Suomi Oy")
    expect(e.builder).toBe("JM Suomi Oy")
    expect(e.location).toBe("Kalevalantie 5 B-C, 02130 Espoo")
    expect(e.estimated_completion).toBe("2027-05-19")
  })

  it("lukee vaiheen julkaisijan tilasta ja merkitsee sen varmaksi", () => {
    const e = jmEhdokas(jasennaKohde(VASTAUS, "https://www.jmoy.fi/x/")!, NYT)
    expect(e.phase).toBe("Rakenteilla")
    expect(e.phase_authoritative).toBe(true)
    expect(e.completed).toBe(false)
  })

  it("merkitsee planned-kohteen suunnitteluun", () => {
    const data = { ...VASTAUS, dataLayer: { projectPageStatus: "planned" } }
    const e = jmEhdokas(jasennaKohde(data, "https://www.jmoy.fi/x/")!, NYT)
    expect(e.phase).toBe("Suunnittelu")
    expect(e.completed).toBe(false)
  })

  /*
   * Mitattu rivi: Vaskiseppa on `soldout` ja muuttopaiva 2.12.2024, eli
   * myyntitila jaa roikkumaan valmistumisen jalkeen. Ilman tata se
   * menisi jonoon vaiheessa Rakenteilla -- ja `importCandidate`in oma
   * suoja ei auta, koska `phase_authoritative` kytkee sen pois.
   */
  it("merkitsee menneen muuttopaivan valmistuneeksi myyntitilasta riippumatta", () => {
    const data = {
      dataLayer: { projectPageStatus: "soldout" },
      template: {
        viewModel: {
          ...VASTAUS.template.viewModel,
          inhabitDate: "2024-12-01T22:00:00+00:00",
        },
      },
    }
    const e = jmEhdokas(jasennaKohde(data, "https://www.jmoy.fi/x/")!, NYT)
    expect(e.completed).toBe(true)
    expect(e.phase).toBe("Valmistunut")
  })

  it("antaa asuntomyynnin organisaation laatikkona, ei henkilona", () => {
    const e = jmEhdokas(jasennaKohde(VASTAUS, "https://www.jmoy.fi/x/")!, NYT)
    expect(e.metadata.contact_persons).toHaveLength(1)
    expect(e.metadata.contact_persons[0]).toMatchObject({
      kind: "organization",
      phone: "020 751 4730",
      email: "asuntomyynti@jmoy.fi",
    })
  })
})
