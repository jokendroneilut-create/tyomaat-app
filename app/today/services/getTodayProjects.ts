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
  /*
   * "Koko Suomi" on velhon sentinel-arvo koko maalle — sitä EI saa antaa
   * .in("region", ...):lle, koska mikään hanke ei ole maakunnassa "Koko Suomi"
   * (johtaisi tyhjään syötteeseen). Suodatetaan sentinel pois; jos jäljelle
   * jää oikeita maakuntia, rajataan niihin, muuten ei aluerajausta.
   */
  const effectiveRegions = (regions ?? []).filter(
    (r) => r && r.toLowerCase() !== "koko suomi"
  )

  if (effectiveRegions.length > 0) {
    query = query.in("region", effectiveRegions)
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(1000)

  if (error) {
    throw error
  }

  return data ?? []
}