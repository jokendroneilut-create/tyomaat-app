import { createClient } from "@supabase/supabase-js"

/*
 * Kirjaa jokaisen LLM-relevanssipäätöksen tauluun llm_relevance_log. Tämä on
 * vaihtoehto 2:n (oman mallin hienosäätö) treenidatan lähde: syöte -> säännön
 * tulos -> mallin vastaus -> lopullinen tila. human_outcome täytetään myöhemmin
 * (kun signaali on kulkenut hyväksyntä/hylkäys-jonon läpi).
 *
 * Fail-open: jos taulua ei ole tai kirjoitus epäonnistuu, ei kaadeta putkea —
 * lokitus on parhaan yrityksen mukaista.
 *
 * Taulun SQL (aja kerran Supabasen SQL-editorissa):
 *
 *   create table if not exists llm_relevance_log (
 *     id uuid primary key default gen_random_uuid(),
 *     created_at timestamptz not null default now(),
 *     signal_id uuid,
 *     title text,
 *     description text,
 *     source_name text,
 *     rule_score int,
 *     rule_status text,
 *     model text,
 *     llm_relevant boolean,
 *     llm_confidence numeric,
 *     llm_reason text,
 *     final_status text,
 *     human_outcome text
 *   );
 */

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function logRelevanceDecision(entry: {
  signalId?: string | null
  title: string
  description?: string | null
  sourceName?: string | null
  ruleScore: number
  ruleStatus: string
  /*
   * Nullit ovat virherivia varten: kun malli ei vastannut, silla ei ollut
   * kantaa. Tyhjaa ei saa lukea "ei relevantti" -paatokseksi (D-177).
   */
  model: string | null
  llmRelevant: boolean | null
  llmConfidence: number | null
  llmReason: string | null
  finalStatus: string
}): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from("llm_relevance_log").insert({
      signal_id: entry.signalId ?? null,
      title: entry.title,
      description: entry.description ?? null,
      source_name: entry.sourceName ?? null,
      rule_score: entry.ruleScore,
      rule_status: entry.ruleStatus,
      model: entry.model ?? null,
      llm_relevant: entry.llmRelevant ?? null,
      llm_confidence: entry.llmConfidence ?? null,
      llm_reason: entry.llmReason ?? null,
      final_status: entry.finalStatus,
    })
    if (error) {
      console.error("logRelevanceDecision insert failed (fail-open):", error.message)
    }
  } catch (err) {
    console.error("logRelevanceDecision failed (fail-open):", err)
  }
}
