import { classifyProject } from "@/lib/agent/knowledge/projectClassifier"
import { resolvePotentialProject } from "@/lib/agent/identity/resolvePotentialProject"
import { PHASE_LABELS } from "@/lib/projects/phases"
import { getMunicipalityByName, MUNICIPALITIES } from "@/lib/geo/municipalities"

function findFact(facts: any[], type: string) {
  return facts.find((fact) => fact.fact_type === type)
}

/*
 * Puolustuskiinteistöjen uutiset viittaavat usein varuskunnan/tukikohdan
 * nimeen (esim. "Rissalan tukikohta", "Santahamina"), joka ei itsessään
 * ole kunnan nimi — siksi tunnetuimmat tukikohdat kartoitetaan suoraan
 * kuntaan ennen yleistä kuntanimihakua tekstistä.
 */
const GARRISON_MUNICIPALITY: Record<string, string> = {
  santahamina: "Helsinki",
  rissala: "Kuopio",
  upinniem: "Kirkkonummi",
  dragsvik: "Raasepori",
  niinisalo: "Kankaanpää",
  parola: "Hattula",
  vekaranjärv: "Kouvola",
  tikkakoski: "Jyväskylä",
  hälvälä: "Hollola",
}

function detectMunicipalityFromText(text: string | null): string | null {
  if (!text) return null
  const lower = text.toLowerCase()

  for (const [garrison, municipality] of Object.entries(GARRISON_MUNICIPALITY)) {
    if (lower.includes(garrison)) return municipality
  }

  const names = Object.values(MUNICIPALITIES)
    .map((m) => m.name)
    .sort((a, b) => b.length - a.length)

  for (const name of names) {
    const regex = new RegExp(`\\b${name}(ssa|ssä|sta|stä|seen|lla|ella|llä|lta|ltä|lle|an|na|nä|n|in|en)?\\b`, "i")
    if (regex.test(text)) return name
  }

  return null
}

export async function resolvePuolustuskiinteistotProject({
  document,
  facts,
}: {
  document: any
  facts: any[]
}) {
  const operation = findFact(facts, "operation")?.fact_value ?? document.title
  const decisionStatus = findFact(facts, "decision_status")?.fact_value ?? null

  const metadata = facts[0]?.metadata ?? {}
  const description = metadata.description ?? null

  const detectedMunicipality = detectMunicipalityFromText(`${operation ?? ""} ${description ?? ""}`)
  const municipality = getMunicipalityByName(detectedMunicipality)

  const completed = decisionStatus === "Valmistunut"
  const phaseHint = completed ? PHASE_LABELS.completed : PHASE_LABELS.construction

  const classification = classifyProject({
    operation,
    title: operation,
  })

  const result = await resolvePotentialProject({
    title: operation,
    municipality: municipality?.name ?? detectedMunicipality,
    address: null,
    propertyId: null,
    permitNumber: null,

    sourceName: document.source_name,

    identifiers: [{ type: "puolustuskiinteistot_article_url", value: document.document_url }],

    metadata: {
      source: "Puolustuskiinteistöt (Senaatti-kiinteistöt)",
      source_name: document.source_name,
      source_document_id: document.id,
      resolver: "puolustuskiinteistotResolver",

      operation,
      /*
       * Puolustuskiinteistöt on valtion tilaajaorganisaatio, ei koskaan
       * fyysinen urakoitsija - approve-reitti lukee rakennuttajan
       * metadata.developer-kentästä, ei metadata.builder-kentästä.
       */
      developer: "Puolustuskiinteistöt",
      region: municipality?.region ?? null,

      decision_status: decisionStatus,
      documents_url: document.document_url,
      source_url: document.document_url,

      description,

      phase_hint: phaseHint,

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
    municipality: municipality?.name ?? detectedMunicipality,
    decisionStatus,
    phaseHint,
    classification,
  }
}
