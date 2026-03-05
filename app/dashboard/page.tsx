'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

type Project = {
  id: string
  name: string
  city: string
  region: string | null
  phase: string
  is_public: boolean

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
  created_at?: string | null
}

const FINNISH_REGIONS = [
  'Ahvenanmaa',
  'Etelä-Karjala',
  'Etelä-Pohjanmaa',
  'Etelä-Savo',
  'Kainuu',
  'Kanta-Häme',
  'Keski-Pohjanmaa',
  'Keski-Suomi',
  'Kymenlaakso',
  'Lappi',
  'Pirkanmaa',
  'Pohjanmaa',
  'Pohjois-Karjala',
  'Pohjois-Pohjanmaa',
  'Pohjois-Savo',
  'Päijät-Häme',
  'Satakunta',
  'Uusimaa',
  'Varsinais-Suomi',
]

const PHASE_OPTIONS = ['Suunnittelussa', 'Rakentaminen aloitettu'] as const

function onlyDigits(value: string) {
  return (value || '').replace(/[^\d]/g, '')
}

function formatThousandsFI(value: string) {
  if (!value) return ''
  const n = Number(value)
  if (!Number.isFinite(n)) return ''
  return new Intl.NumberFormat('fi-FI', { maximumFractionDigits: 0 }).format(n)
}

function digitsToNumberOrNull(value: string) {
  const digits = onlyDigits(value)
  if (!digits) return null
  const n = Number(digits)
  return Number.isFinite(n) ? n : null
}

/** Input with suffix on right side */
function SuffixInput(props: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  suffix: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
}) {
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <input
        className="dashInput"
        inputMode={props.inputMode}
        placeholder={props.placeholder}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        style={{ paddingRight: 52 }}
      />
      <span
        style={{
          position: 'absolute',
          right: 12,
          top: '50%',
          transform: 'translateY(-50%)',
          color: '#6b7280',
          fontSize: 13,
          pointerEvents: 'none',
          userSelect: 'none',
          fontWeight: 800,
        }}
      >
        {props.suffix}
      </span>
    </div>
  )
}

