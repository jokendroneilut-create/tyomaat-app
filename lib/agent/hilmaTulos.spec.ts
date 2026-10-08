import { describe, it, expect } from "vitest"
import { tulosEFormsista } from "./hilmaTulos"

/* Rakenne on Hilman oikeasta vastauksesta 9.10.2026, karsittuna. */
function doc(noticeResult: any, organizations: any[] = []) {
  return {
    eForm: {
      ublExtensions: [
        { extensionContent: { eformsExtension: { noticeResult, organizations: { organization: organizations } } } },
      ],
    },
  }
}

describe("tulosEFormsista", () => {
  /* Virolahden lammitysmuodon muutos: ainoa tarjous hylattiin. */
  it("tunnistaa clos-nw:n ilman voittajaa ja palauttaa syyn", () => {
    const t = tulosEFormsista(
      doc({
        lotResult: [
          {
            tenderResultCode: { listName: "winner-selection-status", value: "clos-nw" },
            decisionReason: { decisionReasonCode: { value: "all-rej" } },
          },
        ],
      })
    )
    expect(t.tulos).toBe("no-winner")
    expect(t.voittajat).toEqual([])
    expect(t.syy).toBe("all-rej")
  })

  it("lukee voittajan nimen organisaatiotunnuksen kautta", () => {
    const t = tulosEFormsista(
      doc(
        {
          lotResult: [{ tenderResultCode: { value: "selec-w" } }],
          tenderingParty: [{ tenderer: [{ id: { value: "ORG-0004" } }] }],
        },
        [
          {
            company: {
              partyIdentification: { id: { value: "ORG-0004" } },
              partyName: [{ name: { value: "R.V. Group Oy" } }],
            },
          },
        ]
      )
    )
    expect(t.tulos).toBe("winner")
    expect(t.voittajat).toEqual(["R.V. Group Oy"])
  })

  /* tenderReference on vapaata tekstia, siksi vasta varalla. */
  it("kayttaa tenderReferencea kun organisaatiota ei loydy", () => {
    const t = tulosEFormsista(
      doc({
        lotResult: [{ tenderResultCode: { value: "selec-w" } }],
        lotTender: [{ tenderReference: [{ id: { value: "Fidelix Oy" } }] }],
      })
    )
    expect(t.voittajat).toEqual(["Fidelix Oy"])
  })

  /*
   * Monen osan hankinnassa yksikin valittu voittaja tekee
   * ilmoituksesta sopimuksen.
   */
  it("riittaa etta yksi osa ratkesi", () => {
    const t = tulosEFormsista(
      doc({
        lotResult: [
          { tenderResultCode: { value: "clos-nw" } },
          { tenderResultCode: { value: "selec-w" } },
        ],
      })
    )
    expect(t.tulos).toBe("winner")
  })

  /*
   * TUNTEMATON EI OLE SAMA KUIN "EI VOITTAJAA". Jos tama palauttaisi
   * no-winner, verkkovirhe merkitsisi aidon sopimuksen keskeytetyksi.
   */
  it("palauttaa null kun tulostietoa ei ole", () => {
    expect(tulosEFormsista(doc({})).tulos).toBeNull()
    expect(tulosEFormsista({}).tulos).toBeNull()
    expect(tulosEFormsista(null).tulos).toBeNull()
  })
})
