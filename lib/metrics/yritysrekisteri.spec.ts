import { describe, expect, it } from "vitest"

import {
  osapuoltenYhteyshenkilot,
  yrityksenYhteyshenkilot,
  type Yritysrekisteri,
  nimetytTaydennykset,
  jarjestysPaino,
  NAYTA_YRITYKSELTA_ENINTAAN,
} from "./yritysrekisteri"

const rekisteri: Yritysrekisteri = new Map([
  [
    "skanska",
    [
      {
        name: "Markus Lipsanen",
        title: "Työpäällikkö",
        email: "markus.lipsanen@skanska.fi",
        phone: null,
        organization: "Skanska",
        level: "company" as const,
      },
    ],
  ],
])

describe("yrityksenYhteyshenkilot", () => {
  it("loytaa yrityksen urakoitsijakentasta", () => {
    expect(yrityksenYhteyshenkilot({ builder: "Skanska Oy" }, rekisteri)).toHaveLength(1)
  })

  it("loytaa yrityksen rakennuttajakentasta", () => {
    expect(yrityksenYhteyshenkilot({ developer: "Skanska" }, rekisteri)).toHaveLength(1)
  })

  it("palauttaa tyhjan tuntemattomalle yritykselle", () => {
    expect(yrityksenYhteyshenkilot({ builder: "Tuntematon Oy" }, rekisteri)).toEqual([])
    expect(yrityksenYhteyshenkilot({}, rekisteri)).toEqual([])
  })

  /* Taso on aina company, jotta merkinta ja mittarin neula osuvat oikein. */
  it("merkitsee tason yrityskohtaiseksi", () => {
    expect(yrityksenYhteyshenkilot({ builder: "Skanska" }, rekisteri)[0].level).toBe("company")
  })
})

/* D-253: osapuolet omana ryhmanaan. Nimet ja numerot keksittyja. */
const osapuoliRekisteri: Yritysrekisteri = new Map([
  [
    "kattotyot",
    [
      {
        name: "Testi Henkilo",
        title: "Tyonjohtaja",
        email: null,
        phone: "040 000 0000",
        organization: "Kattotyot Oy",
        level: "company" as const,
      },
    ],
  ],
])

describe("osapuoltenYhteyshenkilot", () => {
  it("loytaa related_companies-osapuolen ja merkitsee roolin", () => {
    const tulos = osapuoltenYhteyshenkilot(
      { metadata: { related_companies: ["Kattotyot Oy (1111111-1)"] } },
      osapuoliRekisteri
    )
    expect(tulos).toHaveLength(1)
    expect(tulos[0].organization).toBe("Kattotyot Oy (osapuoli)")
    expect(tulos[0].group).toBe("osapuoli")
    expect(tulos[0].level).toBe("company")
  })

  it("kayttaa aliurakoitsijan tyota roolina", () => {
    const tulos = osapuoltenYhteyshenkilot(
      {
        metadata: {
          related_companies: ["Kattotyot Oy"],
          aliurakoitsijat: [{ yritys: "Kattotyot Oy", tyo: "vesikattotyot" }],
        },
      },
      osapuoliRekisteri
    )
    expect(tulos[0].organization).toBe("Kattotyot Oy (vesikattotyot)")
  })

  it("ei palauta urakoitsijaa osapuolena", () => {
    expect(
      osapuoltenYhteyshenkilot(
        { builder: "Kattotyot Oy", metadata: { related_companies: ["Kattotyot Oy"] } },
        osapuoliRekisteri
      )
    ).toEqual([])
  })

  /* Ostajapuolen rivi ei saa alkaa nayttaa osapuolta "yrityksen yhteyshenkilona". */
  it("yrityksenYhteyshenkilot ei lue related_companies-kenttaa", () => {
    expect(
      yrityksenYhteyshenkilot(
        { metadata: { related_companies: ["Kattotyot Oy"] } } as never,
        osapuoliRekisteri
      )
    ).toEqual([])
  })
})

