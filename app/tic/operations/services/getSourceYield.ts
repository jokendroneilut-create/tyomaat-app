import { createClient } from "@supabase/supabase-js"
import { sources } from "@/lib/agent/sources"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type SourceYield = {
  name: string
  lastSeen: string | null
  eventsLast30Days: number
  queuedForReview: number
  skipped: number
}

/*
 * Kandidaattituotto per fetcher (lib/agent/sources.ts:n 34 yritys- ja
 * varhaislähdettä): montako ehdokasta lähde tuotti ja mihin ne päätyivät.
 *
 * Tämä on eri asia kuin discovery_sourcesin lähdeterveys, joka kertoo vain
 * onnistuiko ajo. Nämä lähteet ajetaan nykyään samassa putkessa muiden
 * kanssa (collector = legacyFetchCollector), mutta niiden tuottoa ei näe
 * mistään muualta, koska yksi ajo tuottaa vaihtelevan määrän ehdokkaita.
 *
 * Lähde on project_import_events, jonne jokainen käsitelty kandidaatti
 * kirjataan riippumatta lopputuloksesta.
 */
export async function getSourceYield(): Promise<SourceYield[]> {
  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  ).toISOString()

  const { data, error } = await supabaseAdmin
    .from("project_import_events")
    .select("source_name, detected_at, action_taken")
    .gte("detected_at", thirtyDaysAgo)

  if (error) throw error

  const bySource = new Map<
    string,
    { lastSeen: string | null; total: number; queued: number; skipped: number }
  >()

  for (const row of data ?? []) {
    const key = row.source_name ?? "tuntematon"
    const entry = bySource.get(key) ?? {
      lastSeen: null,
      total: 0,
      queued: 0,
      skipped: 0,
    }

    entry.total += 1
    if (!entry.lastSeen || row.detected_at > entry.lastSeen) {
      entry.lastSeen = row.detected_at
    }
    if (row.action_taken === "queued_for_review") entry.queued += 1
    if (row.action_taken === "skipped") entry.skipped += 1

    bySource.set(key, entry)
  }

  return sources.map((source) => {
    const stat = bySource.get(source.name)

    return {
      name: source.name,
      lastSeen: stat?.lastSeen ?? null,
      eventsLast30Days: stat?.total ?? 0,
      queuedForReview: stat?.queued ?? 0,
      skipped: stat?.skipped ?? 0,
    }
  })
}
