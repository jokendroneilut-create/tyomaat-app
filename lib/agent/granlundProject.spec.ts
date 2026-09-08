import { describe, expect, it } from "vitest"

import {
  parseGranlundContacts,
  parseGranlundDescription,
  parseGranlundFields,
} from "./granlundProject"

/* Kentat ovat liimattuna yhteen ilman erottimia, kuten oikealla sivulla. */
const LOHKO =
  "Paikkakunta Seinäjoki Tilaaja Eepee Kiinteistöt Oy Tyyppi Korjausrakentaminen " +
  "Aloitus 2024 Valmistuminen 2027 Bruttoneliöt 30 000 m2 " +
  "Muut hankkeen toimijat Ramboll Finland Oy, Sustera HVAC Design Oy, Fredag Oy " +
  "Granlundin palvelut projektissa ArkkitehtisuunnitteluSähkösuunnitteluHuoltokirjakoordinointi " +
  "Katso kaikki palvelumme Tutustu muihin"

const KUVAUS =
  "Seinäjoen Hyllykallion Prisman laajennus ja uudistustyöt ovat käynnistyneet kesällä 2026. " +
  "Suunnittelu aloitettiin kesällä 2024. Toimimme hankkeessa pää- ja arkkitehtisuunnittelijoina. " +
  "Prisma Hyllykallioon rakennetaan laajennusta noin 4 000 m2."

describe("parseGranlundFields", () => {
  it("poimii kenttalohkon", () => {
    const f = parseGranlundFields(`<p>${KUVAUS}</p>${LOHKO}`)
    expect(f.city).toBe("Seinäjoki")
    expect(f.developer).toBe("Eepee Kiinteistöt Oy")
    expect(f.projectType).toBe("Korjausrakentaminen")
    expect(f.startYear).toBe(2024)
    expect(f.completionYear).toBe(2027)
    expect(f.estimatedCompletion).toBe("2027-12-31")
    expect(f.area).toBe("30 000 m2")
  })

  it("pilkkoo muut toimijat", () => {
    const f = parseGranlundFields(LOHKO)
    expect(f.otherCompanies).toEqual(["Ramboll Finland Oy", "Sustera HVAC Design Oy", "Fredag Oy"])
  })

  /* Palvelut ovat liimattuna yhteen, koska ne ovat HTML:ssa omina elementteinaan. */
  it("erottaa liimatut palvelut isosta kirjaimesta", () => {
    const f = parseGranlundFields(LOHKO)
    expect(f.granlundServices).toEqual([
      "Arkkitehtisuunnittelu",
      "Sähkösuunnittelu",
      "Huoltokirjakoordinointi",
    ])
  })

  it("kestaa puuttuvat kentat", () => {
    const f = parseGranlundFields("Paikkakunta Turku Tyyppi Uudisrakentaminen Katso kaikki palvelumme")
    expect(f.city).toBe("Turku")
    expect(f.developer).toBeNull()
    expect(f.completionYear).toBeNull()
    expect(f.estimatedCompletion).toBeNull()
  })

  it("palauttaa tyhjan kun sisaltoa ei ole", () => {
    const f = parseGranlundFields("")
    expect(f.city).toBeNull()
    expect(f.otherCompanies).toEqual([])
  })

  /* Vuosi luetaan vain nelinumeroisena; muu muoto on arvausta. */
  it("hylkaa kelvottoman vuoden", () => {
    expect(parseGranlundFields("Valmistuminen kevat").completionYear).toBeNull()
    expect(parseGranlundFields("Valmistuminen 27").completionYear).toBeNull()
  })
})

describe("parseGranlundDescription", () => {
  it("lukee kenttalohkoa EDELTAVAN tekstin", () => {
    const k = parseGranlundDescription(`<p>${KUVAUS}</p>${LOHKO}`)
    expect(k).toContain("Hyllykallion Prisman laajennus")
    expect(k).not.toContain("Paikkakunta")
    expect(k).not.toContain("Eepee")
  })

  /*
   * Lohkon jalkeen tulee "Tutustu muihin projekteihimme" -karuselli, jossa
   * on TOISTEN hankkeiden nimia - sama ansa kuin Kreatella (D-121).
   */
  it("EI lue muiden hankkeiden karusellia", () => {
    const k = parseGranlundDescription(`<p>${KUVAUS}</p>${LOHKO} Hangonsillan monitoimiareena Hyvinkää`)
    expect(k).not.toContain("Hangonsillan")
  })

  it("palauttaa nullin liian lyhyesta", () => {
    expect(parseGranlundDescription("<p>Lyhyt.</p>")).toBeNull()
    expect(parseGranlundDescription("")).toBeNull()
    expect(parseGranlundDescription(null)).toBeNull()
  })
})

/*
 * SIVUN KALUSTE EI KUULU KUVAUKSEEN (D-181). Hippos-hankkeen sivulla
 * yhteyshenkilölaatikko on kuvauksen ja kenttälohkon VÄLISSÄ, joten
 * "Paikkakunta"-kohdasta leikkaaminen ei riittänyt.
 */
