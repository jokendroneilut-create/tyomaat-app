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

/** Kevyt mobile-aware: käytä näytön leveyttä (ei user-agentia) */
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

export default function Projects() {
  const isMobile = useIsMobile(768)
  const pageSize = isMobile ? 15 : 30
  const mapHeight = isMobile ? 360 : 520

  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  // Filtterit
  const [q, setQ] = useState('')
  const [region, setRegion] = useState<string>('') // '' = kaikki
  const [city, setCity] = useState<string>('') // '' = kaikki
  const [phase, setPhase] = useState<string>('') // '' = kaikki
  const [propertyType, setPropertyType] = useState<string>('') // '' = kaikki

  // listan sivutus / “lataa lisää”
  const [visibleCount, setVisibleCount] = useState(pageSize)

  // modal
  const [selected, setSelected] = useState<Project | null>(null)

  // kartta rajaa listaa
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

  // Kartan näkymärajauksen suodatus listaan
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

  // Kun filtteri vaihtuu tai mobiili/desktop vaihtuu, aloita lista alusta
  useEffect(() => {
    setVisibleCount(pageSize)
  }, [q, region, city, phase, propertyType, limitToMapView, mapBounds, pageSize])

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
    <div className="projects-page">
      {/* Leaflet z-index varmistus */}
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

      {/* Filtterit */}
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

          <div>
            <label className="projects-label">Maakunta</label>
            <select
              className="projects-select"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
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
            <label className="projects-label">Kaupunki</label>
            <select
              className="projects-select"
              value={city}
              onChange={(e) => setCity(e.target.value)}
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
            <label className="projects-label">Vaihe</label>
            <select
              className="projects-select"
              value={phase}
              onChange={(e) => setPhase(e.target.value)}
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
            <label className="projects-label">Kohdetyyppi</label>
            <select
              className="projects-select"
              value={propertyType}
              onChange={(e) => setPropertyType(e.target.value)}
            >
              <option value="">Kaikki</option>
              {propertyTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <button className="projects-clear" onClick={clearFilters}>
            Tyhjennä
          </button>
        </div>
      </div>

      {/* Kartta-rajauksen toggle + laskuri */}
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
          Karttanäkymässä <strong>{inViewProjects.length}</strong> / suodatetuista{' '}
          {filteredProjects.length} (yhteensä {projects.length})
        </div>
      </div>

      {/* Kartta */}
      <div className="projects-map" style={{ height: mapHeight }}>
        <MapClient projects={filteredProjects} onBoundsChange={setMapBounds} />
      </div>

      {/* Lista */}
      <div className="projects-list">
        {inViewProjects.length === 0 && (
          <p>Ei projekteja karttanäkymässä / valituilla filttereillä.</p>
        )}

        {inViewProjects.length > 0 && (
          <>
            {/* Desktop-table */}
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
                  <div className="projects-name">{p.name}</div>
                  <div>{p.city}</div>
                  <div>{p.region || '-'}</div>
                  <div>{p.phase}</div>
                  <div className="projects-actions">
                    <button className="projects-btn" onClick={() => setSelected(p)}>
                      Näytä tiedot
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Mobile-cards */}
            <div className="projects-cards">
              {visibleProjects.map((p) => (
                <div key={p.id} className="projects-cardRow">
                  <div className="projects-cardTitle">{p.name}</div>
                  <div className="projects-cardMeta">
                    {p.city} • {p.region || '-'} • {p.phase}
                  </div>
                  <button className="projects-btn projects-btnFull" onClick={() => setSelected(p)}>
                    Näytä tiedot
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {inViewProjects.length > visibleCount && (
          <div className="projects-more">
            <button className="projects-moreBtn" onClick={() => setVisibleCount((c) => c + pageSize)}>
              Lataa lisää (+{pageSize})
            </button>
          </div>
        )}
      </div>

      {/* MODAL */}
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
                  {selected.city} • {selected.region || '-'} • {selected.phase}
                </div>
              </div>

              <button className="projects-btn" onClick={closeModal}>
                Sulje
              </button>
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

            <hr className="projects-hr" />

            <div className="projects-modalGrid">
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
                <hr className="projects-hr" />
                <p style={{ marginBottom: 6 }}>
                  <strong>Lisätietoja:</strong>
                </p>
                <p className="projects-pre">{selected.additional_info}</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}