import { describe, it, expect } from "vitest"
import {
  hankinnanArvo,
  inferPhase,
  kilpailutusHyvaksytaan,
  onPoydallePano,
  shouldExclude,
  toIsoDate,
} from "./fetchHelsinkiPaatoksetSource"

/*
 * KILPAILUTUS-LUOKAN OTSIKKOSAANTO (D-386).
 *
 * Otsikot ovat ESIMERKEIKSI POIMITTUJA AITOJA RIVEJA Ahjon
 * Kilpailutus-luokasta 7.11.2026 (382 asiaa kolmen kuukauden ikkunassa).
 * Lapi menee 21, ja jokainen testattu muoto on nahty aineistossa.
 */
const KILPAILUTUS = ["Kilpailutus"]
const RAKENTAMINEN = ["Rakennusten ja rakennelmien suunnittelu ja toteutus"]

describe("kilpailutusHyvaksytaan", () => {
  it("hyvaksyy urakoitsijan, kokonaisurakoitsijan ja toteuttajan valinnan", () => {
    for (const otsikko of [
      "Arkadiankadun katutyöt, kokonaisurakka, urakoitsijan valinta",
      "Kontulan päiväkoti, korvaava uudisrakennus, kokonaisurakoitsijan valinta",
      "Minikilpailutus, Capellanaukion rantaportaat, kokonaisurakka, urakoitsijan valinta",
      "Töölön Kisahallin perusparannus, projektinjohtourakka, toteuttajan valinta sekä sopimuksen teko",
      "Hankintapäätös, Veturitien alikulkukäytävä, urakoitsijan valinta",
    ]) {
      expect(kilpailutusHyvaksytaan(otsikko, KILPAILUTUS)).toBe(true)
    }
  })

  it("pudottaa tarjoajien valinnan: kilpailu avataan, urakoitsijaa ei valita", () => {
    expect(
      kilpailutusHyvaksytaan(
        "Itäkeskuksen peruskoulun elinkaarihanke, tarjoajien valintapäätös",
        KILPAILUTUS
      )
    ).toBe(false)
    expect(
      kilpailutusHyvaksytaan(
        "Siltamäen koulun ja päiväkodin vuokrahanke, Tarjoajien valintapäätös tarjousvaiheeseen 2",
        KILPAILUTUS
      )
    ).toBe(false)
  })

  it("pudottaa lisa- ja muutostyot seka varauksen korotuksen", () => {
    for (const otsikko of [
      "Kruunusillat – siltaurakka, kokonaisurakka, muutostyötilaus, 14 850 euroa",
      "Verkkosaaren pohjoisosa, urakka 2, kokonaisurakka, lisä- ja muutostyötilaus, 87 012,07 euroa",
      "Suorahankinta, lisätyöpäätös nro 6, kiveyksen bitumisaumaus",
      "Jätkäsaaren Bunkkerin purku- ja maanrakennustöiden lisä- ja muutostyövarauksen korotus",
    ]) {
      expect(kilpailutusHyvaksytaan(otsikko, KILPAILUTUS)).toBe(false)
    }
  })

  it("pudottaa DPS:n ja valinehankinnat", () => {
    expect(
      kilpailutusHyvaksytaan(
        "Sisäinen kilpailutus (DPS), Kotinummenpuiston pelikenttä, toimittajan valinta",
        KILPAILUTUS
      )
    ).toBe(false)
    expect(
      kilpailutusHyvaksytaan(
        "Yksikönjohtajan hankintapäätös, Lp Marielundinpuiston leikkivälineet 2026",
        KILPAILUTUS
      )
    ).toBe(false)
  })

  it("hankintaoikaisuvaatimus putoaa jo yhteiseen esteeseen", () => {
    const otsikko =
      "Hankintaoikaisuvaatimus yksikön päällikön 88 § 27.8.2026 päätöksestä koskien urakoitsijan valintaa Harakan laiturin urakassa"
    /* Sanamuoto osuu valintakuvioon, joten este on tarkistettava eika oletettava. */
    expect(kilpailutusHyvaksytaan(otsikko, KILPAILUTUS)).toBe(true)
    expect(shouldExclude(otsikko)).toBe(true)
  })

  it("ei karsi rakentamisluokan rivia, joka tulee lahteeseen jo nyt", () => {
    expect(
      kilpailutusHyvaksytaan(
        "Pukinmäenkaaren peruskoulun perusparannuksen hankesuunnitelma",
        RAKENTAMINEN
      )
    ).toBe(true)
  })
})

describe("onPoydallePano", () => {
  it("tunnistaa asian siirron seuraavaan kokoukseen", () => {
    expect(
      onPoydallePano(
        "Päätös Kaupunkiympäristölautakunnan rakennusten ja yleisten alueiden jaosto päätti panna asian pöydälle."
      )
    ).toBe(true)
  })

  it("ei osu aitoon valintaan", () => {
    expect(
      onPoydallePano(
        "Päätös Infrapäällikkö hyväksyi GRK Suomi Oy:n tarjouksen kokonaistaloudellisesti edullisimpana."
      )
    ).toBe(false)
  })
})

