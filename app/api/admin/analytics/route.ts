import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { verifyAdminRequest } from "@/lib/auth/verifyAdminRequest"
import { ISTUNTO_TAUKO_MIN } from "@/lib/analytics/kayttoyhteenveto"

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

/*
 * Tapahtumat sivutettuna. Aiempi `.limit(20000)` oli sekä katkaisu että
 * hiljainen: kannassa oli 25 263 riviä, joten "tallennettuja tapahtumia"
 * -luku olisi ennen pitkää alkanut valehdella eikä mikään olisi kertonut
 * siitä.
 */
async function fetchAllEvents() {
  const rows: any[] = []

  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from("analytics_events")
      .select("user_id, event_type, path, project_id, duration_seconds, device_type, created_at")
      .range(from, from + 999)

    if (error) throw error

    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  return rows
}

/*
 * ADMIN EROTETAAN OMAKSI LUVUKSEEN.
 *
 * Mitattu 17.8.2026: kaikista 25 263 tapahtumasta 22 254 eli 88 % oli
 * admin-tunnuksesta — sivunkatseluista 90 %. Analytiikka näytti siis
 * pääosin ylläpitäjän omaa käyttöä asiakkaiden käyttönä, ja jokainen
 * "eniten"-lista oli käytännössä hänen.
 *
 * Sama vääristymä olisi tehnyt poikkeamien havaitsemisesta mahdotonta:
 * ylläpitäjä selaa hankkeita työkseen, joten hän olisi aina näyttänyt
 * eniten poikkeavalta.
 */
function resolveAdminIds(users: any[]): Set<string> {
  const admins = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)

  return new Set(
    users
      .filter((u) => admins.includes(String(u.email ?? "").toLowerCase()))
      .map((u) => u.id)
  )
}

