import { extractFacts } from "@/lib/agent/facts/extractFacts"
import { extractHilmaFacts } from "@/lib/agent/facts/extractHilmaFacts"
import { extractLupapisteFacts } from "@/lib/agent/facts/extractLupapisteFacts"
import { extractVantaaKaavaFacts } from "@/lib/agent/facts/extractVantaaKaavaFacts"
import { splitEspooPermitNoticeText } from "@/lib/agent/building-permits/decisionSplitter"

export function resolveFacts(document: any) {
  if (document.source_name === "Hilma") {
    const notice = document.raw_payload?.original ?? JSON.parse(document.raw_text ?? "{}")

    return {
      decisions: [],
      facts: extractHilmaFacts({
        documentId: document.id,
        sourceName: document.source_name,
        notice,
      }),
    }
  }

  if (document.source_name === "Lupapiste kuulutukset") {
    const notice = document.raw_payload?.original ?? JSON.parse(document.raw_text ?? "{}")

    return {
      decisions: [],
      facts: extractLupapisteFacts({
        documentId: document.id,
        sourceName: document.source_name,
        notice,
      }),
    }
  }

  if (document.source_name === "Vantaan vireillä olevat kaavat") {
    const feature = document.raw_payload?.original ?? JSON.parse(document.raw_text ?? "{}")
    const center = document.raw_payload?.center ?? null

    return {
      decisions: [],
      facts: extractVantaaKaavaFacts({
        documentId: document.id,
        sourceName: document.source_name,
        feature,
        center,
      }),
    }
  }

  const fullText = document.extracted_text ?? ""
  const decisions = splitEspooPermitNoticeText(fullText)

  if (decisions.length === 0) {
    return {
      decisions,
      facts: extractFacts({
        documentId: document.id,
        sourceName: document.source_name,
        text: fullText,
      }),
    }
  }

  const facts = decisions.flatMap((decision) => {
    const decisionFacts = extractFacts({
      documentId: document.id,
      sourceName: document.source_name,
      text: decision.rawText,
    })

    return decisionFacts.map((fact) => ({
      ...fact,
      metadata: {
        ...(fact.metadata ?? {}),
        decision_index: decision.index,
        section_number: decision.sectionNumber,
        permit_number: decision.permitNumber,
        address: decision.address,
        property_ids: decision.propertyIds,
        district: decision.district,
        operation: decision.operation,
        decision_maker: decision.decisionMaker,
      },
    }))
  })

  return {
    decisions,
    facts,
  }
}