function formatSupabaseError(error: any) {
  return [error?.message, error?.details, error?.hint, error?.code].filter(Boolean).join(' | ')
}

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [filterQ, setFilterQ] = useState('')
  const [filterRegion, setFilterRegion] = useState('')
  const [filterPhase, setFilterPhase] = useState('')
  const [filterVisibility, setFilterVisibility] = useState<'all' | 'public' | 'hidden'>('all')

  const emptyForm = {
    name: '',
    location: '',
    region: '',
    city: '',
    phase: PHASE_OPTIONS[0],
    is_public: true,

    developer: '',
    builder: '',
    property_type: '',

    apartments: '',
    floor_area: '',
    estimated_cost: '',
    construction_start: '',

    structural_design: '',
    hvac_design: '',
    electrical_design: '',
    architectural_design: '',
    geotechnical_design: '',
    earthworks_contractor: '',
    additional_info: '',
  }

  const [form, setForm] = useState<any>(emptyForm)

  const apartmentsDisplay = useMemo(() => formatThousandsFI(onlyDigits(form.apartments)), [form.apartments])
  const floorAreaDisplay = useMemo(() => formatThousandsFI(onlyDigits(form.floor_area)), [form.floor_area])
  const estimatedCostDisplay = useMemo(
    () => formatThousandsFI(onlyDigits(form.estimated_cost)),
    [form.estimated_cost]
  )

  useEffect(() => {
    fetchProjects()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function showErrorUI(prefix: string, error: any) {
    const msg = formatSupabaseError(error) || 'Tuntematon virhe'
    console.log(prefix, error)
    setSubmitError(msg)
    alert(`${prefix}: ${msg}`)
  }

  async function fetchProjects() {
    setLoading(true)
    setSubmitError(null)

    const res1 = await supabase.from('projects').select('*').order('created_at', { ascending: false })
    if (!res1.error) {
      setProjects((res1.data as Project[]) || [])
      setLoading(false)
      return
    }

    const res2 = await supabase.from('projects').select('*')
    if (res2.error) {
      showErrorUI('Virhe haussa', res2.error)
      setProjects([])
    } else {
      setProjects((res2.data as Project[]) || [])
    }

    setLoading(false)
  }

  function buildGeocodeQuery() {
    const parts = [(form.location || '').trim(), (form.city || '').trim(), (form.region || '').trim(), 'Finland'].filter(
      Boolean
    )
    return parts.join(', ')
  }

  async function geocodeAddress(query: string) {
    if (!query) return { lat: null as number | null, lon: null as number | null }
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`
      const res = await fetch(url, { headers: { 'Accept-Language': 'fi,en;q=0.8' } })
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0 && data[0]?.lat && data[0]?.lon) {
        return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) }
      }
      return { lat: null, lon: null }
    } catch (err) {
      console.error('Geocoding error:', err)
      return { lat: null, lon: null }
    }
  }

  function setDigitsField(field: 'apartments' | 'floor_area' | 'estimated_cost', raw: string) {
    setForm((prev: any) => ({ ...prev, [field]: onlyDigits(raw) }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)

    const q1 = buildGeocodeQuery()
    let coords = await geocodeAddress(q1)

    if ((coords.lat == null || coords.lon == null) && (form.city || '').trim()) {
      coords = await geocodeAddress(`${(form.city || '').trim()}, Finland`)
    }
    if ((coords.lat == null || coords.lon == null) && (form.region || '').trim()) {
      coords = await geocodeAddress(`${(form.region || '').trim()}, Finland`)
    }

    if (coords.lat == null || coords.lon == null) {
      setSubmitError(`Osoitetta ei löytynyt kartalta. Lisää tarkempi osoite.\nHaku: "${q1}"`)
      return
    }

    const payload = {
      ...form,
      region: form.region?.trim() ? form.region.trim() : null,
      city: form.city?.trim() ? form.city.trim() : '',
      phase: form.phase?.trim() ? form.phase.trim() : PHASE_OPTIONS[0],

      apartments: digitsToNumberOrNull(form.apartments),
      floor_area: digitsToNumberOrNull(form.floor_area),
      estimated_cost: digitsToNumberOrNull(form.estimated_cost),

      construction_start: form.construction_start?.trim() ? form.construction_start.trim() : null,
      latitude: coords.lat,
      longitude: coords.lon,
    }

    if (editingId) {
      const { error } = await supabase.from('projects').update(payload).eq('id', editingId)
      if (error) return showErrorUI('Päivitys epäonnistui', error)

      setEditingId(null)
      setForm(emptyForm)
      await fetchProjects()
      return
    }

    const { error } = await supabase.from('projects').insert([payload])
    if (error) return showErrorUI('Lisäys epäonnistui', error)

    setForm(emptyForm)
    await fetchProjects()
  }

  async function togglePublic(id: string, current: boolean) {
    setSubmitError(null)
    const { error } = await supabase.from('projects').update({ is_public: !current }).eq('id', id)
    if (error) return showErrorUI('Näkyvyyden vaihto epäonnistui', error)
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, is_public: !current } : p)))
  }

  async function deleteProject(id: string) {
    setSubmitError(null)
    if (!confirm('Poistetaanko projekti?')) return
    const { error } = await supabase.from('projects').delete().eq('id', id)
    if (error) return showErrorUI('Poisto epäonnistui', error)
    setProjects((prev) => prev.filter((p) => p.id !== id))
  }

  function startEdit(project: Project) {
    setSubmitError(null)
    setEditingId(project.id)
    setForm({
      ...project,
      region: project.region || '',
      phase: PHASE_OPTIONS.includes(project.phase as any) ? project.phase : PHASE_OPTIONS[0],
      apartments: project.apartments != null ? String(project.apartments) : '',
      floor_area: project.floor_area != null ? String(project.floor_area) : '',
      estimated_cost: project.estimated_cost != null ? String(project.estimated_cost) : '',
      construction_start: project.construction_start ?? '',
      location: project.location ?? '',
      developer: project.developer ?? '',
      builder: project.builder ?? '',
      property_type: project.property_type ?? '',
      structural_design: project.structural_design ?? '',
      hvac_design: project.hvac_design ?? '',
      electrical_design: project.electrical_design ?? '',
      architectural_design: project.architectural_design ?? '',
      geotechnical_design: project.geotechnical_design ?? '',
      earthworks_contractor: project.earthworks_contractor ?? '',
      additional_info: project.additional_info ?? '',
    })
  }

  function cancelEdit() {
    setSubmitError(null)
    setEditingId(null)
    setForm(emptyForm)
  }

  if (loading) return <p style={{ padding: 20 }}>Ladataan...</p>

  return (
    <div className="dashPage">
      <div className="dashWrap">
        <h1 className="dashH1">Dashboard – Hallinta</h1>

        {/* FORM */}
        <div className="dashCard" style={{ marginBottom: 18 }}>
          <h2 className="dashTitle">{editingId ? 'Muokkaa projektia' : 'Lisää projekti'}</h2>

          {submitError && <div className="dashError">Tallennusvirhe: {submitError}</div>}

          <form onSubmit={handleSubmit}>
            <div className="dashGrid twoCols">
              <div>
                <label className="dashLabel">Projektin nimi</label>
                <input
                  className="dashInput"
                  placeholder="Esim. As Oy Testikatu 1"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div>
                <label className="dashLabel">Sijainti / osoite</label>
                <input
                  className="dashInput"
                  placeholder="Esim. Testikatu 1"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </div>

              <div>
                <label className="dashLabel">Maakunta</label>
                <select
                  className="dashInput"
                  value={form.region}
                  onChange={(e) => setForm({ ...form, region: e.target.value })}
                >
                  <option value="">(ei pakollinen)</option>
                  {FINNISH_REGIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="dashLabel">Kaupunki</label>
                <input
                  className="dashInput"
                  placeholder="Esim. Helsinki"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </div>

              <div>
                <label className="dashLabel">Vaihe</label>
                <select
                  className="dashInput"
                  value={form.phase}
                  onChange={(e) => setForm({ ...form, phase: e.target.value })}
                >
                  {PHASE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="dashLabel">Näkyvyys</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                  <input
                    type="checkbox"
                    checked={form.is_public}
                    onChange={(e) => setForm({ ...form, is_public: e.target.checked })}
                  />
                  <span style={{ fontWeight: 900, color: form.is_public ? '#166534' : '#7f1d1d' }}>
                    {form.is_public ? '🟢 Julkinen' : '🔒 Piilotettu'}
                  </span>
                </label>
              </div>

              <div>
                <label className="dashLabel">🏗️ Rakennuttaja</label>
                <input
                  className="dashInput"
                  value={form.developer}
                  onChange={(e) => setForm({ ...form, developer: e.target.value })}
                />
              </div>

              <div>
                <label className="dashLabel">👷 Rakennusliike</label>
                <input
                  className="dashInput"
                  value={form.builder}
                  onChange={(e) => setForm({ ...form, builder: e.target.value })}
                />
              </div>

              <div>
                <label className="dashLabel">🏢 Kohdetyyppi</label>
                <input
                  className="dashInput"
                  value={form.property_type}
                  onChange={(e) => setForm({ ...form, property_type: e.target.value })}
                />
              </div>

              <div>
                <label className="dashLabel">🏠 Asuntoja</label>
                <SuffixInput
                  inputMode="numeric"
                  placeholder="0"
                  value={apartmentsDisplay}
                  onChange={(v) => setDigitsField('apartments', v)}
                  suffix="kpl"
                />
              </div>

              <div>
                <label className="dashLabel">📐 Kerrosala</label>
                <SuffixInput
                  inputMode="numeric"
                  placeholder="0"
                  value={floorAreaDisplay}
                  onChange={(v) => setDigitsField('floor_area', v)}
                  suffix="m²"
                />
              </div>

              <div>
                <label className="dashLabel">💰 Arvioitu kustannus</label>
                <SuffixInput
                  inputMode="numeric"
                  placeholder="0"
                  value={estimatedCostDisplay}
                  onChange={(v) => setDigitsField('estimated_cost', v)}
                  suffix="€"
                />
              </div>

              <div>
                <label className="dashLabel">📅 Rakentamisen aloitus</label>
                <input
                  className="dashInput"
                  type="date"
                  value={form.construction_start}
                  onChange={(e) => setForm({ ...form, construction_start: e.target.value })}
                />
              </div>
            </div>

            <div className="dashDivider" />

            <div className="dashGrid twoCols">
              <div>
                <label className="dashLabel">Rakennesuunnittelu</label>
                <input
                  className="dashInput"
                  value={form.structural_design}
                  onChange={(e) => setForm({ ...form, structural_design: e.target.value })}
                />
              </div>
              <div>
                <label className="dashLabel">LVIA-suunnittelu</label>
                <input
                  className="dashInput"
                  value={form.hvac_design}
                  onChange={(e) => setForm({ ...form, hvac_design: e.target.value })}
                />
              </div>
              <div>
                <label className="dashLabel">Sähkösuunnittelu</label>
                <input
                  className="dashInput"
                  value={form.electrical_design}
                  onChange={(e) => setForm({ ...form, electrical_design: e.target.value })}
                />
              </div>
              <div>
                <label className="dashLabel">Arkkitehtisuunnittelu</label>
                <input
                  className="dashInput"
                  value={form.architectural_design}
                  onChange={(e) => setForm({ ...form, architectural_design: e.target.value })}
                />
              </div>
              <div>
                <label className="dashLabel">Pohjarakennesuunnittelu</label>
                <input
                  className="dashInput"
                  value={form.geotechnical_design}
                  onChange={(e) => setForm({ ...form, geotechnical_design: e.target.value })}
                />
              </div>
              <div>
                <label className="dashLabel">Maanrakentaja</label>
                <input
                  className="dashInput"
                  value={form.earthworks_contractor}
                  onChange={(e) => setForm({ ...form, earthworks_contractor: e.target.value })}
                />
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <label className="dashLabel">Lisätietoja</label>
              <textarea
                className="dashTextarea"
                value={form.additional_info}
                onChange={(e) => setForm({ ...form, additional_info: e.target.value })}
                placeholder="Vapaamuotoiset lisätiedot…"
              />
            </div>

            <div className="dashActions">
              <button type="submit" className="btnPrimary">
                {editingId ? 'Päivitä projekti' : 'Lisää projekti'}
              </button>

              {editingId && (
                <button type="button" className="btnSecondary" onClick={cancelEdit}>
                  Peruuta
                </button>
              )}
            </div>
          </form>
        </div>

        {/* LIST */}
        <div className="dashCard">
          <h2 className="dashTitle">Projektit ({projects.length})</h2>
          <div className="dashFilters">
  <div>
    <label className="dashLabel">Haku</label>
    <input
      className="dashInput"
      placeholder="Hae nimen, kaupungin, rakennuttajan…"
      value={filterQ}
      onChange={(e) => setFilterQ(e.target.value)}
    />
  </div>

  <div>
    <label className="dashLabel">Maakunta</label>
    <select className="dashInput" value={filterRegion} onChange={(e) => setFilterRegion(e.target.value)}>
      <option value="">Kaikki</option>
      {FINNISH_REGIONS.map((r) => (
        <option key={r} value={r}>
          {r}
        </option>
      ))}
    </select>
  </div>

  <div>
    <label className="dashLabel">Vaihe</label>
    <select className="dashInput" value={filterPhase} onChange={(e) => setFilterPhase(e.target.value)}>
      <option value="">Kaikki</option>
      {PHASE_OPTIONS.map((p) => (
        <option key={p} value={p}>
          {p}
        </option>
      ))}
    </select>
  </div>

  <div>
    <label className="dashLabel">Näkyvyys</label>
    <select
      className="dashInput"
      value={filterVisibility}
      onChange={(e) => setFilterVisibility(e.target.value as any)}
    >
      <option value="all">Kaikki</option>
      <option value="public">Vain julkiset</option>
      <option value="hidden">Vain piilotetut</option>
    </select>
  </div>

  <button
    type="button"
    className="btnSecondary"
    onClick={() => {
      setFilterQ('')
      setFilterRegion('')
      setFilterPhase('')
      setFilterVisibility('all')
    }}
    style={{ alignSelf: 'end' }}
  >
    Tyhjennä
  </button>
</div>

          {projects
  .filter((p) => {
    if (filterRegion && (p.region || '') !== filterRegion) return false
    if (filterPhase && p.phase !== filterPhase) return false
    if (filterVisibility === 'public' && !p.is_public) return false
    if (filterVisibility === 'hidden' && p.is_public) return false

    const needle = filterQ.trim().toLowerCase()
    if (!needle) return true

    const hay = [
      p.name,
      p.city,
      p.region ?? '',
      p.phase,
      p.location ?? '',
      p.developer ?? '',
      p.builder ?? '',
      p.property_type ?? '',
      p.additional_info ?? '',
    ]
      .join(' ')
      .toLowerCase()

    return hay.includes(needle)
  })
  .map((p) => (
            <div key={p.id} className="dashRow">
              <div>
                <div className="dashRowTitle">{p.name}</div>
                <div className="dashRowMeta">
                  {(p.city || '') + (p.region ? ` • ${p.region}` : '') + ` • ${p.phase}`}
                </div>
                <div className="dashRowPub">{p.is_public ? '🟢 Julkinen' : '🔒 Piilotettu'}</div>
              </div>

              <div className="dashRowActions">
                <button className="btnSecondary" onClick={() => togglePublic(p.id, p.is_public)}>
                  {p.is_public ? 'Piilota' : 'Julkaise'}
                </button>
                <button className="btnSecondary" onClick={() => startEdit(p)}>
                  Muokkaa
                </button>
                <button
                  className="btnSecondary"
                  onClick={() => deleteProject(p.id)}
                  style={{ borderColor: '#fecaca', color: '#b91c1c' }}
                >
                  Poista
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ✅ TYYLIT TÄÄLLÄ (renderöityy varmasti) */}
      <style jsx global>{`
        .dashPage {
          padding: 20px;
        }
        .dashWrap {
          max-width: 980px;
          margin: 0 auto;
        }
        .dashH1 {
          margin: 0 0 14px 0;
          font-size: 22px;
          font-weight: 900;
          color: #111827;
        }
        .dashCard {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          padding: 16px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
        }
        .dashTitle {
          font-size: 18px;
          font-weight: 900;
          margin: 0 0 12px 0;
          color: #111827;
        }
        .dashError {
          margin: 10px 0 10px 0;
          padding: 12px;
          border: 1px solid #ffb4b4;
          background: #ffecec;
          color: #8a0000;
          border-radius: 12px;
          white-space: pre-wrap;
          font-weight: 800;
        }
        .dashGrid {
          display: grid;
          gap: 12px;
        }
        .twoCols {
          grid-template-columns: 1fr 1fr;
        }
        @media (max-width: 860px) {
          .twoCols {
            grid-template-columns: 1fr;
          }
        }
        .dashLabel {
          display: block;
          font-size: 13px;
          font-weight: 800;
          color: #374151;
          margin-bottom: 6px;
        }
        .dashInput,
        .dashTextarea {
          width: 100%;
          border: 1px solid #d1d5db;
          background: #ffffff;
          border-radius: 12px;
          padding: 12px 12px;
          font-size: 15px;
          outline: none;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .dashTextarea {
          min-height: 110px;
          resize: vertical;
        }
        .dashInput:focus,
        .dashTextarea:focus {
          border-color: #111827;
          box-shadow: 0 0 0 3px rgba(17, 24, 39, 0.12);
        }
        .dashActions {
          margin-top: 14px;
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        .btnPrimary {
          background: #111827;
          color: #ffffff;
          border: 1px solid #111827;
          border-radius: 12px;
          padding: 12px 14px;
          font-weight: 900;
          cursor: pointer;
        }
        .btnPrimary:hover {
          filter: brightness(0.95);
        }
        .btnSecondary {
          background: #ffffff;
          color: #111827;
          border: 1px solid #d1d5db;
          border-radius: 12px;
          padding: 12px 14px;
          font-weight: 900;
          cursor: pointer;
        }
        .btnSecondary:hover {
          background: #f9fafb;
        }
        .dashDivider {
          height: 1px;
          background: #e5e7eb;
          margin: 16px 0;
        }
        .dashRow {
          border-top: 1px solid #e5e7eb;
          padding-top: 12px;
          margin-top: 12px;
          display: flex;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          align-items: flex-start;
        }
        .dashRowTitle {
          font-weight: 900;
          color: #111827;
        }
        .dashRowMeta {
          font-size: 13px;
          color: #6b7280;
          margin-top: 4px;
        }
        .dashRowPub {
          font-size: 13px;
          margin-top: 6px;
          font-weight: 900;
        }
        .dashRowActions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items: center;
        }
      `}</style>
    </div>
  )
}