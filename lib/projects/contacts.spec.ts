import { describe, it, expect } from "vitest"
import { extractContacts, hasPersonContact, mergeContacts } from "./contacts"

describe("extractContacts", () => {
  /* SRV:n tiedotteen vakiomuoto: nimi, tehtava, yritys, puh, sposti. */
  it("poimii SRV-muotoisen yhteyshenkilon", () => {
    const t =
      "Lisatiedot: Jani Peltomäki, aluejohtaja, SRV, puh. 044 085 0412, jani.peltomaki@srv.fi"
    const [c] = extractContacts(t)
    expect(c.name).toBe("Jani Peltomäki")
    expect(c.phone).toBe("044 085 0412")
    expect(c.email).toBe("jani.peltomaki@srv.fi")
    expect(c.kind).toBe("person")
    expect(c.title).toContain("aluejohtaja")
  })

  /*
   * Mitattu 22.8.2026: ikkunasta luettuna toinen yhteyshenkilo sai
   * ensimmaisen puhelinnumeron. Lahin numero kuuluu talle osoitteelle.
   */
  it("antaa jokaiselle oman puhelinnumeron", () => {
    const t =
      "Jani Peltomäki, SRV, puh. 044 085 0412, jani.peltomaki@srv.fi Heidi Tetteh, SRV, puh. 040 662 3220, heidi.tetteh@srv.fi"
    const c = extractContacts(t)
    expect(c.find((x) => x.email.startsWith("jani"))?.phone).toBe("044 085 0412")
    expect(c.find((x) => x.email.startsWith("heidi"))?.phone).toBe("040 662 3220")
  })

  /*
   * Mitattu: kolme Taalerin yhteyshenkiloa sai kaikki nimekseen "Taaleri
   * Kiinteistot", koska lahin isolla alkava sanapari oli yrityksen nimi.
   * Sahkoposti antaa oikean nimen.
   */
  it("lukee nimen sahkopostista kun teksti antaa yrityksen nimen", () => {
    const t =
      "sanoo Taaleri Kiinteistöjen sijoitusjohtaja Jan Hellman. Lisätietoja: Taaleri Kiinteistöt, 044 544 4445, jan.hellman@taaleri.com"
    const [c] = extractContacts(t)
    expect(c.name).toBe("Jan Hellman")
  })

  /* Sahkoposti on ASCII, joten aakkoset otetaan tekstista. */
  it("sailyttaa aakkoset nimessa", () => {
    const t = "Tiia Järvi, myyntipäällikkö, tiia.jarvi@pohjolarakennus.fi"
    expect(extractContacts(t)[0].name).toBe("Tiia Järvi")
  })

  /* Kirjaamo ei ole myyntikontakti. */
  it("merkitsee yleiset postilaatikot organisaatioksi", () => {
    const c = extractContacts("Lausunnot: kirjaamo@lvv.fi")
    expect(c[0].kind).toBe("organization")
    expect(hasPersonContact(c)).toBe(false)
  })

  it("tunnistaa STT:n etunimi.sukunimi-paikanpitajan", () => {
    const c = extractContacts("Mervi Roiha-Muilu kiinteistöpäällikkö Kela Puh: 020 634 1693 etunimi.sukunimi@kela.fi")
    expect(c[0].kind).toBe("organization")
  })

  /*
   * Yhden kirjaimen "p" poistettiin nimikkeesta ilman pistetta, jolloin
   * "viestintapaallikko" muuttui muotoon "viestinta aallikko" - ä ei ole
   * JS:n regexissa sanamerkki.
   */
  it("ei riko nimiketta jossa on aakkosia", () => {
    const t = "Heidi Tetteh, viestintäpäällikkö, SRV, puh. 040 662 3220, heidi.tetteh@srv.fi"
    expect(extractContacts(t)[0].title).toContain("viestintäpäällikkö")
  })

  it("lukee organisaation sahkopostin domainista", () => {
    expect(extractContacts("matti.meikalainen@sitowise.fi")[0].organization).toBe("sitowise")
  })

  it("ei pida vapaata sahkopostia organisaationa", () => {
    expect(extractContacts("matti.meikalainen@gmail.com")[0].organization).toBeNull()
  })

  it("ei toista samaa osoitetta", () => {
    const c = extractContacts("a.b@x.fi ja uudelleen a.b@x.fi")
    expect(c).toHaveLength(1)
  })

  it("henkilot ensin", () => {
    const c = extractContacts("kirjaamo@lvv.fi sekä Emma Keränen, emma.keranen@sitowise.fi")
    expect(c[0].kind).toBe("person")
  })

  it("kestaa tyhjan", () => {
    expect(extractContacts(null)).toEqual([])
    expect(extractContacts("ei osoitteita tässä")).toEqual([])
  })
})

