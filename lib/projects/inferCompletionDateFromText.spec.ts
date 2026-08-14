import { describe, it, expect } from "vitest"
import { inferCompletionDateFromText, isPastDate } from "./inferCompletionDateFromText"

describe("inferCompletionDateFromText", () => {
  /*
   * Yritysten tiedotteiden aineistolla viritetyt kuviot. Nämä ovat tässä
   * siksi, että sopimuskauden lisäys ei saa muuttaa niiden tulosta -
   * uusi haara ajetaan vasta kun nämä eivät löydä mitään.
   */
  it("poimii kuukauden valmis-sanan läheltä", () => {
    expect(
      inferCompletionDateFromText("Urakka valmistuu kokonaisuudessaan syyskuussa 2025.")
    ).toBe("2025-09-30")
  })

  it("ei poimi kuukautta ilman valmis-sanaa", () => {
    expect(
      inferCompletionDateFromText("Sertifikaatti myönnettiin syyskuussa 2025.")
    ).toBeNull()
  })

  it("kartoittaa vuodenajan sen myöhäisimpään kuukauteen", () => {
    expect(
      inferCompletionDateFromText("Hankkeen arvioidaan valmistuvan loppuvuodesta 2025.")
    ).toBe("2025-12-31")
  })

  /*
   * Kunnan hankintapäätös ei sano "valmistuu syyskuussa" vaan ilmoittaa
   * sopimuskauden. Kauden loppu on se päivä johon mennessä työn on oltava
   * tehty. Mitattu rivi oli päätetty 5.12.2025 ja kausi päättyi 24.5.2026,
   * mutta se päätyi silti TIC-jonoon mahdollisuutena.
   */
  it("lukee valmistumisen sopimuskauden lopusta", () => {
    expect(
      inferCompletionDateFromText(
        "Keskusurheilukentän tekonurmen peruskorjaus. Hankinnan sopimuskausi " +
          "on 15.4.-24.5.2026."
      )
    ).toBe("2026-05-24")
  })

  it("lukee valmistumisen luovutuksen takarajasta", () => {
    expect(
      inferCompletionDateFromText(
        "Kohteen töiden tulee olla täysin valmiit ja luovutettavissa " +
          "tilaajalle viimeistään 31.5.2026."
      )
    ).toBe("2026-05-31")
  })

  /*
   * Aikavyöhyke ei saa siirtää päivää: toISOString() muuttaisi vuoden
   * ensimmäisen päivän edellisen vuoden viimeiseksi.
   */
  it("ei siirrä päivää aikavyöhykkeen verran", () => {
    expect(
      inferCompletionDateFromText("Hankinnan sopimuskausi on 1.1.2026 - 1.1.2027.")
    ).toBe("2027-01-01")
  })

  /* Tiedotteen oma valmistumislause voittaa, koska sopimuskausi on viimeisenä. */
  it("antaa valmis-lauseen voittaa sopimuskauden", () => {
    expect(
      inferCompletionDateFromText(
        "Urakka valmistuu maaliskuussa 2027. Hankinnan sopimuskausi on " +
          "1.5.2026 - 30.9.2026."
      )
    ).toBe("2027-03-31")
  })

  it("sietää tyhjän tekstin", () => {
    expect(inferCompletionDateFromText(null)).toBeNull()
    expect(inferCompletionDateFromText("")).toBeNull()
  })
})

describe("isPastDate", () => {
  it("tunnistaa menneen päivän", () => {
    expect(isPastDate("2020-01-01")).toBe(true)
  })

  it("ei pidä tulevaa päivää menneenä", () => {
    expect(isPastDate("2099-12-31")).toBe(false)
  })

  it("tyhjä ei ole mennyt", () => {
    expect(isPastDate(null)).toBe(false)
  })
})

