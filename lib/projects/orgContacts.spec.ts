import { describe, expect, it } from "vitest"

import { domainIsMunicipality, isMunicipalityContact, isRoleMailbox, orgContact } from "./orgContacts"
import { MUNICIPALITY_CONTACTS, municipalityContact } from "./municipalityContacts"

describe("isRoleMailbox", () => {
  it("tunnistaa roolilaatikon", () => {
    expect(isRoleMailbox("kirjaamo@tampere.fi")).toBe(true)
    expect(isRoleMailbox("kaavoitus@seinajoki.fi")).toBe(true)
    expect(isRoleMailbox("tilapalvelut.hankinnat@espoo.fi")).toBe(true)
  })

  it("tunnistaa roolin myös pisteen jäljessä", () => {
    /* Helsinki on 579 hanketta — ilman tätä se jäisi kokonaan pois. */
    expect(isRoleMailbox("helsinki.kirjaamo@hel.fi")).toBe(true)
    expect(isRoleMailbox("tekninen.kirjaamo@kitee.fi")).toBe(true)
  })

  it("hylkää henkilön osoitteen", () => {
    expect(isRoleMailbox("johanna.snellman@hel.fi")).toBe(false)
    expect(isRoleMailbox("merja.rukko@hel.fi")).toBe(false)
  })

  it("hylkää tekstiin tarttuneen osoitteen", () => {
    /* Rivinvaihto katoaa tiedotteesta ja osoite jatkuu seuraavaan sanaan. */
    expect(isRoleMailbox("kirjaamo@vaala.fiosallistumis")).toBe(false)
  })
})

describe("domainIsMunicipality", () => {
  it("hyväksyy täsmällisen tunnuksen", () => {
    expect(domainIsMunicipality("tampere.fi", "Tampere")).toBe(true)
    expect(domainIsMunicipality("tohmajarvi.fi", "Tohmajärvi")).toBe(true)
    expect(domainIsMunicipality("hel.fi", "Helsinki")).toBe(true)
  })

  it("hylkää osittaisen osuman", () => {
    /*
     * Nämä kolme kaatoivat aiemmat versiot. Yleissana "kaupunki" osui
     * tunnukseen uusikaupunki.fi ja "keskus" tunnukseen ely-keskus.fi —
     * yhteensä 794 väärää paria yhdessä kuivaharjoituksessa.
     */
    expect(domainIsMunicipality("uusikaupunki.fi", "Tampere")).toBe(false)
    expect(domainIsMunicipality("ely-keskus.fi", "Tampere")).toBe(false)
    expect(domainIsMunicipality("helsingintoimitilat.fi", "Helsinki")).toBe(false)
    expect(domainIsMunicipality("lvv.fi", "Väylävirasto")).toBe(false)
  })
})

describe("isMunicipalityContact", () => {
  it("vaatii molemmat ehdot", () => {
    expect(isMunicipalityContact("kirjaamo@tampere.fi", "Tampere")).toBe(true)
    /* oikea kunta, mutta henkilö */
    expect(isMunicipalityContact("johanna.snellman@hel.fi", "Helsinki")).toBe(false)
    /* roolilaatikko, mutta väärä organisaatio */
    expect(isMunicipalityContact("kirjaamo.pirkanmaa@ely-keskus.fi", "Tampere")).toBe(false)
  })
})

describe("orgContact", () => {
  it("merkitään aina organisaatioksi", () => {
    const c = orgContact("kirjaamo@tampere.fi", "Tampere")
    expect(c.kind).toBe("organization")
    expect(c.name).toBeNull()
  })
})

describe("MUNICIPALITY_CONTACTS", () => {
  it("Helsingin osoite on kunnan oma eikä kaavasta johdettu", () => {
    /* kirjaamo@hel.fi ei ole olemassa — tästä koko rekisteri sai alkunsa. */
    expect(municipalityContact("Helsinki")).toBe("helsinki.kirjaamo@hel.fi")
  })

  it("jokainen rekisterin osoite läpäisee omat ehtonsa", () => {
    for (const [kunta, { email }] of Object.entries(MUNICIPALITY_CONTACTS)) {
      expect(isMunicipalityContact(email, kunta), `${kunta}: ${email}`).toBe(true)
    }
  })

  it("jokaisella rivillä on lähdeviite", () => {
    for (const [kunta, { source }] of Object.entries(MUNICIPALITY_CONTACTS)) {
      expect(source, kunta).toMatch(/^https:\/\//)
    }
  })
})
