import { createClient } from "@supabase/supabase-js"

import { relevanssiportinTila } from "@/lib/tic/relevanssiportinTila"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type RelevanceDecision = {
  id: string
  created_at: string
  signal_id: string | null
  title: string | null
  source_name: string | null
  model: string | null
  llm_relevant: boolean | null
  llm_confidence: number | null
  llm_reason: string | null
  final_status: string | null
}

export type RelevanceDecisionsResult = {
  decisions: RelevanceDecision[]
  total: number
  surfaced: number
  ignored: number
  /*
   * Epaonnistuneet kutsut. Ilman tata katko oli nakymaton: loki kirjasi
   * vain onnistuneet, joten "malli ei vastannut" ja "mallia ei kutsuttu"
   * eivat eronneet mitenkaan (D-177).
   */
  errors: number
  lastErrorAt: string | null
  lastErrorReason: string | null
  /*
   * Onko portti oikeasti tauolla. Pelkka virheiden lukumaara ei kerro
   * sita: 1.10.2026 ikkunassa oli 5 virhetta, mutta kaikki samasta
   * seitseman minuutin ruuhkasta viikkoa aiemmin, ja portti oli
   * vastannut 131 kertaa niiden jalkeen (D-222).
   */
  paused: boolean
  successesSinceError: number
  /* Selitys virheen omasta viestista, ei arvaus. */
  errorExplanation: string | null
}

/*
 * Lukee AI-relevanssiportin päätökset (llm_relevance_log) TIC-seurantaa varten.
 * Näin näet mitä automaattinen suodatus teki harmaan alueen signaaleille —
 * etenkin mitä se pudotti (ignored) ilman että se päätyi katselmointijonoosi.
 */
export async function getRelevanceDecisions(
  limit = 200
): Promise<RelevanceDecisionsResult> {
  const { data, error } = await supabaseAdmin
    .from("llm_relevance_log")
    .select(
      "id, created_at, signal_id, title, source_name, model, llm_relevant, llm_confidence, llm_reason, final_status"
    )
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) throw error

  const decisions = (data ?? []) as RelevanceDecision[]

  const tila = relevanssiportinTila(decisions)

  return {
    decisions,
    total: decisions.length,
    surfaced: decisions.filter((d) => d.final_status === "needs_review").length,
    ignored: decisions.filter((d) => d.final_status === "ignored").length,
    errors: tila.virheita,
    lastErrorAt: tila.viimeisinVirheAika,
    lastErrorReason: tila.viimeisinVirheSyy,
    paused: tila.tauolla,
    successesSinceError: tila.onnistuneitaVirheenJalkeen,
    errorExplanation: tila.selitys,
  }
}