export async function GET(request: Request) {
  const auth = await verifyAdminRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const [users, eventsRes, savedSearchesRes, favoritesRes, teamMembersRes, feedbackRes] =
      await Promise.all([
        fetchAllUsers(),
        fetchAllEvents().then((data) => ({ data, error: null as any })),
        supabaseAdmin.from("saved_searches").select("user_id"),
        supabaseAdmin.from("user_project_favorites").select("project_id"),
        supabaseAdmin.from("team_members").select("user_id, team_id"),
        supabaseAdmin
          .from("project_feedback")
          .select(
            "project_id, rating, reason_category, reason_text, region, size_class, source_name, created_at"
          )
          .order("created_at", { ascending: false })
          .limit(5000),
      ])

    if (eventsRes.error) throw eventsRes.error
    if (savedSearchesRes.error) throw savedSearchesRes.error
    if (favoritesRes.error) throw favoritesRes.error
    if (teamMembersRes.error) throw teamMembersRes.error
    if (feedbackRes.error) throw feedbackRes.error

    const userEmail = new Map(users.map((u) => [u.id, u.email ?? u.id]))
    const adminIds = resolveAdminIds(users)

    const allEvents = eventsRes.data ?? []

    /*
     * TAPAHTUMA ILMAN KÄYTTÄJÄTUNNISTETTA ON MAHDOTON (D-083).
     *
     * Kirjausreitti ei kirjoita riviä ilman kirjautunutta käyttäjää, joten
     * tämän luvun kuuluu olla nolla. Nollasta poikkeava tarkoittaa
     * tuntematonta kirjoittajaa. Heinäkuussa niitä kertyi 544 kuukauden
     * ajan eikä kukaan huomannut, koska mikään ei katsonut — tämä mittari
     * on se joka olisi katsonut.
     */
    /*
     * IKKUNA ON 30 VRK, EI KOKO HISTORIA. Heinäkuun 544 riviä ovat pysyvä
     * osa aineistoa, joten koko historiasta laskettuna varoitus olisi aina
     * päällä — ja pysyvä varoitus lakkaa olemasta varoitus. Vanha luku
     * näytetään erikseen taustatietona.
     */
    const unattributedCutoff = new Date(Date.now() - 30 * 86400_000).toISOString()

    const unattributedEvents = allEvents.filter(
      (e) => !e.user_id && String(e.created_at) >= unattributedCutoff
    ).length

    const unattributedEventsAllTime = allEvents.filter((e) => !e.user_id).length

    const adminEventsExcluded = allEvents.filter(
      (e) => e.user_id && adminIds.has(e.user_id)
    ).length

    /* Kaikki alla olevat mittarit koskevat ASIAKKAITA, eivät ylläpitoa. */
    const events = allEvents.filter((e) => e.user_id && !adminIds.has(e.user_id))

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

    /*
     * Kirjautumisajat kerataan ensin ja tiivistetaan vasta silmukan
     * jalkeen: `fetchAllEvents` ei jarjesta rivejä, joten tiivistys ei
     * saa olla riippuvainen saapumisjarjestyksesta.
     */
    const kirjautumisajat = new Map<string, number[]>()

    for (const e of events) {
      if (e.device_type) {
        deviceCounts.set(e.device_type, (deviceCounts.get(e.device_type) ?? 0) + 1)
      }

      /*
       * KIRJAUTUMISTAPAHTUMA EI OLE KIRJAUTUMINEN. `login` kirjataan
       * Supabasen SIGNED_IN-signaalista, joka laukeaa myos istunnon
       * palautuksesta ja valilehden avauksesta. Mitattu 5.9.2026 yhdelta
       * asiakkaalta: 34 tapahtumasta 17 tuli alle minuutin paassa
       * edellisesta, ja nelja osui samaan sekuntiin.
       *
       * Tiivistetaan samalla saannolla kuin istunto (30 min), jotta tama
       * lista ja kayttajakohtainen nakyma kertovat saman luvun.
       */
      if (e.event_type === "login" && e.user_id) {
        const hetki = new Date(String(e.created_at)).getTime()
        if (Number.isFinite(hetki)) {
          const lista = kirjautumisajat.get(e.user_id) ?? []
          lista.push(hetki)
          kirjautumisajat.set(e.user_id, lista)
        }
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

    /*
     * POIKKEAVA KÄYTTÖ (kohta 3).
     *
     * Kolme lukua per käyttäjä: montako ERI hanketta on avattu, suurin
     * avausmäärä yhden tunnin sisällä, ja montako lähdelinkkiä on avattu.
     *
     * Perustaso mitattu 17.8.2026 ilman adminia: 28 asiakasta joilla
     * avauksia, mediaani 6 eri hanketta, suurin 43. Koko lähdelistan
     * kerääminen vaatisi yli 5 000 avausta — kaksi kertaluokkaa yli
     * innokkaimman aidon käyttäjän. Poikkeama ei siis ole hienovarainen,
     * ja siksi tämä on lista eikä hälytys: kynnysarvo asetetaan vasta kun
     * jakaumaa on katsottu.
     */
    const distinctProjectsByUser = new Map<string, Set<string>>()
    const opensPerUserHour = new Map<string, number>()
    const sourceClicksByUser = new Map<string, number>()
    const totalOpensByUser = new Map<string, number>()

    for (const e of events) {
      const userId = e.user_id as string

      if (e.event_type === "project_open" && e.project_id) {
        if (!distinctProjectsByUser.has(userId)) {
          distinctProjectsByUser.set(userId, new Set())
        }
        distinctProjectsByUser.get(userId)!.add(e.project_id)

        totalOpensByUser.set(userId, (totalOpensByUser.get(userId) ?? 0) + 1)

        /* Tunnin tarkkuus riittää: kaappaus näkyy tuhansina, ei kymmeninä. */
        const hourKey = `${userId}|${String(e.created_at).slice(0, 13)}`
        opensPerUserHour.set(hourKey, (opensPerUserHour.get(hourKey) ?? 0) + 1)
      }

      if (e.event_type === "source_link_click") {
        sourceClicksByUser.set(userId, (sourceClicksByUser.get(userId) ?? 0) + 1)
      }
    }

    const peakOpensByUser = new Map<string, number>()
    for (const [key, count] of opensPerUserHour) {
      const userId = key.split("|")[0]
      if (count > (peakOpensByUser.get(userId) ?? 0)) {
        peakOpensByUser.set(userId, count)
      }
    }

    const anomalyUserIds = Array.from(
      new Set([
        ...distinctProjectsByUser.keys(),
        ...sourceClicksByUser.keys(),
      ])
    )

    const usageAnomalies = anomalyUserIds
      .map((userId) => ({
        userId,
        email: userEmail.get(userId) ?? userId,
        distinctProjects: distinctProjectsByUser.get(userId)?.size ?? 0,
        totalOpens: totalOpensByUser.get(userId) ?? 0,
        peakOpensPerHour: peakOpensByUser.get(userId) ?? 0,
        sourceLinkClicks: sourceClicksByUser.get(userId) ?? 0,
      }))
      .sort((a, b) => b.distinctProjects - a.distinctProjects)
      .slice(0, 15)

    const distinctSizes = Array.from(distinctProjectsByUser.values())
      .map((set) => set.size)
      .sort((a, b) => a - b)

    const usageBaseline = {
      usersWithOpens: distinctSizes.length,
      medianDistinctProjects: distinctSizes.length
        ? distinctSizes[Math.floor(distinctSizes.length / 2)]
        : 0,
      maxDistinctProjects: distinctSizes.length
        ? distinctSizes[distinctSizes.length - 1]
        : 0,
    }

    /*
     * LÄHDELINKIN KÄYTTÖ (kohta 4).
     *
     * Linkki lisättiin koska sitä pidettiin asiakkaalle arvokkaana, mutta
     * oletusta ei ole koskaan mitattu. `clickRate` vastaa siihen suoraan:
     * kuinka moni avattu hanke johtaa alkuperäisen ilmoituksen avaamiseen.
     */
    const sourceLinkClicks = Array.from(sourceClicksByUser.values()).reduce(
      (a, b) => a + b,
      0
    )

    const totalOpens = Array.from(totalOpensByUser.values()).reduce((a, b) => a + b, 0)

    const sourceLinkUsage = {
      clicks: sourceLinkClicks,
      clickers: sourceClicksByUser.size,
      projectOpens: totalOpens,
      clickRate: totalOpens > 0 ? Math.round((sourceLinkClicks / totalOpens) * 1000) / 10 : 0,
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

    // Hanke-palaute (peukku ylös/alas)
    const feedback = feedbackRes.data ?? []

    let totalUp = 0
    let totalDown = 0
    const downvotesByProject = new Map<string, number>()
    const downvotesByRegion = new Map<string, number>()
    const downvotesBySizeClass = new Map<string, number>()
    const downvotesBySource = new Map<string, number>()

    for (const row of feedback) {
      if (row.rating === "up") totalUp += 1

      if (row.rating === "down") {
        totalDown += 1
        downvotesByProject.set(row.project_id, (downvotesByProject.get(row.project_id) ?? 0) + 1)
        if (row.region) downvotesByRegion.set(row.region, (downvotesByRegion.get(row.region) ?? 0) + 1)
        if (row.size_class) downvotesBySizeClass.set(row.size_class, (downvotesBySizeClass.get(row.size_class) ?? 0) + 1)
        if (row.source_name) downvotesBySource.set(row.source_name, (downvotesBySource.get(row.source_name) ?? 0) + 1)
      }
    }

    const recentReasons = feedback
      .filter((row) => row.reason_category || row.reason_text)
      .slice(0, 20)
      .map((row) => ({
        projectId: row.project_id,
        rating: row.rating,
        reasonCategory: row.reason_category,
        reasonText: row.reason_text,
        createdAt: row.created_at,
      }))

    // Poimitaan hankkeiden nimet niille joita tarvitaan (avatut + suosikit + hylätyt)
    const neededProjectIds = Array.from(
      new Set([
        ...Array.from(projectOpenCounts.keys()),
        ...Array.from(favoriteCounts.keys()),
        ...Array.from(downvotesByProject.keys()),
        ...recentReasons.map((r) => r.projectId),
      ])
    )

    let projectNames = new Map<string, string>()
    if (neededProjectIds.length > 0) {
      /*
       * .in() ON PILKOTTAVA. Tunnisteet menevat URL-kyselyjonoon, ja
       * liian pitka lista kaatuu - mitattu 5.9.2026: 764 tunnistetta
       * yhdella kyselylla palautti "Bad Request", ja Next.js naytti sen
       * sivulla muodossa "TypeError: fetch failed". Sivu oli siis rikki
       * ilman etta mikaan kertoi syyta.
       *
       * Raja kasvaa aineiston mukana: tama toimi niin kauan kuin
       * avattuja hankkeita oli vahan. Sadan palat kestavat myos
       * kasvun.
       */
      const PALA = 90
      const projectRows: any[] = []
      for (let i = 0; i < neededProjectIds.length; i += PALA) {
        const { data, error: projectError } = await supabaseAdmin
          .from("projects")
          .select("id, name")
          .in("id", neededProjectIds.slice(i, i + PALA))

        if (projectError) throw projectError
        projectRows.push(...(data ?? []))
      }

      projectNames = new Map((projectRows ?? []).map((p) => [p.id, p.name]))
    }

    const totalDeviceEvents = Array.from(deviceCounts.values()).reduce((a, b) => a + b, 0)
    const devicePercentages = Array.from(deviceCounts.entries()).map(([device, count]) => ({
      device,
      count,
      percentage: totalDeviceEvents > 0 ? Math.round((count / totalDeviceEvents) * 1000) / 10 : 0,
    }))

    for (const [userId, ajat] of kirjautumisajat) {
      let laskuri = 0
      let edellinen: number | null = null
      for (const hetki of [...ajat].sort((a, b) => a - b)) {
        if (edellinen === null || hetki - edellinen > ISTUNTO_TAUKO_MIN * 60_000) {
          laskuri++
        }
        edellinen = hetki
      }
      loginCounts.set(userId, laskuri)
    }

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
      mostLoggedInUsers: mapUsers(topN(loginCounts, 5), "loginCount"),
      mostTimeSpentUsers: mapUsers(topN(userTimeSpent, 5), "seconds"),
      mostViewedPages: topN(pageTimeSpent, 5).map(([path, seconds]) => ({ path, seconds })),
      searchWatchUsers: mapUsers(
        topN(savedSearchCounts, 5),
        "watchCount"
      ),
      mostOpenedProjects: mapProjects(topN(projectOpenCounts, 5), "openCount"),
      mostFavoritedProjects: mapProjects(topN(favoriteCounts, 5), "favoriteCount"),
      teamUsers: teamUserIds.map((userId) => ({
        userId,
        email: userEmail.get(userId) ?? userId,
      })),
      devicePercentages,
      totalUsers: users.length,
      totalEvents: events.length,

      /* Erottelu näkyviin: muuten luvut näyttäisivät vain pienentyneen. */
      adminEventsExcluded,
      unattributedEvents,
      unattributedEventsAllTime,
      usageAnomalies,
      usageBaseline,
      sourceLinkUsage,

      feedbackTotals: { up: totalUp, down: totalDown },
      mostDownvotedProjects: mapProjects(topN(downvotesByProject, 5), "downvoteCount"),
      downvotesByRegion: topN(downvotesByRegion, 5).map(([region, count]) => ({ region, count })),
      downvotesBySizeClass: topN(downvotesBySizeClass, 5).map(([sizeClass, count]) => ({ sizeClass, count })),
      downvotesBySource: topN(downvotesBySource, 5).map(([source, count]) => ({ source, count })),
      recentFeedbackReasons: recentReasons.map((r) => ({
        ...r,
        projectName: projectNames.get(r.projectId) ?? "(poistettu hanke)",
      })),
    })
  } catch (err: any) {
    console.error("ANALYTICS ROUTE ERROR:", err)
    return NextResponse.json({ error: err?.message ?? "unknown error" }, { status: 500 })
  }
}
