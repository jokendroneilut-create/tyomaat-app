import { describe, it, expect } from "vitest"
import {
  extractContractPeriod,
  inferDecisionPhase,
  phaseFromTitle,
} from "./decisionPhase"

const NYT = new Date(2026, 7, 9) /* 9.8.2026 */

describe("extractContractPeriod", () => {
  it("poimii sopimuskauden molemmilla vuosilla", () => {
    const p = extractContractPeriod("Hankinnan sopimuskausi on 1.5.2026 – 30.9.2026.")
    expect(p?.start?.getFullYear()).toBe(2026)
    expect(p?.start?.getMonth()).toBe(4)
    expect(p?.end.getMonth()).toBe(8)
  })

  /*
   * Alkuvuosi puuttuu kun kausi on saman vuoden sisällä. Ilman lukemista
   * loppupäivästä alkupäivä jäisi tulkitsematta.
   */
  it("lukee puuttuvan alkuvuoden loppupäivästä", () => {
    const p = extractContractPeriod("Hankinnan sopimuskausi on 15.4.-24.5.2026.")
    expect(p?.start?.getFullYear()).toBe(2026)
    expect(p?.start?.getDate()).toBe(15)
    expect(p?.end.getDate()).toBe(24)
  })

  it("poimii luovutuksen takarajan kun sopimuskautta ei ole", () => {
    const p = extractContractPeriod(
      "Kohteen töiden tulee olla täysin valmiit ja luovutettavissa " +
        "tilaajalle viimeistään 31.5.2026."
    )
    expect(p?.start).toBeNull()
    expect(p?.end.getDate()).toBe(31)
  })

  /*
   * Pehmeät tavuviivat ja nollan levyiset välit katkaisevat kuvion
   * näkymättömästi. Päätösaineistossa niitä on keskellä sanoja.
   */
  it("sietää näkymättömiä merkkejä tekstissä", () => {
    expect(
      extractContractPeriod("Hankinnan sopi­muskausi on 1.6.2024 - 30.9.2024.")
    ).not.toBeNull()
  })

  /*
   * Toteutusaikataulu on ALUSTAVA ja kuvaa suunnitteluvaiheita, joten siitä
   * luettu vaihe olisi arvaus. Hanke on juuri siinä vaiheessa miksi se on
   * merkittykin.
   */
  it("ei lue vaihetta alustavasta toteutusaikataulusta", () => {
    expect(
      extractContractPeriod(
        "Alustava toteutusaikataulu on seuraava: hankesuunnitelman " +
          "hyväksyminen 6/2026, toteutussuunnittelu 8/2026–2/2027."
      )
    ).toBeNull()
  })

  it("ei lue vaihetta päivämäärättömästä urakka-ajasta", () => {
    expect(
      extractContractPeriod(
        "Hankinta-asiakirjojen mukaan urakka-aika alkaa ja urakkasopimus " +
          "tulee voimaan, kun sopimus on allekirjoitettu."
      )
    ).toBeNull()
  })

  it("sietää tyhjän kuvauksen", () => {
    expect(extractContractPeriod(null)).toBeNull()
    expect(extractContractPeriod("")).toBeNull()
  })
})

describe("inferDecisionPhase", () => {
  /*
   * Mitattu rivi: päätös 5.12.2025, urakoitsija valittu, sopimuskausi
   * päättyi 24.5.2026 - silti vaihe oli "Suunnittelussa", koska otsikossa
   * "Keskusurheilukentän tekonurmen peruskorjaus" ei ole sanaa urakka.
   */
  it("päättynyt sopimuskausi tarkoittaa valmista", () => {
    expect(
      inferDecisionPhase({
        description: "Hankinnan sopimuskausi on 15.4.-24.5.2026.",
        hasWinner: true,
        fallback: "Suunnittelussa",
        now: NYT,
      })
    ).toBe("Valmistunut")
  })

  it("käynnissä oleva sopimuskausi tarkoittaa rakenteilla", () => {
    expect(
      inferDecisionPhase({
        description: "Hankinnan sopimuskausi on 11.5.2026 – 30.10.2026.",
        hasWinner: true,
        fallback: "Suunnittelussa",
        now: NYT,
      })
    ).toBe("Rakenteilla")
  })

  it("tuleva sopimuskausi tarkoittaa myönnettyä sopimusta", () => {
    expect(
      inferDecisionPhase({
        description: "Hankinnan sopimuskausi on 1.10.2026 – 30.4.2027.",
        hasWinner: false,
        fallback: "Suunnittelussa",
        now: NYT,
      })
    ).toBe("Sopimus myönnetty")
  })

  /* Voittaja yksin riittää: sopimus on myönnetty vaikka aikaa ei mainita. */
  it("voittaja tarkoittaa myönnettyä sopimusta ilman aikatietoa", () => {
    expect(
      inferDecisionPhase({
        description: "Urakoitsijaksi valitaan MVR-Yhtymä Oy.",
        hasWinner: true,
        fallback: "Suunnittelussa",
        now: NYT,
      })
    ).toBe("Sopimus myönnetty")
  })

  /*
   * Ilman kumpaakaan signaalia lähteen oma päättely jää voimaan. Helsingin
   * otsikkopäättely on rikkaampi kuin muiden, eikä sitä haluta menettää.
   */
  it("palauttaa varalla olevan arvon kun signaalia ei ole", () => {
    expect(
      inferDecisionPhase({
        description: "Tarveselvitys hyväksytään jatkosuunnittelun pohjaksi.",
        hasWinner: false,
        fallback: "Suunnittelu",
        now: NYT,
      })
    ).toBe("Suunnittelu")
  })
})

