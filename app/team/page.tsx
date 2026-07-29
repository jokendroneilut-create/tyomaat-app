'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import ConfirmModal from '../components/ConfirmModal'

type DistributionFilters = {
  phases?: string[]
  keyword?: string
}

type Team = {
  id: string
  name: string
  area: string
  areas: string[] | null
  leader_id: string
  distribution_filters: DistributionFilters | null
}

type TeamMember = {
  user_id: string
  role: 'leader' | 'member'
}

type Assignment = {
  project_id: string
  owner_id: string | null
}

type Profile = {
  id: string
  email: string
  full_name: string | null
}

type FilterMode = 'unassigned' | 'assigned' | 'mine' | 'all'

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/*
 * Muotoile näyttönimi sähköpostin etuliitteestä kun oikeaa nimeä ei ole:
 * "johannes.sippola@..." -> "Johannes Sippola". Sama muotoilu kuin
 * profiles-autoluonti-triggerissä, jotta nimet ovat yhtenäisiä.
 */
function formatNameFromEmail(email: string | null | undefined): string {
  const prefix = (email ?? "").split("@")[0]
  if (!prefix) return email ?? ""
  return prefix
    .replace(/[._]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((word) =>
      word
        .split("-")
        .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
        .join("-")
    )
    .join(" ")
}

const FINNISH_REGIONS = [
  'Uusimaa',
  'Varsinais-Suomi',
  'Satakunta',
  'Kanta-Häme',
  'Pirkanmaa',
  'Päijät-Häme',
  'Kymenlaakso',
  'Etelä-Karjala',
  'Etelä-Savo',
  'Pohjois-Savo',
  'Pohjois-Karjala',
  'Keski-Suomi',
  'Etelä-Pohjanmaa',
  'Pohjanmaa',
  'Keski-Pohjanmaa',
  'Pohjois-Pohjanmaa',
  'Kainuu',
  'Lappi',
  'Ahvenanmaa',
]

export default function TeamPage() {
  const [team, setTeam] = useState<Team | null>(null)
  const [selectedAreas, setSelectedAreas] = useState<string[]>([])
  const [useWholeFinland, setUseWholeFinland] = useState(false)

  const [members, setMembers] = useState<TeamMember[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [user, setUser] = useState<any>(null)

  const [filterMode, setFilterMode] = useState<FilterMode>('unassigned')
  const [ownerFilter, setOwnerFilter] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [visibleCount, setVisibleCount] = useState(50)
  const [takeCount, setTakeCount] = useState(10)
  const [autoAssignCount, setAutoAssignCount] = useState(30)

  const [loading, setLoading] = useState(true)
  const [debug, setDebug] = useState<string>('')

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null)
  const [confirmMessage, setConfirmMessage] = useState('')

  const [showTeamSettings, setShowTeamSettings] = useState(false)

  // Osa 2: esihenkilön määrittelemät jakosuodattimet (teams.distribution_filters).
  // Rajaavat vain jaettavaa poolia ("Ei omistajaa" + "Jaa tiimille" / "Ota itselle").
  // Jo jaetut hankkeet pysyvät koskemattomina.
  const [distPhases, setDistPhases] = useState<string[]>([])
  const [distKeyword, setDistKeyword] = useState('')
  const [savingDistFilters, setSavingDistFilters] = useState(false)
  const [distFiltersMsg, setDistFiltersMsg] = useState<string | null>(null)

  const [newTeamName, setNewTeamName] = useState('')
  const [newTeamAreas, setNewTeamAreas] = useState<string[]>([])
  const [newTeamWholeFinland, setNewTeamWholeFinland] = useState(true)
  const [creatingTeam, setCreatingTeam] = useState(false)
  const [createTeamError, setCreateTeamError] = useState<string | null>(null)

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviting, setInviting] = useState(false)

  const getProfileName = (userId: string | null) => {
    if (!userId) return 'Ei omistajaa'
    const profile = profiles.find((p) => p.id === userId)
    return profile?.full_name || profile?.email || userId
  }

  const getOwner = (projectId: string) => {
    const a = assignments.find((a) => a.project_id === projectId)
    return a?.owner_id || null
  }

  const projectsWithOwners = useMemo(() => {
    return projects.map((project) => ({
      ...project,
      owner_id: getOwner(project.id),
    }))
  }, [projects, assignments])

  // Osa 2: onko esihenkilön jakosuodatin aktiivinen?
  const hasDistFilter = distPhases.length > 0 || distKeyword.trim().length > 0

  /*
   * Kuuluuko hanke jaettavaan joukkoon esihenkilön suodattimen mukaan.
   * Käytetään VAIN vapaan poolin ("Ei omistajaa") näyttöön ja jakoon
   * ("Jaa tiimille" / "Ota itselle"). Ei koske jo vastuutettuja hankkeita.
   */
  const matchesDistribution = (p: any): boolean => {
    if (distPhases.length > 0 && !distPhases.includes(p.phase)) return false
    const kw = distKeyword.trim().toLowerCase()
    if (kw) {
      const hay = [
        p.name,
        p.title,
        p.city,
        p.region,
        p.metadata?.description,
        p.metadata?.summary,
        p.additional_info,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (!hay.includes(kw)) return false
    }
    return true
  }

  const counts = useMemo(() => {
    const all = projectsWithOwners.length
    // "Ei omistajaa" -laskuri kuvaa jaettavaa poolia -> huomioi jakosuodatin.
    const unassigned = projectsWithOwners.filter(
      (p) => !p.owner_id && matchesDistribution(p)
    ).length
    const assigned = projectsWithOwners.filter((p) => !!p.owner_id).length
    const mine = projectsWithOwners.filter((p) => p.owner_id === user?.id).length

    return { all, unassigned, assigned, mine }
  }, [projectsWithOwners, user, distPhases, distKeyword])

  // Vaiheet jotka oikeasti esiintyvät ladatuissa hankkeissa -> jakosuodattimen
  // valittavat vaiheet (varmistaa että suodatin osuu todelliseen dataan).
  const availablePhases = useMemo(
    () =>
      [...new Set(projects.map((p) => p.phase).filter(Boolean))].sort((a, b) =>
        String(a).localeCompare(String(b), 'fi')
      ),
    [projects]
  )

const distribution = useMemo(() => {
  const map: Record<string, number> = {}

  assignments.forEach((a) => {
    if (!a.owner_id) return
    map[a.owner_id] = (map[a.owner_id] || 0) + 1
  })

  return map
}, [assignments])

  const filteredProjects = useMemo(() => {
    let list = [...projectsWithOwners]

    if (filterMode === 'unassigned')
      list = list.filter((p) => !p.owner_id && matchesDistribution(p))
    if (filterMode === 'assigned') list = list.filter((p) => !!p.owner_id)
    if (filterMode === 'mine') list = list.filter((p) => p.owner_id === user?.id)
if (ownerFilter) {
  list = list.filter((p) => p.owner_id === ownerFilter)
}

    if (search.trim()) {
      const q = search.trim().toLowerCase()

      list = list.filter((p) => {
        const name = String(p.name || p.title || '').toLowerCase()
        const region = String(p.region || '').toLowerCase()
        const city = String(p.city || '').toLowerCase()
        const phase = String(p.phase || '').toLowerCase()
        const status = String(p.status || '').toLowerCase()
        const ownerName = getProfileName(p.owner_id).toLowerCase()

        return (
          name.includes(q) ||
          region.includes(q) ||
          city.includes(q) ||
          phase.includes(q) ||
          status.includes(q) ||
          ownerName.includes(q)
        )
      })
    }

    return list
  }, [
    projectsWithOwners,
    filterMode,
    ownerFilter,
    search,
    user,
    profiles,
    distPhases,
    distKeyword,
  ])

  const visibleProjects = filteredProjects.slice(0, visibleCount)

  useEffect(() => {
    setVisibleCount(50)
  }, [filterMode, search])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          setDebug('No logged in user')
          return
        }

        setUser(user)

        const { data: memberRow } = await supabase
  .from('team_members')
  .select('team_id')
  .eq('user_id', user.id)
  .maybeSingle()

        if (!memberRow) {
          setDebug('No team found')
          return
        }

        const { data: teamData } = await supabase
          .from('teams')
          .select('*')
          .eq('id', memberRow.team_id)
          .single()

        const { data: membersData } = await supabase
          .from('team_members')
          .select('*')
          .eq('team_id', memberRow.team_id)

        const memberIds = (membersData || []).map((m) => m.user_id)

        const { data: profilesData } = await supabase
          .from('profiles')
          .select('*')
          .in('id', memberIds)

        const teamAreas = teamData.areas || []

        /*
         * PostgREST palauttaa oletuksena max 1000 riviä per kysely, joten
         * ilman sivutusta iso alue (esim. koko Suomi) katkesi 1000:een. Haetaan
         * sivutettuna kunnes kaikki on saatu. Perussuodatus kuten kartta/Tänään:
         * valmistuneet ja vanhentuneet eivät ole jaettavaksi relevantteja.
         */
        const PAGE_SIZE = 1000
        const projectsData: any[] = []

        for (let from = 0; ; from += PAGE_SIZE) {
          let projectQuery = supabase
            .from('projects')
            .select('*')
            .neq('phase', 'Valmistunut')
            .neq('status', 'expired')
            .order('created_at', { ascending: false })

          if (teamAreas.length > 0) {
            projectQuery = projectQuery.in('region', teamAreas)
          }

          const { data: pageData, error: pageError } = await projectQuery.range(
            from,
            from + PAGE_SIZE - 1
          )

          if (pageError) break

          projectsData.push(...((pageData as any[]) || []))

          if (!pageData || pageData.length < PAGE_SIZE) break
        }

        /*
         * Vastuutukset sivutettuna: ilman sivutusta PostgREST katkaisee 1000:een,
         * jolloin tiimin kasvaessa yli 1000 vastuutuksen osa jäsenistä menetti
         * omistamiaan hankkeita "Omat"-näkymästä (katkaisujärjestys on lisäksi
         * määrittelemätön, joten juuri jaetut saattoivat pudota pois).
         */
        const assignmentsData: any[] = []
        for (let from = 0; ; from += PAGE_SIZE) {
          const { data: aPage, error: aErr } = await supabase
            .from('project_assignments')
            .select('*')
            .eq('team_id', memberRow.team_id)
            .range(from, from + PAGE_SIZE - 1)

          if (aErr) break

          assignmentsData.push(...((aPage as any[]) || []))

          if (!aPage || aPage.length < PAGE_SIZE) break
        }

        /*
         * Varmista, että kaikki vastuutetut hankkeet latautuvat, vaikka ne eivät
         * kuuluisi jaettavaan pooliin (valmistunut / vanhentunut / eri alue).
         * Muuten "Omat"- ja "Vastuutetut"-näkymistä katoaisi hankkeita heti kun
         * ne valmistuvat tai siirtyvät alueen ulkopuolelle. Jaettava pooli
         * ("Ei omistajaa") pysyy silti perussuodatettuna, koska nämä lisätyt
         * hankkeet ovat aina jonkun omistuksessa.
         */
        const loadedIds = new Set(projectsData.map((p) => p.id))
        const missingAssignedIds = [
          ...new Set(
            assignmentsData
              .map((a) => a.project_id)
              .filter((id) => id && !loadedIds.has(id))
          ),
        ]
        for (let i = 0; i < missingAssignedIds.length; i += 100) {
          const chunk = missingAssignedIds.slice(i, i + 100)
          const { data: extra } = await supabase
            .from('projects')
            .select('*')
            .in('id', chunk)
          if (extra) projectsData.push(...(extra as any[]))
        }

        setTeam(teamData)

        // Osa 2: lataa esihenkilön jakosuodattimet (rajaa vain jaettavaa poolia).
        const df = ((teamData as any).distribution_filters || {}) as DistributionFilters
        setDistPhases(Array.isArray(df.phases) ? df.phases : [])
        setDistKeyword(typeof df.keyword === 'string' ? df.keyword : '')

        const areas = teamData.areas || []

if (areas.length === 0) {
  setUseWholeFinland(true)
  setSelectedAreas([])
} else {
  setUseWholeFinland(false)
  setSelectedAreas(areas)
}
        setMembers(membersData || [])
        setProfiles(profilesData || [])
        setProjects(projectsData || [])
        setAssignments(assignmentsData || [])
        setDebug(`Kirjautunut: ${user.email}`)
      } catch {
        setDebug('Error loading data')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

/*
 * Hae kaikki tiimin vastuutukset sivutettuna. Jaon jälkeisissä päivityksissä
 * ilman sivutusta PostgREST katkaisi 1000:een, jolloin osa vastuutuksista
 * katosi näkymästä heti jaon jälkeen.
 */
const refreshAssignments = async (teamId: string) => {
  const PAGE = 1000
  const out: any[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('project_assignments')
      .select('*')
      .eq('team_id', teamId)
      .range(from, from + PAGE - 1)
    if (error) return { data: null as any, error }
    out.push(...((data as any[]) || []))
    if (!data || data.length < PAGE) break
  }
  return { data: out, error: null as any }
}

const handleAutoAssignToTeam = async () => {
  if (!team || !user?.id) {
    setDebug('Tiimiä tai käyttäjää ei löytynyt.')
    return
  }

  const assignableMembers = members.filter((m) => m.role === 'member')

  if (assignableMembers.length === 0) {
    setDebug('Tiimissä ei ole jäseniä, joille hankkeita voidaan jakaa.')
    return
  }

  const unassignedProjects = projectsWithOwners
    .filter((p) => !p.owner_id && matchesDistribution(p))
    .slice(0, autoAssignCount)

  if (unassignedProjects.length === 0) {
    setDebug('Ei jaettavia hankkeita.')
    return
  }

  const rows = unassignedProjects.map((p, index) => {
    const owner = assignableMembers[index % assignableMembers.length]

    return {
      team_id: team.id,
      project_id: p.id,
      owner_id: owner.user_id,
      assigned_by: user.id,
    }
  })

  const { error } = await supabase
    .from('project_assignments')
    .upsert(rows, { onConflict: 'team_id,project_id' })

  if (error) {
    setDebug(`Automaattinen jako epäonnistui: ${error.message}`)
    return
  }

  const { data, error: refreshError } = await refreshAssignments(team.id)

  if (refreshError) {
    setDebug(`Päivitys epäonnistui: ${refreshError.message}`)
    return
  }

  setAssignments(data || [])
  setFilterMode('assigned')
  setDebug(`Jaettu ${unassignedProjects.length} hanketta tiimin jäsenille.`)
}

const handleTakeNextTen = async () => {
  if (!team || !user?.id) {
    setDebug('Tiimiä tai käyttäjää ei löytynyt.')
    return
  }

  const unassignedProjects = projectsWithOwners
    .filter((p) => !p.owner_id && matchesDistribution(p))
    .slice(0, takeCount)

  if (unassignedProjects.length === 0) {
    setDebug('Ei jaettavia hankkeita.')
    return
  }

  const rows = unassignedProjects.map((p) => ({
    team_id: team.id,
    project_id: p.id,
    owner_id: user.id,
    assigned_by: user.id,
  }))

  const { error } = await supabase
    .from('project_assignments')
    .upsert(rows, { onConflict: 'team_id,project_id' })

  if (error) {
    setDebug(`Ota itselle epäonnistui: ${error.message}`)
    return
  }

  const { data, error: refreshError } = await refreshAssignments(team.id)

  if (refreshError) {
    setDebug(`Päivitys epäonnistui: ${refreshError.message}`)
    return
  }

  setAssignments(data || [])
  setFilterMode('mine')
  setDebug(`Otettu itselle ${unassignedProjects.length} hanketta.`)
}

  const handleAssign = async (projectId: string, ownerId: string | null) => {
  if (!team) {
    setDebug('Tiimiä ei löytynyt.')
    return
  }

  const existing = assignments.find((a) => a.project_id === projectId)

  if (existing) {
    const { error } = await supabase
      .from('project_assignments')
      .update({ owner_id: ownerId })
      .eq('project_id', projectId)
      .eq('team_id', team.id)

    if (error) {
      setDebug(`Omistajan vaihto epäonnistui: ${error.message}`)
      return
    }
  } else {
    const { error } = await supabase.from('project_assignments').insert({
      team_id: team.id,
      project_id: projectId,
      owner_id: ownerId,
      assigned_by: user?.id || null,
    })

    if (error) {
      setDebug(`Omistajan lisäys epäonnistui: ${error.message}`)
      return
    }
  }

  const { data, error: refreshError } = await refreshAssignments(team.id)

  if (refreshError) {
    setDebug(`Päivitys epäonnistui: ${refreshError.message}`)
    return
  }

  setAssignments(data || [])
  setDebug('Omistaja päivitetty.')
}

const handleSaveTeamAreas = async () => {
  if (!team) return

  const areasToSave = useWholeFinland ? [] : selectedAreas

  if (!useWholeFinland && areasToSave.length === 0) {
    setDebug('Valitse vähintään yksi maakunta tai Koko Suomi.')
    return
  }

  const { error } = await supabase
    .from('teams')
    .update({
      areas: areasToSave,
      area: useWholeFinland ? 'finland' : selectedAreas[0].toLowerCase(),
    })
    .eq('id', team.id)

  if (error) {
    setDebug(`Alueiden tallennus epäonnistui: ${error.message}`)
    return
  }

  setTeam({
    ...team,
    areas: areasToSave,
    area: useWholeFinland ? 'finland' : selectedAreas[0].toLowerCase(),
  })

  setDebug('Tiimin alueet tallennettu.')
  window.location.reload()
}

/*
 * Osa 2: tallenna esihenkilön jakosuodattimet. Rajaa vain jaettavaa poolia
 * ("Ei omistajaa" + "Jaa tiimille" / "Ota itselle"); jo vastuutetut hankkeet
 * pysyvät koskemattomina.
 */
const handleSaveDistributionFilters = async () => {
  if (!team) return

  setSavingDistFilters(true)
  setDistFiltersMsg(null)

  const filters: DistributionFilters = {
    phases: distPhases,
    keyword: distKeyword.trim(),
  }

  const { error } = await supabase
    .from('teams')
    .update({ distribution_filters: filters })
    .eq('id', team.id)

  setSavingDistFilters(false)

  if (error) {
    setDistFiltersMsg(`Suodattimien tallennus epäonnistui: ${error.message}`)
    return
  }

  setTeam({ ...team, distribution_filters: filters })
  setDistFiltersMsg('Jakosuodattimet tallennettu.')
}

const handleRemoveMember = async (userId: string) => {
  if (!team) return

  const teamId = team.id
  const memberName = getProfileName(userId)

  setConfirmMessage(`Poistetaanko ${memberName} tiimistä?`)

  setConfirmAction(() => async () => {
    const { error: deleteError } = await supabase
      .from('team_members')
      .delete()
      .eq('team_id', teamId)
      .eq('user_id', userId)

    if (deleteError) {
      setInviteError(`Jäsenen poisto epäonnistui: ${deleteError.message}`)
      setConfirmOpen(false)
      return
    }

    setMembers((current) => current.filter((m) => m.user_id !== userId))
    setConfirmOpen(false)
  })

  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('team_id', team.id)
    .eq('user_id', userId)

  if (error) {
    setInviteError(`Jäsenen poisto epäonnistui: ${error.message}`)
    return
  }

  setMembers((current) => current.filter((m) => m.user_id !== userId))
}

const handleInviteMember = async () => {
  if (!team) return

  setInviteError(null)

  const email = inviteEmail.trim().toLowerCase()

  if (!email) {
    setInviteError('Anna sähköpostiosoite.')
    return
  }

  setInviting(true)

  try {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('email', email)
      .maybeSingle()

    if (profileError) {
      setInviteError(`Profiilin haku epäonnistui: ${profileError.message}`)
      return
    }

    if (!profile) {
      setInviteError('Käyttäjää ei löytynyt.')
      return
    }
const { data: existingMembership, error: existingMembershipError } = await supabase
  .from('team_members')
  .select('team_id')
  .eq('user_id', profile.id)
  .maybeSingle()

if (existingMembershipError) {
  setInviteError(`Jäsenyyden tarkistus epäonnistui: ${existingMembershipError.message}`)
  return
}

if (existingMembership && existingMembership.team_id !== team.id) {
  setInviteError('Käyttäjä kuuluu jo toiseen tiimiin.')
  return
}
    const alreadyMember = members.some((m) => m.user_id === profile.id)

if (alreadyMember) {
  setInviteError('Käyttäjä on jo tässä tiimissä.')
  return
}

const { error: memberError } = await supabase.from('team_members').insert({
  team_id: team.id,
  user_id: profile.id,
  role: 'member',
})

if (memberError) {
  if (memberError.message.includes('one_team_per_user')) {
    setInviteError('Käyttäjä kuuluu jo toiseen tiimiin.')
    return
  }

  if (memberError.message.includes('duplicate key')) {
    setInviteError('Käyttäjä on jo tässä tiimissä tai toisessa tiimissä.')
    return
  }

  setInviteError(`Jäsenen lisäys epäonnistui: ${memberError.message}`)
  return
}

    const { data: membersData, error: membersError } = await supabase
      .from('team_members')
      .select('*')
      .eq('team_id', team.id)

    if (membersError) {
      setInviteError(`Jäsenlistan päivitys epäonnistui: ${membersError.message}`)
      return
    }

    const memberIds = (membersData || []).map((m) => m.user_id)

    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .in('id', memberIds)

    if (profilesError) {
      setInviteError(`Profiilien päivitys epäonnistui: ${profilesError.message}`)
      return
    }

    setMembers(membersData || [])
    setProfiles(profilesData || [])
    setInviteEmail('')
  } catch (error) {
    setInviteError(error instanceof Error ? error.message : 'Tuntematon virhe.')
  } finally {
    setInviting(false)
  }
}

const handleCreateTeam = async () => {
  setCreateTeamError(null)

  const name = newTeamName.trim()

  if (!name) {
    setCreateTeamError('Anna tiimille nimi.')
    return
  }

  if (!user?.id) {
    setCreateTeamError('Käyttäjää ei löytynyt. Kirjaudu uudelleen.')
    return
  }

  setCreatingTeam(true)

  await supabase.from('profiles').upsert(
    {
      id: user.id,
      email: user.email,
      full_name: formatNameFromEmail(user.email),
    },
    // Älä ylikirjoita triggerin/olemassa olevaa nimeä pelkällä etuliitteellä.
    { onConflict: 'id', ignoreDuplicates: true }
  )

  const areasToSave = newTeamWholeFinland ? [] : newTeamAreas

if (!newTeamWholeFinland && areasToSave.length === 0) {
  setCreateTeamError('Valitse vähintään yksi maakunta tai Koko Suomi.')
  setCreatingTeam(false)
  return
}

const { data: teamData, error: teamError } = await supabase
  .from('teams')
  .insert({
    name,
    area: newTeamWholeFinland ? 'finland' : areasToSave[0].toLowerCase(),
    areas: areasToSave,
    leader_id: user.id,
  })
    .select('*')
    .single()

  if (teamError || !teamData) {
    setCreateTeamError(teamError?.message || 'Tiimin luonti epäonnistui.')
    setCreatingTeam(false)
    return
  }

  const { error: memberError } = await supabase.from('team_members').insert({
    team_id: teamData.id,
    user_id: user.id,
    role: 'leader',
  })

  if (memberError) {
    setCreateTeamError(memberError.message)
    setCreatingTeam(false)
    return
  }

  window.location.reload()
}

const ownerBadgeStyle = (ownerId: string | null): React.CSSProperties => {
  if (!ownerId) {
    return {
      background: '#fef3c7',
      color: '#92400e',
      border: '1px solid #f59e0b',
    }
  }

  if (ownerId === user?.id) {
    return {
      background: '#dcfce7',
      color: '#166534',
      border: '1px solid #22c55e',
    }
  }

  return {
    background: '#dbeafe',
    color: '#1d4ed8',
    border: '1px solid #60a5fa',
  }
}

  const filterButtonStyle = (mode: FilterMode): React.CSSProperties => ({
    border: filterMode === mode ? '1px solid #111827' : '1px solid #e5e7eb',
    background: filterMode === mode ? '#111827' : '#ffffff',
    color: filterMode === mode ? '#ffffff' : '#111827',
    borderRadius: 999,
    padding: '9px 13px',
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  })

  if (loading) return <div style={{ padding: 20 }}>Ladataan...</div>

  if (!team) {
  return (
    <div style={{ padding: 20, maxWidth: 720, margin: '0 auto' }}>
      <div
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: 16,
          background: '#ffffff',
          padding: 20,
        }}
      >
        <h1 style={{ marginTop: 0 }}>Luo tiimi</h1>

        <p style={{ color: '#6b7280' }}>
          Tällä käyttäjällä ei ole vielä tiimiä. Luo uusi tiimi ja määritä seuranta-alue.
        </p>

        <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
          <div>
            <label style={{ display: 'block', fontWeight: 700, marginBottom: 6 }}>
              Tiimin nimi
            </label>

            <input
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="Esim. Yritys Oy myyntitiimi"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid #e5e7eb',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 700, marginBottom: 6 }}>
              Seuranta-alue
            </label>

            <div style={{ marginBottom: 12 }}>
  <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
    <input
      type="checkbox"
      checked={newTeamWholeFinland}
      onChange={(e) => setNewTeamWholeFinland(e.target.checked)}
    />
    Koko Suomi
  </label>
</div>

<div
  style={{
    display: 'grid',
    gap: 8,
    opacity: newTeamWholeFinland ? 0.45 : 1,
  }}
>
  {FINNISH_REGIONS.map((region) => (
    <label
      key={region}
      style={{ display: 'flex', gap: 8, alignItems: 'center' }}
    >
      <input
        type="checkbox"
        disabled={newTeamWholeFinland}
        checked={newTeamAreas.includes(region)}
        onChange={(e) => {
          if (e.target.checked) {
            setNewTeamAreas((current) => [...current, region])
          } else {
            setNewTeamAreas((current) =>
              current.filter((r) => r !== region)
            )
          }
        }}
      />
      {region}
    </label>
  ))}
</div>
          </div>

          {createTeamError && (
            <div style={{ color: '#b91c1c', fontSize: 14 }}>
              {createTeamError}
            </div>
          )}

          <button
            onClick={handleCreateTeam}
            disabled={creatingTeam}
            style={{
              marginTop: 6,
              padding: '11px 14px',
              borderRadius: 12,
              border: '1px solid #111827',
              background: '#111827',
              color: '#ffffff',
              fontWeight: 800,
              cursor: creatingTeam ? 'not-allowed' : 'pointer',
            }}
          >
            {creatingTeam ? 'Luodaan tiimiä...' : 'Luo tiimi'}
          </button>
        </div>
      </div>
    </div>
  )
}

  const isLeader = user?.id === team.leader_id

  return (
    <div style={{ padding: 20, maxWidth: 1100, margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          marginBottom: 18,
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>{team.name}</h1>
          <p style={{ marginTop: 6, color: '#6b7280' }}>
            Seuranta-alue: <strong>{team.area}</strong>
          </p>
        </div>

        <div
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            padding: '10px 12px',
            background: '#ffffff',
            fontSize: 14,
          }}
        >
          <strong>{isLeader ? 'Esihenkilö' : 'Tiimin jäsen'}</strong>
          <div style={{ color: '#6b7280', marginTop: 4 }}>{debug}</div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 12,
          marginBottom: 18,
        }}
      >
        <SummaryCard label="Kaikki hankkeet" value={counts.all} />
        <SummaryCard label="Ei omistajaa" value={counts.unassigned} />
        <SummaryCard label="On omistaja" value={counts.assigned} />
        <SummaryCard label="Oma omistus" value={counts.mine} />
      </div>

      <div
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: 14,
          background: '#ffffff',
          padding: 16,
          marginBottom: 18,
        }}
      >

