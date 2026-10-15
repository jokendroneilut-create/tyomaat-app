import { describe, expect, it } from "vitest"

import {
  jasennaLiitteet,
  liiteUrl,
  liiteluettelonOsoite,
  urakanLaajuus,
  valitseLiite,
} from "./hilmaLiitteet"

/* Vastaa Hämeenkyrön ilmoituksen 59130 vastausta 15.10.2026. */
const VASTAUS = {
  attachments: [
    { id: "0f25e860-d465-4dc8-ee77-08df282cfe6b", name: "Liite 1_ urakkaohjelma_ Kirkkokatu 14 ja 16 ikkuna- ja oviremontti.pdf", status: 10 },
    { id: "ec9df98b-946c-4bc0-ee75-08df282cfe6b", name: "Liite 2. tekninen työselostus_ Kirkkokatu 14 ja 16 ikkuna- ja oviremontti.pdf" },
    { id: "ba2db098-59a6-4b90-ee7b-08df282cfe6b", name: "Liite 4_ urakkarajaliite_ Kirkkokatu 14 ja 16 ikkuna- ja oviremontti.pdf" },
    { id: "151e9418-85a5-4ae6-ee79-08df282cfe6b", name: "Liite 5_ turvallisuusasiakirja Kirkkokatu 14 ja 16 ikkuna- ja oviremontti.pdf" },
    { id: "d9575ae6-f0e2-4c4d-ee7d-08df282cfe6b", name: "LIITE 6_ tarjouslomake_ Kirkkokatu 14 ja 16 ikkuna- ja oviremontti.docx" },
    { id: "5be4d6e1-0ed9-4068-ee7f-08df282cfe6b", name: "Tarjouspyyntö_ Kirkkokatu 14 ja16 ikkuna- ja oviremontti.pdf" },
  ],
}

describe("liiteluettelo", () => {
  it("muodostaa julkisen rajapinnan osoitteen", () => {
    expect(liiteluettelonOsoite(38475, 59130)).toBe(
      "https://www.hankintailmoitukset.fi/web/api/public/procedure/38475/enotice/59130"
    )
  })

  it("muodostaa CDN-latausosoitteen", () => {
    expect(liiteUrl("abc")).toBe("https://cdn.hankintailmoitukset.fi/public-attachments/abc")
  })

  it("jasentaa liiteluettelon", () => {
    expect(jasennaLiitteet(VASTAUS)).toHaveLength(6)
  })

  it("ei kaadu kun liitteita ei ole", () => {
    /* Mitattu: 21 / 25 ohuesta rivista palauttaa nolla liitetta. */
    expect(jasennaLiitteet({})).toEqual([])
    expect(jasennaLiitteet(null)).toEqual([])
    expect(jasennaLiitteet({ attachments: "ei lista" })).toEqual([])
  })
})

describe("valitseLiite", () => {
  it("valitsee urakkaohjelman ensin", () => {
    expect(valitseLiite(jasennaLiitteet(VASTAUS))?.name).toMatch(/urakkaohjelma/)
  })

  it("ohittaa lomakkeet, turvallisuusasiakirjan ja urakkarajaliitteen", () => {
    const vain = jasennaLiitteet({
      attachments: [
        { id: "1", name: "LIITE 6_ tarjouslomake.docx" },
        { id: "2", name: "Liite 5_ turvallisuusasiakirja.pdf" },
        { id: "3", name: "Liite 4_ urakkarajaliite.pdf" },
      ],
    })
    expect(valitseLiite(vain)).toBeNull()
  })

  it("ei valitse word-tiedostoa, koska purkaja on pdf-parse", () => {
    const vain = jasennaLiitteet({ attachments: [{ id: "1", name: "urakkaohjelma.docx" }] })
    expect(valitseLiite(vain)).toBeNull()
  })

  it("kelpuuttaa tarjouspyynnon kun urakkaohjelmaa ei ole", () => {
    const vain = jasennaLiitteet({ attachments: [{ id: "9", name: "Tarjouspyyntö murskeenajo Kotoluhta Fleini.pdf" }] })
    expect(valitseLiite(vain)?.id).toBe("9")
  })
})

