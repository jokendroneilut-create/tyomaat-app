import { describe, it, expect } from "vitest"
import { extractHilmaFacts, type ExtractedFact } from "./extractHilmaFacts"

function factByType(facts: ExtractedFact[], type: string) {
  return facts.find((f) => f.fact_type === type)
}

const awardNotice = {
  titleFi: "Maanrakennusurakka, Espoo",
  descriptionFi: "Kadun rakentaminen",
  organisationNameFi: "Espoon kaupunki",
  deadline: "2026-03-01",
  noticeNumber: "2026-053798",
  noticeId: 53798,
  mainType: "ContractAwardNotices",
  winnerOrganisations: "Jatke Pirkanmaa Oy (2951086-4)",
  receivedTenderCount: 5,
  noticeResultTotalAmount: 1500000,
  noticeResultTotalAmountCurrency: "EUR",
}

describe("extractHilmaFacts – jälki-ilmoitus (voittaja)", () => {
  const facts = extractHilmaFacts({
    documentId: "doc-1",
    sourceName: "Hilma",
    notice: awardNotice,
  })

  it("poimii voittajaorganisaation faktana", () => {
    const winner = factByType(facts, "winner_organisations")
    expect(winner?.fact_value).toBe("Jatke Pirkanmaa Oy (2951086-4)")
  })

  it("poimii tarjousten määräajan deadline-faktana", () => {
    const deadline = factByType(facts, "deadline")
    expect(deadline?.fact_key).toBe("tender_deadline")
    expect(deadline?.fact_date).toBe("2026-03-01")
  })

  it("poimii urakkasumman ja saatujen tarjousten määrän", () => {
    expect(factByType(facts, "contract_value")?.fact_number).toBe(1500000)
    expect(factByType(facts, "received_tender_count")?.fact_number).toBe(5)
  })

  it("merkitsee metadataan is_contract_award = true ja winners-taulukon", () => {
    const meta = facts[0]?.metadata
    expect(meta?.is_contract_award).toBe(true)
    expect(meta?.winners).toEqual(["Jatke Pirkanmaa Oy (2951086-4)"])
  })

  it("erottelee useat voittajat // -erottimella", () => {
    const multi = extractHilmaFacts({
      documentId: "doc-2",
      sourceName: "Hilma",
      notice: { ...awardNotice, winnerOrganisations: "A Oy // B Oy" },
    })
    expect(multi[0]?.metadata?.winners).toEqual(["A Oy", "B Oy"])
  })
})

describe("extractHilmaFacts – tavallinen tarjousilmoitus", () => {
  const facts = extractHilmaFacts({
    documentId: "doc-3",
    sourceName: "Hilma",
    notice: {
      titleFi: "Tarjouspyyntö",
      noticeNumber: "2026-050000",
      noticeId: 50000,
      mainType: "ContractNotices",
      deadline: "2026-05-01",
    },
  })

  it("ei merkitse voittajaa eikä is_contract_award-lippua", () => {
    expect(factByType(facts, "winner_organisations")).toBeUndefined()
    expect(facts[0]?.metadata?.is_contract_award).toBe(false)
  })

  it("poimii silti deadline-faktan", () => {
    expect(factByType(facts, "deadline")?.fact_date).toBe("2026-05-01")
  })
})
