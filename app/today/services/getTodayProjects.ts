import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function getTodayProjects(regions?: string[]) {
  let query = supabaseAdmin
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

  /*
   * Rajataan alueen mukaan jo tietokantatasolla, jos käyttäjä on valinnut
   * tietyt maakunnat. Ilman tätä pelkkä "300 uusinta" -haku voi täyttyä
   * kokonaan muiden alueiden hankkeista, jos niitä on juuri hyväksytty
   * paljon, ja käyttäjän oman alueen osumat putoavat ikkunasta pois
   * kokonaan vaikka niitä olisi runsaasti koko datassa.
   */
  if (regions && regions.length > 0) {
    query = query.in("region", regions)
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(1000)

  if (error) {
    throw error
  }

  return data ?? []
}