{isLeader && (
  <div style={{ marginBottom: 12 }}>
    <button
      onClick={() => setShowTeamSettings((v) => !v)}
      style={{
        border: '1px solid #e5e7eb',
        background: '#ffffff',
        borderRadius: 12,
        padding: '8px 12px',
        fontWeight: 700,
        cursor: 'pointer',
      }}
    >
      {showTeamSettings ? 'Sulje asetukset' : 'Tiimin asetukset'}
    </button>
  </div>
)}

{isLeader && showTeamSettings && (
  <div
    style={{
      border: '1px solid #e5e7eb',
      borderRadius: 14,
      background: '#f9fafb',
      padding: 14,
      marginBottom: 16,
    }}
  >
    <h3 style={{ marginTop: 0 }}>Tiimin asetukset</h3>

    <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
      <input
        type="checkbox"
        checked={useWholeFinland}
        onChange={(e) => setUseWholeFinland(e.target.checked)}
      />
      Koko Suomi
    </label>

    {!useWholeFinland && (
      <div style={{ display: 'grid', gap: 8 }}>
        {FINNISH_REGIONS.map((region) => (
          <label key={region} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={selectedAreas.includes(region)}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedAreas((current) => [...current, region])
                } else {
                  setSelectedAreas((current) => current.filter((r) => r !== region))
                }
              }}
            />
            {region}
          </label>
        ))}
      </div>
    )}
    <button
  onClick={handleSaveTeamAreas}
  style={{
    marginTop: 14,
    border: '1px solid #111827',
    background: '#111827',
    color: '#ffffff',
    borderRadius: 12,
    padding: '10px 14px',
    fontWeight: 800,
    cursor: 'pointer',
  }}
