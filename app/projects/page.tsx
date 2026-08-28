'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import { supabase } from '@/lib/supabaseClient'
import MapClient from './MapClient'
import type { MapBounds } from './Map'
import PhaseTimeline from './PhaseTimeline'
import { CANONICAL_PHASES, displayPhaseLabel, normalizeLegacyPhase } from '@/lib/projects/phases'
import { expandSearchTerm } from '@/lib/projects/searchSynonyms'
import {
  collectProjectCompanies,
  mergeCompanyNames,
} from '@/lib/projects/projectCompanies'
import { trackEvent } from '@/lib/analytics/trackEvent'
import FeedbackButton from '../components/FeedbackButton'

/*
 * Vaihesuodattimen vaihtoehdot. VALMISTUNEET JATETAAN POIS, koska ne on
 * jo suodatettu pois itse aineistosta (ks. activeProjectsData alla).
 * Valittavissa oleva vaihtoehto joka palauttaa aina nolla tulosta ei
 * kerro kayttajalle "naita ei nayteta" vaan "naita ei ole".
 */
const PHASE_OPTIONS = CANONICAL_PHASES.filter((p) => p.key !== 'completed').map((p) => p.label)

type Project = {
  id: string
  name: string
  city: string
  region: string | null
  phase: string
  status?: string | null
  location: string | null
  developer: string | null
  builder: string | null
  /*
   * Haetaan listaan omana JSON-polkuna eikä koko metadatana: metadata oli
   * 58 % karttasivun siirretystä datasta ja pudotettiin siksi pois. Yritykset
   * ovat kuitenkin se tieto jonka takia "Sopimus myönnetty" -suodatinta
   * käytetään, joten ne pitää nähdä listalta ilman että jokainen hanke
   * avataan erikseen.
   */
  related_companies: string[] | null
  property_type: string | null
  apartments: number | null
  floor_area: number | null
  estimated_cost: number | null
  construction_start: string | null
  estimated_completion: string | null
  structural_design: string | null
  hvac_design: string | null
  electrical_design: string | null
  architectural_design: string | null
  geotechnical_design: string | null
  earthworks_contractor: string | null
  additional_info: string | null
  created_at: string
  latitude?: number | string | null
  longitude?: number | string | null
  lat?: number | string | null
  lng?: number | string | null
  owner_id?: string | null

  metadata?: {
    source?: string | null
    source_name?: string | null
    source_url?: string | null
    documents_url?: string | null
    deadline?: string | null
    notice_number?: string | null
    notice_id?: string | null
    developer?: string | null
    buyer_address?: string | null
    project_address?: string | null
    contact_persons?:
      | { name: string; title: string | null; phone: string | null; email: string | null }[]
      | null
    [key: string]: unknown
  } | null
}

function uniqSorted(values: (string | null | undefined)[]) {
  const s = new Set(
    values
      .map((v) => (v ?? '').trim())
      .filter(Boolean)
  )
  return Array.from(s).sort((a, b) => a.localeCompare(b, 'fi'))
}

function formatEUR(n: number | null | undefined) {
  if (n == null) return '-'
  try {
    return new Intl.NumberFormat('fi-FI', { maximumFractionDigits: 0 }).format(n) + ' €'
  } catch {
    return `${n} €`
  }
}

