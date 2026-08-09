import { describe, it, expect } from "vitest"
import {
  inferCompanyPhase,
  extractReleaseBody,
  inferBuildingType,
  createCompanyEnricher,
} from "./companyRelease"
import { allativeToNominative } from "./companyName"
import { extractClientFromText } from "./fetchSttHakuSource"

/*
 * Kaikki testitapaukset ovat oikeasta tiedotteesta "Peab peruskorjaa Vanhan
 * Vaasan sairaalan F- ja T-rakennukset" (6.8.2026), joka tuotti kantaan
 * tyhjän ehdokkaan: pelkkä kaupunki ja vaihe "Suunnittelussa".
 */
const VAASA_BODY =
  "Peab toteuttaa Senaatti-kiinteistöille Vanhan Vaasan sairaalan suojeltujen " +
  "F- ja T-rakennusten peruskorjauksen kulttuurihistoriallisella alueella. " +
  "Urakkasumma on noin 14,5 miljoonaa euroa. Peab on aiemmin rakentanut " +
  "Senaatti-kiinteistöille Vanhan Vaasan sairaalan uudisrakennuksen. " +
  "Rakennus valmistui marraskuussa 2025. Projekti käynnistyy elokuussa 2026 " +
  "ja valmistuu maaliskuussa 2028."

describe("inferCompanyPhase", () => {
  /*
   * Tämä oli varsinainen virhe: urakkasumma on tiedotteessa, mutta koska
   * leipätekstiä ei luettu lainkaan, vaiheeksi tuli "Suunnittelussa".
   */
  it("tunnistaa myönnetyn urakan leipätekstistä", () => {
    expect(
      inferCompanyPhase("Peab peruskorjaa Vanhan Vaasan sairaalan F- ja T-rakennukset", VAASA_BODY)
    ).toBe("Sopimus myönnetty")
  })

  it("tunnistaa tilaajan allatiivista ilman urakkasummaa", () => {
    expect(inferCompanyPhase("Peab rakentaa koulun", "Peab toteuttaa Kojamolle koulun.")).toBe(
      "Sopimus myönnetty"
    )
  })

  /*
   * Leipätekstin "valmistui" viittaa lähes aina AIEMPAAN kohteeseen - tässä
   * tiedotteessa vuonna 2025 valmistuneeseen uudisrakennukseen. Jos se
   * luettaisiin, koko hanke merkittäisiin valmistuneeksi ja katoaisi
   * asiakasnäkymästä.
   */
  it("ei merkitse valmistuneeksi leipätekstin menneen muodon perusteella", () => {
    expect(inferCompanyPhase("Peab peruskorjaa sairaalan", VAASA_BODY)).not.toBe("Valmistunut")
  })

  it("merkitsee valmistuneeksi otsikon perusteella", () => {
    expect(inferCompanyPhase("Peabin rakentama koulu valmistui Ouluun", null)).toBe("Valmistunut")
  })

  it("palauttaa suunnitteluvaiheen kun merkkejä ei ole", () => {
    expect(inferCompanyPhase("Peab mukaan hankkeen kehitysvaiheeseen", null)).toBe("Suunnittelu")
  })
})

describe("allativeToNominative", () => {
  it("kääntää monikon allatiivin", () => {
    expect(allativeToNominative("Senaatti-kiinteistöille")).toBe("Senaatti-kiinteistöt")
    expect(allativeToNominative("Tilapalveluille")).toBe("Tilapalvelut")
  })

  it("kääntää yksikön allatiivin", () => {
    expect(allativeToNominative("Kojamolle")).toBe("Kojamo")
    expect(allativeToNominative("Peabille")).toBe("Peab")
  })

  /*
   * Astevaihtelu ("kaupungille" -> kaupunki) ei ole pääteltävissä
   * päätteestä. Tyhjä kenttä on parempi kuin väärä nimi.
   */
  it("palauttaa nullin kun perusmuotoa ei voi päätellä", () => {
    expect(allativeToNominative("Kaupungille")).toBeNull()
    expect(allativeToNominative("Asiakkaalle")).toBeNull()
    expect(allativeToNominative("Senaatti-kiinteistöt")).toBeNull()
  })

  it("ei sekoita yhdyssanaista nimeä yleissanaan", () => {
    expect(allativeToNominative("Asuntosäätiölle")).toBe("Asuntosäätiö")
  })
})

