'use client'

import { useEffect, useMemo, useState } from 'react'
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

// --------------------
// Number helpers
// --------------------
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

// --------------------
// Small input component with right-side suffix
// --------------------
function SuffixInput(props: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  suffix: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
}) {
  return (
    <div style={{ position: 'relative', width: '100%', marginTop: 8 }}>
      <input
        inputMode={props.inputMode}
        placeholder={props.placeholder}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        style={{
          width: '100%',
          padding: '8px 44px 8px 8px',
          border: '1px solid #ddd',
          borderRadius: 6,
        }}
      />
      <span
        style={{
          position: 'absolute',
          right: 10,
          top: '50%',
          transform: 'translateY(-50%)',
          color: '#666',
          fontSize: 13,
          pointerEvents: 'none',
          userSelect: 'none',
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

  // display formatting (thousand separators)
  const apartmentsDisplay = useMemo(
    () => formatThousandsFI(onlyDigits(form.apartments)),
    [form.apartments]
  )
  const floorAreaDisplay = useMemo(
    () => formatThousandsFI(onlyDigits(form.floor_area)),
    [form.floor_area]
  )
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

  // ✅ parempi geokoodaus
  function buildGeocodeQuery() {
    const parts = [
      (form.location || '').trim(),
      (form.city || '').trim(),
      (form.region || '').trim(),
      'Finland',
    ].filter(Boolean)

    return parts.join(', ')
  }

  async function geocodeAddress(query: string) {
    if (!query) return { lat: null as number | null, lon: null as number | null }

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
        query
      )}`

      const res = await fetch(url, {
        headers: {
          // Nominatim tykkää kun on "asialliset" headerit
          'Accept-Language': 'fi,en;q=0.8',
        },
      })

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

  // onChange: keep digits only
  function setDigitsField(field: 'apartments' | 'floor_area' | 'estimated_cost', raw: string) {
    setForm((prev: any) => ({
      ...prev,
      [field]: onlyDigits(raw),
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)

    // ✅ 1) Ensisijainen: location + city + region + Finland
    const q1 = buildGeocodeQuery()
    let coords = await geocodeAddress(q1)

    // ✅ 2) Fallback: jos location ei löydy, kokeile city + Finland
    if ((coords.lat == null || coords.lon == null) && (form.city || '').trim()) {
      const q2 = `${(form.city || '').trim()}, Finland`
      coords = await geocodeAddress(q2)
    }

    // ✅ 3) Fallback: jos city puuttuu, kokeile region + Finland
    if ((coords.lat == null || coords.lon == null) && (form.region || '').trim()) {
      const q3 = `${(form.region || '').trim()}, Finland`
      coords = await geocodeAddress(q3)
    }

    // ✅ Jos et halua sallia tallennusta ilman koordinaatteja, pidä tämä:
    // (Jos haluat sallia, kommentoi tämä if pois.)
    if (coords.lat == null || coords.lon == null) {
      setSubmitError(
        `Osoitetta ei löytynyt kartalta. Lisää tarkempi osoite.\nHaku: "${q1}"`
      )
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
    <div style={{ padding: 20, maxWidth: 900 }}>
      <h1>Dashboard – Hallinta</h1>

      <form onSubmit={handleSubmit} style={{ marginBottom: 40 }}>
        <h3>{editingId ? 'Muokkaa projektia' : 'Lisää projekti'}</h3>

        {submitError && (
          <div
            style={{
              marginTop: 10,
              marginBottom: 10,
              padding: 10,
              border: '1px solid #ffb4b4',
              background: '#ffecec',
              color: '#8a0000',
              borderRadius: 8,
              whiteSpace: 'pre-wrap',
            }}
          >
            Tallennusvirhe: {submitError}
          </div>
        )}

        <input
          placeholder="Projektin nimi"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          style={{ width: '100%', padding: 8, marginTop: 8 }}
        />

        <input
          placeholder="Sijainti / Osoite (esim. katuosoite)"
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
          style={{ width: '100%', padding: 8, marginTop: 8 }}
        />

        <select
          value={form.region}
          onChange={(e) => setForm({ ...form, region: e.target.value })}
          style={{ width: '100%', padding: 8, marginTop: 8 }}
        >
          <option value="">Valitse maakunta (ei pakollinen)</option>
          {FINNISH_REGIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>

        <input
          placeholder="Kaupunki"
          value={form.city}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
          style={{ width: '100%', padding: 8, marginTop: 8 }}
        />

        <select
          value={form.phase}
          onChange={(e) => setForm({ ...form, phase: e.target.value })}
          style={{ width: '100%', padding: 8, marginTop: 8 }}
        >
          {PHASE_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>

        <input
          placeholder="🏗️ Rakennuttaja"
          value={form.developer}
          onChange={(e) => setForm({ ...form, developer: e.target.value })}
          style={{ width: '100%', padding: 8, marginTop: 8 }}
        />

        <input
          placeholder="👷 Rakennusliike"
          value={form.builder}
          onChange={(e) => setForm({ ...form, builder: e.target.value })}
          style={{ width: '100%', padding: 8, marginTop: 8 }}
        />

        <input
          placeholder="🏢 Kohdetyyppi"
          value={form.property_type}
          onChange={(e) => setForm({ ...form, property_type: e.target.value })}
          style={{ width: '100%', padding: 8, marginTop: 8 }}
        />

        <SuffixInput
          inputMode="numeric"
          placeholder="🏠 Asuntoja"
          value={apartmentsDisplay}
          onChange={(v) => setDigitsField('apartments', v)}
          suffix="kpl"
        />

        <SuffixInput
          inputMode="numeric"
          placeholder="📐 Kerrosala"
          value={floorAreaDisplay}
          onChange={(v) => setDigitsField('floor_area', v)}
          suffix="m²"
        />

        <SuffixInput
          inputMode="numeric"
          placeholder="💰 Arvioitu kustannus"
          value={estimatedCostDisplay}
          onChange={(v) => setDigitsField('estimated_cost', v)}
          suffix="€"
        />

        <input
          type="date"
          value={form.construction_start}
          onChange={(e) => setForm({ ...form, construction_start: e.target.value })}
          style={{ width: '100%', padding: 8, marginTop: 8 }}
        />

        <input
          placeholder="Rakennesuunnittelu"
          value={form.structural_design}
          onChange={(e) => setForm({ ...form, structural_design: e.target.value })}
          style={{ width: '100%', padding: 8, marginTop: 8 }}
        />
        <input
          placeholder="LVIA-suunnittelu"
          value={form.hvac_design}
          onChange={(e) => setForm({ ...form, hvac_design: e.target.value })}
          style={{ width: '100%', padding: 8, marginTop: 8 }}
        />
        <input
          placeholder="Sähkösuunnittelu"
          value={form.electrical_design}
          onChange={(e) => setForm({ ...form, electrical_design: e.target.value })}
          style={{ width: '100%', padding: 8, marginTop: 8 }}
        />
        <input
          placeholder="Arkkitehtisuunnittelu"
          value={form.architectural_design}
          onChange={(e) => setForm({ ...form, architectural_design: e.target.value })}
          style={{ width: '100%', padding: 8, marginTop: 8 }}
        />
        <input
          placeholder="Pohjarakennesuunnittelu"
          value={form.geotechnical_design}
          onChange={(e) => setForm({ ...form, geotechnical_design: e.target.value })}
          style={{ width: '100%', padding: 8, marginTop: 8 }}
        />
        <input
          placeholder="Maanrakentaja"
          value={form.earthworks_contractor}
          onChange={(e) => setForm({ ...form, earthworks_contractor: e.target.value })}
          style={{ width: '100%', padding: 8, marginTop: 8 }}
        />

        <textarea
          placeholder="Lisätietoja"
          value={form.additional_info}
          onChange={(e) => setForm({ ...form, additional_info: e.target.value })}
          style={{ width: '100%', padding: 8, marginTop: 8, minHeight: 90 }}
        />

        <label style={{ display: 'block', marginTop: 10 }}>
          <input
            type="checkbox"
            checked={form.is_public}
            onChange={(e) => setForm({ ...form, is_public: e.target.checked })}
          />{' '}
          Näytä julkisesti
        </label>

        <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
          <button type="submit">{editingId ? 'Päivitä projekti' : 'Lisää projekti'}</button>
          {editingId && (
            <button type="button" onClick={cancelEdit}>
              Peruuta
            </button>
          )}
        </div>
      </form>

      {projects.map((p) => (
        <div key={p.id} style={{ border: '1px solid #ccc', padding: 15, marginBottom: 20 }}>
          <h3 style={{ marginBottom: 6 }}>{p.name}</h3>
          <p>
            <strong>Maakunta:</strong> {p.region || '-'}
          </p>
          <p>
            <strong>Kaupunki:</strong> {p.city}
          </p>
          <p>
            <strong>Vaihe:</strong> {p.phase}
          </p>
          <p>
            <strong>Näkyvyys:</strong> {p.is_public ? '🟢 Julkinen' : '🔒 Piilotettu'}
          </p>

          <button onClick={() => togglePublic(p.id, p.is_public)}>{p.is_public ? 'Piilota' : 'Julkaise'}</button>
          <button onClick={() => startEdit(p)} style={{ marginLeft: 10 }}>
            Muokkaa
          </button>
          <button
            onClick={() => deleteProject(p.id)}
            style={{ marginLeft: 10, background: 'red', color: 'white' }}
          >
            Poista
          </button>
        </div>
      ))}
    </div>
  )
}