function formatM2(n: number | null | undefined) {
  if (n == null) return '-'
  try {
    return new Intl.NumberFormat('fi-FI', { maximumFractionDigits: 0 }).format(n) + ' m²'
  } catch {
    return `${n} m²`
  }
}

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`)
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [breakpoint])

  return isMobile
}

/*
 * Sulkee avoimen monivalintapaneelin kun klikataan sen ulkopuolelle tai
 * painetaan Escapea. Jaettu, koska sekä vaihe- että maakuntavalikko
 * tarvitsevat täsmälleen saman käytöksen.
 */
function useCloseOnOutside(
  open: boolean,
  ref: RefObject<HTMLDivElement | null>,
  setOpen: Dispatch<SetStateAction<boolean>>
) {
  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, ref, setOpen])
}

function toNumberOrNull(v: unknown): number | null {
  if (v == null) return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string') {
    const n = parseFloat(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function getCoords(p: Project): { lat: number | null; lng: number | null } {
  const lat = toNumberOrNull(p.latitude ?? p.lat)
  const lng = toNumberOrNull(p.longitude ?? p.lng)
  return { lat, lng }
}

function hasCoords(p: Project) {
  const { lat, lng } = getCoords(p)
  return lat != null && lng != null
}

function humanizeStatus(status: string) {
  switch (status) {
    case 'new':
      return 'Uusi'
    case 'contacted':
      return 'Kontaktoitu'
    case 'offer_sent':
      return 'Tarjous lähetetty'
    case 'won':
      return 'Voitettu'
    case 'lost':
      return 'Hävitty'
    default:
      return status
  }
}

function getStatusStyle(status: string) {
  switch (status) {
    case 'new':
      return { background: '#f3f4f6', color: '#374151' }
    case 'contacted':
      return { background: '#dbeafe', color: '#1d4ed8' }
    case 'offer_sent':
      return { background: '#fef3c7', color: '#b45309' }
    case 'won':
      return { background: '#dcfce7', color: '#166534' }
    case 'lost':
      return { background: '#fee2e2', color: '#991b1b' }
    default:
      return { background: '#f3f4f6', color: '#374151' }
  }
}

export default function Projects() {
  const isMobile = useIsMobile(768)
  const pageSize = isMobile ? 15 : 30
  const mapHeight = isMobile ? 360 : 520

  /*
   * Ylläpitäjän tunnistus, jotta korjauslinkki näkyy vain hänelle.
   * Sama tapa kuin Navbarissa: istunnon token ja /api/admin/is-admin.
   */
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    let peruttu = false

    const tarkista = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        const token = data.session?.access_token
        if (!token) return

        const res = await fetch('/api/admin/is-admin', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const json = await res.json()
        if (!peruttu) setIsAdmin(json?.isAdmin === true)
      } catch {
        /* Ylläpitolinkin puuttuminen ei saa rikkoa asiakkaan näkymää. */
      }
    }

    tarkista()
    return () => {
      peruttu = true
    }
  }, [])

  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [loadDebug, setLoadDebug] = useState('Aloitetaan lataus...')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [teamModeEnabled, setTeamModeEnabled] = useState(false)
  const [showTeamHighlights, setShowTeamHighlights] = useState(true)

  const [q, setQ] = useState('')
  /*
   * Maakuntasuodatin on monivalinta samasta syystä kuin vaihe alla:
   * urakoitsija toimii tyypillisesti muutamalla naapurimaakunnalla, ei
   * yhdellä eikä koko maassa. Tyhjä lista = ei rajausta.
   */
  const [region, setRegion] = useState<string[]>([])
  const [regionOpen, setRegionOpen] = useState(false)
  const regionRef = useRef<HTMLDivElement | null>(null)
  const [city, setCity] = useState<string>('')
  /*
   * Vaihesuodatin on monivalinta: käyttäjä haluaa nähdä esimerkiksi
   * rakenteilla olevat JA valmistumassa olevat samassa näkymässä ilman
   * jo valmistuneita. Yksittäisvalinnalla vaihtoehtoja oli vain "kaikki"
   * tai yksi kerrallaan. Tyhjä lista = ei rajausta.
   */
  const [phase, setPhase] = useState<string[]>([])
  const [phaseOpen, setPhaseOpen] = useState(false)
  const phaseRef = useRef<HTMLDivElement | null>(null)
  const [propertyType, setPropertyType] = useState<string>('')

  const [visibleCount, setVisibleCount] = useState(pageSize)

  const [selected, setSelected] = useState<Project | null>(null)
  const [phaseHistory, setPhaseHistory] = useState<
    { phase: string; created_at: string }[]
  >([])

  useEffect(() => {
    if (projects.length === 0) return

    const params = new URLSearchParams(window.location.search)
    const openId = params.get('open')
    if (!openId) return

    const found = projects.find((p) => String(p.id) === openId)
    if (found) {
      setSelected(found)
    }
  }, [projects])

  /*
   * Valitun hankkeen metadata haetaan vasta tässä, koska listakysely jättää
   * sen pois egressin takia (ks. kommentti latauksen yhteydessä). Tulos
   * sulautetaan selected-olioon, jolloin paneelin selected.metadata?.x
   * -viittaukset toimivat muuttumattomina. Ennen hakua ne ovat undefined,
   * mikä on sama tila kuin hankkeella jolla ei ole metadataa - paneeli
   * osaa jo piilottaa kentät silloin.
   */
  useEffect(() => {
    const id = selected?.id
    if (!id || selected?.metadata !== undefined) return

    let cancelled = false

    supabase
      .from('projects')
      .select('metadata')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (cancelled || !data) return
        setSelected((current) =>
          current && current.id === id
            ? { ...current, metadata: data.metadata ?? null }
            : current
        )
      })

    return () => {
      cancelled = true
    }
  }, [selected?.id, selected?.metadata])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    /*
     * Osoiterivillä maakunnat ovat pilkulla eroteltuina. Yksi maakunta
     * toimii yhä sellaisenaan, joten vanhat linkit eivät hajoa.
     */
    const regionParam = params.get('region')
    if (regionParam) {
      setRegion(
        regionParam
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
      )
    }
  }, [])

  useEffect(() => {
    if (!selected?.id) {
      setPhaseHistory([])
      return
    }

    let cancelled = false

    supabase
      .from('project_phase_history')
      .select('phase, created_at')
      .eq('project_id', selected.id)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (!cancelled) setPhaseHistory(data ?? [])
      })

    return () => {
      cancelled = true
    }
  }, [selected?.id])

  useEffect(() => {
    if (selected?.id) {
      trackEvent({ event_type: 'project_open', project_id: selected.id })
    }
  }, [selected?.id])

  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null)
  const [limitToMapView, setLimitToMapView] = useState(true)

  const [zoomTarget, setZoomTarget] = useState<{ lat: number; lng: number } | null>(null)

  const [watchOpen, setWatchOpen] = useState(false)
  const [watchName, setWatchName] = useState('')
  const [watchFrequency, setWatchFrequency] = useState<'daily' | 'weekly'>('weekly')
  const [watchSaving, setWatchSaving] = useState(false)
  const [watchError, setWatchError] = useState<string | null>(null)
  const [watchSuccess, setWatchSuccess] = useState<string | null>(null)
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [statuses, setStatuses] = useState<Record<string, string>>({})

  const toggleFavorite = async (projectId: string) => {
    const { data: userRes } = await supabase.auth.getUser()
    const userId = userRes?.user?.id
    if (!userId) return

    if (favorites.has(projectId)) {
      await supabase
        .from('user_project_favorites')
        .delete()
        .eq('user_id', userId)
        .eq('project_id', projectId)

      const next = new Set(favorites)
      next.delete(projectId)
      setFavorites(next)
    } else {
      await supabase.from('user_project_favorites').insert({ user_id: userId, project_id: projectId })

      const next = new Set(favorites)
      next.add(projectId)
      setFavorites(next)
    }
  }

  const setProjectStatus = async (projectId: string, status: string) => {
    const { data: userRes } = await supabase.auth.getUser()
    const userId = userRes?.user?.id
    if (!userId) return

    await supabase
      .from('user_project_status')
      .upsert({ user_id: userId, project_id: projectId, status }, { onConflict: 'user_id,project_id' })

    setStatuses((prev) => ({
      ...prev,
      [projectId]: status,
    }))
  }

  const openWatch = () => {
    setWatchError(null)
    setWatchSuccess(null)
    setWatchFrequency('weekly')

    const parts = [
      region.length > 0 ? region.join(', ') : null,
      city || null,
      phase.length > 0 ? phase.join(', ') : null,
      propertyType || null,
    ].filter(Boolean) as string[]
    const suggested = parts.length ? parts.join(' – ') : 'Hakuvahti'
    setWatchName(suggested)

    setWatchOpen(true)
  }

  const closeWatch = () => {
    setWatchOpen(false)
    setWatchSaving(false)
    setWatchError(null)
  }

  const saveWatch = async () => {
    setWatchError(null)
    setWatchSuccess(null)

    const name = watchName.trim()
    if (!name) {
      setWatchError('Anna hakuvahtille nimi.')
      return
    }

    setWatchSaving(true)

    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser()
      if (userErr || !userRes?.user?.id) {
        setWatchError('Kirjaudu sisään tallentaaksesi hakuvahdin.')
        setWatchSaving(false)
        return
      }

      const filters = {
        q: q.trim() || null,
        /*
         * Hakuvahdille lista, kuten vaiheelle. /api/digests osaa lukea
         * sekä yksittäisen merkkijonon (vanhat tallennetut haut) että
         * listan.
         */
        region: region.length > 0 ? region : null,
        city: city || null,
        /*
         * Hakuvahdille lista. /api/digests osaa lukea sekä yksittäisen
         * merkkijonon (vanhat tallennetut haut) että listan.
         */
        phase: phase.length > 0 ? phase : null,
        property_type: propertyType || null,
      }

      const { error: insErr } = await supabase.from('saved_searches').upsert(
        {
          user_id: userRes.user.id,
          name,
          filters,
          frequency: watchFrequency,
          is_enabled: true,
          last_sent_at: null,
        },
        {
          onConflict: 'user_id,frequency,name,filters',
          ignoreDuplicates: true,
        }
      )

      if (insErr) {
        setWatchError(insErr.message)
        setWatchSaving(false)
        return
      }

      setWatchSaving(false)
      setWatchSuccess('Hakuvahti tallennettu!')
      setWatchOpen(false)
    } catch (e: any) {
      setWatchError(e?.message || 'Tallennus epäonnistui.')
      setWatchSaving(false)
    }
  }

  const zoomToProject = (p: Project) => {
    const { lat, lng } = getCoords(p)
    if (lat == null || lng == null) return
    setZoomTarget({ lat, lng })
  }

  useEffect(() => {
  const fetchProjects = async () => {
    setLoading(true)
    setLoadDebug('Haetaan käyttäjää...')

    const {
      data: { user },
    } = await supabase.auth.getUser()

    setCurrentUserId(user?.id || null)
    setLoadDebug(`Käyttäjä: ${user?.email || 'ei kirjautunut'}. Haetaan projekteja...`)

    /*
     * Supabase/PostgREST palauttaa oletuksena korkeintaan 1000 riviä per
     * kysely (db-max-rows), vaikka .limit()-kutsua ei olisikaan — tämä
     * katkaisi projektilistan hiljaisesti kun julkisten hankkeiden määrä
     * ylitti 1000. Haetaan siis sivutettuna 1000 rivin erissä kunnes
     * kaikki on saatu.
     */
    /*
     * metadata EI ole mukana sarakelistassa tarkoituksella. Se on raskain
     * kenttä (6,97 MB koko aineistossa, 58 % latauksen 11,94 megatavusta),
     * mutta sitä luetaan vain valitun hankkeen paneelissa. Koko listan
     * hakeminen selaimeen täytti Supabasen 5 GB egress-kiintiön ~429
     * sivulatauksella. Valitun hankkeen metadata haetaan erikseen alempana.
     *
     * additional_info sen sijaan jää: sitä käytetään vapaan tekstihaun
     * hakukentässä kaikille hankkeille, joten sitä ei voi hakea vain
     * valitulle.
     */
    const PAGE_SIZE = 1000
    const projectsData: Project[] = []

    for (let from = 0; ; from += PAGE_SIZE) {
      const { data: pageData, error: pageError } = await supabase
        .from('projects')
        .select(
          `
          id, name, city, region, phase, status, location, developer, builder, property_type,
          apartments, floor_area, estimated_cost, construction_start, estimated_completion,
          structural_design, hvac_design, electrical_design, architectural_design,
          geotechnical_design, earthworks_contractor, additional_info,
          related_companies:metadata->related_companies,
           latitude, longitude,
          is_public,
          created_at
        `
        )
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .range(from, from + PAGE_SIZE - 1)

      if (pageError) {
        console.error('Supabase error:', pageError)
        setProjects([])
        setLoading(false)
        return
      }

      projectsData.push(...((pageData as Project[]) || []))

      if (!pageData || pageData.length < PAGE_SIZE) break
    }

    /*
     * Valmistuneet hankkeet eivät ole tälle näkymälle relevantteja -
     * käyttäjä ei voi tehdä mitään jo valmistuneella työmaalla, joten ne
     * suodatetaan pois heti haun jälkeen sekä listasta että kartasta.
     * Samoin vanhentuneet kilpailutukset (status = "expired"): tarjous-
     * ilmoituksesta on kulunut yli vuosi eikä hanke ole enää relevantti.
     * Vain "expired" suodatetaan statuksen perusteella, jottei esim.
     * null-statuksisia legacy-hankkeita katoa vahingossa.
     */
    const activeProjectsData = projectsData.filter(
      (p) =>
        normalizeLegacyPhase(p.phase) !== 'completed' &&
        p.status !== 'expired'
    )

setLoadDebug('Projektit haettu. Tarkistetaan mahdollinen tiimi...')

    if (!user) {
      setProjects(activeProjectsData)
      setLoading(false)
      return
    }

    const { data: memberRow } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!memberRow) {
      setProjects(activeProjectsData)
      setLoading(false)
      setTeamModeEnabled(false)
      return
    }
setTeamModeEnabled(true)
    const { data: assignmentsData } = await supabase
      .from('project_assignments')
      .select('project_id, owner_id')
      .eq('team_id', memberRow.team_id)

    const assignmentMap = new Map(
      (assignmentsData || []).map((a: any) => [a.project_id, a.owner_id])
    )

    const projectsWithOwners = activeProjectsData.map((project) => ({
      ...project,
      owner_id: assignmentMap.has(project.id)
        ? assignmentMap.get(project.id)
        : null,
    }))

    setProjects(projectsWithOwners)
    setLoading(false)
  }

  fetchProjects()
}, [])

  useEffect(() => {
    const fetchCRM = async () => {
      const { data: userRes } = await supabase.auth.getUser()
      const userId = userRes?.user?.id
      if (!userId) return

      const [{ data: favs }, { data: stats }] = await Promise.all([
        supabase.from('user_project_favorites').select('project_id').eq('user_id', userId),
        supabase.from('user_project_status').select('project_id,status').eq('user_id', userId),
      ])

      setFavorites(new Set((favs ?? []).map((r: any) => r.project_id)))

      const m: Record<string, string> = {}
      ;(stats ?? []).forEach((r: any) => {
        m[r.project_id] = r.status
      })
      setStatuses(m)
    }

    fetchCRM()
  }, [])

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<Project>
      if (customEvent.detail) {
        setSelected(customEvent.detail)
      }
    }

    window.addEventListener('open-project-from-map', handler)

    return () => {
      window.removeEventListener('open-project-from-map', handler)
    }
  }, [])

  const regions = useMemo(() => uniqSorted(projects.map((p) => p.region)), [projects])

  const cities = useMemo(() => {
    const base =
      region.length > 0 ? projects.filter((p) => region.includes(p.region || '')) : projects
    return uniqSorted(base.map((p) => p.city))
  }, [projects, region])

  const phases = PHASE_OPTIONS

  const propertyTypes = useMemo(() => uniqSorted(projects.map((p) => p.property_type)), [projects])

  const filteredProjects = useMemo(() => {
    const needle = q.trim().toLowerCase()

    return projects.filter((p) => {
      if (region.length > 0 && !region.includes(p.region || '')) return false
      if (city && p.city !== city) return false
      if (phase.length > 0 && !phase.includes(displayPhaseLabel(p.phase))) return false

      if (propertyType && !(p.property_type || '').toLowerCase().includes(propertyType.toLowerCase())) return false

      if (!needle) return true

      const haystack = [
        p.name,
        p.region ?? '',
        p.city,
        p.phase,
        p.location ?? '',
        p.developer ?? '',
        p.builder ?? '',
        p.earthworks_contractor ?? '',
        p.property_type ?? '',
        p.additional_info ?? '',
      ]
        .join(' ')
        .toLowerCase()

      /*
       * Sanahaku: jokaisen hakusanan on löydyttävä (JA), mutta eri kentistä ja
       * missä järjestyksessä tahansa. Esim. "forssa data" löytää hankkeen jonka
       * kaupunki on Forssa ja kohdetyyppi Datakeskus, vaikka "forssa data" ei
       * esiinny yhtenäisenä jonona missään kentässä. Osamerkkijono kattaa myös
       * taivutuksen (esim. "forssa" löytyy sanasta "Forssaan").
       */
      const terms = needle.split(/\s+/).filter(Boolean)
      return terms.every((term) =>
        expandSearchTerm(term).some((syn) => haystack.includes(syn))
      )
    })
  }, [projects, q, region, city, phase, propertyType])

  const filteredWithCoords = useMemo(() => filteredProjects.filter((p) => hasCoords(p)), [filteredProjects])
  const filteredNoCoords = useMemo(() => filteredProjects.filter((p) => !hasCoords(p)), [filteredProjects])

  const inBoundsWithCoords = useMemo(() => {
    if (!limitToMapView || !mapBounds) return filteredWithCoords

    const { south, west, north, east } = mapBounds
    return filteredWithCoords.filter((p) => {
      const { lat, lng } = getCoords(p)
      if (lat == null || lng == null) return false
      return lat >= south && lat <= north && lng >= west && lng <= east
    })
  }, [filteredWithCoords, limitToMapView, mapBounds])

  const listProjects = useMemo(() => {
    if (!limitToMapView) return filteredProjects
    return [...inBoundsWithCoords, ...filteredNoCoords]
  }, [limitToMapView, filteredProjects, inBoundsWithCoords, filteredNoCoords])

  useEffect(() => {
    setVisibleCount(pageSize)
  }, [q, region, city, phase, propertyType, limitToMapView, mapBounds, pageSize])

  const visibleProjects = useMemo(() => listProjects.slice(0, visibleCount), [listProjects, visibleCount])

  const clearFilters = () => {
    setQ('')
    setRegion([])
    setCity('')
    setPhase([])
    setPropertyType('')
  }

  /*
   * Paneeli sulkeutuu kun klikataan sen ulkopuolelle. Ilman tätä avattu
   * valikko jäisi auki ja peittäisi kartan.
   */
  useCloseOnOutside(phaseOpen, phaseRef, setPhaseOpen)
  useCloseOnOutside(regionOpen, regionRef, setRegionOpen)

  useEffect(() => {
    if (!city) return
    const ok = cities.includes(city)
    if (!ok) setCity('')
  }, [region, cities, city])

  function closeModal() {
    setSelected(null)
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') closeModal()
    }
    if (selected) window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selected])

  const mapCount = limitToMapView ? inBoundsWithCoords.length : filteredWithCoords.length
  const noCoordsCount = filteredNoCoords.length

  if (loading) {
  return (
    <div style={{ padding: 20 }}>
      <p>Ladataan...</p>
      {process.env.NODE_ENV === 'development' && (
  <pre style={{ color: '#6b7280', fontSize: 12 }}>{loadDebug}</pre>
)}
    </div>
  )
}

  return (
    <div className="projects-page">
      <style jsx global>{`
        .leaflet-container {
          z-index: 0 !important;
        }
        .leaflet-pane,
        .leaflet-map-pane,
        .leaflet-tile-pane,
        .leaflet-overlay-pane,
        .leaflet-shadow-pane,
        .leaflet-marker-pane,
        .leaflet-tooltip-pane,
        .leaflet-popup-pane {
          z-index: 0 !important;
        }
        .leaflet-control {
          z-index: 1 !important;
        }
      `}</style>

      <h1 className="projects-title">Työmaat</h1>

      <div className="projects-filters-card">
        <div className="projects-filters-grid">
          <div>
            <label className="projects-label">Haku</label>
            <input
              className="projects-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Hae nimen, maakunnan, kaupungin, rakennuttajan…"
            />
          </div>

          <div className="projects-multiselect" ref={regionRef}>
            <label className="projects-label">Maakunta</label>

            <button
              type="button"
              className="projects-multiselect-toggle"
              onClick={() => setRegionOpen((open) => !open)}
              aria-expanded={regionOpen}
            >
              <span>
                {region.length === 0
                  ? 'Kaikki'
                  : region.length === 1
                    ? region[0]
                    : `${region.length} valittu`}
              </span>
              <span aria-hidden>▾</span>
            </button>

            {regionOpen && (
              <div className="projects-multiselect-panel">
                <div className="projects-multiselect-actions">
                  <button type="button" onClick={() => setRegion([...regions])}>
                    Valitse kaikki
                  </button>
                  <button type="button" onClick={() => setRegion([])}>
                    Tyhjennä
                  </button>
                </div>

                {regions.map((r) => (
                  <label key={r} className="projects-multiselect-option">
                    <input
                      type="checkbox"
                      checked={region.includes(r)}
                      onChange={(e) =>
                        setRegion((current) =>
                          e.target.checked
                            ? [...current, r]
                            : current.filter((value) => value !== r)
                        )
                      }
                    />
                    {r}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="projects-label">Kaupunki</label>
            <select className="projects-select" value={city} onChange={(e) => setCity(e.target.value)}>
              <option value="">Kaikki</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="projects-multiselect" ref={phaseRef}>
            <label className="projects-label">Vaihe</label>

            <button
              type="button"
              className="projects-multiselect-toggle"
              onClick={() => setPhaseOpen((open) => !open)}
              aria-expanded={phaseOpen}
            >
              <span>
                {phase.length === 0
                  ? 'Kaikki'
                  : phase.length === 1
                    ? phase[0]
                    : `${phase.length} valittu`}
              </span>
              <span aria-hidden>▾</span>
            </button>

            {phaseOpen && (
              <div className="projects-multiselect-panel">
                <div className="projects-multiselect-actions">
                  <button type="button" onClick={() => setPhase([...phases])}>
                    Valitse kaikki
                  </button>
                  <button type="button" onClick={() => setPhase([])}>
                    Tyhjennä
                  </button>
                </div>

                {phases.map((p) => (
                  <label key={p} className="projects-multiselect-option">
                    <input
                      type="checkbox"
                      checked={phase.includes(p)}
                      onChange={(e) =>
                        setPhase((current) =>
                          e.target.checked
                            ? [...current, p]
                            : current.filter((value) => value !== p)
                        )
                      }
                    />
                    {p}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="projects-label">Kohdetyyppi</label>
            <input
              type="text"
              placeholder="Hae kohdetyyppiä..."
              value={propertyType}
              onChange={(e) => setPropertyType(e.target.value)}
              style={{
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid #ccc',
                width: '200px',
              }}
            />
          </div>

          <button type="button" className="projects-clear" onClick={clearFilters}>
            Tyhjennä
          </button>

          <button type="button" className="projects-clear" onClick={openWatch} style={{ borderColor: '#cbd5e1' }}>
            Tallenna hakuvahti
          </button>
        </div>
      </div>

      <div className="projects-topbar">
        <label className="projects-checkbox">
          <input
            type="checkbox"
            checked={limitToMapView}
            onChange={(e) => setLimitToMapView(e.target.checked)}
          />
          Rajaa listaa kartan mukaan
        </label>

        <div className="projects-counter">
          Kartassa <strong>{mapCount}</strong> / suodatetuista {filteredProjects.length}
          {noCoordsCount > 0 ? (
            <>
              {' '}
              • <strong>{noCoordsCount}</strong> ilman koordinaatteja (näkyvät listassa)
            </>
          ) : null}
        </div>
      </div>

      <div className="projects-map" style={{ height: mapHeight }}>
        <MapClient
  projects={filteredProjects}
  onBoundsChange={setMapBounds}
  zoomTo={zoomTarget}
  currentUserId={currentUserId}
  teamModeEnabled={teamModeEnabled && showTeamHighlights}
/>
      </div>

      <div
        style={{
          marginTop: 14,
          marginBottom: 14,
          padding: '14px 16px',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          background: '#ffffff',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="marker-dot marker--planning" />
            <span style={{ fontSize: 14 }}>Suunnittelussa</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="marker-dot marker--tender" />
            <span style={{ fontSize: 14 }}>Kilpailutus / lupa</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="marker-dot marker--active" />
            <span style={{ fontSize: 14 }}>Rakenteilla</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/*
              * Sama vari on seka "Valmistumassa"- etta "Valmistunut"-
              * vaiheelle, mutta valmistuneet on suodatettu pois, joten
              * kartalla se tarkoittaa aina viimeistelyvaihetta.
              */}
            <span className="marker-dot marker--done" />
            <span style={{ fontSize: 14 }}>Valmistumassa</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="marker-dot marker--default" />
            <span style={{ fontSize: 14 }}>Peruttu / muu</span>
          </div>
        </div>
        
{teamModeEnabled && (
  <>
    <div style={{ width: 1, height: 20, background: '#e5e7eb' }} />

    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span className="marker-dot marker--planning marker--mine" />
      <span style={{ fontSize: 14 }}>Oma hanke</span>
    </div>

    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span className="marker-dot marker--planning marker--unassigned" />
      <span style={{ fontSize: 14 }}>Ei omistajaa</span>
    </div>

    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span className="marker-dot marker--planning marker--team" />
      <span style={{ fontSize: 14 }}>Toisen tiimiläisen hanke</span>
    </div>
  </>
)}

          

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
  {teamModeEnabled && (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
      <input
        type="checkbox"
        checked={showTeamHighlights}
        onChange={(e) => setShowTeamHighlights(e.target.checked)}
      />
      Näytä tiimikorostukset
    </label>
  )}

  <div style={{ fontSize: 14, color: '#374151' }}>
    <strong>Lajittelu:</strong> Uusimmat hankkeet näkyvät listan alussa.
  </div>
</div>
      </div>

      <div className="projects-list">
        {listProjects.length === 0 && <p>Ei projekteja valituilla filttereillä.</p>}

        {listProjects.length > 0 && (
          <>
            <div className="projects-tableWrap">
              <div className="projects-tableHead">
                <div>Nimi</div>
                <div>Kaupunki</div>
                <div>Maakunta</div>
                <div>Vaihe</div>
                <div />
              </div>

              {visibleProjects.map((p) => (
                <div key={p.id} className="projects-tableRow">
                  <div className="projects-name">
                    {p.name}{' '}
                    {(() => {
                      /*
                       * Urakoitsija ja liittyvät yritykset suoraan riville:
                       * aiemmin ne näkyivät vain hankekortin avaamisen
                       * jälkeen, joten "Sopimus myönnetty" -suodatuksella
                       * selatessa ei nähnyt kuka kilpailun voitti — juuri se
                       * tieto jonka takia suodatinta käytetään.
                       */
                      const companies = mergeCompanyNames(
                        [p.builder],
                        p.related_companies
                      )

                      if (companies.length === 0) return null

                      return (
                        <div className="projects-companies">
                          👷 {companies.join(' · ')}
                        </div>
                      )
                    })()}
                    {!hasCoords(p) ? (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: 12,
                          padding: '2px 8px',
                          borderRadius: 999,
                          border: '1px solid #e5e7eb',
                          background: '#f9fafb',
                          color: '#6b7280',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Ei koordinaatteja
                      </span>
                    ) : null}
                  </div>
                  <div>{p.city}</div>
                  <div>{p.region || '-'}</div>
                  <div>{displayPhaseLabel(p.phase)}</div>

                  <div className="projects-actions" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button className="projects-btn" onClick={() => setSelected(p)}>
                      Näytä tiedot
                    </button>

                    <button
                      className="projects-btn"
                      type="button"
                      onClick={() => zoomToProject(p)}
                      disabled={!hasCoords(p)}
                      title={!hasCoords(p) ? 'Ei koordinaatteja' : 'Zoomaa kartalla kohteeseen'}
                      style={!hasCoords(p) ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                    >
                      Näytä kartalla
                    </button>

                    <button
                      className="projects-btn"
                      type="button"
                      onClick={() => toggleFavorite(p.id)}
                      title="Lisää omiin"
                    >
                      {favorites.has(p.id) ? '★ Omat' : '☆ Omiin'}
                    </button>

                    <select
                      className="projects-select"
                      value={statuses[p.id] ?? 'new'}
                      onChange={(e) => setProjectStatus(p.id, e.target.value)}
                      style={{
                        maxWidth: 170,
                        padding: '8px 10px',
                        borderRadius: 10,
                        border: '1px solid #e5e7eb',
                        fontWeight: 700,
                        ...getStatusStyle(statuses[p.id] ?? 'new'),
                      }}
                    >
                      <option value="new">Uusi</option>
                      <option value="contacted">Kontaktoitu</option>
                      <option value="offer_sent">Tarjous lähetetty</option>
                      <option value="won">Voitettu</option>
                      <option value="lost">Hävitty</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>

            <div className="projects-cards">
              {visibleProjects.map((p) => (
                <div key={p.id} className="projects-cardRow">
                  <div className="projects-cardTitle">
                    {p.name}{' '}
                    {!hasCoords(p) ? (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: 12,
                          padding: '2px 8px',
                          borderRadius: 999,
                          border: '1px solid #e5e7eb',
                          background: '#f9fafb',
                          color: '#6b7280',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Ei koordinaatteja
                      </span>
                    ) : null}
                  </div>

                  <div className="projects-cardMeta">
                    {p.city} • {p.region || '-'} • {displayPhaseLabel(p.phase)}
                  </div>

                  <div style={{ marginTop: 6 }}>
                    <span
                      style={{
                        ...getStatusStyle(statuses[p.id] ?? 'new'),
                        padding: '4px 10px',
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 700,
                        display: 'inline-block',
                      }}
                    >
                      {humanizeStatus(statuses[p.id] ?? 'new')}
                    </span>
                  </div>

                  <div className="projects-cardActions">
                    <button className="projects-btn projects-btnFull" onClick={() => setSelected(p)}>
                      Näytä tiedot
                    </button>

                    <button
                      className="projects-btn projects-btnFull"
                      type="button"
                      onClick={() => zoomToProject(p)}
                      disabled={!hasCoords(p)}
                      style={!hasCoords(p) ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                    >
                      Näytä kartalla
                    </button>

                    <button
                      className="projects-btn projects-btnFull"
                      type="button"
                      onClick={() => toggleFavorite(p.id)}
                    >
                      {favorites.has(p.id) ? '★ Omat' : '☆ Omiin'}
                    </button>

                    <select
                      className="projects-select"
                      value={statuses[p.id] ?? 'new'}
                      onChange={(e) => setProjectStatus(p.id, e.target.value)}
                    >
                      <option value="new">Uusi</option>
                      <option value="contacted">Kontaktoitu</option>
                      <option value="offer_sent">Tarjous lähetetty</option>
                      <option value="won">Voitettu</option>
                      <option value="lost">Hävitty</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {listProjects.length > visibleCount && (
          <div className="projects-more">
            <button className="projects-moreBtn" onClick={() => setVisibleCount((c) => c + pageSize)}>
              Lataa lisää (+{pageSize})
            </button>
          </div>
        )}
      </div>

      {selected && (
        <div
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeModal()
          }}
          className="projects-modalBackdrop"
        >
          <div className="projects-modal">
            <div className="projects-modalTop">
              <div>
                <h2 className="projects-modalTitle">{selected.name}</h2>
                <div className="projects-modalSub">
                  {selected.city} • {selected.region || '-'} • {displayPhaseLabel(selected.phase)}
                </div>
                <PhaseTimeline rawPhase={selected.phase} history={phaseHistory} />
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  justifyContent: 'flex-end',
                }}
              >
                <select
                  className="projects-select"
                  value={statuses[selected.id] ?? 'new'}
                  onChange={(e) => setProjectStatus(selected.id, e.target.value)}
                  style={{
                    minWidth: 160,
                    maxWidth: 220,
                    padding: '8px 10px',
                    borderRadius: 10,
                    border: '1px solid #e5e7eb',
                    fontWeight: 700,
                    ...getStatusStyle(statuses[selected.id] ?? 'new'),
                  }}
                >
                  <option value="new">Uusi</option>
                  <option value="contacted">Kontaktoitu</option>
                  <option value="offer_sent">Tarjous lähetetty</option>
                  <option value="won">Voitettu</option>
                  <option value="lost">Hävitty</option>
                </select>

                <button className="projects-btn" onClick={() => toggleFavorite(selected.id)}>
                  {favorites.has(selected.id) ? '★ Omat' : '☆ Omiin'}
                </button>

                <button className="projects-btn" onClick={closeModal}>
                  Sulje
                </button>

                <FeedbackButton
  context="Hankepalaute"
  projectId={selected.id}
  projectName={selected.name}
  className="projects-btn"
  style={{ background: '#e5e7eb' }}
/>

                {/*
                  * YLLÄPITÄJÄN OIKOPOLKU KORJAUKSEEN.
                  *
                  * Virhe huomataan täällä — tässä näkymässä asiakas sen
                  * näkee — mutta korjaus tehdään hankkeen omalla sivulla,
                  * eikä sinne johtanut mistään linkkiä. Ilman tätä väärän
                  * tiedon korjaaminen vaati id:n kaivamisen osoiteriviltä.
                  *
                  * Näkyy vain ylläpitäjälle; asiakkaalle painiketta ei ole.
                  */}
                {isAdmin && (
                  <a
                    href={`/tic/hanke/${selected.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="projects-btn"
                    style={{ background: '#111827', color: '#fff' }}
                  >
                    Muokkaa
                  </a>
                )}

                <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
                  
                </div>
              </div>
            </div>

            <hr className="projects-hr" />

            <div className="projects-modalGrid">
              <div>
                <p>
                  <strong>Maakunta:</strong> {selected.region || '-'}
                </p>
                <p>
                  <strong>Kaupunki:</strong> {selected.city}
                </p>
                <p>
                  <strong>Sijainti / osoite:</strong> {selected.location || '-'}
                </p>
                {selected.property_type ? (
                  <p>
                    <strong>🏢 Kohdetyyppi:</strong> {selected.property_type}
                  </p>
                ) : null}
              </div>

              <div>
                {/*
                  * Tyhjät kentät jätetään pois. Aiemmin jokainen rivi
                  * näytettiin aina, joten hankekortti oli enimmäkseen
                  * viivoja ("Asuntoja: -", "Kerrosala: -", ...) ja näytti
                  * tyhjältä vaikka tiedossa olisi ollut olennaista.
                  */}
                {selected.apartments != null ? (
                  <p>
                    <strong>🏠 Asuntoja:</strong> {selected.apartments}
                  </p>
                ) : null}
                {selected.floor_area != null ? (
                  <p>
                    <strong>📐 Kerrosala:</strong> {formatM2(selected.floor_area)}
                  </p>
                ) : null}
                {selected.estimated_cost != null ? (
                  <p>
                    <strong>💰 Arvioitu kustannus:</strong>{' '}
                    {formatEUR(selected.estimated_cost)}
                  </p>
                ) : null}
                {selected.construction_start ? (
                  <p>
                    <strong>📅 Rakentamisen aloitus:</strong>{' '}
                    {selected.construction_start}
                  </p>
                ) : null}
                {selected.estimated_completion ? (
                  <p>
                    <strong>📅 Arvioitu valmistuminen:</strong>{' '}
                    {selected.estimated_completion}
                  </p>
                ) : null}
              </div>
            </div>

            <hr className="projects-hr" />

            {/*
              * Hankkeeseen liittyvät yritykset yhtenä listana rooleineen sen
              * sijaan että jokainen rooli olisi oma rivinsä myös tyhjänä.
              * Kokoaa myös usean osaurakan voittajat, jotka jäivät ennen
              * näkymättä kun vain yksi mahtui builder-kenttään.
              */}
            {(() => {
              const companies = collectProjectCompanies(selected)

              return (
                <div>
                  <p style={{ marginBottom: 8 }}>
                    <strong>Hankkeeseen liittyvät yritykset</strong>
                  </p>

                  {companies.length === 0 ? (
                    <p style={{ color: '#6b7280' }}>Ei vielä tiedossa.</p>
                  ) : (
                    <div className="projects-companyList">
                      {companies.map((company) => (
                        <p key={`${company.role}-${company.name}`}>
                          <strong>{company.role}:</strong> {company.name}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )
            })()}

 {selected.metadata?.deadline ||
            selected.metadata?.source_url ||
            selected.metadata?.documents_url ? (
              <>
                <hr className="projects-hr" />

                <div>
                  <p style={{ marginBottom: 8 }}>
                    <strong>Hankintatiedot</strong>
                  </p>

                  {selected.metadata?.source_name ? (
                    <p>
                      <strong>Lähde:</strong>{" "}
                      {selected.metadata.source_name}
                    </p>
                  ) : null}

                  {selected.metadata?.notice_number ? (
                    <p>
                      <strong>Ilmoitusnumero:</strong>{" "}
                      {selected.metadata.notice_number}
                    </p>
                  ) : null}

                  {selected.metadata?.deadline ? (
                    <p>
                      <strong>Tarjousten määräaika:</strong>{" "}
                      {new Date(
                        selected.metadata.deadline
                      ).toLocaleString("fi-FI")}
                    </p>
                  ) : null}

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 10,
                      marginTop: 12,
                    }}
                  >
                    {selected.metadata?.source_url &&
!(
  selected.metadata?.source_name?.toLowerCase() === "hilma" &&
  selected.metadata?.documents_url
) ? (
  <a
    href={selected.metadata.source_url}
    target="_blank"
    rel="noopener noreferrer"
    className="projects-btn"
    style={{ textDecoration: "none" }}
    onClick={() =>
      trackEvent({
        event_type: 'source_link_click',
        project_id: selected.id,
        path: '/projects',
      })
    }
  >
    Avaa alkuperäinen ilmoitus
  </a>
) : null}

                    {selected.metadata?.documents_url ? (
                      <a
                        href={selected.metadata.documents_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="projects-btn"
                        style={{ textDecoration: "none" }}
                      >
                        Avaa Hilma / tarjousasiakirjat
                      </a>
                    ) : null}
                  </div>
                </div>
              </>
            ) : null}

            {selected.metadata?.contact_persons && selected.metadata.contact_persons.length > 0 ? (
              <>
                <hr className="projects-hr" />
                <p style={{ marginBottom: 8 }}>
                  <strong>Yhteyshenkilöt</strong>
                </p>
                {selected.metadata.contact_persons.map((contact, i) => (
                  <p key={i}>
                    {contact.name}
                    {contact.title ? `, ${contact.title}` : ''}
                    {contact.phone ? (
                      <>
                        {' — '}
                        <a href={`tel:${contact.phone}`}>{contact.phone}</a>
                      </>
                    ) : null}
                    {contact.email ? (
                      <>
                        {' — '}
                        <a href={`mailto:${contact.email}`}>{contact.email}</a>
                      </>
                    ) : null}
                  </p>
                ))}
              </>
            ) : null}

            {/*
              * Hankkeeseen liittyvät yritykset joilla ei ole omaa saraketta -
              * esimerkiksi talotekniikkaurakoitsija. Ilman tätä tieto olisi
              * vain kirjoitettu kantaan eikä näkyisi missään.
              */}

            {selected.additional_info ? (
              <>
                <hr className="projects-hr" />
                <p style={{ marginBottom: 6 }}>
                  <strong>Lisätietoja:</strong>
                </p>
                <p className="projects-pre">{selected.additional_info}</p>
              </>
            ) : null}
          </div>
        </div>
      )}

      {watchOpen && (
        <div
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeWatch()
          }}
          className="projects-modalBackdrop"
        >
          <div className="projects-modal" style={{ maxWidth: 560 }}>
            <div className="projects-modalTop">
              <div>
                <h2 className="projects-modalTitle">Tallenna hakuvahti</h2>
                <div className="projects-modalSub">Saat sähköpostin uusista hankkeista valituilla suodattimilla.</div>
              </div>

              <button className="projects-btn" onClick={closeWatch}>
                Sulje
              </button>
            </div>

            <hr className="projects-hr" />

            <div className="projects-modalGrid" style={{ gridTemplateColumns: '1fr', gap: 12 }}>
              <div>
                <label className="projects-label">Hakuvahtin nimi</label>
                <input
                  className="projects-input"
                  value={watchName}
                  onChange={(e) => setWatchName(e.target.value)}
                  placeholder="Esim. Uusimaa – Suunnittelu"
                />
              </div>

              <div>
                <label className="projects-label">Lähetysväli</label>
                <select
                  className="projects-select"
                  value={watchFrequency}
                  onChange={(e) => setWatchFrequency(e.target.value as 'daily' | 'weekly')}
                >
                  <option value="weekly">Viikoittain</option>
                  <option value="daily">Päivittäin</option>
                </select>
              </div>

              {watchError && <div style={{ color: '#b91c1c', fontSize: 14 }}>{watchError}</div>}
              {watchSuccess && <div style={{ color: '#15803d', fontSize: 14 }}>{watchSuccess}</div>}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className="projects-btn" onClick={closeWatch} disabled={watchSaving}>
                  Peruuta
                </button>
                <button className="projects-btn" onClick={saveWatch} disabled={watchSaving} style={{ fontWeight: 700 }}>
                  {watchSaving ? 'Tallennetaan…' : 'Tallenna'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}