describe("numeromuotoinen valmistumisaika", () => {
  /*
   * Kuntien hankesuunnitelmissa aikataulu kirjoitetaan lähes aina
   * numeroina, ei kuukauden nimellä. Mitattu: 52 päätösriviä, joista 39
   * oli jo mennyt - eli lähes 40 vuosia sitten valmistunutta hanketta
   * odotti katselmointijonossa merkinnällä "Suunnittelussa".
   */
  it("lukee muodon 'valmistuu 12 /2019'", () => {
    expect(
      inferCompletionDateFromText(
        "Aikataulu ja toteutus Rakentaminen alkaa 06 /19, ja työ valmistuu 12 /2019."
      )
    ).toBe("2019-12-31")
  })

  it("lukee muodon ilman välilyöntiä", () => {
    expect(inferCompletionDateFromText("Hanke valmistuu 9/2022.")).toBe("2022-09-30")
  })

  /*
   * Aloituspäivä on tyypillisesti samassa virkkeessä. Ilman
   * "valmis"-vartijaa kuvio poimisi sen ja hanke näyttäisi valmistuneen
   * ennen kuin se alkoi.
   */
  it("ei poimi pelkkää aloituspäivää", () => {
    expect(
      inferCompletionDateFromText("Rakentaminen alkaa 06/2019 ja kestää vuoden.")
    ).toBeNull()
  })

  /*
   * Kaksinumeroinen vuosi jäisi vuodeksi 19, koska päivän rakentaja lukee
   * luvun sellaisenaan. Vuosisadan arvaaminen olisi turhaa: mitatut
   * valmistumisajat kirjoitetaan aina nelinumeroisina.
   */
  it("ohittaa kaksinumeroisen vuoden", () => {
    expect(inferCompletionDateFromText("Työ valmistuu 12 /19.")).toBeNull()
  })

  /*
   * ASIAKIRJAN VALMISTUMINEN EI OLE HANKKEEN VALMISTUMINEN.
   *
   * Mitattu tapaus: Huutoniemen sairaala-alue (45 M€), jonka tekstissa
   * lukee "kehitys- ja hankesuunnitelmat valmistuvat elokuussa 2026" kun
   * tyomaavaihe on 2027-2028. Ilman tata saantoa kenttaan olisi
   * kirjoitettu 2026-08-31 ja auto-complete olisi merkinnyt hankkeen
   * valmiiksi ennen kuin rakentaminen alkaa.
   */
  it("ei poimi asiakirjan valmistumista", () => {
    expect(
      inferCompletionDateFromText(
        "Aluetta varten laaditaan kehitys- ja hankesuunnitelmat, jotka valmistuvat elokuussa 2026."
      )
    ).toBeNull()

    expect(
      inferCompletionDateFromText("Kaavaselostus valmistuu maaliskuussa 2027.")
    ).toBeNull()

    expect(
      inferCompletionDateFromText("Osayleiskaava valmistuu 6/2026.")
    ).toBeNull()

    expect(
      inferCompletionDateFromText("Tarveselvitys valmistuu syksylla 2026.")
    ).toBeNull()
  })

  /*
   * "SUUNNITELMAN MUKAAN" ON ADVERBIAALI, EI SUBJEKTI. Talloin
   * valmistuva asia on rakennus, ja paiva on oikea.
   */
  it("poimii paivan kun suunnitelma on vain viittaus", () => {
    expect(
      inferCompletionDateFromText("Suunnitelman mukaan rakennus valmistuu 12/2027.")
    ).toBe("2027-12-31")

    expect(
      inferCompletionDateFromText(
        "Suunnitelman mukaan kohde valmistuu joulukuussa 2027."
      )
    ).toBe("2027-12-31")
  })

  it("poimii rakennuksen valmistumisen normaalisti", () => {
    expect(
      inferCompletionDateFromText("Urakka valmistuu kokonaisuudessaan syyskuussa 2025.")
    ).toBe("2025-09-30")
  })

  /*
   * "KK" LUVUN JA VUODEN VALISSA. Helsingin paatosteksteissa kuukausi
   * merkitaan yksikkoineen. Mitattu tapaus: Kannelmaen peruskoulun
   * purkaminen (HEL-2021-006032), joka oli jonossa viisi vuotta
   * valmistumisajan jalkeen koska muoto jai poimimatta.
   */
  it("poimii kuukauden kk-yksikon kanssa", () => {
    expect(
      inferCompletionDateFromText("Tyo on suunniteltu valmistuvaksi 5 kk/2021.")
    ).toBe("2021-05-31")

    expect(
      inferCompletionDateFromText("Purkutyo valmistuu 01 kk/2023.")
    ).toBe("2023-01-31")

    expect(
      inferCompletionDateFromText("Hanke valmistuu 12 kk/2024.")
    ).toBe("2024-12-31")
  })

  it("ei sekoa kk-muodossa asiakirjan valmistumiseen", () => {
    expect(
      inferCompletionDateFromText("Hankesuunnitelma valmistuu 5 kk/2021.")
    ).toBeNull()
  })

  /*
   * KAYTTOONOTTO ON VALMISTUMINEN. Helsingin tarveselvitys- ja
   * hankesuunnitelmapaatoksissa luovutus ilmaistaan vakiokaavalla jossa
   * ei esiinny "valmis"-vartaloa lainkaan. Mitattu tapaus: Abraham
   * Wetterin tien paivakoti, joka on tanaan auki nimella Paivakoti
   * Kirsikkapuisto mutta oli jonossa vaiheessa "Suunnittelu".
   */
  it("poimii kayttoonoton", () => {
    expect(
      inferCompletionDateFromText(
        "Uudisrakennus otetaan käyttöön kalustettuna elokuuhun 2023 mennessä."
      )
    ).toBe("2023-08-31")

    expect(
      inferCompletionDateFromText(
        "Rakennus otetaan käyttöön kalustettuna tammikuussa 2025."
      )
    ).toBe("2025-01-31")
  })

  /*
   * VAISTOTILAN KAYTTOONOTTO ON PAINVASTAINEN SIGNAALI: se otetaan
   * kayttoon kun varsinainen tyo ALKAA.
   */
  it("ei poimi vaistotilan kayttoonottoa", () => {
    expect(
      inferCompletionDateFromText("Väistötilat otetaan käyttöön elokuuhun 2023 mennessä.")
    ).toBeNull()
  })

  /*
   * Pelkka sanan esiintyminen tekstissa ei saa estaa poimintaa:
   * kuvauksissa lukee usein etta vaistotiloja EI tarvita.
   */
  it("sietaa vaistotilamaininnan toisessa lauseessa", () => {
    expect(
      inferCompletionDateFromText(
        "Hankkeen toteutuksen yhteydessä ei tarvita väistötiloja. " +
          "Uudisrakennus otetaan käyttöön kalustettuna elokuuhun 2023 mennessä."
      )
    ).toBe("2023-08-31")
  })

  it("ei poimi asiakirjan kayttoonottoa", () => {
    expect(
      inferCompletionDateFromText("Hankesuunnitelma otetaan käyttöön elokuuhun 2023 mennessä.")
    ).toBeNull()
  })
})

