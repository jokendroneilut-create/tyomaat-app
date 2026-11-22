import { describe, expect, it } from "vitest"
import { yhdistaLahdehistoria, type LahdehistoriaRivi } from "./yhdistaLahdehistoria"

const rivi = (osat: Partial<LahdehistoriaRivi>): LahdehistoriaRivi => ({
  source_name: null,
  source_document_id: null,
  document_url: null,
  seen_at: "2026-11-22T00:00:00Z",
  ...osat,
})

const HILMA = rivi({ source_name: "Hilma", source_document_id: "h1", document_url: "https://tarjouspalvelu.fi/vayla?id=622209" })
const NRC = rivi({ source_name: "nrc_uutiset", source_document_id: "n1", document_url: "https://www.nrcgroup.fi/uutiset/x" })

describe("yhdistaLahdehistoria", () => {
  it("lisää ehdokkaan lähteen hankkeen historian perään", () => {
    expect(yhdistaLahdehistoria([HILMA], [NRC], null)).toEqual([HILMA, NRC])
  })

  it("ei lisää samaa dokumenttia kahdesti", () => {
    expect(yhdistaLahdehistoria([HILMA, NRC], [NRC], null)).toEqual([HILMA, NRC])
  })

  it("tunnistaa saman rivin osoitteesta, kun id puuttuu", () => {
    const ilmanId = rivi({ source_name: "nrc_uutiset", document_url: NRC.document_url })
    expect(yhdistaLahdehistoria([NRC], [ilmanId], null)).toEqual([NRC])
  })

  it("kirjaa varalähteen, kun ehdokkaalla ei ole historiaa", () => {
    expect(yhdistaLahdehistoria([HILMA], undefined, NRC)).toEqual([HILMA, NRC])
    expect(yhdistaLahdehistoria(undefined, [], NRC)).toEqual([NRC])
  })

  it("ei kirjaa tyhjää varariviä eikä riko vanhaa historiaa", () => {
    expect(yhdistaLahdehistoria([HILMA], [], rivi({ source_name: "x" }))).toEqual([HILMA])
    expect(yhdistaLahdehistoria("roskaa", null, null)).toEqual([])
  })
})