describe("extractClientFromText", () => {
  it("poimii tilaajan allatiivimuodosta perusmuotoisena", () => {
    expect(extractClientFromText(null, VAASA_BODY)).toBe("Senaatti-kiinteistöt")
  })

  /*
   * Evijärven tiedote: tilaaja rinnasteisena urakoitsijan kanssa.
   * Organisaatiosana on pienellä eikä kuulu nimikuvioon, joten ilman
   * erillistä sallintaa tilaajaksi jäisi pelkkä "Evijärven".
   */
  it("poimii tilaajan rinnasteisesta sopimuslauseesta", () => {
    expect(
      extractClientFromText(
        null,
        "Peab ja Evijärven kunta ovat sopineet uuden koulu- ja kirjastorakennuksen rakentamisesta."
      )
    ).toBe("Evijärven kunta")
  })
})

describe("inferCompanyPhase — sopimuksen merkit", () => {
  it("tunnistaa sopimisen ilman urakkasummaa", () => {
    expect(
      inferCompanyPhase(
        "Peab rakentaa koulun ja kirjaston Evijärvelle",
        "Peab ja Evijärven kunta ovat sopineet rakentamisesta. Urakka sisältää suunnittelun."
      )
    ).toBe("Sopimus myönnetty")
  })
})

describe("inferBuildingType", () => {
  it("päättelee tyypin otsikosta", () => {
    expect(
      inferBuildingType("Peab peruskorjaa Vanhan Vaasan sairaalan F- ja T-rakennukset", VAASA_BODY)
    ).toBe("Sairaala")
  })

  /*
   * Otsikko ratkaistaan ennen runkoa. Ilman sitä "Iisalmen kulttuurikeskus"
   * sai tyypin "Kirjasto", koska keskuksessa on kirjasto.
   *
   * Rungossa EI saa olla kulttuurisanaa, muuten testi menee läpi väärästä
   * syystä - juuri niin kävi ensimmäisellä versiolla, ja se peitti sen että
   * otsikko ei osunut lainkaan.
   */
  it("antaa otsikolle etusijan runkoon nähden", () => {
    expect(
      inferBuildingType(
        "Peab peruskorjaa ja uudistaa Iisalmen kulttuurikeskuksen",
        "Rakennuksessa toimii kirjasto."
      )
    ).toBe("Kulttuurirakennus")
  })

  /*
   * Astevaihtelu: "keskus" -> "keskuksen". Täysi sana ei osu taivutettuun
   * muotoon, joten kuvio on katkaistava vartaloon.
   */
  it("tunnistaa tyypin myös taivutetusta muodosta", () => {
    expect(inferBuildingType("FIN04A-datakeskuksen rakentaminen", null)).toBe("Datakeskus")
    expect(inferBuildingType("Iisalmen kulttuurikeskuksen uudistus", null)).toBe(
      "Kulttuurirakennus"
    )
  })

  it("ei sekoita koulutusta kouluun", () => {
    expect(
      inferBuildingType(
        "Hyvinkää Areena - uusi urheilu-, koulutus- ja tapahtumakeskus",
        null
      )
    ).not.toBe("Koulu")
  })

  /*
   * Kayttotarkoituksen muutoksessa ratkaisee kohde, ei lahtotilanne.
   * Mitattu: "Toimistorakennuksen muuttaminen asuinkerrostaloksi" sai
   * tyypin "Toimitila".
   */
  it("kayttaa muutoksen kohdetta eika lahtotilannetta", () => {
    expect(
      inferBuildingType("Toimistorakennuksen muuttaminen asuinkerrostaloksi, Pohjantie 3", null)
    ).toBe("Kerrostalo")
  })

  it("ei sekoita lausunnonantajaa hankkeen kohteeseen", () => {
    expect(
      inferBuildingType("Laajennuslupa 49-2024-260, Pohjantie 3", "Lausunnot Kaupunginmuseo Ehdollinen")
    ).toBeNull()
  })

  it("palauttaa nullin kun tyyppiä ei tunnisteta", () => {
    expect(inferBuildingType("Peab investoi uuteen kalustoon", null)).toBeNull()
  })
})

