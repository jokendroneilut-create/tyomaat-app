'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import MapClient from './MapClient'
import type { MapBounds } from './Map'

type Project = {
  id: string
  name: string
  city: string
  region: string | null
  phase: string
  location: string | null
  developer: string | null
  builder: string | null
  property_type: string | null
  apartments: number | null
  floor_area: number | null
  estimated_cost: number | null
  construction_start: string | null
  structural_design: string | null
  hvac_design: string | null
  electrical_design: string | null
  architectural_design: string | null
  geotechnical_design: string | null
  earthworks_contractor: string | null
  additional_info: string | null
  latitude: number | null
  longitude: number | null
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
    return (
      new Intl.NumberFormat('fi-FI', { maximumFractionDigits: 0 }).format(n) + ' €'
    )
  } catch {
    return `${n} €`
  }
}

function formatM2(n: number | null | undefined) {
  if (n == null) return '-'
  try {
    return (
      new Intl.NumberFormat('fi-FI', { maximumFractionDigits: 0 }).format(n) + ' m²'
    )
  } catch {
    return `${n} m²`
  }
}

const PAGE_SIZE = 30

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  // ✅ Filtterit
  const [q, setQ] = useState('')
  const [region, setRegion] = useState<string>('') // '' = kaikki
  const [city, setCity] = useState<string>('') // '' = kaikki
  const [phase, setPhase] = useState<string>('') // '' = kaikki
  const [propertyType, setPropertyType] = useState<string>('') // '' = kaikki

  // ✅ listan sivutus / “lataa lisää”
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  // ✅ modal
  const [selected, setSelected] = useState<Project | null>(null)

  // ✅ kartta rajaa listaa
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null)
  const [limitToMapView, setLimitToMapView] = useState(true)

  useEffect(() => {
    const fetchProjects = async () => {
      setLoading(true)

      const { data, error } = await supabase
        .from('projects')
        .select(
          `
          id, name, city, region, phase, location, developer, builder, property_type,
          apartments, floor_area, estimated_cost, construction_start,
          structural_design, hvac_design, electrical_design, architectural_design,
          geotechnical_design, earthworks_contractor, additional_info,
          latitude, longitude,
          is_public
        `
        )
        .eq('is_public', true)

      if (error) {
        console.error('Supabase error:', error)
        setProjects([])
      } else {
        setProjects((data as Project[]) || [])
      }

      setLoading(false)
    }

    fetchProjects()
  }, [])

  const regions = useMemo(() => uniqSorted(projects.map((p) => p.region)), [projects])

  const cities = useMemo(() => {
    const base = region ? projects.filter((p) => (p.region || '') === region) : projects
    return uniqSorted(base.map((p) => p.city))
  }, [projects, region])

  const phases = useMemo(() => uniqSorted(projects.map((p) => p.phase)), [projects])
  const propertyTypes = useMemo(
    () => uniqSorted(projects.map((p) => p.property_type)),
    [projects]
  )

  const filteredProjects = useMemo(() => {
    const needle = q.trim().toLowerCase()

    return projects.filter((p) => {
      if (region && (p.region || '') !== region) return false
      if (city && p.city !== city) return false
      if (phase && p.phase !== phase) return false
      if (propertyType && (p.property_type || '') !== propertyType) return false

      if (!needle) return true

      const haystack = [
        p.name,
        p.region ?? '',
        p.city,
        p.phase,
        p.location ?? '',
        p.developer ?? '',
        p.builder ?? '',
        p.property_type ?? '',
        p.additional_info ?? '',
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(needle)
    })
  }, [projects, q, region, city, phase, propertyType])

  // ✅ Kartan näkymärajauksen suodatus listaan
  const inViewProjects = useMemo(() => {
    if (!limitToMapView || !mapBounds) return filteredProjects

    const { south, west, north, east } = mapBounds
    return filteredProjects.filter((p) => {
      if (p.latitude == null || p.longitude == null) return false
      const lat = p.latitude
      const lon = p.longitude
      return lat >= south && lat <= north && lon >= west && lon <= east
    })
  }, [filteredProjects, limitToMapView, mapBounds])

  // Kun filtteri vaihtuu, aloita lista alusta
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [q, region, city, phase, propertyType, limitToMapView, mapBounds])

  const visibleProjects = useMemo(
    () => inViewProjects.slice(0, visibleCount),
    [inViewProjects, visibleCount]
  )

  const clearFilters = () => {
    setQ('')
    setRegion('')
    setCity('')
    setPhase('')
    setPropertyType('')
  }

  // Kun maakunta vaihtuu, ja valittu kaupunki ei enää ole saatavilla, tyhjennä kaupunki
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

  if (loading) return <p style={{ padding: 20 }}>Ladataan...</p>

  return (
    <div style={{ padding: 20, maxWidth: 1100, margin: '0 auto' }}>
      {/* ✅ Pakota Leaflet aina taakse (varmistus) */}
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

      <h1 style={{ marginBottom: 12 }}>Työmaat</h1>

      {/* 🔎 Filtterit */}
      <div
        style={{
          border: '1px solid #e5e5e5',
          padding: 14,
          borderRadius: 12,
          background: '#fff',
          marginBottom: 18,
          display: 'grid',
          gridTemplateColumns: '1.3fr 1fr 1fr 1fr 1fr auto',
          gap: 10,
          alignItems: 'end',
        }}
      >
        <div>
          <label style={{ display: 'block', fontSize: 12, marginBottom: 6 }}>Haku</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Hae nimen, maakunnan, kaupungin, rakennuttajan…"
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #ddd',
              borderRadius: 10,
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 12, marginBottom: 6 }}>Maakunta</label>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #ddd',
              borderRadius: 10,
              background: '#fff',
            }}
          >
            <option value="">Kaikki</option>
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 12, marginBottom: 6 }}>Kaupunki</label>
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #ddd',
              borderRadius: 10,
              background: '#fff',
            }}
          >
            <option value="">Kaikki</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 12, marginBottom: 6 }}>Vaihe</label>
          <select
            value={phase}
            onChange={(e) => setPhase(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #ddd',
              borderRadius: 10,
              background: '#fff',
            }}
          >
            <option value="">Kaikki</option>
            {phases.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 12, marginBottom: 6 }}>Kohdetyyppi</label>
          <select
            value={propertyType}
            onChange={(e) => setPropertyType(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #ddd',
              borderRadius: 10,
              background: '#fff',
            }}
          >
            <option value="">Kaikki</option>
            {propertyTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={clearFilters}
          style={{
            padding: '10px 14px',
            border: '1px solid #ddd',
            borderRadius: 10,
            background: '#f7f7f7',
            cursor: 'pointer',
            height: 42,
          }}
        >
          Tyhjennä
        </button>
      </div>

      {/* ✅ Kartta-rajauksen toggle */}
      <div style={{ marginBottom: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={limitToMapView}
            onChange={(e) => setLimitToMapView(e.target.checked)}
          />
          Rajaa listaa kartan mukaan
        </label>

        <div style={{ marginLeft: 'auto', color: '#555' }}>
          Karttanäkymässä <strong>{inViewProjects.length}</strong> / suodatetuista{' '}
          {filteredProjects.length} (yhteensä {projects.length})
        </div>
      </div>

      {/* 🗺 Kartta */}
      
<MapClient projects={filteredProjects} onBoundsChange={setMapBounds} />      {/* 📋 TIIVIS LISTA + LATAA LISÄÄ */}
      <div style={{ marginTop: 16 }}>
        {inViewProjects.length === 0 && <p>Ei projekteja karttanäkymässä / valituilla filttereillä.</p>}

        {inViewProjects.length > 0 && (
          <div
            style={{
              border: '1px solid #e5e5e5',
              borderRadius: 12,
              background: '#fff',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.6fr 1fr 1fr 1fr auto',
                gap: 10,
                padding: '10px 12px',
                fontSize: 12,
                color: '#666',
                borderBottom: '1px solid #eee',
                background: '#fafafa',
              }}
            >
              <div>Nimi</div>
              <div>Kaupunki</div>
              <div>Maakunta</div>
              <div>Vaihe</div>
              <div />
            </div>

            {visibleProjects.map((p) => (
              <div
                key={p.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.6fr 1fr 1fr 1fr auto',
                  gap: 10,
                  padding: '12px',
                  borderBottom: '1px solid #f0f0f0',
                  alignItems: 'center',
                }}
              >
                <div style={{ fontWeight: 600, lineHeight: 1.25 }}>{p.name}</div>
                <div>{p.city}</div>
                <div>{p.region || '-'}</div>
                <div>{p.phase}</div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setSelected(p)}
                    style={{
                      padding: '8px 10px',
                      border: '1px solid #ddd',
                      borderRadius: 10,
                      background: '#fff',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Näytä tiedot
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {inViewProjects.length > visibleCount && (
          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              style={{
                padding: '10px 14px',
                border: '1px solid #ddd',
                borderRadius: 12,
                background: '#f7f7f7',
                cursor: 'pointer',
              }}
            >
              Lataa lisää (+{PAGE_SIZE})
            </button>
          </div>
        )}
      </div>

      {/* 🪟 MODAL: täydet tiedot */}
      {selected && (
        <div
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeModal()
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 18,
            zIndex: 9999, // ✅ aina kartan päälle
          }}
        >
          <div
            style={{
              width: 'min(860px, 100%)',
              maxHeight: '85vh',
              overflow: 'auto',
              background: '#fff',
              borderRadius: 14,
              padding: 18,
              border: '1px solid #eee',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <h2 style={{ margin: 0 }}>{selected.name}</h2>
                <div style={{ marginTop: 6, color: '#555' }}>
                  {selected.city} • {selected.region || '-'} • {selected.phase}
                </div>
              </div>

              <button
                onClick={closeModal}
                style={{
                  padding: '8px 10px',
                  border: '1px solid #ddd',
                  borderRadius: 10,
                  background: '#fff',
                  cursor: 'pointer',
                  height: 40,
                }}
              >
                Sulje
              </button>
            </div>

            <hr style={{ margin: '14px 0' }} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
                <p>
                  <strong>🏗️ Rakennuttaja:</strong> {selected.developer || '-'}
                </p>
                <p>
                  <strong>👷 Rakennusliike:</strong> {selected.builder || '-'}
                </p>
                <p>
                  <strong>🏢 Kohdetyyppi:</strong> {selected.property_type || '-'}
                </p>
              </div>

              <div>
                <p>
                  <strong>🏠 Asuntoja:</strong> {selected.apartments ?? '-'}
                </p>
                <p>
                  <strong>📐 Kerrosala:</strong> {formatM2(selected.floor_area)}
                </p>
                <p>
                  <strong>💰 Arvioitu kustannus:</strong> {formatEUR(selected.estimated_cost)}
                </p>
                <p>
                  <strong>📅 Rakentamisen aloitus:</strong> {selected.construction_start || '-'}
                </p>
              </div>
            </div>

            <hr style={{ margin: '14px 0' }} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <p>
                  <strong>Rakennesuunnittelu:</strong> {selected.structural_design || '-'}
                </p>
                <p>
                  <strong>LVIA-suunnittelu:</strong> {selected.hvac_design || '-'}
                </p>
                <p>
                  <strong>Sähkösuunnittelu:</strong> {selected.electrical_design || '-'}
                </p>
              </div>

              <div>
                <p>
                  <strong>Arkkitehtisuunnittelu:</strong> {selected.architectural_design || '-'}
                </p>
                <p>
                  <strong>Pohjarakennesuunnittelu:</strong> {selected.geotechnical_design || '-'}
                </p>
                <p>
                  <strong>Maanrakentaja:</strong> {selected.earthworks_contractor || '-'}
                </p>
              </div>
            </div>

            {selected.additional_info && (
              <>
                <hr style={{ margin: '14px 0' }} />
                <p style={{ marginBottom: 6 }}>
                  <strong>Lisätietoja:</strong>
                </p>
                <p style={{ whiteSpace: 'pre-wrap', marginTop: 0 }}>{selected.additional_info}</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}