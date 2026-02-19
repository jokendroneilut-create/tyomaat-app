'use client'

import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
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
  latitude: number | null
  longitude: number | null
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

export default function MapClient({ projects }: { projects: Project[] }) {
  useEffect(() => {
    // Fix marker icons Next.js:ssä (varalla, vaikka käytetään divIconia)
    delete (L.Icon.Default.prototype as any)._getIconUrl
    L.Icon.Default.mergeOptions({
      iconRetinaUrl:
        'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
    })
  }, [])

  const projectsWithCoords = useMemo(
    () => projects.filter((p) => p.latitude != null && p.longitude != null),
    [projects]
  )

  // Jos haluat, voidaan myöhemmin auto-centeröidä kartta näihin projekteihin
  const defaultCenter: [number, number] = [60.1699, 24.9384]

  return (
    <div style={{ height: 520, marginBottom: 40 }}>
      <MapContainer
        center={defaultCenter}
        zoom={6}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />

        {projectsWithCoords.map((p) => {
          const icon = makeIcon(phaseClass(p.phase))

          return (
            <Marker
              key={p.id}
              position={[p.latitude as number, p.longitude as number]}
              icon={icon}
            >
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