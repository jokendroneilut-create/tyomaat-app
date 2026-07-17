import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type FavoritesContext = {
  favoriteProjectIds: Set<string>
  hiddenProjectIds: Set<string>
}

const EMPTY_CONTEXT: FavoritesContext = {
  favoriteProjectIds: new Set(),
  hiddenProjectIds: new Set(),
}

export async function getUserFavoritesContext(
  userId?: string | null
): Promise<FavoritesContext> {
  if (!userId) return EMPTY_CONTEXT

  const { data, error } = await supabaseAdmin
    .from("user_project_favorites")
    .select("project_id, hidden_from_today")
    .eq("user_id", userId)

  if (error) throw error

  const favoriteProjectIds = new Set<string>()
  const hiddenProjectIds = new Set<string>()

  for (const row of data ?? []) {
    favoriteProjectIds.add(row.project_id)
    if (row.hidden_from_today) hiddenProjectIds.add(row.project_id)
  }

  return { favoriteProjectIds, hiddenProjectIds }
}
