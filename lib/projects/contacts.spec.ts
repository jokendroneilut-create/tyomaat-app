import { describe, it, expect } from "vitest"
import { extractContacts, hasPersonContact, mergeContacts , sanitizeEmail} from "./contacts"

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

describe("peitetyt sahkopostit", () => {
  /*
   * Mitattu 22.8.2026: 78 hanketta ja 197 osoitetta jaivat huomaamatta,
   * koska ne on kirjoitettu keruun estamiseksi muodossa [at] tai (at).
   */
  it("tunnistaa hakasulkeisen muodon", () => {
    const c = extractContacts("yksikön päällikkö Merja Rukko, puh. 09 310 20576, merja.rukko[at]hel.fi")
    expect(c[0].email).toBe("merja.rukko@hel.fi")
    expect(c[0].name).toBe("Merja Rukko")
  })

  it("tunnistaa kaarisulkeisen muodon", () => {
    expect(extractContacts("tapani.vuorentausta(at)kouvola.fi")[0].email).toBe("tapani.vuorentausta@kouvola.fi")
  })

  it("sallii valilyonnit sulkeiden ymparilla", () => {
    expect(extractContacts("tapani.pukinkorva [at] ii.fi")[0].email).toBe("tapani.pukinkorva@ii.fi")
  })

  it("muuntaa myos peitetyn pisteen", () => {
    expect(extractContacts("matti [at] firma [dot] fi")[0].email).toBe("matti@firma.fi")
  })

  /* Pelkkaa " at " -sanaa ei kosketa: se on englannissa tavallinen. */
  it("ei muuta proosaa jossa lukee at", () => {
    expect(extractContacts("The meeting is at the office in Helsinki")).toEqual([])
  })
})

describe("puhelinankkuri", () => {
  /*
   * Kunnan paatoksissa on nimi ja numero mutta ei osoitetta lainkaan.
   * Mitattu: 271 hanketta, joista 181:lla myos nimi.
   */
  it("poimii kontaktin nimesta ja puhelimesta ilman sahkopostia", () => {
    const c = extractContacts("Valmistelija: suunnittelupäällikkö Tapani Vuorentausta, puh. 020 615 7096")
    expect(c).toHaveLength(1)
    expect(c[0].name).toBe("Tapani Vuorentausta")
    expect(c[0].phone).toBe("020 615 7096")
    expect(c[0].email).toBe("")
    expect(c[0].kind).toBe("person")
  })

  /* Pelkka irrallinen numero ei ole yhteystieto. */
  it("ei poimi numeroa ilman nimea", () => {
    expect(extractContacts("Kokonaiskustannus 020 615 7096 euroa")).toEqual([])
  })

  it("ei toista henkiloa joka on jo poimittu sahkopostilla", () => {
    const c = extractContacts("Jani Peltomäki, puh. 044 085 0412, jani.peltomaki@srv.fi")
    expect(c).toHaveLength(1)
  })

  it("poimii seka sahkopostillisen etta pelkan puhelimellisen", () => {
    const t =
      "Jani Peltomäki, puh. 044 085 0412, jani.peltomaki@srv.fi Lisätietoja antaa suunnittelupäällikkö Satu Suomi, puh. 020 615 8046"
    const c = extractContacts(t)
    expect(c).toHaveLength(2)
    expect(c.some((x) => x.name === "Satu Suomi" && x.email === "")).toBe(true)
  })
})

describe("nimentunnistuksen rajaus", () => {
  /* Mitattu puhelinankkuria lisattaessa: nama tulivat "nimina". */
  it("ei pida yhtiomuotoa nimena", () => {
    expect(extractContacts("Linjasaneeraus Rakennus Oy puh. 0207415560")).toEqual([])
  })

  it("ei pida kadunnimea sukunimena", () => {
    expect(extractContacts("Kerrostalo Heka Tihtaalinkatu puh. 0503721640")).toEqual([])
  })

  it("ei pida tehtavanimiketta etunimena", () => {
    expect(extractContacts("Työnjohtaja Esa puh. 0505677677")).toEqual([])
    expect(extractContacts("Yhteyshenkilö Jani puh. 0407526606")).toEqual([])
  })

  it("tunnistaa oikean nimen nimikkeen jalkeen", () => {
    const c = extractContacts("Työnjohtaja Esa Virtanen puh. 040 567 7677")
    expect(c[0].name).toBe("Esa Virtanen")
  })
})