describe("urakanLaajuus", () => {
  /*
   * ANSA: sama otsikko on ensin sisallysluettelossa pistejonon ja
   * sivunumeron kanssa. Ensimmainen osuma antaisi luettelon, ei tekstia -
   * ja sisallysluettelo on yksi niista joita kuvaukseksi ei lasketa.
   */
  const PDF_TEKSTI =
    "URAKKAOHJELMA SISÄLLYSLUETTELO 1. Rakennushankkeen yhteystiedot ........ 2 " +
    "2. Rakennuskohde ja urakan laajuus ................ 3 " +
    "3. Urakkamuoto ja maksuperuste ................... 3 " +
    "1. Rakennushankkeen yhteystiedot Tilaaja on Hämeenkyrön Asunnonhankinta Oy. " +
    "2. Rakennuskohde ja urakan laajuus Kohteena ovat Kirkkokatu 14 ja Kirkkokatu 16, " +
    "39200 Hämeenkyrö. Urakassa uusitaan tarjousasiakirjoissa osoitetut ikkunat ja ovet " +
    "valmiiksi, toimintakuntoiseksi ja viimeistellyksi kokonaisuudeksi. Urakkaan kuuluvat " +
    "212 ikkunaa, 64 parvekeovea ja seitsemän puuovea sekä Kirkkokatu 16:n ikkunoiden " +
    "väliset julkisivupaneloinnit tarjousasiakirjojen mukaisesti. " +
    "3. Urakkamuoto ja maksuperuste Urakkamuoto on kokonaisurakka."

  it("poimii leipatekstin eika sisallysluetteloa", () => {
    const laajuus = urakanLaajuus(PDF_TEKSTI)!
    expect(laajuus).toMatch(/212 ikkunaa/)
    expect(laajuus).toMatch(/64 parvekeovea/)
    expect(laajuus).toMatch(/julkisivupaneloinnit/)
    /* Pistejono ei saa paatya kuvaukseen. */
    expect(laajuus).not.toMatch(/\.{4,}/)
  })

  it("paattyy seuraavaan numeroituun otsikkoon", () => {
    expect(urakanLaajuus(PDF_TEKSTI)).not.toMatch(/kokonaisurakka/)
  })

  /*
   * Osio paattyy usein PDF:n sivutunnisteeseen, joka ei kerro
   * hankkeesta. Tunnusmerkki on toisto: tunniste on joka sivulla.
   */
  it("karsii toistuvan sivun alatunnisteen", () => {
    const ALATUNNISTE = "Hämeenkyrön Asunnonhankinta Oy | Kirkkokatu 14 ja 16 | Urakkaohjelma – Liite 1"
    const teksti =
      `1. Yhteystiedot Tilaaja on Hämeenkyrön Asunnonhankinta Oy. ${ALATUNNISTE} ` +
      "2. Rakennuskohde ja urakan laajuus Kohteena ovat Kirkkokatu 14 ja Kirkkokatu 16, " +
      "39200 Hämeenkyrö. Urakkaan kuuluvat 212 ikkunaa, 64 parvekeovea ja seitsemän puuovea " +
      `sekä julkisivupaneloinnit tarjousasiakirjojen mukaisesti. ${ALATUNNISTE} ` +
      "3. Urakkamuoto Urakkamuoto on kokonaisurakka."
    const laajuus = urakanLaajuus(teksti)!
    expect(laajuus).toMatch(/212 ikkunaa/)
    expect(laajuus).not.toMatch(/Urakkaohjelma – Liite 1/)
    expect(laajuus.endsWith("mukaisesti.")).toBe(true)
  })

  it("ei karsi virkketta joka vain sattuu olemaan lopussa", () => {
    /* Kerran esiintyva hanta on sisaltoa, ei alatunniste. */
    const teksti =
      "2. Urakan laajuus Kohteena on koulun peruskorjaus. Urakkaan kuuluvat myös " +
      "piha-alueen työt ja salaojitus kokonaisuudessaan valmiiksi saatettuna. " +
      "5. Urakkamuoto Kokonaisurakka."
    const laajuus = urakanLaajuus(teksti)!
    expect(laajuus).toMatch(/salaojitus/)
  })

  /*
   * TVT Jyrkkalanrinteen urakkaohjelma: sisallysluettelo ilman
   * pistejonoa, sivunumerot kiinni sanoissa. Lapaisi ensimmaisen
   * suojan, koska kirjainosuus on korkea eika pistejonoa ole.
   */
  it("torjuu sisallysluettelon jossa ei ole pistejonoa", () => {
    const teksti =
      "URAKKAOHJELMA Urakan laajuus ja tekniset rajaukset4 7 Haitta-aineet ja " +
      "erityistyöt5 8 Työturvallisuus ja viranomaismenettelyt5 9 Työmaan toteutus ja " +
      "yhteistoiminta6 10 Tiedottaminen6 11 Työmaasuunnitelma ja -järjestelyt7"
    expect(urakanLaajuus(teksti)).toBeNull()
  })

  it("ei torju leipatekstia jossa on lukuja", () => {
    /* Leipatekstissa numeroa edeltaa valilyonti. */
    const teksti =
      "2. Urakan laajuus Purkutyö käsittää vuonna 1979 rakennetun asuinkerrostalon " +
      "purkamisen. Urakkaan kuuluvat 212 ikkunaa ja 64 parvekeovea kokonaisuudessaan " +
      "valmiiksi saatettuna tarjousasiakirjojen mukaisesti. 5. Urakkamuoto Kokonaisurakka."
    const laajuus = urakanLaajuus(teksti)!
    expect(laajuus).toMatch(/212 ikkunaa/)
    expect(laajuus).toMatch(/vuonna 1979/)
  })

  /*
   * Ilman sanarajaa "rakennuskohteet?" osui sanan "rakennuskohteeseen"
   * sisaan, ja poiminta alkoi kesken virkettä keskelta YSE-vakiotekstia.
   */
  it("ei osu hakusanan sisaan toisessa sanassa", () => {
    const teksti =
      "Urakoitsija on velvollinen rakennuskohteeseen sopimuksessa määritetyn " +
      "työntuloksen ja luovuttamaan sen sopimusasiakirjojen mukaisesti valmiina " +
      "rakennuttajalle. Urakoitsija toimittaa huoltokirjatiedot tilaajalle."
    expect(urakanLaajuus(teksti)).toBeNull()
  })

  it("palauttaa null kun osiota ei ole", () => {
    expect(urakanLaajuus("Tarjouspyyntö. Pyydämme tarjoustanne oheisen mukaisesti.")).toBeNull()
    expect(urakanLaajuus(null)).toBeNull()
    expect(urakanLaajuus("")).toBeNull()
  })

  it("palauttaa null kun osiossa ei ole proosaa", () => {
    /* Pelkka otsikko ja sivunumero ei ole kuvaus. */
    expect(urakanLaajuus("2. Urakan laajuus ................ 3 4. Seuraava Otsikko")).toBeNull()
  })
})
