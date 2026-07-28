import { getTodayProjects, getRegionProjectCount } from "./getTodayProjects"
import { getTodaySettings } from "./getTodaySettings"
import { getUserFeedbackContext } from "./getUserFeedbackContext"
import { getUserFavoritesContext } from "./getUserFavoritesContext"
import {
  matchesBestSalesMoments,
  matchesSources,
  matchesRegions,
} from "./todayFilters"
import { rankTodayProjects } from "./todayRanking"
import { getTeamOwnership } from "./getTeamOwnership"
import { persistOpportunityScores } from "@/lib/opportunity/persistScores"

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

  const teamModeOn = settings.teamModeInToday === true

  const [
    allProjects,
    feedbackContext,
    favoritesContext,
    regionTotal,
    teamOwnership,
  ] = await Promise.all([
    getTodayProjects(settings.regions),
    getUserFeedbackContext(userId),
    getUserFavoritesContext(userId),
    getRegionProjectCount(settings.regions),
    getTeamOwnership(userId, teamModeOn),
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

  // V4: persistoi asiakaskohtaiset relevanssipisteet (best-effort, ei estä
  // näkymää). Pohja P2-hälytyksille + analytiikka.
  await persistOpportunityScores(userId, rankedProjects)

  /*
   * Tiimi-integraatio (opt-in): liitä hankkeeseen omistaja tiimistä. Oletuksena
   * kollegan omistamat piilotetaan syötteestä (hideTeammateOwned) — omistajuus
   * on jo jonkun, joten sitä ei näytetä päällekkäin. Omat + jakamattomat jäävät.
   * Jos hideTeammateOwned = false, kollegan omistamat näkyvät badgella.
   */
  const teamRankedProjects =
    teamModeOn && teamOwnership.inTeam
      ? rankedProjects
          .map((project: any) => {
            const ownerId =
              teamOwnership.ownerByProject.get(project.id) ?? null
            return {
              ...project,
              team_owner_id: ownerId,
              team_owner_name: ownerId
                ? teamOwnership.nameByOwner.get(ownerId) ?? null
                : null,
            }
          })
          .filter((project: any) => {
            if (settings.hideTeammateOwned === false) return true
            // Piilota kollegan omistamat (omat ja jakamattomat jäävät).
            return !(
              project.team_owner_id && project.team_owner_id !== userId
            )
          })
      : rankedProjects

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
      regionTotal,
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

    recommendedProjects: teamRankedProjects.slice(0, maxProjects),

    // Ohjaa opt-in-kytkimen näkymisen /today-sivulla.
    team: { inTeam: teamOwnership.inTeam },
  }
}