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
})
