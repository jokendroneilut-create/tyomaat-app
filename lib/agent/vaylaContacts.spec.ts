import * as cheerio from "cheerio"
import { describe, expect, it } from "vitest"

import { expandPlaceholderEmail, isPersonName, normalizeVaylaContact, vaylanYhteyshenkilot} from "./vaylaContacts"

describe("isPersonName", () => {
  it("hyväksyy tavallisen nimen", () => {
    expect(isPersonName("Kari Partiainen")).toBe(true)
    expect(isPersonName("Vesa-Matti Eura")).toBe(true)
  })

  it("hylkää ohjetekstin nimikentässä", () => {
    /* Nämä ovat todellisia arvoja Väyläviraston sivujen full-name-kentässä. */
    expect(isPersonName("Yhteydenotot Palauteväylän kautta (palautevayla.fi)")).toBe(false)
    expect(isPersonName("Kts. osahankkeiden yhteystiedot")).toBe(false)
  })

  it("hylkää yhden sanan ja liian pitkän", () => {
    expect(isPersonName("Väylävirasto")).toBe(false)
    expect(isPersonName("Anna Maria Liisa Virtanen")).toBe(false)
  })
})

describe("expandPlaceholderEmail", () => {
  it("laajentaa mallin nimen perusteella", () => {
    expect(expandPlaceholderEmail("etunimi.sukunimi@vayla.fi", "Kari Partiainen")).toBe(
      "kari.partiainen@vayla.fi"
    )
  })

  it("riisuu ääkköset mutta säilyttää väliviivan", () => {
    expect(expandPlaceholderEmail("etunimi.sukunimi@elinvoimakeskus.fi", "Timo Bäcklund")).toBe(
      "timo.backlund@elinvoimakeskus.fi"
    )
    expect(expandPlaceholderEmail("etunimi.sukunimi@elinvoimakeskus.fi", "Vesa-Matti Eura")).toBe(
      "vesa-matti.eura@elinvoimakeskus.fi"
    )
  })

  it("palauttaa oikean osoitteen sellaisenaan", () => {
    expect(expandPlaceholderEmail("maria.torttila@vayla.fi", "Maria Torttila")).toBe(
      "maria.torttila@vayla.fi"
    )
  })

  it("hylkää tunnistamattoman mallin", () => {
    /*
     * Sivulla ollut kirjoitusvirhe. Ensimmäinen versio palautti tämän
     * sellaisenaan, jolloin asiakkaalle olisi näytetty osoite
     * "etunimi.sukuni@vayla.fi".
     */
    expect(expandPlaceholderEmail("etunimi.sukuni@vayla.fi", "Vesa Pakarinen")).toBeNull()
  })

  it("ei laajenna kun nimi ei ole henkilö", () => {
    expect(expandPlaceholderEmail("etunimi.sukunimi@rovaniemi.fi", "Lapin Kansa")).toBeNull()
    expect(expandPlaceholderEmail("etunimi.sukunimi@rovaniemi.fi", "Tekninen lautakunta")).toBeNull()
    expect(expandPlaceholderEmail("etunimi.sukunimi@vykos.fi", "Vykos Oy")).toBeNull()
    expect(expandPlaceholderEmail("etunimi.sukunimi@tuusula.fi", "Valmistelija Sahlakari")).toBeNull()
    expect(expandPlaceholderEmail("fornamn.efternamn@korsnas.fi", "Fornamn Efternamn")).toBeNull()
  })
})

describe("normalizeVaylaContact", () => {
  it("poimii henkilön ja laajentaa osoitteen", () => {
    expect(
      normalizeVaylaContact({
        organization: "Väylävirasto",
        title: "Projektipäällikkö",
        name: "Kari Partiainen",
        phone: "029 534 3580",
        email: "etunimi.sukunimi@vayla.fi",
      })
    ).toEqual([
      {
        name: "Kari Partiainen",
        title: "Projektipäällikkö",
        organization: "Väylävirasto",
        email: "kari.partiainen@vayla.fi",
        phone: "029 534 3580",
        kind: "person",
      },
    ])
  })

  it("säilyttää nimen ja puhelimen vaikka osoite hylätään", () => {
    const [c] = normalizeVaylaContact({
      organization: "Väylävirasto",
      title: "Projektipäällikkö",
      name: "Vesa Pakarinen",
      phone: "029 534 3149",
      email: "etunimi.sukuni@vayla.fi",
    })

    expect(c.name).toBe("Vesa Pakarinen")
    expect(c.phone).toBe("029 534 3149")
    expect(c.email).toBe("")
  })

  it("siistii versaalinimikkeen", () => {
    expect(normalizeVaylaContact({
      organization: null,
      title: "PROJEKTIPÄÄLLIKKÖ",
      name: "Petri Teerimäki",
      phone: "0295 024 008",
      email: null,
    })[0].title).toBe("Projektipäällikkö")
  })

  it("palauttaa tyhjän kun nimikentässä on ohje", () => {
    expect(
      normalizeVaylaContact({
        organization: null,
        title: null,
        name: "Kts. osahankkeiden yhteystiedot",
        phone: "029 534 3000",
        email: null,
      })
    ).toEqual([])
  })

  it("palauttaa tyhjän kun jäljelle jäisi pelkkä nimi", () => {
    expect(
      normalizeVaylaContact({ organization: null, title: null, name: "Kari Partiainen", phone: null, email: null })
    ).toEqual([])
  })
})

