import { getTodayProjects } from "./getTodayProjects"
import { getTodaySettings } from "./getTodaySettings"
import { getUserFeedbackContext } from "./getUserFeedbackContext"
import {
  matchesBestSalesMoments,
  matchesSources,
  matchesRegions,
  projectSource,
} from "./todayFilters"
import { rankTodayProjects } from "./todayRanking"

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

  const [allProjects, feedbackContext] = await Promise.all([
    getTodayProjects(),
    getUserFeedbackContext(userId),
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

    metrics: {
      newProjects: recentProjects.length,
      approvedToday: recentProjects.length,
      highValue: highValueProjects.length,

      tenders: rankedProjects.filter((project: any) =>
        projectSource(project).includes("hilma")
      ).length,
    },

    approvedProjects: recentProjects.slice(0, maxProjects),

    newPotentialProjects: [],

    recommendedProjects: rankedProjects.slice(0, maxProjects),
  }
}