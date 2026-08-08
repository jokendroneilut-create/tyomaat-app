import { describe, it, expect } from "vitest"
import { inferPeabPhase, extractPeabBody } from "./fetchPeabSource"
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

describe("inferPeabPhase", () => {
  /*
   * Tämä oli varsinainen virhe: urakkasumma on tiedotteessa, mutta koska
   * leipätekstiä ei luettu lainkaan, vaiheeksi tuli "Suunnittelussa".
   */
  it("tunnistaa myönnetyn urakan leipätekstistä", () => {
    expect(
      inferPeabPhase("Peab peruskorjaa Vanhan Vaasan sairaalan F- ja T-rakennukset", VAASA_BODY)
    ).toBe("Sopimus myönnetty")
  })

  it("tunnistaa tilaajan allatiivista ilman urakkasummaa", () => {
    expect(inferPeabPhase("Peab rakentaa koulun", "Peab toteuttaa Kojamolle koulun.")).toBe(
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
    expect(inferPeabPhase("Peab peruskorjaa sairaalan", VAASA_BODY)).not.toBe("Valmistunut")
  })

  it("merkitsee valmistuneeksi otsikon perusteella", () => {
    expect(inferPeabPhase("Peabin rakentama koulu valmistui Ouluun", null)).toBe("Valmistunut")
  })

  it("palauttaa suunnitteluvaiheen kun merkkejä ei ole", () => {
    expect(inferPeabPhase("Peab mukaan hankkeen kehitysvaiheeseen", null)).toBe("Suunnittelu")
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
})

describe("extractPeabBody", () => {
  it("pudottaa sivukalusteet ja palauttaa leipätekstin", () => {
    const html =
      "<html><body><nav>Tätä tarjoamme Asunnot Toimitilat</nav>" +
      `<article><p>${VAASA_BODY}</p></article></body></html>`
    const body = extractPeabBody(html)
    expect(body).toMatch(/^Peab toteuttaa Senaatti-kiinteistöille/)
    expect(body).not.toMatch(/Tätä tarjoamme/)
  })

  it("palauttaa nullin liian lyhyestä sivusta", () => {
    expect(extractPeabBody("<html><body><p>Lyhyt</p></body></html>")).toBeNull()
  })
})
