import { describe, it, expect } from "vitest"
import { calculateMatch, type MatchableProject } from "./projectMatcher"

function project(fields: Partial<MatchableProject> = {}): MatchableProject {
  return {
    id: "p1",
    name: null,
    city: null,
    region: null,
    location: null,
    phase: null,
    completed_at: null,
    status: "active",
    developer: null,
    property_type: null,
    additional_info: null,
    metadata: {},
    ...fields,
  } as MatchableProject
}

describe("name_in_description", () => {
  /*
   * Mitattu tapaus: ehdokkaan kuvauksessa lukee hankkeen nimi lähes
   * sanatarkasti, mutta hankkeella ei ole kuvausta lainkaan - joten
   * kuvausvertailu ei voi osua. Ilman tätä ehdokas ei saanut yhtään pistettä.
   */
  it("tunnistaa hankkeen nimen ehdokkaan kuvauksesta", () => {
    const match = calculateMatch(
      project({
        name: "L-rakennus lastenpsykiatrialle ja sairaalakoululle Oulun sairaala-alueella",
        city: "Oulu",
        region: "Pohjois-Pohjanmaa",
      }),
      {
        name: "OYSin uuden L-talon rakentaminen alkaa",
        city: "Oulu",
        region: "Pohjois-Pohjanmaa",
        description:
          "Sairaalan vanhan lastenklinikan paikalle nousevaan uudisrakennukseen " +
          "rakennetaan tilat lastenpsykiatrialle ja sairaalakoululle Oulun sairaala-alueella.",
      }
    )

    expect(match).not.toBeNull()
    expect(match!.reasons).toContain("name_in_description")
  })

  /*
   * Ensimmäinen toteutus vertasi trigrammeilla ja kaatui suomen yhdyssanoihin:
   * "tuulivoimahanke" sisältyy lähes kokonaan tekstiin jossa lukee
   * "tuulivoimapuisto". Mitattuna 37 osumasta yli puolet oli vääriä. Vertailu
   * tehdään siksi kokonaisina sanoina.
   */
  it("ei osu pelkän yhdyssanan yhteisen osan perusteella", () => {
    const match = calculateMatch(
      project({ name: "Asemakeskus", city: "Oulu" }),
      {
        name: "Kotaselän tuulivoimahanke",
        city: "Oulu",
        description:
          "Kotaselän tuulivoimapuiston rakentaminen etenee Oulun alueella " +
          "ja hankkeen tuulivoimaloiden määrä tarkentuu suunnittelun myötä.",
      }
    )

    expect(match?.reasons ?? []).not.toContain("name_in_description")
  })

  it("vaatii vähintään kaksi erottelevaa sanaa", () => {
    const match = calculateMatch(
      project({ name: "Datakeskus", city: "Loviisa" }),
      {
        name: "Hyperco Quantum Oy - Loviisan datakeskus",
        city: "Loviisa",
        description: "Yhtiö rakentaa datakeskuksen Loviisaan lähivuosina.",
      }
    )

    expect(match?.reasons ?? []).not.toContain("name_in_description")
  })

  it("toimii myös toiseen suuntaan: ehdokkaan nimi hankkeen kuvauksessa", () => {
    const match = calculateMatch(
      project({
        name: "Vanha nimi",
        city: "Turku",
        additional_info:
          "Turun vankilan uusi sellirakennus vastaa kasvavaan vankipaikkatarpeeseen " +
          "ja rakentaminen alkaa syksyllä.",
      }),
      {
        name: "Turun vankilan sellirakennus",
        city: "Turku",
        description: null,
      }
    )

    expect(match!.reasons).toContain("name_in_description")
  })

  it("ei anna pisteitä kahdesti kuvausvertailun kanssa", () => {
    const shared =
      "Kohteeseen rakennetaan uusi liikuntahalli Siilinjärven keskustaan " +
      "ja hanke sisältää myös piha-alueiden kunnostuksen kokonaisuudessaan."

    const match = calculateMatch(
      project({ name: "Siilinjärven liikuntahalli", city: "Siilinjärvi", additional_info: shared }),
      {
        name: "Siilinjärven liikuntahalli",
        city: "Siilinjärvi",
        description: shared,
      }
    )

    expect(match!.reasons).toContain("similar_description")
    expect(match!.reasons).not.toContain("name_in_description")
  })

  /*
   * Mitattu tapaus: "Kansallismuseon peruskorjaus ja laajennus". Geneeristen
   * sanojen karsinta jättää vain yhden erottuvan sanan, jolloin sääntö
   * kieltäytyi katsomasta tekstiä lainkaan - vaikka kuvauksessa esiintyivät
   * nimen kaikki kolme sanaa. Ehdokas sai 0 % eikä näkynyt missään.
   */
  it("hyväksyy yhden pitkän erottuvan sanan kun nimen kaikki sanat löytyvät", () => {
    const match = calculateMatch(
      project({
        name: "Kansallismuseon peruskorjaus ja laajennus",
        city: "Helsinki",
      }),
      {
        name: "Kansallismuseon uudisosa luovutettu museon käyttöön",
        city: "Helsinki",
        description:
          "Peruskorjauksen läpi käynyt historiallinen päärakennus luovutetaan " +
          "Suomen kansallismuseolle elokuussa. Uusi laajennusosa avautuu " +
          "yleisölle huhtikuussa 2027 tontilla jatkuvien töiden jälkeen.",
      }
    )

    expect(match!.reasons).toContain("name_in_description")
  })

  /*
   * Sama sääntö ei saa laueta lyhyestä erottuvasta sanasta: "koulun" osoittaa
   * tuhatta rakennusta, joten "Koulun peruskorjaus" ei kelpaa tunnisteeksi.
   */
  it("ei hyväksy lyhyttä yksittäistä erottuvaa sanaa", () => {
    const match = calculateMatch(
      project({ name: "Koulun peruskorjaus", city: "Espoo" }),
      {
        name: "Espoossa alkaa koulun remontti",
        city: "Espoo",
        description:
          "Koulun peruskorjaus alkaa kesällä ja kohteessa tehdään laajat " +
          "sisätyöt sekä julkisivun kunnostus aikataulun mukaisesti.",
      }
    )

    expect(match?.reasons ?? []).not.toContain("name_in_description")
  })

  /*
   * Taivutusvertailu tehtiin ennen kuuden merkin yhteisellä alulla, mikä on
   * liian löyhä pitkille yhdyssanoille: "kansallismuseolle" ja
   * "kansallisarkiston" jakavat alun "kansal". Mitattu tuotannosta -
   * Kansallismuseon uutinen osui parhaiten Kansallisarkiston peruskorjaukseen.
   */
  it("ei sekoita eri yhdyssanoja joilla on sama alku", () => {
    const match = calculateMatch(
      project({
        name: "Kansallisarkiston peruskorjaus Helsingissä",
        city: "Helsinki",
      }),
      {
        name: "Kansallismuseon uudisosa luovutettu museon käyttöön",
        city: "Helsinki",
        description:
          "Peruskorjauksen läpi käynyt päärakennus luovutetaan Suomen " +
          "kansallismuseolle elokuussa Helsingissä. Museo avautuu yleisölle " +
          "huhtikuussa 2027 kun sisätyöt saadaan valmiiksi.",
      }
    )

    expect(match?.reasons ?? []).not.toContain("name_in_description")
  })
})
