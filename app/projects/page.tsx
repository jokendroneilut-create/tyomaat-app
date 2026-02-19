'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Map from './Map'

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

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  // ✅ Filtterit
  const [q, setQ] = useState('')
  const [region, setRegion] = useState<string>('') // '' = kaikki
  const [city, setCity] = useState<string>('') // '' = kaikki
  const [phase, setPhase] = useState<string>('') // '' = kaikki
  const [propertyType, setPropertyType] = useState<string>('') // '' = kaikki

  useEffect(() => {
    const fetchProjects = async () => {
      setLoading(true)

      // Haetaan tarvittavat kentät (voit pitää myös select('*'), mutta tämä on kevyempi)
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
    // Jos maakunta valittu, näytä city-dropdownissa vain sen maakunnan kaupungit
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

  if (loading) return <p style={{ padding: 20 }}>Ladataan...</p>

  return (
    <div style={{ padding: 20, maxWidth: 1100, margin: '0 auto' }}>
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
          <label style={{ display: 'block', fontSize: 12, marginBottom: 6 }}>
            Haku
          </label>
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
          <label style={{ display: 'block', fontSize: 12, marginBottom: 6 }}>
            Maakunta
          </label>
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
          <label style={{ display: 'block', fontSize: 12, marginBottom: 6 }}>
            Kaupunki
          </label>
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
          <label style={{ display: 'block', fontSize: 12, marginBottom: 6 }}>
            Vaihe
          </label>
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
          <label style={{ display: 'block', fontSize: 12, marginBottom: 6 }}>
            Kohdetyyppi
          </label>
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

      <p style={{ marginBottom: 16, color: '#555' }}>
        Näytetään <strong>{filteredProjects.length}</strong> / {projects.length} projektia
      </p>

      {/* 🗺 Kartta */}
      <Map projects={filteredProjects} />

      {/* 📋 Lista */}
      {filteredProjects.length === 0 && <p>Ei projekteja valituilla filttereillä.</p>}

      {filteredProjects.map((project) => (
        <div
          key={project.id}
          style={{
            border: '1px solid #ddd',
            padding: 20,
            marginBottom: 20,
            borderRadius: 10,
            background: '#fff',
          }}
        >
          <h2 style={{ marginBottom: 10 }}>{project.name}</h2>

          <p>
            <strong>Maakunta:</strong> {project.region || '-'}
          </p>
          <p>
            <strong>Sijainti:</strong> {project.location || '-'}
          </p>
          <p>
            <strong>Kaupunki:</strong> {project.city}
          </p>
          <p>
            <strong>Vaihe:</strong> {project.phase}
          </p>

          <hr style={{ margin: '15px 0' }} />

          <p>
            <strong>🏗️ Rakennuttaja:</strong> {project.developer || '-'}
          </p>
          <p>
            <strong>👷 Rakennusliike:</strong> {project.builder || '-'}
          </p>
          <p>
            <strong>🏢 Kohde:</strong> {project.property_type || '-'}
          </p>
          <p>
            <strong>🏠 Asuntoja:</strong> {project.apartments ?? '-'}
          </p>
          <p>
            <strong>📐 Kerrosala:</strong>{' '}
            {project.floor_area ? `${project.floor_area} m²` : '-'}
          </p>
          <p>
            <strong>💰 Arvioitu kustannus:</strong>{' '}
            {project.estimated_cost ? `${project.estimated_cost} €` : '-'}
          </p>
          <p>
            <strong>📅 Rakentamisen aloitus:</strong> {project.construction_start || '-'}
          </p>

          <hr style={{ margin: '15px 0' }} />

          <p>
            <strong>Rakennesuunnittelu:</strong> {project.structural_design || '-'}
          </p>
          <p>
            <strong>LVIA-suunnittelu:</strong> {project.hvac_design || '-'}
          </p>
          <p>
            <strong>Sähkösuunnittelu:</strong> {project.electrical_design || '-'}
          </p>
          <p>
            <strong>Arkkitehtisuunnittelu:</strong> {project.architectural_design || '-'}
          </p>
          <p>
            <strong>Pohjarakennesuunnittelu:</strong> {project.geotechnical_design || '-'}
          </p>
          <p>
            <strong>Maanrakentaja:</strong> {project.earthworks_contractor || '-'}
          </p>

          {project.additional_info && (
            <>
              <hr style={{ margin: '15px 0' }} />
              <p>
                <strong>Lisätietoja:</strong>
              </p>
              <p>{project.additional_info}</p>
            </>
          )}
        </div>
      ))}
    </div>
  )
}