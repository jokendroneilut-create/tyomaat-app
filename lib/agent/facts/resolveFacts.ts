import { extractFacts } from "@/lib/agent/facts/extractFacts"
import { extractHilmaFacts } from "@/lib/agent/facts/extractHilmaFacts"
import { extractLupapisteFacts } from "@/lib/agent/facts/extractLupapisteFacts"
import { extractVantaaKaavaFacts } from "@/lib/agent/facts/extractVantaaKaavaFacts"
import { extractHelsinkiKaavaFacts } from "@/lib/agent/facts/extractHelsinkiKaavaFacts"
import { extractTampereKaavaFacts } from "@/lib/agent/facts/extractTampereKaavaFacts"
import { extractTurkuKaavaFacts } from "@/lib/agent/facts/extractTurkuKaavaFacts"
import { extractKreateFacts } from "@/lib/agent/facts/extractKreateFacts"
import { extractVaylaFacts } from "@/lib/agent/facts/extractVaylaFacts"
import { extractSenaattiFacts } from "@/lib/agent/facts/extractSenaattiFacts"
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

  if (document.source_name === "Tampereen vireillä olevat kaavat") {
    const feature = document.raw_payload?.original ?? JSON.parse(document.raw_text ?? "{}")
    const center = document.raw_payload?.center ?? null
    const kaavaTunnus = document.raw_payload?.kaava_tunnus ?? null
    const diaarinumero = document.raw_payload?.diaarinumero ?? null
    const phase = document.raw_payload?.phase ?? null
    const description = document.raw_payload?.description ?? null
    const decisionMaker = document.raw_payload?.decision_maker ?? null
    const planTitle = document.raw_payload?.plan_title ?? null

    return {
      decisions: [],
      facts: extractTampereKaavaFacts({
        documentId: document.id,
        sourceName: document.source_name,
        feature,
        center,
        kaavaTunnus,
        diaarinumero,
        phase,
        description,
        decisionMaker,
        planTitle,
      }),
    }
  }

  if (document.source_name === "Turun vireillä olevat kaavat") {
    const feature = document.raw_payload?.original ?? JSON.parse(document.raw_text ?? "{}")
    const center = document.raw_payload?.center ?? null
    const kaavaTunnus = document.raw_payload?.kaava_tunnus ?? null
    const kaavanNimi = document.raw_payload?.kaavan_nimi ?? null
    const kaavalaji = document.raw_payload?.kaavalaji ?? null
    const kaavatilanne = document.raw_payload?.kaavatilanne ?? null
    const description = document.raw_payload?.description ?? null
    const identifyingInfo = document.raw_payload?.identifying_info ?? {}

    return {
      decisions: [],
      facts: extractTurkuKaavaFacts({
        documentId: document.id,
        sourceName: document.source_name,
        feature,
        center,
        kaavaTunnus,
        kaavanNimi,
        kaavalaji,
        kaavatilanne,
        documentsUrl: document.document_url,
        description,
        identifyingInfo,
      }),
    }
  }

  if (document.source_name === "Kreate hankkeet") {
    const post = document.raw_payload?.original ?? JSON.parse(document.raw_text ?? "{}")
    const title = document.raw_payload?.title ?? null
    const phase = document.raw_payload?.phase ?? null
    const category = document.raw_payload?.category ?? null
    const contacts = document.raw_payload?.contacts ?? []

    return {
      decisions: [],
      facts: extractKreateFacts({
        documentId: document.id,
        sourceName: document.source_name,
        post,
        title,
        phase,
        category,
        contacts,
      }),
    }
  }

  if (document.source_name === "Väylävirasto hankkeet") {
    const item = document.raw_payload?.original ?? JSON.parse(document.raw_text ?? "{}")
    const title = document.raw_payload?.title ?? null
    const description = document.raw_payload?.description ?? null
    const hankeType = document.raw_payload?.hanke_type ?? null
    const region = document.raw_payload?.region ?? null
    const phase = document.raw_payload?.phase ?? null
    const contact = document.raw_payload?.contact ?? null
    const progress = document.raw_payload?.progress ?? null

    return {
      decisions: [],
      facts: extractVaylaFacts({
        documentId: document.id,
        sourceName: document.source_name,
        item,
        title,
        description,
        hankeType,
        region,
        phase,
        contact,
        progress,
      }),
    }
  }

  if (document.source_name === "Senaatti-kiinteistöt hankkeet") {
    const post = document.raw_payload?.original ?? JSON.parse(document.raw_text ?? "{}")
    const title = document.raw_payload?.title ?? null
    const description = document.raw_payload?.description ?? null
    const phase = document.raw_payload?.phase ?? null
    const location = document.raw_payload?.location ?? null
    const buildingType = document.raw_payload?.building_type ?? null
    const contact = document.raw_payload?.contact ?? null

    return {
      decisions: [],
      facts: extractSenaattiFacts({
        documentId: document.id,
        sourceName: document.source_name,
        post,
        title,
        description,
        phase,
        location,
        buildingType,
        contact,
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