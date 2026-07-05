import { createClient } from "@supabase/supabase-js"
import { resolvePotentialProject } from "@/lib/agent/identity/resolvePotentialProject"

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

  for (const [decisionIndex, decisionFacts] of grouped.entries()) {
    const metadata = decisionFacts[0]?.metadata ?? {}

    const permitNumber = metadata.permit_number ?? null
    const address = metadata.address ?? null
    const district = metadata.district ?? null

    const propertyFact = decisionFacts.find(
      (fact) => fact.fact_type === "property_id"
    )

    const propertyId = propertyFact?.fact_value ?? null

    const title = address
      ? `Rakennuslupa: ${address}`
      : permitNumber
        ? `Rakennuslupa: ${permitNumber}`
        : "Rakennuslupa"

    const result = await resolvePotentialProject({
      title,
      municipality: "Espoo",
      address,
      propertyId,
      permitNumber,
      sourceName: decisionFacts[0]?.source_name ?? null,
      metadata: {
        source_document_id: documentId,
        decision_index: decisionIndex,
        district,
        fact_count: decisionFacts.length,
        resolver: "identityWorker",
      },
    })

    results.push({
      decisionIndex,
      action: result.action,
      potentialProjectId: result.potentialProject.id,
      title: result.potentialProject.title,
      address: result.potentialProject.address,
      permitNumber: result.potentialProject.permit_number,
    })
  }

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