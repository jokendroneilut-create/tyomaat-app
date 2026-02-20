'use client'

import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

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

  // nykyinen schema
  latitude?: number | string | null
  longitude?: number | string | null

  // vanha/mahdollinen schema
  lat?: number | string | null
  lng?: number | string | null
}

export type MapBounds = {
  south: number
  west: number
  north: number
  east: number
}

function phaseClass(phase: string) {
  const p = (phase || '').toLowerCase()
  if (p.includes('suunn')) return 'marker--planning'
  if (p.includes('käynn') || p.includes('rakenn')) return 'marker--active'
  if (p.includes('valmis') || p.includes('valmist')) return 'marker--done'
  if (p.includes('kilpail') || p.includes('hank')) return 'marker--tender'
  return 'marker--default'
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
  // tue sekä uusia että vanhoja kenttiä
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

export default function Map({
  projects,
  onBoundsChange,
}: {
  projects: Project[]
  onBoundsChange?: (b: MapBounds) => void
}) {
  useEffect(() => {
    // varalla (vaikka käytetään divIconia)
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

        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />

        {projectsWithCoords.map(({ p, lat, lng }) => {
          const icon = makeIcon(phaseClass(p.phase))
          return (
            <Marker key={p.id} position={[lat as number, lng as number]} icon={icon}>
              <Popup>
                <div style={{ minWidth: 220 }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>{p.name}</div>

                  <div style={{ fontSize: 13, lineHeight: 1.35 }}>
                    <div>
                      <strong>Maakunta:</strong> {p.region || '-'}
                    </div>
                    <div>
                      <strong>Kaupunki:</strong> {p.city || '-'}
                    </div>
                    <div>
                      <strong>Vaihe:</strong> {p.phase || '-'}
                    </div>

                    {p.location ? (
                      <div style={{ marginTop: 6 }}>
                        <strong>Sijainti:</strong> {p.location}
                      </div>
                    ) : null}

                    {p.property_type ? (
                      <div style={{ marginTop: 6 }}>
                        <strong>Kohdetyyppi:</strong> {p.property_type}
                      </div>
                    ) : null}

                    {p.developer ? (
                      <div style={{ marginTop: 6 }}>
                        <strong>Rakennuttaja:</strong> {p.developer}
                      </div>
                    ) : null}

                    {p.builder ? (
                      <div style={{ marginTop: 6 }}>
                        <strong>Rakennusliike:</strong> {p.builder}
                      </div>
                    ) : null}

                    {p.construction_start ? (
                      <div style={{ marginTop: 6 }}>
                        <strong>Aloitus:</strong> {p.construction_start}
                      </div>
                    ) : null}
                  </div>
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>
    </div>
  )
}