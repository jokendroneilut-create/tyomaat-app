import { scoreRelevance, isRelevanceScorerEnabled } from "./scorers/llmRelevanceScorer"
import { logRelevanceDecision } from "./logRelevanceDecision"

/*
 * LLM-relevanssiportti uusille ehdokkaille.
 *
 * Portti oli olemassa mutta ei ollut kytkettynä mihinkään: ainoa kutsuja oli
 * lib/agent/pipeline/runSource.ts, jota puolestaan kutsui vain
 * /api/agent/run-source - reitti jolle ei ollut yhtään kutsujaa (ei cronissa,
 * ei käyttöliittymässä) ja joka luki poistettua agent_sources-taulua. Siksi
 * llm_relevance_log oli tyhjä ja TIC:in AI-suodatus-sivu näytti nollaa.
 *
 * Nyt portti on siellä missä ehdokkaat oikeasti syntyvät: identityWorkerin
 * resolvePotentialProject.
 *
 * PORTTI EI KOSKAAN HYVÄKSY MITÄÄN JULKISEKSI HANKKEEKSI. Se päättää vain
 * pääseekö ehdokas katselmointijonoon vai suodattuuko se pois - hyväksyntä on
 * aina ihmisen tekemä. Suunta on tarkoituksellinen: väärä suodatus piilottaa
 * yhden liidin, väärä hyväksyntä veisi roskaa käyttäjille asti.
 *
 * Portti ajetaan VAIN harmaalle alueelle eli silloin kun sääntöpohjainen
 * luokittelu ei sanonut mitään (recommended_action puuttuu). Selvät tapaukset
 * - vanhat uutiset, kaavan ajantasaistamiset, CQE:n omat päätökset - hoituvat
 * sääntöinä ilman mallikutsua.
 *
 * Fail-open kauttaaltaan: ilman API-avainta, mallin virheessä tai lokituksen
 * kaatuessa ehdokas menee jonoon kuten ennenkin.
 */

export type RelevanceGateResult = {
  /* Metadata joka yhdistetään ehdokkaan metadataan. Tyhjä jos portti ei ajanut. */
  metadata: Record<string, unknown>
  /* True = ehdokas suodatetaan pois katselmointijonosta. */
  ignored: boolean
}

const NO_DECISION: RelevanceGateResult = { metadata: {}, ignored: false }

/*
 * Sama kynnys kuin aiemmassa saveSignal-toteutuksessa: epävarma "ei
 * relevantti" ei riitä suodatukseen, koska virheen hinta on piilotettu liidi.
 */
const SURFACE_CONFIDENCE = 0.6

export async function gateCandidateRelevance(input: {
  title: string | null
  description?: string | null
  sourceName?: string | null
  /*
   * Sääntöjen jo antama päätös. Jos tämä on olemassa, porttia ei ajeta
   * lainkaan - sääntö on halvempi ja jäljitettävämpi kuin mallikutsu.
   */
  ruleRecommendedAction: string | null
}): Promise<RelevanceGateResult> {
  if (!input.title) return NO_DECISION
  if (input.ruleRecommendedAction) return NO_DECISION
  if (!isRelevanceScorerEnabled()) return NO_DECISION

  const verdict = await scoreRelevance({
    title: input.title,
    description: input.description ?? null,
    sourceName: input.sourceName ?? null,
  })

  if (!verdict) return NO_DECISION

  const surface = verdict.relevant && verdict.confidence >= SURFACE_CONFIDENCE

  await logRelevanceDecision({
    title: input.title,
    description: input.description ?? null,
    sourceName: input.sourceName ?? null,
    ruleScore: 0,
    ruleStatus: "no_rule_verdict",
    model: verdict.model,
    llmRelevant: verdict.relevant,
    llmConfidence: verdict.confidence,
    llmReason: verdict.reason,
    finalStatus: surface ? "needs_review" : "ignored",
  })

  if (surface) {
    return {
      metadata: {
        llm_relevance: {
          relevant: true,
          confidence: verdict.confidence,
          reason: verdict.reason,
          model: verdict.model,
        },
      },
      ignored: false,
    }
  }

  return {
    metadata: {
      recommended_action: "ignore",
      auto_ignored_reason: "llm_ei_relevantti",
      llm_relevance: {
        relevant: verdict.relevant,
        confidence: verdict.confidence,
        reason: verdict.reason,
        model: verdict.model,
      },
    },
    ignored: true,
  }
}
