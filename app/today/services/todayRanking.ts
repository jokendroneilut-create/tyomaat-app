import type { TodaySettings } from "./getTodaySettings"
import { projectSource, projectPhaseText } from "./todayFilters"
import type { FeedbackContext } from "./getUserFeedbackContext"

const FEEDBACK_ATTRIBUTE_WEIGHT = 5
const FEEDBACK_SCORE_CAP = 30

function daysSince(dateValue: string | null | undefined) {
  if (!dateValue) return 999

  const created = new Date(dateValue).getTime()
  if (Number.isNaN(created)) return 999

  const now = Date.now()
  return Math.max(0, Math.floor((now - created) / (1000 * 60 * 60 * 24)))
}

function businessValueScore(project: any) {
  const value = project.metadata?.business_value

  if (value === "high") return 50
  if (value === "medium") return 25
  if (value === "low") return 5

  return 0
}

function freshnessScore(project: any) {
  const age = daysSince(project.created_at)

  if (age <= 1) return 25
  if (age <= 3) return 15
  if (age <= 7) return 8

  return 0
}

function sourceScore(project: any) {
  const source = projectSource(project)

  if (source.includes("hilma")) return 15
  if (source.includes("rakennuslupa")) return 12
  if (source.includes("espoon kuulutukset")) return 12
  if (source.includes("kaavoitus")) return 10

  return 0
}

function salesMomentScore(project: any, settings: TodaySettings) {
  const moments = settings.bestSalesMoments ?? []
  if (!moments.length) return 0

  const text = projectPhaseText(project)

  let score = 0

  for (const moment of moments) {
    const normalized = moment.toLowerCase()

    if (normalized === "kilpailutus" && text.includes("hilma")) score += 20
    if (normalized === "rakennuslupa" && text.includes("lupa")) score += 20
    if (normalized === "rakenteilla" && text.includes("rakenteilla")) score += 20
    if (normalized === "kaavoitus" && text.includes("kaavoitus")) score += 20
    if (normalized === "suunnittelu" && text.includes("suunnittel")) score += 20
  }

  return Math.min(score, 30)
}

function feedbackAffinityScore(project: any, feedbackContext?: FeedbackContext) {
  if (!feedbackContext) return 0

  const attrs: Record<string, string | null | undefined> = {
    region: project.region,
    business_value: project.metadata?.business_value,
    construction_type: project.metadata?.construction_type,
    building_type: project.metadata?.building_type,
    size_class: project.metadata?.size_class,
    source_name: project.metadata?.source_name,
  }

  let score = 0

  for (const key of Object.keys(attrs)) {
    const value = attrs[key]
    if (!value) continue

    const net = feedbackContext.affinity[key]?.[value]
    if (net) score += net * FEEDBACK_ATTRIBUTE_WEIGHT
  }

  return Math.max(-FEEDBACK_SCORE_CAP, Math.min(FEEDBACK_SCORE_CAP, score))
}

export function calculateTodayScore(
  project: any,
  settings: TodaySettings,
  feedbackContext?: FeedbackContext
) {
  return (
    businessValueScore(project) +
    freshnessScore(project) +
    sourceScore(project) +
    salesMomentScore(project, settings) +
    feedbackAffinityScore(project, feedbackContext)
  )
}

export function rankTodayProjects(
  projects: any[],
  settings: TodaySettings,
  feedbackContext?: FeedbackContext
) {
  return [...projects]
    .map((project) => ({
      ...project,
      today_score: calculateTodayScore(project, settings, feedbackContext),
    }))
    .sort((a, b) => {
      if (b.today_score !== a.today_score) {
        return b.today_score - a.today_score
      }

      return (
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime()
      )
    })
}