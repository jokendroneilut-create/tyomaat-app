'use client'

import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, useMapEvents, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import L from 'leaflet'
import 'leaflet.markercluster'
import type { ZoomTarget } from './MapClient'
import { normalizeLegacyPhase, type PhaseKey } from '@/lib/projects/phases'

type Project = {
  id: string
  name: string
  region?: string | null
  city: string
  phase: string
  location?: string | null
  developer?: string | null
  builder?: string | null
  property_type?: string | null
  construction_start?: string | null

  latitude?: number | string | null
  longitude?: number | string | null

  lat?: number | string | null
  lng?: number | string | null
  owner_id?: string | null
}

export type MapBounds = {
  south: number
  west: number
  north: number
  east: number
}

/*
 * Karttamerkin väri perustuu kanoniseen vaiheavaimeen (lib/projects/phases.ts)
 * raa'an tekstin osamerkkijonohaun sijaan — muuten esim. "Rakennuslupa"
 * täsmäisi vahingossa samaan "käynnissä"-hakuun kuin "Rakenteilla".
 */
const PHASE_MARKER_CLASS: Record<PhaseKey, string> = {
  idea: 'marker--planning',
  zoning: 'marker--planning',
  planning: 'marker--planning',
  permit: 'marker--tender',
  tender: 'marker--tender',
  contract_awarded: 'marker--active',
  construction: 'marker--active',
  nearing_completion: 'marker--done',
  completed: 'marker--done',
  cancelled: 'marker--default',
}

function phaseClass(phase: string) {
  const key = normalizeLegacyPhase(phase)
  return key ? PHASE_MARKER_CLASS[key] : 'marker--default'
}

function ownerClass(ownerId?: string | null, currentUserId?: string | null) {
  if (!ownerId) return 'marker--unassigned'
  if (currentUserId && ownerId === currentUserId) return 'marker--mine'
  return 'marker--team'
}

function makeIcon(className: string) {
  return L.divIcon({
    className: `marker-dot ${className}`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -8],
  })
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

