import { getTodayProjects } from "./getTodayProjects"
import { getTodaySettings } from "./getTodaySettings"
import { getUserFeedbackContext } from "./getUserFeedbackContext"
import { getUserFavoritesContext } from "./getUserFavoritesContext"
import {
  matchesBestSalesMoments,
  matchesSources,
  matchesRegions,
} from "./todayFilters"
import { rankTodayProjects } from "./todayRanking"

function toMetricProject(project: any) {
  return {
    id: project.id,
    name: project.name,
    city: project.city,
    region: project.region,
    phase: project.phase,
  }
}

function daysAgoIso(days: number) {
  const now = new Date()
  const start = new Date(now)
  start.setDate(start.getDate() - days)
  start.setHours(0, 0, 0, 0)
  return start.toISOString()
}

export async function getTodaySummary(userId?: string | null) {
  const sevenDaysAgo = daysAgoIso(7)

  const settings = await getTodaySettings(userId)
  const maxProjects = Number(settings.maxProjects ?? 20)

  const [allProjects, feedbackContext, favoritesContext] = await Promise.all([
    getTodayProjects(settings.regions),
    getUserFeedbackContext(userId),
    getUserFavoritesContext(userId),
  ])

  const filteredProjects = allProjects
  .filter((project: any) =>
    matchesRegions(project, settings.regions)
  )
  .filter((project: any) =>
    matchesSources(project, settings.sources)
  )
  .filter((project: any) =>
    matchesBestSalesMoments(project, settings.bestSalesMoments)
  )
  .filter((project: any) =>
    settings.showRejected || !feedbackContext.downvotedProjectIds.has(project.id)
  )
  .filter((project: any) =>
    !favoritesContext.hiddenProjectIds.has(project.id)
  )

  const rankedProjects = rankTodayProjects(
    filteredProjects,
    settings,
    feedbackContext
  )

  const recentProjects = rankedProjects.filter(
    (project: any) =>
      new Date(project.created_at) >= new Date(sevenDaysAgo)
  )

  const highValueProjects = rankedProjects.filter(
    (project: any) =>
      project.metadata?.business_value === "high"
  )

  return {
    settings,
    feedback: feedbackContext.ratings,
    favorites: Object.fromEntries(
      Array.from(favoritesContext.favoriteProjectIds).map((id) => [id, true])
    ),

    metrics: {
      regionTotal: allProjects.length,
      newProjects: recentProjects.length,
      approvedToday: recentProjects.length,
      highValue: highValueProjects.length,
    },

    metricProjects: {
      new: recentProjects.slice(0, 50).map(toMetricProject),
      highValue: highValueProjects.slice(0, 50).map(toMetricProject),
    },

    approvedProjects: recentProjects.slice(0, maxProjects),

    newPotentialProjects: [],

    recommendedProjects: rankedProjects.slice(0, maxProjects),
  }
}