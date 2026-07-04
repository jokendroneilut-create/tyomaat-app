import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type DiscoverySourceRow = {
  id: string
  name: string
  type: string
  category: string | null
  url: string
  priority: number | null
  enabled: boolean | null
  refresh_minutes: number | null
  collector: string
  parser: string | null
  last_run_at: string | null
  last_success_at: string | null
  last_error_at: string | null
  last_error_message: string | null
  run_count: number | null
  success_count: number | null
  error_count: number | null
}

export async function getDiscoverySources(): Promise<DiscoverySourceRow[]> {
  const { data, error } = await supabaseAdmin
    .from("discovery_sources")
    .select("*")
    .order("priority", { ascending: false })
    .order("name", { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []) as DiscoverySourceRow[]
}