describe("sanitizeEmail", () => {
  it("katkaisee verkkotunnukseen tarttuneen sanan", () => {
    expect(sanitizeEmail("reima.liikamaa@jatke.fiKuvatLataaLataaJatke")).toBe("reima.liikamaa@jatke.fi")
    /* Isolla alkava verkkotunnus on aito eika saa katketa. */
    expect(sanitizeEmail("Eveliina.Etelakoski@Raisio.fi")).toBe("Eveliina.Etelakoski@Raisio.fi")
    expect(sanitizeEmail("kirjaamo@vaala.fiOsallistumis")).toBe("kirjaamo@vaala.fi")
    expect(sanitizeEmail("niko.mikkonen@lohja.fiTiitus")).toBe("niko.mikkonen@lohja.fi")
  })

  it("katkaisee peraan tarttuneen puhelinnumeron", () => {
    expect(sanitizeEmail("arttu.makipaa@kuopio.fi\n044 718 5435")).toBe("arttu.makipaa@kuopio.fi")
  })

  it("poistaa alusta numerot kun jaljelle jaa nimi", () => {
    expect(sanitizeEmail("8368reima.liikamaa@jatke.fi")).toBe("reima.liikamaa@jatke.fi")
    expect(sanitizeEmail("0021pirjo.raiha@espoonasunnot.fi")).toBe("pirjo.raiha@espoonasunnot.fi")
  })

  it("poistaa etunumerot myos ilman pistetta", () => {
    /* STT:n kuvatunniste tarttuu osoitteeseen kiinni. */
    expect(sanitizeEmail("0811mursu@energiequelle.fi")).toBe("mursu@energiequelle.fi")
  })

  it("ei kajoa numeroalkuiseen kun jaljelle jaa liian vahan", () => {
    /* "3m" ei ole "m" — siita ei voi paatella mitaan. */
    expect(sanitizeEmail("3m@example.fi")).toBe("3m@example.fi")
  })

  it("sailyttaa harvinaiset paatteet", () => {
    /* Ei paatelistaa, joten nama eivat katkea. */
    expect(sanitizeEmail("teemu.ruuska@vsb.energy")).toBe("teemu.ruuska@vsb.energy")
    expect(sanitizeEmail("sonja.vuorsalo@elements.green")).toBe("sonja.vuorsalo@elements.green")
    expect(sanitizeEmail("scg.helsinki-amba@diplomatie.gouv.fr")).toBe("scg.helsinki-amba@diplomatie.gouv.fr")
  })

  it("ei muuta kirjainkokoa", () => {
    /* Pienaakkostus olisi tuottanut 594 turhaa paivitysta. */
    expect(sanitizeEmail("Jani.Laasanen@kaarina.fi")).toBe("Jani.Laasanen@kaarina.fi")
  })

  it("palauttaa nullin kun osoitetta ei ole", () => {
    expect(sanitizeEmail(null)).toBeNull()
    expect(sanitizeEmail("ei osoitetta")).toBeNull()
  })
})

describe("extractContacts – malliosoite ei ole osoite", () => {
  /*
   * Mitattu 25.8.2026 ajamalla poimija 12 547 kuvaustekstin yli: 670
   * nimi–osoite-ristiriidasta 659 syntyi siita, etta sivun OHJE
   * ("sahkoposti: etunimi.sukunimi@rovaniemi.fi") liitettiin viereiseen
   * oikeaan nimeen. Asiakas naki uskottavan osoitteen ja lahetti viestin
   * tyhjaan.
   */
  it("ei anna malliosoitetta oikealle nimelle", () => {
    const teksti =
      "Lisatietoja antaa kaavoituspaallikko Markku Pyhajarvi, puh. 016 322 8927, sahkoposti: etunimi.sukunimi@rovaniemi.fi"
    const c = extractContacts(teksti)
    expect(c.some((x) => String(x.email).includes("etunimi"))).toBe(false)
  })

  it("sailyttaa nimen ja numeron vaikka osoite pudotetaan", () => {
    const teksti =
      "Lisatietoja antaa kaavoituspaallikko Markku Pyhajarvi, puh. 016 322 8927, sahkoposti: etunimi.sukunimi@rovaniemi.fi"
    const c = extractContacts(teksti)
    const markku = c.find((x) => String(x.name ?? "").includes("Markku"))
    expect(markku).toBeTruthy()
    expect(markku!.email).toBe("")
    expect(String(markku!.phone ?? "")).toContain("322 8927")
  })

  /*
   * Nimea EI saa laajentaa osoitteeksi. Vapaassa tekstissa lahin nimi on
   * usein nimike tai toinen henkilo, joten laajennus tuottaisi keksityn
   * osoitteen. Laajennus kuuluu vain rakenteisiin lahteisiin (D-103).
   */
  it("ei laajenna nimesta osoitetta", () => {
    const c = extractContacts("Markku Pyhajarvi sahkoposti: etunimi.sukunimi@rovaniemi.fi")
    expect(c.some((x) => x.email === "markku.pyhajarvi@rovaniemi.fi")).toBe(false)
    expect(c.every((x) => x.email === "" || !x.email)).toBe(true)
  })

  it("ei lue nimea malliosoitteesta", () => {
    const c = extractContacts("Sahkopostit ovat muotoa etunimi.sukunimi@kuopio.fi")
    expect(c.some((x) => /Etunimi|Sukunimi/i.test(String(x.name ?? "")))).toBe(false)
  })

  it("lyhennetty muoto etu.sukunimi kelpaa myos malliksi", () => {
    const c = extractContacts("Kaavoittaja Liisa Virtanen, sahkoposti: etu.sukunimi@rovaniemi.fi")
    expect(c.some((x) => String(x.email).includes("etu.sukunimi"))).toBe(false)
  })

  /* Oikea osoite ei saa pudota mukana. */
  it("ei koske oikeaan osoitteeseen", () => {
    const c = extractContacts("Kaavoituspaallikko Markku Pyhajarvi, markku.pyhajarvi@rovaniemi.fi")
    expect(c.some((x) => x.email === "markku.pyhajarvi@rovaniemi.fi")).toBe(true)
  })

  it("ei tuota kaksoiskappaleita kun sama malli toistuu", () => {
    const teksti =
      "Markku Pyhajarvi sahkoposti: etunimi.sukunimi@rovaniemi.fi ja lisatietoja etunimi.sukunimi@rovaniemi.fi"
    const c = extractContacts(teksti)
    const markut = c.filter((x) => String(x.name ?? "").includes("Markku"))
    expect(markut.length).toBe(1)
  })
})
