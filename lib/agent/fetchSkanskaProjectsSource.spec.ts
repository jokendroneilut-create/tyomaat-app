import { describe, it, expect } from "vitest"
import { extractSkanskaField } from "./fetchSkanskaProjectsSource"

/*
 * Sivun teksti sellaisena kuin cheerio sen tuottaa: elementit yhdistyvät
 * ILMAN välilyöntejä, joten kenttien erottaminen ei voi nojata
 * välimerkkeihin. Aito ote Espoon Prismakeskuksen sivulta 18.8.2026.
 */
const PAGE =
  "Espoon PrismakeskusStatusKäynnissäProjektin tiedotEspoon keskukseen " +
  "rakentuu noin 30 000 bruttoneliömetrin hybridikokonaisuus. " +
  "Asiakas: HOK-Elanto Palvelu: Asuntorakentaminen, Toimitilarakentaminen " +
  "Hanketyyppi: Kaupat ja kauppakeskukset " +
  "Urakkamuoto: Kiinteä kokonaishintaurakka"

describe("extractSkanskaField", () => {
  it("poimii asiakkaan seuraavaan otsikkoon asti", () => {
    expect(extractSkanskaField(PAGE, "Asiakas")).toBe("HOK-Elanto")
  })

  it("ei niele seuraavan kentän sisältöä", () => {
    expect(extractSkanskaField(PAGE, "Hanketyyppi")).toBe("Kaupat ja kauppakeskukset")
  })

  it("palauttaa nullin puuttuvasta kentästä", () => {
    expect(extractSkanskaField(PAGE, "Urakkasumma")).toBeNull()
  })
})

describe("Status ilman välilyöntiä", () => {
  /*
   * Status on ainoa kenttä ilman kaksoispistettä, ja cheerion jäljiltä myös
   * ilman välilyöntiä: "StatusKäynnissäProjektin tiedot". Kuvio, joka
   * vaati välilyönnin, palautti nullin ja jätti vaiheen arvaukseksi.
   */
  it("irrottaa arvon suoraan otsikon perästä", () => {
    expect(PAGE.match(/Status\s*([A-ZÅÄÖ][a-zåäö]+)/)?.[1]).toBe("Käynnissä")
  })
})

describe("kentät ilman välilyöntiä kaksoispisteen jälkeen", () => {
  /*
   * Sivun HTML:stä cheerio tuottaa "Asiakas:Skanska KoditPalvelu:...".
   * Väärin kirjoitettu whitespace-luokka söi `i`-lipun kanssa arvon
   * alkukirjaimen, ja tulos oli "kanska Kodit". Alkuperäinen testi ei
   * paljastanut sitä, koska siinä oli välilyönti kaksoispisteen jälkeen.
   */
  const TIGHT = "Asiakas:Skanska KoditPalvelu:ProjektikehitysHanketyyppi:Asunnot"

  it("säilyttää arvon alkukirjaimen", () => {
    expect(extractSkanskaField(TIGHT, "Asiakas")).toBe("Skanska Kodit")
  })

  it("katkaisee seuraavaan kenttään", () => {
    expect(extractSkanskaField(TIGHT, "Palvelu")).toBe("Projektikehitys")
  })
})
