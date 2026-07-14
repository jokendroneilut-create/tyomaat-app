import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const AFFINITY_ATTRIBUTES = [
  "region",
  "business_value",
  "construction_type",
  "building_type",
  "size_class",
  "source_name",
] as const

export type FeedbackContext = {
  downvotedProjectIds: Set<string>
  ratings: Record<string, "up" | "down">
  affinity: Record<string, Record<string, number>>
}

const EMPTY_CONTEXT: FeedbackContext = {
  downvotedProjectIds: new Set(),
  ratings: {},
  affinity: {},
}

export async function getUserFeedbackContext(
  userId?: string | null
): Promise<FeedbackContext> {
  if (!userId) return EMPTY_CONTEXT

  const { data, error } = await supabaseAdmin
    .from("project_feedback")
    .select(
      "project_id, rating, region, business_value, construction_type, building_type, size_class, source_name"
    )
    .eq("user_id", userId)

  if (error) throw error

  const downvotedProjectIds = new Set<string>()
  const ratings: Record<string, "up" | "down"> = {}
  const affinity: Record<string, Record<string, number>> = {}

  for (const row of data ?? []) {
    if (row.rating === "down") downvotedProjectIds.add(row.project_id)
    ratings[row.project_id] = row.rating

    const delta = row.rating === "up" ? 1 : -1

    for (const attr of AFFINITY_ATTRIBUTES) {
      const value = (row as any)[attr]
      if (!value) continue

      if (!affinity[attr]) affinity[attr] = {}
      affinity[attr][value] = (affinity[attr][value] ?? 0) + delta
    }
  }

  return { downvotedProjectIds, ratings, affinity }
}
