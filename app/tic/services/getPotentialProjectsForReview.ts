import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function getPotentialProjectsForReview() {
  const { data, error } = await supabaseAdmin
    .from("potential_projects")
    .select("*")
    .eq("status", "new")
    .neq("metadata->>recommended_action", "ignore")
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) throw error

  return data ?? []
}