>
  Tallenna alueet
</button>

    <div
      style={{
        marginTop: 18,
        paddingTop: 16,
        borderTop: '1px solid #e5e7eb',
      }}
    >
      <h3 style={{ margin: '0 0 4px' }}>Jaettavan joukon rajaus</h3>
      <p style={{ margin: '0 0 12px', color: '#6b7280', fontSize: 13 }}>
        Rajaa mitä hankkeita jaetaan tiimille. Vaikuttaa vain vapaaseen
        pooliin ("Ei omistajaa") ja jakonappeihin — jo vastuutetut hankkeet
        pysyvät koskemattomina.
      </p>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
          Vaiheet (tyhjä = kaikki)
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {availablePhases.map((phase) => {
            const checked = distPhases.includes(phase)
            return (
              <label
                key={phase}
                style={{
                  display: 'flex',
                  gap: 6,
                  alignItems: 'center',
                  border: '1px solid #e5e7eb',
                  borderRadius: 999,
                  padding: '4px 10px',
                  background: checked ? '#eef2ff' : '#ffffff',
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setDistPhases((cur) => [...cur, phase])
                    } else {
                      setDistPhases((cur) => cur.filter((p) => p !== phase))
                    }
                  }}
                />
                {phase}
              </label>
            )
          })}
          {availablePhases.length === 0 && (
            <span style={{ color: '#9ca3af', fontSize: 13 }}>
              Ei ladattuja hankkeita.
            </span>
          )}
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
          Avainsana (nimessä tai kuvauksessa)
        </div>
        <input
          value={distKeyword}
          onChange={(e) => setDistKeyword(e.target.value)}
          placeholder="esim. koulu, sähkö, saneeraus..."
          style={{
            width: '100%',
            maxWidth: 420,
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid #e5e7eb',
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={handleSaveDistributionFilters}
          disabled={savingDistFilters}
          style={{
            border: '1px solid #111827',
            background: '#111827',
            color: '#ffffff',
            borderRadius: 12,
            padding: '10px 14px',
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          {savingDistFilters ? 'Tallennetaan...' : 'Tallenna jakosuodattimet'}
        </button>

        {hasDistFilter && (
          <button
            onClick={() => {
              setDistPhases([])
              setDistKeyword('')
            }}
            style={{
              border: '1px solid #e5e7eb',
              background: '#ffffff',
              color: '#374151',
              borderRadius: 12,
              padding: '10px 14px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Tyhjennä
          </button>
        )}

        {distFiltersMsg && (
          <span style={{ color: '#6b7280', fontSize: 13 }}>{distFiltersMsg}</span>
        )}
      </div>
    </div>
  </div>
)}

        <h2 style={{ marginTop: 0 }}>Tiimin jäsenet</h2>
        {isLeader && (
  <div
    style={{
      marginBottom: 16,
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap',
    }}
  >
    <input
      value={inviteEmail}
      onChange={(e) => setInviteEmail(e.target.value)}
      placeholder="Lisää jäsen sähköpostilla..."
      style={{
        flex: 1,
        minWidth: 220,
        padding: '10px 12px',
        borderRadius: 10,
        border: '1px solid #e5e7eb',
      }}
    />

    <button
  onClick={handleInviteMember}
  disabled={inviting}
      style={{
        padding: '10px 14px',
        borderRadius: 10,
        border: '1px solid #111827',
        background: '#111827',
        color: '#fff',
        fontWeight: 700,
        cursor: 'pointer',
      }}
    >
      {inviting ? 'Lisätään...' : 'Lisää jäsen'}
    </button>
  </div>
)}

{inviteError && (
  <div style={{ color: '#b91c1c', marginBottom: 10 }}>
    {inviteError}
  </div>
)}
{isLeader && (
  <div
    style={{
      border: '1px solid #e5e7eb',
      borderRadius: 14,
      background: '#ffffff',
      padding: 16,
      marginBottom: 18,
    }}
  >
    <h2 style={{ marginTop: 0 }}>Hankkeiden jakauma</h2>

    <div style={{ display: 'grid', gap: 10 }}>
      {members.map((m) => {
        const count = distribution[m.user_id] || 0
        const percent = counts.assigned > 0 ? Math.round((count / counts.assigned) * 100) : 0
        const active = ownerFilter === m.user_id

        return (
          <div
            key={m.user_id}
            role="button"
            title={`Näytä vain ${getProfileName(m.user_id)} -omistamat hankkeet`}
            onClick={() => {
              // Suodata hankelista tähän jäseneen; 'all' jotta suodatin
              // ei tyhjene "ei omistajaa" -välilehden takia.
              setOwnerFilter(active ? null : m.user_id)
              setFilterMode('all')
            }}
            style={{
              cursor: 'pointer',
              borderRadius: 10,
              padding: 8,
              border: active ? '1px solid #111827' : '1px solid transparent',
              background: active ? '#f3f4f6' : 'transparent',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <strong>
                {getProfileName(m.user_id)}
                {active ? ' • suodatettu' : ''}
              </strong>
              <span>
                {count} kpl • {percent} %
              </span>
            </div>

            <div
              style={{
                height: 8,
                background: '#f3f4f6',
                borderRadius: 999,
                overflow: 'hidden',
                marginTop: 6,
              }}
            >
              <div
                style={{
                  width: `${percent}%`,
                  height: '100%',
                  background: '#111827',
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  </div>
)}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {members.map((m) => (
            <div
              key={m.user_id}
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 999,
                padding: '8px 12px',
                background: '#f9fafb',
                fontSize: 14,
              }}
            >
              <strong>{getProfileName(m.user_id)}</strong>{' '}
              <span style={{ color: '#6b7280' }}>
                {m.role === 'leader' ? 'esihenkilö' : 'jäsen'}
              </span>
              {isLeader && m.user_id !== user?.id && (
  <button
    onClick={() => handleRemoveMember(m.user_id)}
    style={{
      marginLeft: 8,
      border: 'none',
      background: 'transparent',
      color: '#b91c1c',
      fontWeight: 700,
      cursor: 'pointer',
    }}
  >
    Poista
  </button>
)}
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: 14,
          background: '#ffffff',
          padding: 16,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
            alignItems: 'center',
            marginBottom: 14,
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>Hankkeet</h2>
            <p style={{ margin: '6px 0 0', color: '#6b7280' }}>
              Näytetään {visibleProjects.length} / {filteredProjects.length} hanketta
            </p>
          </div>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Hae hanketta, kaupunkia, aluetta tai omistajaa..."
            style={{
              width: '100%',
              maxWidth: 420,
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid #e5e7eb',
            }}
          />
        </div>

{isLeader && hasDistFilter && (
  <div
    style={{
      marginBottom: 12,
      padding: '8px 12px',
      borderRadius: 10,
      background: '#eef2ff',
      color: '#3730a3',
      fontSize: 13,
    }}
  >
    Jaettavaa joukkoa on rajattu
    {distPhases.length > 0 && <> · vaiheet: {distPhases.join(', ')}</>}
    {distKeyword.trim() && <> · avainsana: "{distKeyword.trim()}"</>}
    {' '}({counts.unassigned} jaettavaa)
  </div>
)}

{isLeader && counts.unassigned > 0 && (
  <div style={{ marginBottom: 14, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
    <select
      value={autoAssignCount}
      onChange={(e) => setAutoAssignCount(Number(e.target.value))}
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 10,
        padding: '8px 10px',
      }}
    >
      <option value={30}>30</option>
      <option value={60}>60</option>
      <option value={120}>120</option>
    </select>

    <button
  onClick={handleAutoAssignToTeam}
  style={{
    border: '1px solid #111827',
    background: '#111827',
    color: '#ffffff',
    borderRadius: 12,
    padding: '10px 14px',
    fontWeight: 800,
    cursor: 'pointer',
  }}
>
  Jaa tiimille
</button>

<span
  title="Jakaa valitun määrän omistamattomia hankkeita tasaisesti tiimin jäsenille. Esihenkilö ei saa hankkeita automaattijaossa, vaan jako tehdään jäsenille vuorotellen."
  style={{
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 22,
    height: 22,
    borderRadius: '50%',
    background: '#e5e7eb',
    color: '#374151',
    fontSize: 13,
    fontWeight: 900,
    cursor: 'help',
  }}
>
  i
</span>
  </div>
  
)}

{ownerFilter && (
  <div style={{ marginBottom: 12 }}>
    <button
      onClick={() => setOwnerFilter(null)}
      style={{
        border: '1px solid #e5e7eb',
        background: '#ffffff',
        borderRadius: 999,
        padding: '8px 12px',
        fontWeight: 700,
        cursor: 'pointer',
      }}
    >
      Poista omistajasuodatus
    </button>
  </div>
)}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          <button onClick={() => setFilterMode('unassigned')} style={filterButtonStyle('unassigned')}>
            Ei omistajaa ({counts.unassigned})
          </button>

          <button onClick={() => setFilterMode('assigned')} style={filterButtonStyle('assigned')}>
            On omistaja ({counts.assigned})
          </button>

          <button onClick={() => setFilterMode('mine')} style={filterButtonStyle('mine')}>
            Oma omistus ({counts.mine})
          </button>

          <button onClick={() => setFilterMode('all')} style={filterButtonStyle('all')}>
            Kaikki ({counts.all})
          </button>
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          {visibleProjects.map((p) => (
            <div
              key={p.id}
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 12,
                padding: 12,
                background: p.owner_id ? '#ffffff' : '#fffbeb',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.5fr 1fr 1fr',
                  gap: 12,
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: 800 }}>{p.name || p.title || p.id}</div>
                  <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
                    {p.city || '-'} • {p.region || '-'} • {p.phase || p.status || '-'}
                  </div>
                </div>

                <div style={{ fontSize: 14 }}>
                  <span style={{ color: '#6b7280' }}>Omistaja</span>
                  <button
  onClick={() => setOwnerFilter(p.owner_id || null)}
  style={{
    display: 'inline-block',
    marginTop: 4,
    padding: '4px 9px',
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
    border: 'none',
    ...ownerBadgeStyle(p.owner_id),
  }}
>
  {p.owner_id === user?.id ? 'Sinä' : getProfileName(p.owner_id)}
</button>
                </div>

                <div>
                  {isLeader ? (
                    <select
                      value={p.owner_id || ''}
                      onChange={(e) => handleAssign(p.id, e.target.value || null)}
                      style={{
                        width: '100%',
                        padding: '9px 10px',
                        borderRadius: 10,
                        border: '1px solid #e5e7eb',
                        background: '#ffffff',
                      }}
                    >
                      <option value="">Ei omistajaa</option>

                      {members.map((m) => (
                        <option key={m.user_id} value={m.user_id}>
                          {getProfileName(m.user_id)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span style={{ color: '#6b7280', fontSize: 14 }}>
                      Vain esihenkilö voi vaihtaa omistajaa
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {visibleCount < filteredProjects.length && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
            <button
              onClick={() => setVisibleCount((current) => current + 50)}
              style={{
                border: '1px solid #e5e7eb',
                background: '#ffffff',
                borderRadius: 12,
                padding: '10px 14px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Näytä lisää
            </button>
          </div>
          )}
      </div>

      <ConfirmModal
        open={confirmOpen}
        title="Vahvista toiminto"
        message={confirmMessage}
        confirmText="Poista"
        cancelText="Peruuta"
        danger
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          if (confirmAction) confirmAction()
        }}
      />
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 14,
        background: '#ffffff',
        padding: 16,
      }}
    >
      
      <div style={{ color: '#6b7280', fontSize: 13 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, marginTop: 4 }}>{value}</div>
    </div>
  )
}