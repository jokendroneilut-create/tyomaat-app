import { createClient } from "@supabase/supabase-js"
import { resolvePotentialProject } from "@/lib/agent/identity/resolvePotentialProject"
import { classifyProject } from "@/lib/agent/knowledge/projectClassifier"
import { resolveHilmaProject } from "@/lib/agent/identity/resolvers/hilmaResolver"
import { resolveLupapisteProject } from "@/lib/agent/identity/resolvers/lupapisteResolver"
import { resolveVantaaKaavaProject } from "@/lib/agent/identity/resolvers/vantaaKaavaResolver"
import { resolveHelsinkiKaavaProject } from "@/lib/agent/identity/resolvers/helsinkiKaavaResolver"
import { resolveTampereKaavaProject } from "@/lib/agent/identity/resolvers/tampereKaavaResolver"
import { resolveTurkuKaavaProject } from "@/lib/agent/identity/resolvers/turkuKaavaResolver"
import { resolveKreateProject } from "@/lib/agent/identity/resolvers/kreateResolver"
import { resolveVaylaProject } from "@/lib/agent/identity/resolvers/vaylaResolver"
import { resolveSenaattiProject } from "@/lib/agent/identity/resolvers/senaattiResolver"
import { resolveKuopioKaavaProject } from "@/lib/agent/identity/resolvers/kuopioKaavaResolver"
import { resolveHyvinkaaKaavaProject } from "@/lib/agent/identity/resolvers/hyvinkaaKaavaResolver"
import { resolveSeinajokiKaavaProject } from "@/lib/agent/identity/resolvers/seinajokiKaavaResolver"
import { resolveRovaniemiKaavaProject } from "@/lib/agent/identity/resolvers/rovaniemiKaavaResolver"
import { resolveMikkeliKaavaProject } from "@/lib/agent/identity/resolvers/mikkeliKaavaResolver"
import { resolveKotkaKaavaProject } from "@/lib/agent/identity/resolvers/kotkaKaavaResolver"
import { resolveSaloKaavaProject } from "@/lib/agent/identity/resolvers/saloKaavaResolver"
import { resolvePorvooKaavaProject } from "@/lib/agent/identity/resolvers/porvooKaavaResolver"
import { resolveKokkolaKaavaProject } from "@/lib/agent/identity/resolvers/kokkolaKaavaResolver"
import { resolveKirkkonummiKaavaProject } from "@/lib/agent/identity/resolvers/kirkkonummiKaavaResolver"
import { resolveKeravaKaavaProject } from "@/lib/agent/identity/resolvers/keravaKaavaResolver"
import { resolveTuusulaKaavaProject } from "@/lib/agent/identity/resolvers/tuusulaKaavaResolver"
import { resolveNurmijarviKaavaProject } from "@/lib/agent/identity/resolvers/nurmijarviKaavaResolver"
import { resolveLahtiKaavaProject } from "@/lib/agent/identity/resolvers/lahtiKaavaResolver"
import { resolvePoriKaavaProject } from "@/lib/agent/identity/resolvers/poriKaavaResolver"
import { resolveOuluKaavaProject } from "@/lib/agent/identity/resolvers/ouluKaavaResolver"
import { resolveJyvaskylaKaavaProject } from "@/lib/agent/identity/resolvers/jyvaskylaKaavaResolver"
import { resolveHameenlinnaKaavaProject } from "@/lib/agent/identity/resolvers/hameenlinnaKaavaResolver"
import { resolveJoensuuKaavaProject } from "@/lib/agent/identity/resolvers/joensuuKaavaResolver"
import { resolveVaasaKaavaProject } from "@/lib/agent/identity/resolvers/vaasaKaavaResolver"
import { resolveKouvolaKaavaProject } from "@/lib/agent/identity/resolvers/kouvolaKaavaResolver"
import { resolveLappeenrantaKaavaProject } from "@/lib/agent/identity/resolvers/lappeenrantaKaavaResolver"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function runIdentityWorker(documentId: string) {
  const startedAt = Date.now()

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
  } else if (sourceName === "vantaan vireillä olevat kaavat") {
    const result = await resolveVantaaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "helsingin vireillä olevat kaavat") {
    const result = await resolveHelsinkiKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "tampereen vireillä olevat kaavat") {
    const result = await resolveTampereKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "turun vireillä olevat kaavat") {
    const result = await resolveTurkuKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "kreate hankkeet") {
    const result = await resolveKreateProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "väylävirasto hankkeet") {
    const result = await resolveVaylaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "senaatti-kiinteistöt hankkeet") {
    const result = await resolveSenaattiProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "kuopion vireillä olevat kaavat") {
    const result = await resolveKuopioKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "hyvinkään vireillä olevat kaavat") {
    const result = await resolveHyvinkaaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "seinäjoen ajankohtaiset asemakaavat") {
    const result = await resolveSeinajokiKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "rovaniemen kaavatori") {
    const result = await resolveRovaniemiKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "mikkelin vireillä olevat kaavat") {
    const result = await resolveMikkeliKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "kotkan vireillä olevat asemakaavat") {
    const result = await resolveKotkaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "salon ajankohtaiset asemakaavat") {
    const result = await resolveSaloKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "porvoon asemakaavat") {
    const result = await resolvePorvooKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "kokkolan asemakaavatyöt") {
    const result = await resolveKokkolaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "kirkkonummen kaavoitus") {
    const result = await resolveKirkkonummiKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "keravan kaavahankkeet") {
    const result = await resolveKeravaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "tuusulan vireillä olevat kaavat") {
    const result = await resolveTuusulaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "nurmijärven ajankohtaiset asemakaavat") {
    const result = await resolveNurmijarviKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "lahden kaavatyökohteet") {
    const result = await resolveLahtiKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "porin vireillä olevat kaavat") {
    const result = await resolvePoriKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "oulun vireillä olevat kaavat") {
    const result = await resolveOuluKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "jyväskylän vireillä olevat kaavat") {
    const result = await resolveJyvaskylaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "hämeenlinnan vireillä olevat kaavat") {
    const result = await resolveHameenlinnaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "joensuun laadinnassa olevat kaavat") {
    const result = await resolveJoensuuKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "vaasan vireillä olevat asemakaavat") {
    const result = await resolveVaasaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "kouvolan ajankohtaiset asemakaavat") {
    const result = await resolveKouvolaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "lappeenrannan vireillä olevat asemakaavat") {
    const result = await resolveLappeenrantaKaavaProject({
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

    const description = [
      propertyId ? `Kiinteistötunnus: ${propertyId}` : null,
      district ? `Kaupunginosa: ${district}` : null,
      address ? `Osoite: ${address}` : null,
      operation ? `Toimenpide: ${operation}` : null,
      decisionMaker ? `Päätöksentekijä: ${decisionMaker}` : null,
      permitNumber ? `Lupatunnus: ${permitNumber}` : null,
    ]
      .filter(Boolean)
      .join("\n")

    const result = await resolvePotentialProject({
      title,
      municipality,
      address,
      propertyId,
      permitNumber,
      sourceName: decisionFacts[0]?.source_name ?? null,
      identifiers: [
        { type: "espoo_permit_number", value: permitNumber },
        { type: "property_id", value: propertyId },
      ],
      metadata: {
        source_document_id: documentId,
        decision_index: decisionIndex,
        district,
        operation,
        decision_maker: decisionMaker,
        description,
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

  const candidatesCreated = results.filter(
    (result) => result.action === "created_new"
  ).length

  await supabaseAdmin.from("agent_runs").insert({
    agent_type: "identity_worker",
    source_id: document.source_id,
    source_name: document.source_name,
    status: "success",
    started_at: new Date(startedAt).toISOString(),
    finished_at: new Date().toISOString(),
    duration_ms: Date.now() - startedAt,
    candidates_created: candidatesCreated,
    payload: {
      documentId,
      decisionsResolved: results.length,
      candidatesCreated,
    },
  })

  return {
    ok: true,
    documentId,
    decisionsResolved: results.length,
    results,
  }
}