import { getTodayProjects, getRegionProjectCount } from "./getTodayProjects"
import { getTodaySettings } from "./getTodaySettings"
import { getUserFeedbackContext } from "./getUserFeedbackContext"
import { getUserFavoritesContext } from "./getUserFavoritesContext"
import {
  matchesBestSalesMoments,
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

/*
 * Kuinka monta riviä syotteeseen ladataan. Nostettu 100 -> 300 sen
 * jalkeen kun rivi kevennettiin: mitattu 0,52 kt/rivi, joten 300 riviä
 * on 156 kt - yha kevyempi kuin 20 raskasta riviä oli (89 kt oli
 * vanhalla rivilla, mutta se kantoi koko kuvaustekstin).
 *
 * Kolmesataa kattaa suurimmankin yksittaisen valinnan: Uudenmaan
 * "Rakenteilla" on 305 hanketta (mitattu 2.9.2026).
 */
const LADATTAVAT = 300

/*
 * SYOTTEEN RIVI KEVENNETAAN ENNEN LAHETYSTA.
 *
 * Hankkeen rivi kantaa `additional_info`- ja `metadata.description`
 * -tekstit, jotka ovat mitattuna 4,4 kt/rivi eli 444 kt sadalta
 * rivilta. Asiakas ei tarvitse niita: kortti nayttaa nimen, sijainnin
 * ja vaiheen, ja modaali hakee hankkeen itse id:lla
 * (`TodayProjectModal`). Pisteytys kayttaa tekstit palvelimella ENNEN
 * tata, joten avainsanaosumat sailyvat.
 *
 * Naiden karsiminen tekee sadasta rivista kevyemman kuin
 * kahdestakymmenesta oli aiemmin.
 */
function kevytRivi(project: any) {
  const md = project.metadata ?? {}
  return {
    id: project.id,
    name: project.name,
    city: project.city,
    region: project.region,
    location: project.location,
    phase: project.phase,
    property_type: project.property_type,
    developer: project.developer,
    builder: project.builder,
    created_at: project.created_at,
    /* Pisteytyksen tuotos, jota kortti nayttaa. */
    today_match: project.today_match,
    today_reasons: project.today_reasons,
    team_owner_id: project.team_owner_id,
    team_owner_name: project.team_owner_name,
    /* Vain ne metadatan kentat joita kortti ja peukut kayttavat. */
    metadata: {
      business_value: md.business_value ?? null,
      construction_type: md.construction_type ?? null,
      building_type: md.building_type ?? null,
      size_class: md.size_class ?? null,
      source_name: md.source_name ?? null,
    },
  }
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
    /*
     * Tekstit haetaan vain kun kayttajalla on avainsanoja: ne ovat rivin
     * painavin osa eika niita tarvita muuhun kuin avainsanapisteytykseen.
     */
    getTodayProjects(settings.regions, {
      tarvitseeTekstit: Array.isArray(settings.keywords) && settings.keywords.length > 0,
    }),
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

    /*
     * SYOTTEESEEN LADATAAN ENEMMAN KUIN NAYTETAAN.
     *
     * Asetuksen `maxProjects` (oletus 20) rajasi aiemmin sen mita
     * palvelin ylipaataan lahetti, joten listan lopussa ei ollut mihin
     * jatkaa - sivu oli nopeasti selattu loppuun. Nyt asetus ohjaa vain
     * ENSIMMAISTA erää, ja "Nayta lisaa" paljastaa loput.
     *
     * Yläraja on olemassa siksi etta rivi kantaa kuvauksen ja koko
     * metadatan (modaali tarvitsee ne), joten koko pisteytetty joukko
     * olisi megatavuja. Sata riviä on viisinkertainen oletusnäkymään ja
     * pysyy kevyena; sen ylitse ohjataan hankelistaukseen.
     */
    recommendedProjects: teamRankedProjects
      .slice(0, Math.max(maxProjects, LADATTAVAT))
      .map(kevytRivi),
    recommendedInitial: maxProjects,
    recommendedTotal: teamRankedProjects.length,

    // Ohjaa opt-in-kytkimen näkymisen /today-sivulla.
    team: { inTeam: teamOwnership.inTeam },
  }
}