describe("nimetytTaydennykset", () => {
  const rekisteri = new Map([
    [
      "louhintahiekka",
      [
        {
          name: "Jani Pullikka",
          title: "Työpäällikkö, Pirkanmaa",
          email: "jani.pullikka@louhintahiekka.fi",
          phone: "040 418 3603",
          organization: "Louhintahiekka Oy",
          level: "company" as const,
        },
        {
          name: "Ville Lonka",
          title: "Työpäällikkö, Varsinais-Suomi",
          email: null,
          phone: "040 829 0089",
          organization: "Louhintahiekka Oy",
          level: "company" as const,
        },
      ],
    ],
  ])

  it("taydentaa kontaktissa olevan nimen jolta puuttuvat tiedot", () => {
    const tulos = nimetytTaydennykset(
      {
        builder: "Louhintahiekka Oy",
        metadata: { contact_persons: [{ name: "Jani Pullikka", email: null, phone: null }] },
      },
      rekisteri
    )
    expect(tulos).toHaveLength(1)
    expect(tulos[0].phone).toBe("040 418 3603")
    /* Henkilo on hankkeen oma; vain yhteystiedot tulevat rekisterista. */
    expect(tulos[0].level).toBe("project")
    expect(tulos[0].loytyi).toBe("kontakti")
  })

  it("ei taydenna kontaktia joka on jo tavoitettavissa", () => {
    expect(
      nimetytTaydennykset(
        {
          builder: "Louhintahiekka Oy",
          metadata: { contact_persons: [{ name: "Jani Pullikka", email: null, phone: "040 111 2222" }] },
        },
        rekisteri
      )
    ).toEqual([])
  })

  it("loytaa nimen hankkeen tekstista kun tavoitettavaa ei ole", () => {
    const tulos = nimetytTaydennykset(
      {
        builder: "Louhintahiekka Oy",
        additional_info: "Urakasta vastaa Louhintahiekan työpäällikkö Jani Pullikka.",
        metadata: { contact_persons: [] },
      },
      rekisteri
    )
    expect(tulos.map((t) => t.name)).toEqual(["Jani Pullikka"])
    expect(tulos[0].loytyi).toBe("teksti")
  })

  /*
   * Tama on `yrityksenYhteyshenkilot`in "taydentaa, ei korvaa" -saanto:
   * kortille ei kerryta tyomaan vastaavaa ja yrityksen aluejohtajaa
   * rinnakkain.
   */
  it("ei lisaa tekstista loytynytta kun hankkeella on jo tavoitettava", () => {
    expect(
      nimetytTaydennykset(
        {
          builder: "Louhintahiekka Oy",
          additional_info: "Työpäällikkö Jani Pullikka vastaa urakasta.",
          metadata: { contact_persons: [{ name: "Toinen Ihminen", phone: "040 000 0000" }] },
        },
        rekisteri
      )
    ).toEqual([])
  })

  /* Vaara numero on pahempi kuin puuttuva: kaksi ihmista voi olla samannimisia. */
  it("ei taydenna kun yritys ei ole hankkeen osapuoli", () => {
    expect(
      nimetytTaydennykset(
        {
          builder: "Joku Muu Oy",
          additional_info: "Jani Pullikka kommentoi hanketta.",
          metadata: { contact_persons: [] },
        },
        rekisteri
      )
    ).toEqual([])
  })

  it("ei palauta henkiloa jolta puuttuu sekä sahkoposti etta puhelin", () => {
    const vajaa = new Map([
      [
        "louhintahiekka",
        [{ name: "Tyhjä Rivi", title: null, email: null, phone: null, organization: "Louhintahiekka Oy", level: "company" as const }],
      ],
    ])
    expect(
      nimetytTaydennykset(
        { builder: "Louhintahiekka Oy", additional_info: "Tyhjä Rivi mainitaan.", metadata: { contact_persons: [] } },
        vajaa
      )
    ).toEqual([])
  })

  /* Osittainen osuma ei kelpaa: pelkka sukunimi osuisi toiseen ihmiseen. */
  it("ei osu pelkkaan sukunimeen", () => {
    expect(
      nimetytTaydennykset(
        {
          builder: "Louhintahiekka Oy",
          additional_info: "Pullikka vastaa urakasta.",
          metadata: { contact_persons: [] },
        },
        rekisteri
      )
    ).toEqual([])
  })

  it("kelpuuttaa henkilon jolta puuttuu vain sahkoposti", () => {
    const tulos = nimetytTaydennykset(
      { builder: "Louhintahiekka Oy", additional_info: "Ville Lonka vastaa.", metadata: { contact_persons: [] } },
      rekisteri
    )
    expect(tulos.map((t) => t.phone)).toEqual(["040 829 0089"])
  })
})

describe("jarjestysPaino", () => {
  /* Kasin lisatylla ei ole viela yhtaan hanketta johon toistuvuus perustuisi. */
  it("kasin lisatty voittaa toistuvimmankin johdetun", () => {
    expect(jarjestysPaino("kasin: louhintahiekka.fi/yhteydenotot, luettu 6.11.2026")).toBeGreaterThan(
      jarjestysPaino("johdettu yrityksen omasta lahteesta, 28 hanketta")
    )
  })

  it("lukee hankemaaran johdetusta lahteesta", () => {
    expect(jarjestysPaino("johdettu yrityksen omasta lahteesta, 28 hanketta")).toBe(28)
    expect(jarjestysPaino("johdettu yrityksen omasta lahteesta, 2 hanketta")).toBe(2)
  })

  it("tuntematon ja tyhja lahde painavat nolla", () => {
    expect(jarjestysPaino(null)).toBe(0)
    expect(jarjestysPaino("jostain muualta")).toBe(0)
  })
})

describe("yritykselta naytetaan enintaan kolme", () => {
  const moni: Yritysrekisteri = new Map([
    [
      "väylävirasto",
      Array.from({ length: 51 }, (_, i) => ({
        name: `Henkilo ${i}`,
        title: "Projektipäällikkö",
        email: `h${i}@vayla.fi`,
        phone: null,
        organization: "Väylävirasto",
        level: "company" as const,
      })),
    ],
  ])

  it("yritystason lista katkaistaan kolmeen", () => {
    expect(yrityksenYhteyshenkilot({ developer: "Väylävirasto" }, moni)).toHaveLength(
      NAYTA_YRITYKSELTA_ENINTAAN
    )
  })

  /*
   * Katto on PER YRITYS: hankkeella voi olla monta olennaista ihmista
   * kunhan he ovat eri yrityksista.
   */
  it("kaksi osapuoliyritysta antaa kuusi", () => {
    const kaksi: Yritysrekisteri = new Map([
      ["alfa", Array.from({ length: 9 }, (_, i) => ({ name: `A${i}`, title: null, email: null, phone: "1", organization: "Alfa Oy", level: "company" as const }))],
      ["beeta", Array.from({ length: 9 }, (_, i) => ({ name: `B${i}`, title: null, email: null, phone: "1", organization: "Beeta Oy", level: "company" as const }))],
    ])
    expect(
      osapuoltenYhteyshenkilot({ metadata: { related_companies: ["Alfa Oy", "Beeta Oy"] } }, kaksi)
    ).toHaveLength(2 * NAYTA_YRITYKSELTA_ENINTAAN)
  })
})
