import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { verifyAdminRequest } from "@/lib/auth/verifyAdminRequest"

export const runtime = "nodejs"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function fetchAllUsers() {
  let allUsers: any[] = []
  let page = 1
  const perPage = 100

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
    if (error) throw error

    const batch = data.users || []
    allUsers = allUsers.concat(batch)

    if (batch.length < perPage) break
    page++
  }

  return allUsers
}

function topN<T>(map: Map<T, number>, n: number) {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
}

export async function GET(request: Request) {
  const auth = await verifyAdminRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const [users, eventsRes, savedSearchesRes, favoritesRes, teamMembersRes] =
      await Promise.all([
        fetchAllUsers(),
        supabaseAdmin
          .from("analytics_events")
          .select("user_id, event_type, path, project_id, duration_seconds, device_type")
          .limit(20000),
        supabaseAdmin.from("saved_searches").select("user_id"),
        supabaseAdmin.from("user_project_favorites").select("project_id"),
        supabaseAdmin.from("team_members").select("user_id, team_id"),
      ])

    if (eventsRes.error) throw eventsRes.error
    if (savedSearchesRes.error) throw savedSearchesRes.error
    if (favoritesRes.error) throw favoritesRes.error
    if (teamMembersRes.error) throw teamMembersRes.error

    const userEmail = new Map(users.map((u) => [u.id, u.email ?? u.id]))
    const events = eventsRes.data ?? []

    // Eniten kirjautuneet käyttäjät
    const loginCounts = new Map<string, number>()
    // Pisimpään aikaa viettäneet käyttäjät (sekunteina)
    const userTimeSpent = new Map<string, number>()
    // Eniten katsotut sivut (sekunteina)
    const pageTimeSpent = new Map<string, number>()
    // Eniten avatut hankkeet
    const projectOpenCounts = new Map<string, number>()
    // Laitejakauma
    const deviceCounts = new Map<string, number>()

    for (const e of events) {
      if (e.device_type) {
        deviceCounts.set(e.device_type, (deviceCounts.get(e.device_type) ?? 0) + 1)
      }

      if (e.event_type === "login" && e.user_id) {
        loginCounts.set(e.user_id, (loginCounts.get(e.user_id) ?? 0) + 1)
      }

      if (e.event_type === "pageview") {
        const seconds = e.duration_seconds ?? 0

        if (e.user_id) {
          userTimeSpent.set(e.user_id, (userTimeSpent.get(e.user_id) ?? 0) + seconds)
        }

        if (e.path) {
          pageTimeSpent.set(e.path, (pageTimeSpent.get(e.path) ?? 0) + seconds)
        }
      }

      if (e.event_type === "project_open" && e.project_id) {
        projectOpenCounts.set(
          e.project_id,
          (projectOpenCounts.get(e.project_id) ?? 0) + 1
        )
      }
    }

    // Hakuvahdit asettaneet käyttäjät
    const savedSearchCounts = new Map<string, number>()
    for (const row of savedSearchesRes.data ?? []) {
      if (row.user_id) {
        savedSearchCounts.set(row.user_id, (savedSearchCounts.get(row.user_id) ?? 0) + 1)
      }
    }

    // Eniten suosikkeihin lisätyt hankkeet
    const favoriteCounts = new Map<string, number>()
    for (const row of favoritesRes.data ?? []) {
      if (row.project_id) {
        favoriteCounts.set(row.project_id, (favoriteCounts.get(row.project_id) ?? 0) + 1)
      }
    }

    // Tiiminäkymän käyttöön ottaneet käyttäjät
    const teamUserIds = Array.from(
      new Set((teamMembersRes.data ?? []).map((row) => row.user_id).filter(Boolean))
    )

    // Poimitaan hankkeiden nimet niille joita tarvitaan (avatut + suosikit)
    const neededProjectIds = Array.from(
      new Set([
        ...Array.from(projectOpenCounts.keys()),
        ...Array.from(favoriteCounts.keys()),
      ])
    )

    let projectNames = new Map<string, string>()
    if (neededProjectIds.length > 0) {
      const { data: projectRows, error: projectError } = await supabaseAdmin
        .from("projects")
        .select("id, name")
        .in("id", neededProjectIds)

      if (projectError) throw projectError

      projectNames = new Map((projectRows ?? []).map((p) => [p.id, p.name]))
    }

    const totalDeviceEvents = Array.from(deviceCounts.values()).reduce((a, b) => a + b, 0)
    const devicePercentages = Array.from(deviceCounts.entries()).map(([device, count]) => ({
      device,
      count,
      percentage: totalDeviceEvents > 0 ? Math.round((count / totalDeviceEvents) * 1000) / 10 : 0,
    }))

    const mapUsers = (entries: [string, number][], key: string) =>
      entries.map(([userId, value]) => ({
        userId,
        email: userEmail.get(userId) ?? userId,
        [key]: value,
      }))

    const mapProjects = (entries: [string, number][], key: string) =>
      entries.map(([projectId, value]) => ({
        projectId,
        name: projectNames.get(projectId) ?? "(poistettu hanke)",
        [key]: value,
      }))

    return NextResponse.json({
      ok: true,
      mostLoggedInUsers: mapUsers(topN(loginCounts, 10), "loginCount"),
      mostTimeSpentUsers: mapUsers(topN(userTimeSpent, 10), "seconds"),
      mostViewedPages: topN(pageTimeSpent, 10).map(([path, seconds]) => ({ path, seconds })),
      searchWatchUsers: mapUsers(
        topN(savedSearchCounts, 50),
        "watchCount"
      ),
      mostOpenedProjects: mapProjects(topN(projectOpenCounts, 10), "openCount"),
      mostFavoritedProjects: mapProjects(topN(favoriteCounts, 10), "favoriteCount"),
      teamUsers: teamUserIds.map((userId) => ({
        userId,
        email: userEmail.get(userId) ?? userId,
      })),
      devicePercentages,
      totalUsers: users.length,
      totalEvents: events.length,
    })
  } catch (err: any) {
    console.error("ANALYTICS ROUTE ERROR:", err)
    return NextResponse.json({ error: err?.message ?? "unknown error" }, { status: 500 })
  }
}