describe("vaylanYhteyshenkilot", () => {
  /* Cloudflare-purku testissä: avaintavu + XOR, sama kuin tuotannossa. */
  const koodaa = (osoite: string, avain = 0x2a) =>
    avain.toString(16).padStart(2, "0") +
    [...osoite].map((c) => (c.charCodeAt(0) ^ avain).toString(16).padStart(2, "0")).join("")
  const pura = (koodattu: string) => {
    const avain = parseInt(koodattu.slice(0, 2), 16)
    let ulos = ""
    for (let i = 2; i < koodattu.length; i += 2) {
      ulos += String.fromCharCode(parseInt(koodattu.slice(i, i + 2), 16) ^ avain)
    }
    return ulos || null
  }

  const laatikko = (org: string, nimike: string, nimi: string, puh: string, posti: string[]) =>
    `<div class="contact">
       <div class="organization">${org}</div>
       <div class="title">${nimike}</div>
       <div class="full-name">${nimi}</div>
       <ul class="phones"><li>${puh}</li></ul>
       ${posti.map((p) => `<span class="__cf_email__" data-cfemail="${koodaa(p)}"></span>`).join("")}
     </div>`

  const sivu = (sisalto: string) =>
    cheerio.load(`<html><body><div class="contact-information">${sisalto}</div></body></html>`)

  /*
   * Kirjalansalmen sivu: kolme laatikkoa, joista saatiin yksi.
   * Urakoitsijan projektipaallikko oli se joka jai saamatta.
   */
  it("lukee kaikki laatikot, ei vain ensimmaista", () => {
    const $ = sivu(
      laatikko("Väylävirasto", "PROJEKTIPÄÄLLIKKÖ", "Saramaria Cowell", "029 534 3342", ["saramaria.cowell@vayla.fi"]) +
        laatikko("Kreate Oy", "PROJEKTIPÄÄLLIKKÖ", "Tero Haaramäki", "040 544 3661", ["tero.haaramaki@kreate.fi"]) +
        laatikko("", "TIEDOTTAJA", "Riitta Sirén", "050 547 9544", ["riitta.siren@valve.fi"])
    )
    const h = vaylanYhteyshenkilot($, pura)
    expect(h.map((x) => x.name)).toEqual(["Saramaria Cowell", "Tero Haaramäki", "Riitta Sirén"])
    expect(h[1].organization).toBe("Kreate Oy")
    expect(h[1].email).toBe("tero.haaramaki@kreate.fi")
  })

  /* Jokainen saa OMAN organisaationsa osoitteen, ei ensimmaisen. */
  it("lukee osoitteen laatikkokohtaisesti", () => {
    const $ = sivu(
      laatikko("Väylävirasto", "PP", "Aino Virtanen", "029 1", ["aino.virtanen@vayla.fi"]) +
        laatikko("Destia Oy", "PP", "Matti Meikäläinen", "040 2", ["matti.meikalainen@destia.fi"])
    )
    expect(vaylanYhteyshenkilot($, pura).map((x) => x.email)).toEqual([
      "aino.virtanen@vayla.fi",
      "matti.meikalainen@destia.fi",
    ])
  })

  /*
   * D-379: Simon sivulla oli KAKSI malliosoitetta, vanhentunut
   * @vaylavirasto.fi ja nykyinen @vayla.fi. Sivun yleisin tunnus voittaa.
   */
  it("valitsee malliosoitteista sivun yleisimman tunnuksen", () => {
    const $ = sivu(
      laatikko("Väylävirasto", "PP", "Vesa Pakarinen", "029 534 3149", [
        "etunimi.sukunimi@vaylavirasto.fi",
        "etunimi.sukunimi@vayla.fi",
      ]) + laatikko("Väylävirasto", "PP", "Aino Virtanen", "029 1", ["aino.virtanen@vayla.fi"])
    )
    expect(vaylanYhteyshenkilot($, pura)[0].email).toBe("etunimi.sukunimi@vayla.fi")
  })

  /* Oikea nimi voittaa mallin aina, vaikka malli olisi ensin. */
  it("oikea osoite voittaa malliosoitteen", () => {
    const $ = sivu(
      laatikko("Väylävirasto", "PP", "Vesa Pakarinen", "029 1", [
        "etunimi.sukunimi@vayla.fi",
        "vesa.pakarinen@vayla.fi",
      ])
    )
    expect(vaylanYhteyshenkilot($, pura)[0].email).toBe("vesa.pakarinen@vayla.fi")
  })

  it("palauttaa tyhjan kun lohkoa ei ole", () => {
    expect(vaylanYhteyshenkilot(cheerio.load("<html><body></body></html>"), pura)).toEqual([])
  })
})
