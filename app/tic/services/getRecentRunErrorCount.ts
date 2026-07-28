import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/*
 * Kuinka monta agentti-ajoa on epäonnistunut viime tunteina. Käytetään
 * sivupalkin Health-kohdan punaiseen huutomerkkiin: jos > 0, jotain vaatii
 * huomiota (esim. lähde palauttaa HTML:ää JSONin sijaan).
 *
 * Best-effort: virhe tai puuttuva taulu ei saa kaataa TIC-layoutia -> 0.
 */
export async function getRecentRunErrorCount(hours = 24): Promise<number> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

  const { count, error } = await supabaseAdmin
    .from("agent_runs")
    .select("*", { count: "exact", head: true })
    .eq("status", "error")
    .gte("started_at", since)

  if (error) return 0

  return count ?? 0
}
