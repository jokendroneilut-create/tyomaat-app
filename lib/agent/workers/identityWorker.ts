import { createClient } from "@supabase/supabase-js"
import { resolvePotentialProject } from "@/lib/agent/identity/resolvePotentialProject"
import { classifyProject } from "@/lib/agent/knowledge/projectClassifier"
import { resolveHilmaProject } from "@/lib/agent/identity/resolvers/hilmaResolver"
import { resolveLupapisteProject } from "@/lib/agent/identity/resolvers/lupapisteResolver"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function runIdentityWorker(documentId: string) {
  const { data: document, error: documentError } = await supabaseAdmin
    .from("source_documents")
    .select("*")
    .eq("id", documentId)
    .maybeSingle()

  if (documentError) throw documentError

  if (!document) {
    return {
      ok: false,
      documentId,
      error: "Document not found",
    }
  }

  if (document.identity_resolved_at) {
    return {
      ok: true,
      documentId,
      message: "Identity already resolved for document",
      decisionsResolved: 0,
      results: [],
    }
  }

  const { data: facts, error: factsError } = await supabaseAdmin
    .from("project_facts")
    .select("*")
    .eq("document_id", documentId)

  if (factsError) throw factsError

  const grouped = new Map<string, any[]>()
  
  for (const fact of facts ?? []) {
    const decisionIndex = fact.metadata?.decision_index
    if (!decisionIndex) continue

    const key = String(decisionIndex)

    if (!grouped.has(key)) {
      grouped.set(key, [])
    }

    grouped.get(key)!.push(fact)
  }

  const results = []

  const sourceName = String(document.source_name ?? "").trim().toLowerCase()

if (sourceName === "hilma") {
    const result = await resolveHilmaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "lupapiste kuulutukset") {
    const result = await resolveLupapisteProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else {

  for (const [decisionIndex, decisionFacts] of grouped.entries()) {
    const metadata = decisionFacts[0]?.metadata ?? {}

    const permitNumber = metadata.permit_number ?? null
    const address = metadata.address ?? null
    const district = metadata.district ?? null
    const operation = metadata.operation ?? null
    const decisionMaker = metadata.decision_maker ?? null
    const municipality = metadata.municipality ?? "Espoo"

    const propertyFact = decisionFacts.find(
      (fact) => fact.fact_type === "property_id"
    )

    const propertyId = propertyFact?.fact_value ?? null

    const classification = classifyProject({
      operation,
      address,
      title: permitNumber ? `Rakennuslupa ${permitNumber}` : null,
    })

    const title = operation
      ? `${operation}: ${address ?? permitNumber ?? "rakennuslupa"}`
      : address
        ? `Rakennuslupa: ${address}`
        : permitNumber
          ? `Rakennuslupa: ${permitNumber}`
          : "Rakennuslupa"

    const result = await resolvePotentialProject({
      title,
      municipality,
      address,
      propertyId,
      permitNumber,
      sourceName: decisionFacts[0]?.source_name ?? null,
      metadata: {
        source_document_id: documentId,
        decision_index: decisionIndex,
        district,
        operation,
        decision_maker: decisionMaker,
        fact_count: decisionFacts.length,
        resolver: "identityWorker",

        construction_type: classification.construction_type,
        building_type: classification.building_type,
        size_class: classification.size_class,
        business_value: classification.business_value,
        recommended_action: classification.recommended_action,
        classification_confidence: classification.confidence,
        classification_reasons: classification.reasons,
      },
    })

    results.push({
      decisionIndex,
      action: result.action,
      potentialProjectId: result.potentialProject.id,
      title: result.potentialProject.title,
      address: result.potentialProject.address,
      permitNumber: result.potentialProject.permit_number,
      operation,
      classification,
    })
  }}

  await supabaseAdmin
    .from("source_documents")
    .update({
      identity_resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", documentId)

  return {
    ok: true,
    documentId,
    decisionsResolved: results.length,
    results,
  }
}