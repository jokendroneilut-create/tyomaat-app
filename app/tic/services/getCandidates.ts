import { createClient } from "@supabase/supabase-js"
import { Candidate } from "../types/candidate"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function getCandidates(
  limit = 50
): Promise<Candidate[]> {
  const { data, error } = await supabaseAdmin
  .from("candidate_projects")
  .select("*")
  .gte("candidate_quality", 20)
  .order("candidate_quality", { ascending: false })
  .order("score", { ascending: false })
  .order("last_signal_at", { ascending: false })
  .limit(limit)

  if (error) {
    throw error
  }

  return (data ?? []) as Candidate[]
}