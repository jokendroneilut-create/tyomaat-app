import { describe, expect, it } from "vitest"

import { inferBuildingType } from "./buildingType"

/*
 * Sääntö on kohdetyypin ensisijainen lähde: se on ilmainen, toistettava
 * ja mitattu lähes virheettömäksi. Jokainen tässä testattu tapaus on
 * kannasta luettu virhe, ei keksitty esimerkki.
 */
describe("inferBuildingType", () => {
  it("tunnistaa kaupan kohteet", () => {
    expect(inferBuildingType("Puuilo-myymälä Jämsään", null)).toBe("Kauppa")
    expect(inferBuildingType("Skanska toteuttaa Lahteen uuden K-Citymarketin", null)).toBe("Kauppa")
    expect(inferBuildingType("Kauppakeskuksen laajennus", null)).toBe("Kauppa")
  })

  it("lukee katu- ja puistosuunnitelman infraksi", () => {
    expect(inferBuildingType("Atlantinaukio, katusuunnitelma, Länsisatama", null)).toBe("Infrahanke")
    expect(inferBuildingType("Tehtaanpuisto, puistosuunnitelman hyväksyminen, Punavuori", null)).toBe(
      "Infrahanke"
    )
  })

  /* Leikkipuisto ja liikuntapuisto ovat taulussa ennen infraa. */
  it("ei vie leikki- eika liikuntapuistoa infraan", () => {
    expect(inferBuildingType("Leikkipuisto Trumpetin puistosuunnitelma", null)).toBe("Leikkipuisto")
    expect(inferBuildingType("Liikuntapuiston puistosuunnitelma", null)).toBe("Liikuntapaikka")
  })

  /*
   * Siltakuvio on kapea tarkoituksella: "silta" on suomessa ennen
   * kaikkea paikannimi. Nama paikannimet luettiin kannasta.
   */
  it("tunnistaa siltatyon mutta ei paikannimea", () => {
    expect(inferBuildingType("Härmälänojan silta", null)).toBe("Silta")
    expect(inferBuildingType("Syrjäsalmen ratasilta", null)).toBe("Silta")
    expect(inferBuildingType("Länsiväylän ylikulkusillan peruskorjauksen hankinta", null)).toBe("Silta")
    expect(inferBuildingType("Papinsillan asemakaava", null)).not.toBe("Silta")
    expect(inferBuildingType("Pasila, Opastinsilta 1 ja 2", null)).not.toBe("Silta")
    expect(inferBuildingType("Multisilta, Multiojankatu 2, käyttötarkoituksen muutos", null)).not.toBe("Silta")
    expect(
      inferBuildingType("Matkustajakäytävien ja maihinnoususiltojen rakentaminen Turun satamaan", null)
    ).not.toBe("Silta")
  })

  it("tunnistaa logistiikkarakennuksen", () => {
    expect(
      inferBuildingType("Jatke rakentaa Lietoon alueellisesti merkittävän logistiikkarakennuksen", null)
    ).toBe("Logistiikka")
  })

  /* Vanhat mitatut virheet: nama eivat saa palata. */
  it("pitaa aiemmat rajaukset", () => {
    expect(inferBuildingType("Hyvinkää Areena - uusi urheilu-, koulutus- ja tapahtumakeskus", null)).not.toBe(
      "Koulu"
    )
    expect(inferBuildingType("Muurolan peruskoulun tarveselvitys", null)).toBe("Koulu")
    expect(
      inferBuildingType("Toimistorakennuksen muuttaminen asuinkerrostaloksi", null)
    ).toBe("Kerrostalo")
  })

  it("palauttaa null kun otsikko ei kerro tyyppia", () => {
    expect(inferBuildingType("Tokeenkatu 7", null)).toBeNull()
    expect(inferBuildingType("L29 Karstunraitti", null)).toBeNull()
  })
})