describe("vuosiraja", () => {
  /*
   * KUUKAUSIPAATTEEN VALINNAISUUS PAASTI LAPI RAKENNUSVUODEN. Mitattu
   * tapaus: rivi sai valmistumisajaksi 1982-08-31 kun teksti kertoi
   * rakennuksen historiasta. Vuosi rajataan 2000-luvulle, kuten
   * numeromuotoisessa kuviossa jo oli.
   */
  it("ei poimi 1900-luvun vuotta", () => {
    expect(
      inferCompletionDateFromText("Rakennus valmistui elokuu 1982 ja on peruskorjattava.")
    ).toBeNull()
  })
})

describe("pelkka vuosi ja valmistelu", () => {
  /*
   * MITATTU TAPAUS. "Nyab rakentaa sahkoaseman Forssaan": teksti on
   * "Rakentaminen alkaa elokuussa ja valmista on vuonna 2028."
   * 109 rivia kertoi valmistumisen vain vuositasolla eika mikaan
   * kuvio poiminut niita.
   */
  it("poimii pelkan vuoden", () => {
    expect(
      inferCompletionDateFromText("Rakentaminen alkaa elokuussa ja valmista on vuonna 2028.")
    ).toBe("2028-12-31")
    expect(inferCompletionDateFromText("Valmistuminen arviolta 2028.")).toBe("2028-12-31")
  })

  /*
   * VUODEN VIIMEINEN PAIVA, samasta syysta kuin vuodenajat kartoitetaan
   * myohaisimpaan kuukauteen: hanketta ei merkita valmiiksi ennen
   * aikojaan.
   */
  it("kayttaa vuoden viimeista paivaa", () => {
    expect(inferCompletionDateFromText("Kohde valmistuu 2027.")).toBe("2027-12-31")
  })

  /*
   * VALMISTELU EI OLE VALMISTUMINEN. "valmis"-vartalo osuu myos sanaan
   * valmistelu, joka tarkoittaa painvastaista.
   */
  it("ei poimi valmistelua", () => {
    expect(
      inferCompletionDateFromText("Hanke eteni valmistelun yhtiön kanssa vuoden 2024 aikana.")
    ).toBeNull()
    expect(inferCompletionDateFromText("Asia on valmisteilla vuonna 2026.")).toBeNull()
  })

  /* Tarkempi kuvio voittaa yha: kuukausi ennen pelkkaa vuotta. */
  it("suosii kuukautta pelkan vuoden sijaan", () => {
    expect(
      inferCompletionDateFromText("Urakka valmistuu syyskuussa 2025 ja takuuaika paattyy 2027.")
    ).toBe("2025-09-30")
  })
})