describe("hankinnanArvo", () => {
  it("lukee paatoksen oman sopimusarvon kolmesta muodosta", () => {
    expect(hankinnanArvo("Hankinnan arvo on 1 563 700 euroa (alv 0 %).")).toBe(
      1_563_700
    )
    expect(hankinnanArvo("Hankinnan arvo on 3 811 040,00 euroa (alv 0 %).")).toBe(
      3_811_040
    )
    expect(
      hankinnanArvo(
        "hankinnassa arvonlisäverottomaan kokonaishintaan 8 333 000 euroa"
      )
    ).toBe(8_333_000)
    expect(
      hankinnanArvo(
        "allekirjoittamaan projektinjohtourakkasopimuksen arvonlisäverottomaan projektinjohtourakan tavoitehintaan 15 720 744,34 euroa"
      )
    ).toBe(15_720_744)
  })

  it("ei poimi haviajan hintaa eika suunnittelijan arviota", () => {
    expect(
      hankinnanArvo(
        "Määräaikaan mennessä tarjouksen jättivät seuraavat tarjoajat: VRJ Suomi Oy 88 700 euroa Tieluiska Oy 191 190 euroa"
      )
    ).toBe(null)
    expect(
      hankinnanArvo(
        "Kustannukset Suunnittelijan laatima kustannusarvio urakasta on 61 604,19 euroa (alv 0 %)"
      )
    ).toBe(null)
  })
})

describe("inferPhase", () => {
  /*
   * Kunnan päätösketju on vakiintunut: tarveselvitys -> hankesuunnitelma ->
   * toteutussuunnitelma -> urakka. Vaihe kertoo käyttäjälle kuinka lähellä
   * kilpailutus on.
   */
  it("tunnistaa ketjun vaiheet otsikosta", () => {
    expect(inferPhase("Töölön kisahallin tarveselvitys")).toBe("Suunnittelu")
    expect(
      inferPhase("Pukinmäenkaaren peruskoulun perusparannuksen hankesuunnitelma")
    ).toBe("Suunnittelussa")
    expect(inferPhase("Koulun laajennuksen urakoitsijan valinta")).toBe(
      "Sopimus myönnetty"
    )
  })

  it("olettaa suunnitteluvaiheen kun otsikko ei kerro", () => {
    expect(inferPhase("Päiväkoti Viikinki, vesikaton uusiminen")).toBe(
      "Suunnittelussa"
    )
  })
})

describe("shouldExclude", () => {
  /*
   * Kategoriasuodatus jättää läpi hallinnollisia päätöksiä. Mitattu otoksesta
   * 80 % kohinaa, ja se keskittyi näihin muotoihin.
   */
  it("pudottaa korvaus- ja lausuntopäätökset", () => {
    expect(
      shouldExclude("Tontille maksettava korvaus Niittyluhdantien rakentamisen johdosta")
    ).toBe(true)
    expect(shouldExclude("Kustannusten korvaaminen pilaantuneen maaperän osalta")).toBe(
      true
    )
    expect(shouldExclude("Aamukouluasia: Toimenpideohjelma keskusta-alueelle")).toBe(true)
  })

  /*
   * Kuvioiden on oltava tarkkoja: pelkkä "korvaus" pudottaisi myös aidon
   * hankkeen. Malli teki mitatusti juuri tämän virheen.
   */
  it("ei pudota korvaavaa uudisrakennusta", () => {
    expect(
      shouldExclude("Suutarilan kirjaston ja nuorisotilan korvaavan uudisrakennuksen hankesuunnitelma")
    ).toBe(false)
  })

  it("päästää läpi aidot hankkeet", () => {
    expect(shouldExclude("Töölön kisahallin perusparannuksen hankesuunnitelma")).toBe(
      false
    )
    expect(shouldExclude("Laajasalon raitiovaunuvarikon toteutussuunnitelma")).toBe(false)
  })
})

describe("toIsoDate", () => {
  /*
   * PAATOSPAIVA ON MITATTAVUUDEN EHTO. Ahjon meeting_date on unix-sekunteina,
   * mutta aineistossa esiintyy myos ISO-merkkijono. Vaara paatospaiva olisi
   * pahempi kuin puuttuva: sen perusteella hanke voitaisiin todeta
   * vanhentuneeksi ja piilottaa asiakkaalta.
   */
  it("lukee unix-sekunnit", () => {
    expect(toIsoDate(1621209600)).toBe("2021-05-17")
  })

  it("lukee unix-millisekunnit", () => {
    expect(toIsoDate(1621209600000)).toBe("2021-05-17")
  })

  it("lukee ISO-merkkijonon", () => {
    expect(toIsoDate("2021-05-17T09:00:00Z")).toBe("2021-05-17")
    expect(toIsoDate("2021-05-17")).toBe("2021-05-17")
  })

  it("lukee numeron merkkijonona", () => {
    expect(toIsoDate("1621209600")).toBe("2021-05-17")
  })

  it("palauttaa null kelvottomasta", () => {
    expect(toIsoDate(null)).toBeNull()
    expect(toIsoDate(undefined)).toBeNull()
    expect(toIsoDate("")).toBeNull()
    expect(toIsoDate("eilen")).toBeNull()
    expect(toIsoDate(NaN)).toBeNull()
  })
})
