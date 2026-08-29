import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type TodaySettings = {
  regions: string[]
  municipalities: string[]
  projectStages: string[]
  constructionTypes: string[]
  buildingTypes: string[]
  bestSalesMoments: string[]
  keywords: string[]
  maxProjects: number
  showRejected: boolean
  showArchived: boolean
  companyProfile: string | null
  // P2: sähköpostihälytys kun hanke etenee roolin huippuvaiheeseen.
  // Opt-out: oletuksena päällä (edellyttää roolia). Ks. /api/opportunity-alerts.
  opportunityAlerts: boolean
  // Tiimi-integraatio /today:hin. Opt-in (oletus off), näkyy vain jos käyttäjä
  // kuuluu tiimiin. Kun päällä + hideTeammateOwned, kollegan omistamat hankkeet
  // piilotetaan syötteestä. Ks. getTeamOwnership + TeamModeToggle.
  teamModeInToday: boolean
  hideTeammateOwned: boolean
}

export const defaultTodaySettings: TodaySettings = {
  regions: [],
  municipalities: [],
  projectStages: [],
  constructionTypes: [],
  buildingTypes: [],
  bestSalesMoments: [],
  keywords: [],
  maxProjects: 20,
  showRejected: false,
  showArchived: false,
  companyProfile: null,
  opportunityAlerts: true,
  teamModeInToday: false,
  hideTeammateOwned: true,
}

export async function getTodaySettings(userId?: string | null) {
  if (!userId) {
    return defaultTodaySettings
  }

  const { data, error } = await supabaseAdmin
    .from("user_today_preferences")
    .select("settings")
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return {
    ...defaultTodaySettings,
    ...(data?.settings ?? {}),
  }
}