describe("parseGranlundDescription - kaluste", () => {
  const runko =
    "Hippos on liikunnan ja hyvinvoinnin keskus Jyväskylässä. Hankkeessa on pitkän " +
    "jännevälin rakenteita, kuten 60 metrin teräsristikoita sekä värähtelymitoitettavia " +
    "välipohjarakenteita. Kustannusarvio on 210 miljoonaa euroa."

  it("katkaisee yhteyshenkilölaatikkoon ennen kenttälohkoa", () => {
    const html = `<p>${runko} Kuvat: PES-arkkitehdit Kysy lisää Matti Meikäläinen Osastonjohtaja 040 000 0000 etunimi.sukunimi@granlund.fi Paikkakunta Jyväskylä Tilaaja Hippos-hanke</p>`
    const kuvaus = parseGranlundDescription(html)

    expect(kuvaus).toBe(runko)
  })

  it("katkaisee kalusteeseen myös ilman kenttälohkoa", () => {
    const kuvaus = parseGranlundDescription(`<p>${runko} Katso kaikki yhteystiedot</p>`)

    expect(kuvaus).toBe(runko)
  })

  it("säilyttää kuvauksen kun kalustetta ei ole", () => {
    expect(parseGranlundDescription(`<p>${runko} Paikkakunta Oulu</p>`)).toBe(runko)
  })
})

/*
 * "Muut hankkeen toimijat" jatkui linkkilaatikkoon asti, koska
 * "Lisätietoa" ei ollut tunnettu otsikko.
 */
describe("parseGranlundFields - toimijat", () => {
  it("katkaisee toimijat linkkilaatikkoon", () => {
    const html =
      "<p>Paikkakunta Jyväskylä Muut hankkeen toimijat PES-arkkitehdit Lisätietoa " +
      "Lue lisää uudistuvasta Hippoksen alueesta Jyväskylän sivuilta " +
      "Granlundin palvelut projektissa Rakennesuunnittelu</p>"

    expect(parseGranlundFields(html).otherCompanies).toEqual(["PES-arkkitehdit"])
  })
})

/*
 * YHTEYSHENKILÖT LUETAAN RAKENTEESTA (D-182). Merkkaus on kahta lajia
 * ja sähköposti on HTML-entiteeteillä hämätty.
 */
describe("parseGranlundContacts", () => {
  const kortti = `
    <div class="contact-card">
      <div class="contact-card__main">
        <h4 class="contact-card__name">Matti Meikäläinen</h4>
        <div class="contact-card__title">Osastonjohtaja, rakennesuunnittelu</div>
        <div class="contact-highlight__location">Granlund Oulu</div>
        <div class="contact-card__footer">
          <div class="contact-card__phone"><a href="tel:040 000 0000">040 000 0000</a></div>
          <div class="contact-card__email">etu&#110;imi.sukunimi&#64;granlund.fi</div>
        </div>
      </div>
    </div>`

  it("lukee nimen, nimikkeen, yksikön ja puhelimen", () => {
    const [c] = parseGranlundContacts(kortti)

    expect(c.name).toBe("Matti Meikäläinen")
    expect(c.title).toBe("Osastonjohtaja, rakennesuunnittelu, Granlund Oulu")
    expect(c.organization).toBe("Granlund Oulu")
    expect(c.phone).toBe("040 000 0000")
  })

  /* Malliosoite on ohje eikä osoite (D-123); tyhjä on parempi kuin väärä. */
  it("ei tallenna malliosoitetta", () => {
    expect(parseGranlundContacts(kortti)[0].email).toBe("")
  })

  it("tallentaa aidon osoitteen entiteeteistä purettuna", () => {
    const html = `
      <div class="project-contact">
        <div class="project-contact__main">
          <h5 class="project-contact__name">Kaisa Esimerkki</h5>
          <div class="project-contact__title">Arkkitehti</div>
          <div class="project-contact__meta">
            <div class="project-contact__phone"><a href="tel:040 111 1111">040 111 1111</a></div>
            <div class="project-contact__email"><a href="#">&#107;aisa.&#101;simerkki&#64;granlund.fi</a></div>
          </div>
        </div>
      </div>`

    const [c] = parseGranlundContacts(html)
    expect(c.email).toBe("kaisa.esimerkki@granlund.fi")
    expect(c.title).toBe("Arkkitehti")
    expect(c.organization).toBe("Granlund")
  })

  it("lukee useamman henkilön samalta sivulta", () => {
    expect(parseGranlundContacts(kortti + kortti.replace("Matti Meikäläinen", "Liisa Virtanen")))
      .toHaveLength(2)
  })

  it("ei palauta mitään ilman yhteyslaatikkoa", () => {
    expect(parseGranlundContacts("<p>Hanke valmistuu 2027.</p>")).toEqual([])
    expect(parseGranlundContacts(null)).toEqual([])
  })
})
