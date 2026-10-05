import { describe, it, expect } from "vitest"
import {
  bestBulletinDescription,
  bulletinPdfUrl,
  cleanBulletinPdfText,
  extractApplicationDescription,
  extractBulletinFields,
  extractBulletinApplicant,} from "./lupapisteBulletinPdf"

describe("cleanBulletinPdfText", () => {
  /* Henkilotiedot on peitetty paatosasiakirjassa mustilla palkeilla. */
  it("poistaa peitetyt henkilotiedot", () => {
    expect(cleanBulletinPdfText("Hankkeeseen ryhtyva████████ Toimenpide")).toBe(
      "Hankkeeseen ryhtyva Toimenpide"
    )
  })

  it("siistii valilyonnit mutta sailyttaa kappaleet", () => {
    expect(cleanBulletinPdfText("a   b\n\n\n\nc")).toBe("a b\n\nc")
  })
})

describe("extractApplicationDescription", () => {
  /*
   * Mitattu tapaus 21.8.2026: Vantaan LP-092-2026-02341. Rajapinta antoi
   * "Rakentamista valmistelevat tyot", PDF kertoi datakeskuksesta.
   */
  it("poimii lainatun kuvauksen otsikon perasta", () => {
    const pdf =
      'LisaselvityksetHankkeen kuvaus hakemuksella\n"Tulevien datakeskusrakennusten ja lammontalteenottorakennuksen rakentamista valmistelevat pohjatyot, kuten maankaivuu ja louhinta."\nHankkeen vaativuusVaativa'
    expect(extractApplicationDescription(pdf)).toBe(
      "Tulevien datakeskusrakennusten ja lammontalteenottorakennuksen rakentamista valmistelevat pohjatyot, kuten maankaivuu ja louhinta."
    )
  })

  /*
   * Kappalehaara kokeiltiin ja poistettiin: mitattu kuudesta poiminnasta
   * kolme tuli siita ja KAIKKI KOLME jatkuivat kuvauksen ohi paatos-
   * maarayksiin ja sivunumeroon asti, koska naissa paatoksissa ei ole
   * tyhjia riveja joista kappaleen lopun tunnistaisi.
   */
  it("ei poimi ilman lainausmerkkeja", () => {
    const pdf =
      "Rakennushankkeen kuvaus:\nUudisrakennus jossa on kolme kerrosta ja autohalli.\nHankkeen vaativuusTavanomainen"
    expect(extractApplicationDescription(pdf)).toBeNull()
  })

  /*
   * Ensimmainen versio otti pisimman lainauksen pituuden perusteella. Se osui
   * 15 paatoksesta yhteen ja sekin oli vaara kohta: poikkeamispaatoksen
   * perustelu, ei hankkeen kuvaus. Siksi poiminta on sidottu otsikkoon.
   */
  it("ei poimi lainausta ilman otsikkoa", () => {
    const pdf =
      'Perustelut paatokselle\n"Autosuojan nykyinen sijainti ei muutu nykytilanteesta, eika rakennusalan ylitys kasva nykytilanteesta."'
    expect(extractApplicationDescription(pdf)).toBeNull()
  })

  /* Otsikon loppuosa vaihtelee kunnittain. */
  it("tunnistaa myos muodon hakemuksessa", () => {
    const pdf = 'Hankkeen kuvaus hakemuksessa: "Olemassa olevan rakennuksen laajennus terassialueelle ja uusi sisaankaynti."'
    expect(extractApplicationDescription(pdf)).toBe(
      "Olemassa olevan rakennuksen laajennus terassialueelle ja uusi sisaankaynti."
    )
  })

  it("ei poimi liian lyhytta", () => {
    expect(extractApplicationDescription('Hankkeen kuvaus\n"Sauna."')).toBeNull()
  })

  it("kestaa tyhjan", () => {
    expect(extractApplicationDescription(null)).toBeNull()
    expect(extractApplicationDescription("")).toBeNull()
  })
})

describe("bulletinPdfUrl", () => {
  it("koodaa tunnisteen", () => {
    expect(bulletinPdfUrl("LP-092-2026-02341_abc")).toContain("bulletinId=LP-092-2026-02341_abc")
  })
})

describe("kentan katkaisu otsikkoon", () => {
  /*
   * Katkaisusta tehtiin 25.8.2026 kirjainkokoriippumaton, jotta
   * versaaliotsikko ("TOIMENPIDE") ei vuoda. Se rikkoi pahemman: sama sana
   * esiintyy leipatekstissa, ja arvo katkesi kesken lauseen. Mitattu
   * 26.8.2026: 36 kuvausta 309:sta olisi lyhentynyt, pahimmin 344 -> 57.
   */
  it("EI katkaise leipatekstin sanaan", () => {
    const teksti =
      "ToimenpideRakennetaan asuinpientalo 100 k-m2 (rakennusoikeudellinen kerrosala 96 k-m2) seka maalampojarjestelma.Kaavatilanne Asemakaava"
    const f = extractBulletinFields(teksti)
    expect(f.toimenpide).toContain("rakennusoikeudellinen kerrosala 96")
  })

  it("katkaisee versaaliotsikkoon", () => {
    const teksti = "ToimenpideEikaavaa TOIMENPIDE Valiaikainen rakennus"
    const f = extractBulletinFields(teksti)
    expect(f.toimenpide).toBe("Eikaavaa")
  })

  /*
   * Lomakkeessa otsikko on kiinni arvossaan ilman valimerkkia, joten
   * kaksoispisteen kanssa kyseessa on virke. Ilman tata Toimenpide-kentan
   * arvo "Poikkeamispaatos: Luvanvaraisuudesta..." tyhjeni kokonaan.
   */
  it("EI katkaise kaksoispisteelliseen sanaan", () => {
    const teksti = "ToimenpidePoikkeamispäätös: Luvanvaraisuudesta vapautetun talousrakennuksen sijoittaminen."
    const f = extractBulletinFields(teksti)
    expect(f.toimenpide).toContain("Luvanvaraisuudesta vapautetun")
  })
})