function BoundsReporter({ onBoundsChange }: { onBoundsChange?: (b: MapBounds) => void }) {
  const map = useMapEvents({
    moveend: () => {
      const b = map.getBounds()
      onBoundsChange?.({
        south: b.getSouth(),
        west: b.getWest(),
        north: b.getNorth(),
        east: b.getEast(),
      })
    },
    zoomend: () => {
      const b = map.getBounds()
      onBoundsChange?.({
        south: b.getSouth(),
        west: b.getWest(),
        north: b.getNorth(),
        east: b.getEast(),
      })
    },
  })

  useEffect(() => {
    const b = map.getBounds()
    onBoundsChange?.({
      south: b.getSouth(),
      west: b.getWest(),
      north: b.getNorth(),
      east: b.getEast(),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}

function FlyTo({ target }: { target?: ZoomTarget }) {
  const map = useMap()

  useEffect(() => {
    if (!target) return
    map.flyTo([target.lat, target.lng], 13, { duration: 0.8 })
  }, [target, map])

  return null
}

/*
 * Popup rakennetaan DOM-elementtinä vasta kun se avataan (bindPopup saa
 * funktion), jolloin 3862 hankkeelle ei koskaan luoda popup-sisältöä
 * ennakkoon. "Avaa hankekortti" -nappiin kiinnitetään oikea click-kuuntelija,
 * jossa hanke on suljettuna sulkeumassa (sama CustomEvent kuin ennen).
 */
function buildPopupEl(p: Project): HTMLElement {
  const wrap = document.createElement('div')
  wrap.style.minWidth = '220px'

  const title = document.createElement('div')
  title.style.cssText = 'font-weight:700;margin-bottom:6px'
  title.textContent = p.name
  wrap.appendChild(title)

  const body = document.createElement('div')
  body.style.cssText = 'font-size:13px;line-height:1.35'
  const row = (label: string, value?: string | null, mt = false) => {
    if (value == null || value === '') return
    const d = document.createElement('div')
    if (mt) d.style.marginTop = '6px'
    const b = document.createElement('strong')
    b.textContent = `${label}: `
    d.appendChild(b)
    d.appendChild(document.createTextNode(value))
    body.appendChild(d)
  }
  row('Maakunta', p.region || '-')
  row('Kaupunki', p.city || '-')
  row('Vaihe', p.phase || '-')
  row('Sijainti', p.location, true)
  row('Kohdetyyppi', p.property_type, true)
  row('Rakennuttaja', p.developer, true)
  row('Rakennusliike', p.builder, true)
  row('Aloitus', p.construction_start, true)
  wrap.appendChild(body)

  const actions = document.createElement('div')
  actions.style.cssText = 'margin-top:10px;display:flex;gap:8px'

  const openBtn = document.createElement('button')
  openBtn.type = 'button'
  openBtn.textContent = 'Avaa hankekortti'
  openBtn.style.cssText =
    'flex:1;text-align:center;padding:6px 8px;background:#2563eb;color:white;border-radius:6px;border:none;font-size:12px;font-weight:600;cursor:pointer'
  openBtn.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('open-project-from-map', { detail: p }))
  })
  actions.appendChild(openBtn)

  const feedback = document.createElement('button')
  feedback.type = 'button'
  feedback.textContent = 'Anna palautetta'
  feedback.style.cssText =
    'flex:1;text-align:center;padding:6px 8px;background:#e5e7eb;color:#111827;border-radius:6px;border:none;font-size:12px;font-weight:600;cursor:pointer'
  feedback.addEventListener('click', () => {
    // Avaa sovelluksen sisäinen palauteluukku (FeedbackModal kuuntelee tätä).
    window.dispatchEvent(
      new CustomEvent('open-feedback', {
        detail: {
          context: 'Hankepalaute',
          projectId: p.id,
          projectName: p.name,
        },
      }),
    )
  })
  actions.appendChild(feedback)

  wrap.appendChild(actions)
  return wrap
}

/*
 * Klusterikerros: kaikki markerit lisätään yhteen L.markerClusterGroupiin,
 * joka ryhmittää lähekkäiset pisteet yhdeksi palloksi. Näin kartalla on
 * kerrallaan vain kymmeniä DOM-elementtejä tuhansien sijaan, ja panorointi/
 * zoom pysyy sujuvana myös tuhansilla hankkeilla. chunkedLoading pilkkoo
 * markerien lisäyksen, jottei UI jäädy alkulatauksessa.
 */
function ClusterLayer({
  points,
  currentUserId,
  teamModeEnabled,
}: {
  points: { p: Project; lat: number | null; lng: number | null }[]
  currentUserId?: string | null
  teamModeEnabled?: boolean
}) {
  const map = useMap()

  useEffect(() => {
    const cluster = (L as any).markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 60,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
    })

    for (const { p, lat, lng } of points) {
      if (lat == null || lng == null) continue
      const ownerClassName = teamModeEnabled ? ownerClass(p.owner_id, currentUserId) : ''
      const icon = makeIcon(`${phaseClass(p.phase)} ${ownerClassName}`)
      const marker = L.marker([lat, lng], { icon })
      marker.bindPopup(() => buildPopupEl(p), { minWidth: 220 })
      cluster.addLayer(marker)
    }

    map.addLayer(cluster)
    return () => {
      map.removeLayer(cluster)
    }
  }, [map, points, currentUserId, teamModeEnabled])

  return null
}

export default function Map({
  projects,
  onBoundsChange,
  zoomTo,
  currentUserId,
  teamModeEnabled,
}: {
  projects: Project[]
  onBoundsChange?: (b: MapBounds) => void
  zoomTo?: ZoomTarget
  currentUserId?: string | null
teamModeEnabled?: boolean
}) {
  useEffect(() => {
    delete (L.Icon.Default.prototype as any)._getIconUrl
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    })
  }, [])

  const projectsWithCoords = useMemo(() => {
    return projects
      .map((p) => {
        const { lat, lng } = getCoords(p)
        return { p, lat, lng }
      })
      .filter((x) => x.lat != null && x.lng != null)
  }, [projects])

  const defaultCenter: [number, number] = [60.1699, 24.9384]

  return (
    <div style={{ position: 'relative', zIndex: 0 }}>
      <MapContainer
        center={defaultCenter}
        zoom={6}
        style={{
          height: 520,
          width: '100%',
          borderRadius: 12,
          overflow: 'hidden',
          zIndex: 0,
        }}
      >
        <BoundsReporter onBoundsChange={onBoundsChange} />
        <FlyTo target={zoomTo} />

        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />

        <ClusterLayer
          points={projectsWithCoords}
          currentUserId={currentUserId}
          teamModeEnabled={teamModeEnabled}
        />
      </MapContainer>
    </div>
      )
}