import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function getPendingReviewCount() {
  const { count, error } = await supabaseAdmin
    .from("potential_projects")
    .select("*", { count: "exact", head: true })
    .eq("status", "new")
    .neq("metadata->>recommended_action", "ignore")

  if (error) throw error

  return count ?? 0
}
