import { extractFacts } from "@/lib/agent/facts/extractFacts"
import { extractHilmaFacts } from "@/lib/agent/facts/extractHilmaFacts"
import { extractLupapisteFacts } from "@/lib/agent/facts/extractLupapisteFacts"
import { extractVantaaKaavaFacts } from "@/lib/agent/facts/extractVantaaKaavaFacts"
import { extractHelsinkiKaavaFacts } from "@/lib/agent/facts/extractHelsinkiKaavaFacts"
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
    const hakija = document.raw_payload?.hakija ?? null
    const contacts = document.raw_payload?.contacts ?? []
    const description = document.raw_payload?.description ?? null

    return {
      decisions: [],
      facts: extractVantaaKaavaFacts({
        documentId: document.id,
        sourceName: document.source_name,
        feature,
        center,
        hakija,
        contacts,
        description,
      }),
    }
  }

  if (document.source_name === "Helsingin vireillä olevat kaavat") {
    const feature = document.raw_payload?.original ?? JSON.parse(document.raw_text ?? "{}")
    const center = document.raw_payload?.center ?? null
    const districtName = document.raw_payload?.district_name ?? null
    const description = document.raw_payload?.description ?? null
    const selostusUrl = document.raw_payload?.selostus_url ?? null

    return {
      decisions: [],
      facts: extractHelsinkiKaavaFacts({
        documentId: document.id,
        sourceName: document.source_name,
        feature,
        center,
        districtName,
        description,
        selostusUrl,
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