describe("phaseFromTitle", () => {
  it("tunnistaa urakan otsikosta", () => {
    expect(phaseFromTitle("Sipolantien 9 purku-urakka")).toBe("Sopimus myönnetty")
  })

  it("muuten suunnittelussa", () => {
    expect(phaseFromTitle("Keskusurheilukentän tekonurmen peruskorjaus")).toBe(
      "Suunnittelussa"
    )
  })
})

describe("phaseFromTitle – kilpailutuksen aloitus", () => {
  /*
   * Kilpailutuksen ALOITUSPÄÄTÖS ei ole myönnetty sopimus. Otsikossa on
   * sana "urakka", joten pelkkä /urak/ antoi vaiheeksi "Sopimus myönnetty"
   * vaikka urakoitsijaa ei ole vielä valittu.
   */
  it("tunnistaa kilpailutusperiaatteet kilpailutukseksi", () => {
    expect(
      phaseFromTitle(
        "Puhjon risteyssilta (W) korjausurakka 2026, korjausurakan kilpailuttaminen, kilpailutusperiaatteet"
      )
    ).toBe("Kilpailutus")
  })

  it("pitää urakoitsijan valinnan yhä myönnettynä sopimuksena", () => {
    expect(phaseFromTitle("Näsin tekojään perusparantaminen - urakoitsijan valinta")).toBe(
      "Sopimus myönnetty"
    )
  })
})

describe("extractContractPeriod – kuukausiväli", () => {
  /*
   * Mitattu rivi: "Sopimuskausi on 04-12.2025". Päivämääräkuvio ei osu
   * pelkkiin kuukausiin, joten kausi jäi lukematta ja hanke näytti
   * myönnetyltä sopimukselta vielä puoli vuotta päättymisen jälkeen.
   */
  it("lukee kuukausivälin ja päättää kuun viimeiseen päivään", () => {
    const p = extractContractPeriod("Sopimuskausi on 04-12.2025 ja se alkaa, kun päätös on lainvoimainen.")
    expect(p?.start?.getFullYear()).toBe(2025)
    expect(p?.start?.getMonth()).toBe(3) /* huhtikuu */
    expect(p?.end.getMonth()).toBe(11) /* joulukuu */
    expect(p?.end.getDate()).toBe(31)
  })

  it("päättelee vuodenvaihteen ylittävän kauden alkuvuoden", () => {
    const p = extractContractPeriod("Sopimuskausi on 11-03.2026")
    expect(p?.start?.getFullYear()).toBe(2025)
    expect(p?.end.getFullYear()).toBe(2026)
    expect(p?.end.getDate()).toBe(31) /* maaliskuu */
  })

  /* Päivämäärämuoto ajetaan ensin, joten se ei saa osua kuukausikuvioon. */
  it("ei sekoita päivämäärämuotoa kuukausiväliksi", () => {
    const p = extractContractPeriod("Hankinnan sopimuskausi on 1.5.2026 – 30.9.2026.")
    expect(p?.start?.getMonth()).toBe(4)
    expect(p?.end.getMonth()).toBe(8)
    expect(p?.end.getDate()).toBe(30)
  })

  it("päättynyt kuukausikausi tarkoittaa valmista", () => {
    expect(
      inferDecisionPhase({
        description: "Sopimuskausi on 04-12.2025 ja se alkaa, kun päätös on lainvoimainen.",
        hasWinner: true,
        fallback: "Sopimus myönnetty",
        now: NYT,
      })
    ).toBe("Valmistunut")
  })
})

describe("inferDecisionPhase – kilpailutus tekstistä", () => {
  /*
   * Mitattu rivi: "Päällystysurakka 2026 + optiot – sisäinen
   * hankintapäätös". Otsikon sana "urakka" antoi vaiheeksi "Sopimus
   * myönnetty", vaikka teksti sanoo että työ vasta kilpailutetaan.
   */
  it("tunnistaa tulevan kilpailutuksen tekstistä", () => {
    expect(
      inferDecisionPhase({
        description: "Päällystysurakassa kilpailutetaan kaupungin katujen päällystystyöt.",
        hasWinner: false,
        fallback: "Sopimus myönnetty",
        title: "Päällystysurakka 2026 + optiot (1+1+1) – sisäinen hankintapäätös",
        now: NYT,
      })
    ).toBe("Kilpailutus")
  })

  /*
   * Kolme vartijaa, koska sana "kilpailutetaan" osuu aineistossa neljään
   * riviin joista vain yksi on kilpailutuspäätös.
   */
  it("ei laukea kun voittaja on tiedossa", () => {
    expect(
      inferDecisionPhase({
        description: "Urakassa kilpailutetaan työt. Urakoitsijaksi valitaan MVR-Yhtymä Oy.",
        hasWinner: true,
        fallback: "Suunnittelussa",
        title: "Päällystysurakka 2026",
        now: NYT,
      })
    ).toBe("Sopimus myönnetty")
  })

  it("ei laukea menneestä muodosta", () => {
    expect(
      inferDecisionPhase({
        description: "Hankinta on kilpailutettu avointa menettelyä käyttäen.",
        hasWinner: false,
        fallback: "Sopimus myönnetty",
        title: "Päällystysurakka 2026",
        now: NYT,
      })
    ).toBe("Sopimus myönnetty")
  })

  /*
   * Otsikkovartija pudottaa vuokrauspäätöksen ja lausunnon, joissa sana
   * esiintyy sivulauseessa.
   */
  it("ei laukea kun otsikko ei ole urakka", () => {
    expect(
      inferDecisionPhase({
        description: "Tilat kilpailutetaan myöhemmin erikseen.",
        hasWinner: false,
        fallback: "Suunnittelussa",
        title: "Tilapäällikön päätös tilojen vuokraamisesta",
        now: NYT,
      })
    ).toBe("Suunnittelussa")
  })
})
