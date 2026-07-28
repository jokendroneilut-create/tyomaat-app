import { createClient } from "@supabase/supabase-js"
import { projectPhaseKey } from "./projectPhaseKey"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Kirjoitetaan enintään tämä määrä rivejä per /today-lataus (raja kuormalle).
const MAX_PERSISTED_ROWS = 200

type RankedProject = {
  id?: string | null
  today_score?: number
  today_reasons?: string[]
  [key: string]: unknown
}

/*
 * V4: persistoi asiakaskohtaiset relevanssipisteet (user × hanke) taulun
 * `opportunity_scores` riveiksi. Lasketaan kysyntähetkellä (kun /today
 * lataa ja pisteyttää hankkeet), ei erillisenä eräajona.
 *
 * Best-effort: taulun puuttuminen tai kirjoitusvirhe EI saa kaataa
 * /today-näkymää — virhe vain logataan. Näin koodi voidaan deployata ennen
 * kuin taulu on luotu Supabaseen, ja näkymä toimii silti.
 *
 * Tallennetaan vain relevantit (score > 0). Pohja P2-hälytyksille + analytiikka.
 */
export async function persistOpportunityScores(
  userId: string | null | undefined,
  rankedProjects: RankedProject[]
): Promise<void> {
  if (!userId || !rankedProjects?.length) return

  const rows = rankedProjects
    .filter((p) => typeof p.id === "string" && (p.today_score ?? 0) > 0)
    .slice(0, MAX_PERSISTED_ROWS)
    .map((p) => ({
      user_id: userId,
      project_id: p.id as string,
      score: Math.round(p.today_score ?? 0),
      phase_key: projectPhaseKey(p) ?? null,
      reasons: Array.isArray(p.today_reasons) ? p.today_reasons : [],
      updated_at: new Date().toISOString(),
    }))

  if (!rows.length) return

  try {
    const { error } = await supabaseAdmin
      .from("opportunity_scores")
      .upsert(rows, { onConflict: "user_id,project_id" })

    if (error) {
      console.error("persistOpportunityScores upsert error:", error.message)
    }
  } catch (err) {
    console.error("persistOpportunityScores failed:", err)
  }
}
