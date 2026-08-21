import { describe, it, expect } from "vitest"
import { parseHilmaContacts } from "./hilmaContacts"

/* Rakenne kuten Hilman rajapinta sen palauttaa (mitattu 22.8.2026). */
const eForm = (opts: { winner?: boolean } = {}) => ({
  contractingParty: [
    { party: { partyIdentification: [{ id: { value: "ORG-0001" } }] } },
  ],
  ublExtensions: [
    {
      extensionContent: {
        eformsExtension: {
          organizations: {
            organization: [
              {
                company: {
                  partyIdentification: { id: { value: "ORG-0001" } },
                  partyName: [{ name: { value: "TVT Asunnot Oy" } }],
                  contact: {
                    name: { value: "Marko Heininen" },
                    telephone: { value: "+358 44 711 0001" },
                    electronicMail: { value: "marko.heininen@tvt.fi" },
                  },
                },
              },
              {
                company: {
                  partyIdentification: { id: { value: "ORG-0002" } },
                  partyName: [{ name: { value: "Hansel Oy (Hilma)" } }],
                  contact: { electronicMail: { value: "tekninen@hankintailmoitukset.fi" } },
                },
              },
              {
                company: {
                  partyIdentification: { id: { value: "ORG-0003" } },
                  partyName: [{ name: { value: "Markkinaoikeus" } }],
                  contact: { electronicMail: { value: "markkinaoikeus@oikeus.fi" } },
                },
              },
              {
                company: {
                  partyIdentification: { id: { value: "ORG-0004" } },
                  partyName: [{ name: { value: "R.V. Group Oy" } }],
                  contact: { electronicMail: { value: "artturi.silantera@rvgroup.fi" } },
                },
              },
            ],
          },
          ...(opts.winner
            ? {
                noticeResult: {
                  tenderingParty: [{ tenderer: [{ id: { value: "ORG-0004" } }] }],
                },
              }
            : {}),
        },
      },
    },
  ],
})

describe("parseHilmaContacts", () => {
  it("poimii tilaajan yhteystiedot", () => {
    const [c] = parseHilmaContacts(eForm())
    expect(c.role).toBe("buyer")
    expect(c.name).toBe("Marko Heininen")
    expect(c.email).toBe("marko.heininen@tvt.fi")
    expect(c.organization).toBe("TVT Asunnot Oy")
    expect(c.kind).toBe("person")
  })

  /*
   * Ilmoituksessa on tyypillisesti nelja organisaatiota. Ensimmainen
   * mittaus otti ensimmaisen loytyneen osoitteen ja vaitti kattavuudeksi
   * 100 % - neljassa kymmenesta se oli Hilman tukipalvelu tai
   * markkinaoikeus.
   */
  it("jattaa eSenderin ja markkinaoikeuden pois", () => {
    const c = parseHilmaContacts(eForm())
    expect(c.map((x) => x.email)).not.toContain("tekninen@hankintailmoitukset.fi")
    expect(c.map((x) => x.email)).not.toContain("markkinaoikeus@oikeus.fi")
  })

  it("ei ota voittajaa mukaan ilman jalki-ilmoitusta", () => {
    expect(parseHilmaContacts(eForm())).toHaveLength(1)
  })

  it("erottaa voittajan tilaajasta", () => {
    const c = parseHilmaContacts(eForm({ winner: true }))
    expect(c).toHaveLength(2)
    expect(c[0].role).toBe("buyer")
    expect(c[1].role).toBe("winner")
    expect(c[1].organization).toBe("R.V. Group Oy")
  })

  /*
   * partyIdentification on organisaatiolohkossa OBJEKTI mutta
   * contractingPartyssa TAULUKKO. Ensimmainen versio luki vain
   * taulukkomuodon ja palautti nolla kaikista 25 testatusta.
   */
  it("kestaa seka taulukko- etta objektimuodon", () => {
    const e: any = eForm()
    e.ublExtensions[0].extensionContent.eformsExtension.organizations.organization[0].company.partyIdentification =
      [{ id: { value: "ORG-0001" } }]
    expect(parseHilmaContacts(e)).toHaveLength(1)
  })

  it("ohittaa organisaation jolla ei ole yhteystietoa", () => {
    const e: any = eForm()
    delete e.ublExtensions[0].extensionContent.eformsExtension.organizations.organization[0].company.contact
    expect(parseHilmaContacts(e)).toHaveLength(0)
  })

  it("kestaa tyhjan", () => {
    expect(parseHilmaContacts(null)).toEqual([])
    expect(parseHilmaContacts({})).toEqual([])
  })
})