describe("bestBulletinDescription", () => {
  /*
   * Aiempi versio valitsi lisaselvitykset TAI toimenpiteen, ja hukkasi
   * tietoa molempiin suuntiin. Toimenpide kertoo mita tehdaan,
   * Lisaselvitykset miten - myyjalle molemmat ovat tarpeen.
   */
  it("yhdistaa toimenpiteen ja lisaselvitykset", () => {
    const teksti =
      "ToimenpideEnergiakaivojen poraaminen.LisäselvityksetTontilta puretaan vanha ammattioppilaitos ja aloitetaan maanrakennustyot.Kaavatilanne Asemakaava"
    const k = String(bestBulletinDescription(teksti) ?? "")
    expect(k).toContain("Energiakaivojen poraaminen")
    expect(k).toContain("Tontilta puretaan vanha ammattioppilaitos")
  })

  it("ei toista samaa tekstia kahdesti", () => {
    const teksti = "ToimenpideSama teksti molemmissa kentissa.LisäselvityksetSama teksti molemmissa kentissa.Kaavatilanne X"
    const k = String(bestBulletinDescription(teksti) ?? "")
    expect(k.split("Sama teksti").length - 1).toBe(1)
  })

  it("palauttaa nullin kun kumpaakaan ei ole", () => {
    expect(bestBulletinDescription("Kaavatilanne Asemakaava")).toBeNull()
  })
})

/*
 * HAKIJA VAIN ORGANISAATIONA (D-237).
 *
 * Nimet testeissa ovat keksittyja. Oikeassa aineistossa hakija on usein
 * yksityishenkilo omalla nimellaan, eika sellaista saa tallentaa
 * saati committaa julkiseen repoon.
 */
describe("extractBulletinApplicant", () => {
  /* Otsikko on PDF-tekstissa kiinni arvossa. */
  const YRITYS =
    "HAKIJAAsuntorakennuttajat hankeyhtiö 4 Oy , Esimerkkikatu 1, 00100 HELSINKI " +
    "RAKENNUSPAIKKA753-416-0016-0024 Puistikkotie, 04130 Sipoo"

  it("poimii yrityksen nimen ilman osoitetta", () => {
    expect(extractBulletinApplicant(YRITYS)).toBe("Asuntorakennuttajat hankeyhtiö 4 Oy")
  })

  it("katkaisee seuraavaan otsikkoon kun pilkkua ei ole", () => {
    expect(extractBulletinApplicant("HAKIJASodankylän kunta RAKENNUSPAIKKA758-405-0021-0116")).toBe(
      "Sodankylän kunta"
    )
  })

  it("lukee myos monikkomuodon HAKIJAT", () => {
    expect(extractBulletinApplicant("HAKIJAT Caruna Oy PL 1, 00001 HELSINKI")).toBe("Caruna Oy")
  })

  /* Yksityishenkilo ei ole liidi vaan henkilotieto. */
  it("ei palauta yksityishenkiloa", () => {
    expect(extractBulletinApplicant("HAKIJA Meikäläinen Matti Juhani Esimerkkitie 5")).toBeNull()
  })

  it("ei palauta peitettya arvoa", () => {
    expect(extractBulletinApplicant("HAKIJAXXXXXXXX RAKENNUSPAIKKA426-405-0337-0000")).toBeNull()
  })

  /* "MUUTOKSENHAKIJA" esiintyy jokaisen paatoksen valitusosoituksessa. */
  it("ei osu sanaan muutoksenhakija", () => {
    expect(
      extractBulletinApplicant("Valitus on MUUTOKSENHAKIJAn allekirjoitettava Oy")
    ).toBeNull()
  })

  it("sietaa tyhjan", () => {
    expect(extractBulletinApplicant(null)).toBeNull()
    expect(extractBulletinApplicant("")).toBeNull()
  })
})

/*
 * Mitattu 6.10.2026: 495 PDF-tekstista 225 kayttaa monikkoa
 * "Lisaselvitykset" ja 35 yksikkoa "Lisaselvitys". Pelkka monikko
 * hukkasi jalkimmaisten kuvauksen kokonaan — mm. Sipoon hoivakodin,
 * jonka koko hankekuvaus on juuri sen otsikon alla.
 */
describe("Lisäselvitys yksikössä", () => {
  it("poimitaan myos yksikkomuodosta", () => {
    const pdf = "TOIMENPIDEPoikkeaminen asemakaavasta LisäselvitysHakemus pohjautuu tontinluovutuskilpailuun. PÄÄTÖS"
    expect(extractBulletinFields(pdf).lisaselvitykset).toContain("tontinluovutuskilpailuun")
  })
})