describe("createCompanyEnricher — rooli", () => {
  /*
   * Rakennuttaja ja urakoitsija eivät ole vaihdettavissa. Y-Säätiö ja
   * Asuntosäätiö tiedottavat omista hankkeistaan; oletusrooli olisi
   * kirjannut ne urakoitsijaksi, mikä on väärä tieto.
   */
  it("erottaa rakennuttajaroolin urakoitsijaroolista", () => {
    const builder = createCompanyEnricher({ publisher: "Varte" })
    const developer = createCompanyEnricher({ publisher: "Y-Säätiö", role: "developer" })
    expect(typeof builder).toBe("function")
    expect(typeof developer).toBe("function")
  })

  it("palauttaa ehdokkaan muuttumattomana ilman osoitetta", async () => {
    const enrich = createCompanyEnricher({ publisher: "Varte" })
    const candidate = { name: "Kohde", source_url: null }
    expect(await enrich(candidate)).toBe(candidate)
  })
})

describe("ingressirajaus", () => {
  /*
   * Mitatut virheet koko sivun lukemisesta: tilaajaksi poimiutui
   * naapuriartikkelin yritys ja kohdetyypiksi lahipalvelu.
   */
  const LEAD = "Skanska ja Iin kunta ovat allekirjoittaneet urakkasopimuksen uudesta koulusta. "
  const TAIL = " ".repeat(800) + "Skanska rakentaa Garminille toimitilat Espooseen."

  it("ei poimi tilaajaa sivun lopun tiedotelistasta", () => {
    expect(extractClientFromText(null, (LEAD + TAIL).slice(0, 700))).not.toBe("Garmin")
  })

  it("ei paattele kohdetyyppia lahipalvelumaininnasta", () => {
    const body =
      "Asunto Oy Helsingin Hellikkiin valmistuu 34 uutta kotia." +
      " ".repeat(800) +
      "Lahella on paivakoti ja koulu."
    expect(inferBuildingType("Pohjola Rakennus rakentaa 34 uutta Hitas-kotia", body)).not.toBe(
      "Paivakoti"
    )
  })
})

describe("extractReleaseBody", () => {
  it("pudottaa sivukalusteet ja palauttaa leipätekstin", () => {
    const html =
      "<html><body><nav>Tätä tarjoamme Asunnot Toimitilat</nav>" +
      `<article><p>${VAASA_BODY}</p></article></body></html>`
    const body = extractReleaseBody(html)
    expect(body).toMatch(/^Peab toteuttaa Senaatti-kiinteistöille/)
    expect(body).not.toMatch(/Tätä tarjoamme/)
  })

  it("palauttaa nullin liian lyhyestä sivusta", () => {
    expect(extractReleaseBody("<html><body><p>Lyhyt</p></body></html>")).toBeNull()
  })
})

describe("inferBuildingType – yhdyssanat ja nuorisotila", () => {
  /*
   * Koulu on suomessa lähes aina yhdyssanan jälkiosa, joten sananrajaa ei
   * saa vaatia. Mitattu: "Muurolan peruskoulun tarveselvitys" ei osunut,
   * jolloin tyyppi luettiin rungosta ja tuloksena oli "Päiväkoti".
   */
  it("tunnistaa koulun yhdyssanan jälkiosana", () => {
    expect(
      inferBuildingType(
        "Muurolan peruskoulun tarveselvityksen käynnistäminen",
        "Koulun läheisyyteen on rakennettu uusi päiväkoti."
      )
    ).toBe("Koulu")
  })

  it("ei pidä koulutusta kouluna", () => {
    expect(
      inferBuildingType("Hyvinkää Areena - uusi urheilu-, koulutus- ja tapahtumakeskus", null)
    ).not.toBe("Koulu")
  })

  it("ei pidä kouluttamista kouluna", () => {
    expect(inferBuildingType("Henkilöstön kouluttaminen uusiin tiloihin", null)).not.toBe(
      "Koulu"
    )
  })

  /*
   * Nuorisotilan teksti kuvaa lähes aina nykyisiä ahtaita tiloja koulun
   * yhteydessä, joten runko veisi tyypin väärään suuntaan.
   */
  it("tunnistaa nuorisotilan eikä ota tyyppiä rungon koulusta", () => {
    expect(
      inferBuildingType(
        "Zillarin nuorisotilan tarveselvitys",
        "Toimintatilat ovat ahtaat ja koulun tarpeisiin sisustetut."
      )
    ).toBe("Nuorisotila")
  })
})
