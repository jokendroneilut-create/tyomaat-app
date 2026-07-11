import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function getTodayProjects() {
  const { data, error } = await supabaseAdmin
    .from("projects")
    .select(`
      id,
      created_at,
      name,
      city,
      region,
      location,
      property_type,
      phase,
      additional_info,
      metadata
    `)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(300)

  if (error) {
    throw error
  }

  return data ?? []
}