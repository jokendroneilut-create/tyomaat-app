import { classifyProject } from "@/lib/agent/knowledge/projectClassifier"
import { resolvePotentialProject } from "@/lib/agent/identity/resolvePotentialProject"

function findFact(facts: any[], type: string) {
  return facts.find((fact) => fact.fact_type === type)
}

export async function resolveHilmaProject({
  document,
  facts,
}: {
  document: any
  facts: any[]
}) {
  const operation = findFact(facts, "operation")?.fact_value ?? document.title
  const developer = findFact(facts, "developer")?.fact_value ?? null
  const address = findFact(facts, "address")?.fact_value ?? null
  const deadline = findFact(facts, "deadline")?.fact_date ?? null
  const cpvCode = findFact(facts, "cpv_code")?.fact_value ?? null
  const documentsUrl = findFact(facts, "documents_url")?.fact_value ?? null
  const noticeNumber = findFact(facts, "permit_number")?.fact_value ?? null

  const metadata = facts[0]?.metadata ?? {}

  const classification = classifyProject({
    operation,
    address,
    title: operation,
  })

  const result = await resolvePotentialProject({
    title: operation,
    municipality: null,
    address,
    propertyId: null,
    permitNumber: noticeNumber,
    sourceName: document.source_name,
    metadata: {
      source: "Hilma",
      source_name: document.source_name,
      source_document_id: document.id,
      resolver: "hilmaResolver",

      operation,
      developer,
      deadline,
      cpv_code: cpvCode,
      documents_url: documentsUrl,
      notice_number: noticeNumber,
      notice_id: metadata.notice_id ?? null,
      date_published: metadata.date_published ?? null,
      procurement_type_code: metadata.procurement_type_code ?? null,

      construction_type: classification.construction_type,
      building_type: classification.building_type,
      size_class: classification.size_class,
      business_value: classification.business_value,
      recommended_action: classification.recommended_action,
      classification_confidence: classification.confidence,
      classification_reasons: classification.reasons,
    },
  })

  return {
    action: result.action,
    potentialProjectId: result.potentialProject.id,
    title: result.potentialProject.title,
    address: result.potentialProject.address,
    permitNumber: result.potentialProject.permit_number,
    operation,
    classification,
  }
}