describe("mergeContacts", () => {
  /*
   * Kaavalahteiden kontakteilla sahkoposti on usein tyhja. Ensimmainen
   * versio avaimensi pelkkaan sahkopostiin ja olisi PUDOTTANUT ne:
   * kuivaharjoitus naytti rivejä 2 -> 1 ja 1 -> 0.
   */
  it("sailyttaa kontaktin jolla ei ole sahkopostia", () => {
    const vanha: any = [{ name: "Valtteri Tupala", email: null, phone: "044 740 1408", title: "kaavasuunnittelija" }]
    const uusi: any = [{ name: "Jan Hellman", email: "jan.hellman@taaleri.com", phone: null, title: null, organization: null, kind: "person" }]
    const tulos = mergeContacts(vanha, uusi)
    expect(tulos).toHaveLength(2)
    expect(tulos.some((c) => c.name === "Valtteri Tupala")).toBe(true)
  })

  it("ei toista samaa sahkopostia", () => {
    const a: any = [{ name: "A", email: "x@y.fi", phone: null, title: null, organization: null, kind: "person" }]
    const b: any = [{ name: "A", email: "X@Y.FI", phone: "040 111 2222", title: null, organization: null, kind: "person" }]
    const tulos = mergeContacts(a, b)
    expect(tulos).toHaveLength(1)
    expect(tulos[0].phone).toBe("040 111 2222")
  })

  it("tunnistaa saman henkilon nimen ja puhelimen perusteella", () => {
    const a: any = [{ name: "Matti Meikäläinen", email: null, phone: "044 740 1408", title: null }]
    const b: any = [{ name: "Matti Meikäläinen", email: null, phone: "044-740 1408", title: "kaavoittaja" }]
    expect(mergeContacts(a, b)).toHaveLength(1)
  })

  it("kestaa tyhjat", () => {
    expect(mergeContacts(null, null)).toEqual([])
  })
})

describe("puhelinnumeron tarkistus", () => {
  /* Diaarinumero "026-1401" nayttaa puhelimelta mutta ei ole. */
  it("ei ota diaarinumeroa puhelimeksi", () => {
    const c = extractContacts("Kai Vaisto 026-1401 kai.vaisto@example.fi")
    expect(c[0].phone).toBeNull()
  })

  it("hyvaksyy tavallisen matkapuhelinnumeron", () => {
    expect(extractContacts("Kai Vaisto 040 123 4567 kai.vaisto@example.fi")[0].phone).toBe("040 123 4567")
  })

  it("hyvaksyy kansainvalisen muodon", () => {
    expect(extractContacts("Topi Laine +358 400 792 492 topi.laine@example.fi")[0].phone).toBe("+358 400 792 492")
  })
})

describe("yhteystietoja ei koskaan poisteta", () => {
  /*
   * TAKUU: yhteystietokentta on vain-lisaava. Lisatietoteksti korvataan
   * uudemmalla (ks. chooseAdditionalInfo), joten vanhasta lahteesta
   * tulleet yhteyshenkilot saisivat kadota vain tassa - eivat saa.
   * Yhteystiedot ovat yksi kolmesta syysta joiden takia testiasiakkaat
   * eivat jaaneet maksaviksi.
   */
  it("sailyttaa jokaisen vanhan kontaktin vaikka uusia tulee", () => {
    const vanhat: any = [
      { name: "Vanha Yksi", email: "vanha1@x.fi", phone: "040 111 1111", title: null },
      { name: "Vanha Kaksi", email: null, phone: "040 222 2222", title: "kaavoittaja" },
      { name: null, email: "kirjaamo@kunta.fi", phone: null, title: null },
    ]
    const uudet: any = [
      { name: "Uusi", email: "uusi@y.fi", phone: "040 333 3333", title: null, organization: null, kind: "person" },
    ]
    const tulos = mergeContacts(vanhat, uudet)
    expect(tulos).toHaveLength(4)
    for (const v of vanhat) {
      expect(tulos.some((t) => (v.email ? t.email === v.email : t.name === v.name))).toBe(true)
    }
  })

  it("ei koskaan lyhene", () => {
    const vanhat: any = [
      { name: "A", email: "a@x.fi", phone: null, title: null },
      { name: "B", email: "b@x.fi", phone: null, title: null },
    ]
    expect(mergeContacts(vanhat, []).length).toBeGreaterThanOrEqual(vanhat.length)
    expect(mergeContacts(vanhat, null).length).toBeGreaterThanOrEqual(vanhat.length)
  })

  it("taydentaa vanhan puuttuvat kentat mutta ei korvaa olemassa olevia", () => {
    const vanhat: any = [{ name: "Matti Meikäläinen", email: "m@x.fi", phone: null, title: null }]
    const uudet: any = [{ name: "Matti M", email: "m@x.fi", phone: "040 123 4567", title: "johtaja", organization: "x", kind: "person" }]
    const [c] = mergeContacts(vanhat, uudet)
    expect(c.name).toBe("Matti Meikäläinen")
    expect(c.phone).toBe("040 123 4567")
    expect(c.title).toBe("johtaja")
  })
})
