import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function getDiscoverySources() {
  const { data, error } = await supabaseAdmin
    .from("discovery_sources")
    .select(`
      id,
      name,
      category,
      enabled,
      priority,
      collector,
      parser,
      refresh_minutes,
      last_run_at,
      last_success_at,
      last_error_at,
      last_error_message,
      run_count,
      success_count,
      error_count
    `)
    .order("priority", { ascending: false })
    .order("name")

  if (error) {
    throw error
  }

  return data ?? []
}