'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

type SavedSearch = {
  id: string
  user_id: string
  name: string
  filters: any
  frequency: 'daily' | 'weekly'
  is_enabled: boolean
  last_sent_at: string | null
  created_at: string
  updated_at: string
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

function formatDateTimeFi(ts: string | null) {
  if (!ts) return '-'
  try {
    return new Intl.DateTimeFormat('fi-FI', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(ts))
  } catch {
    return ts
  }
}

function summarizeFilters(filters: any): string {
  if (!filters || typeof filters !== 'object') return '—'

  const parts: string[] = []
  if (filters.q) parts.push(`Haku: ${filters.q}`)
  if (filters.region) parts.push(`Maakunta: ${filters.region}`)
  if (filters.city) parts.push(`Kaupunki: ${filters.city}`)
  if (filters.phase) parts.push(`Vaihe: ${filters.phase}`)
  if (filters.property_type) parts.push(`Kohdetyyppi: ${filters.property_type}`)

  return parts.length ? parts.join(' • ') : 'Ei suodattimia'
}

export default function WatchlistsPage() {
  const isMobile = useIsMobile(768)

  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<SavedSearch[]>([])
  const [error, setError] = useState<string | null>(null)

  // inline edit
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')

  const load = async () => {
    setError(null)
    setLoading(true)

    const { data: userRes, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userRes?.user?.id) {
      setItems([])
      setLoading(false)
      setError('Kirjaudu sisään nähdäksesi hakuvahdit.')
      return
    }

    const { data, error: fetchErr } = await supabase
      .from('saved_searches')
      .select('id,user_id,name,filters,frequency,is_enabled,last_sent_at,created_at,updated_at')
      .order('created_at', { ascending: false })

    if (fetchErr) {
      setItems([])
      setError(fetchErr.message)
    } else {
      setItems((data as SavedSearch[]) || [])
    }

    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const enabledCount = useMemo(() => items.filter((x) => x.is_enabled).length, [items])

  const toggleEnabled = async (id: string, next: boolean) => {
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, is_enabled: next } : x)))

    const { error: updErr } = await supabase.from('saved_searches').update({ is_enabled: next }).eq('id', id)
    if (updErr) {
      // revert
      setItems((prev) => prev.map((x) => (x.id === id ? { ...x, is_enabled: !next } : x)))
      setError(updErr.message)
    }
  }

  const changeFrequency = async (id: string, freq: 'daily' | 'weekly') => {
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, frequency: freq } : x)))

    const { error: updErr } = await supabase.from('saved_searches').update({ frequency: freq }).eq('id', id)
    if (updErr) {
      setError(updErr.message)
      // reload to be safe
      load()
    }
  }

  const startEditName = (it: SavedSearch) => {
    setEditingId(it.id)
    setDraftName(it.name || '')
    setError(null)
  }

  const cancelEditName = () => {
    setEditingId(null)
    setDraftName('')
  }

  const saveName = async (id: string) => {
    const name = draftName.trim()
    if (!name) {
      setError('Nimi ei voi olla tyhjä.')
      return
    }

    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, name } : x)))
    setEditingId(null)

    const { error: updErr } = await supabase.from('saved_searches').update({ name }).eq('id', id)
    if (updErr) {
      setError(updErr.message)
      load()
    }
  }

  const remove = async (id: string) => {
    const ok = window.confirm('Poistetaanko hakuvahti?')
    if (!ok) return

    const before = items
    setItems((prev) => prev.filter((x) => x.id !== id))

    const { error: delErr } = await supabase.from('saved_searches').delete().eq('id', id)
    if (delErr) {
      setItems(before)
      setError(delErr.message)
    }
  }

  if (loading) return <p style={{ padding: 20 }}>Ladataan…</p>

  return (
    <div style={{ padding: 20, maxWidth: 1100, margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'baseline',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>Omat hakuvahdit</h1>
          <p style={{ marginTop: 8, color: '#4b5563' }}>
            Aktiivisia: <strong>{enabledCount}</strong> / {items.length}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link
            href="/projects"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid #e5e7eb',
              textDecoration: 'none',
              color: '#111827',
              background: '#fff',
              fontWeight: 600,
            }}
          >
            ← Takaisin projekteihin
          </Link>

          <button
            type="button"
            onClick={load}
            style={{
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid #e5e7eb',
              background: '#fff',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Päivitä
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            marginTop: 14,
            padding: '10px 12px',
            border: '1px solid #fecaca',
            background: '#fff1f2',
            borderRadius: 10,
            color: '#991b1b',
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <div
          style={{
            marginTop: 18,
            padding: 16,
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            background: '#fff',
            color: '#374151',
          }}
        >
          <p style={{ margin: 0 }}>
            Et ole vielä luonut hakuvahteja. Mene edelliselle sivulle ja valitse suodattimet → “Tallenna hakuvahti”.
          </p>
        </div>
      ) : (
        <>
          {/* 📱 MOBILE: kortit */}
          {isMobile ? (
            <div style={{ marginTop: 18, display: 'grid', gap: 12 }}>
              {items.map((it) => (
                <div
                  key={it.id}
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: 12,
                    background: '#fff',
                    padding: 14,
                  }}
                >
                  {/* Nimi + muokkaus */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                    <div style={{ fontWeight: 900, fontSize: 18 }}>
                      {editingId === it.id ? '' : it.name}
                    </div>

                    {editingId !== it.id ? (
                      <button
                        type="button"
                        onClick={() => startEditName(it)}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 999,
                          border: '1px solid #e5e7eb',
                          background: '#fff',
                          cursor: 'pointer',
                          fontWeight: 700,
                          fontSize: 12,
                          color: '#374151',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Muokkaa
                      </button>
                    ) : null}
                  </div>

                  {editingId === it.id ? (
                    <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                      <input
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: 10,
                          border: '1px solid #e5e7eb',
                        }}
                      />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => saveName(it.id)}
                          style={{
                            flex: 1,
                            padding: '10px 12px',
                            borderRadius: 10,
                            border: '1px solid #e5e7eb',
                            background: '#fff',
                            fontWeight: 900,
                            cursor: 'pointer',
                          }}
                        >
                          Tallenna
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditName}
                          style={{
                            flex: 1,
                            padding: '10px 12px',
                            borderRadius: 10,
                            border: '1px solid #e5e7eb',
                            background: '#fff',
                            fontWeight: 800,
                            cursor: 'pointer',
                          }}
                        >
                          Peru
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <div style={{ marginTop: 10, color: '#374151', fontSize: 13 }}>
                    {summarizeFilters(it.filters)}
                  </div>

                  <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 800, marginBottom: 4 }}>Väli</div>
                      <select
                        value={it.frequency}
                        onChange={(e) => changeFrequency(it.id, e.target.value as 'daily' | 'weekly')}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: 10,
                          border: '1px solid #e5e7eb',
                          background: '#fff',
                          cursor: 'pointer',
                        }}
                      >
                        <option value="weekly">Viikoittain</option>
                        <option value="daily">Päivittäin</option>
                      </select>
                    </div>

                    <div>
                      <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 800, marginBottom: 4 }}>Tila</div>
                      <label style={{ display: 'inline-flex', gap: 10, alignItems: 'center', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={it.is_enabled}
                          onChange={(e) => toggleEnabled(it.id, e.target.checked)}
                        />
                        <span style={{ fontWeight: 900, color: it.is_enabled ? '#15803d' : '#6b7280' }}>
                          {it.is_enabled ? 'Päällä' : 'Pois'}
                        </span>
                      </label>
                    </div>

                    <div>
                      <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 800, marginBottom: 4 }}>
                        Viimeksi lähetetty
                      </div>
                      <div style={{ color: '#374151', fontSize: 13 }}>{formatDateTimeFi(it.last_sent_at)}</div>
                    </div>

                    <button
                      type="button"
                      onClick={() => remove(it.id)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: '1px solid #fecaca',
                        background: '#fff1f2',
                        color: '#991b1b',
                        cursor: 'pointer',
                        fontWeight: 900,
                      }}
                    >
                      Poista
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* 🖥 DESKTOP: taulukko */
            <div style={{ marginTop: 18, border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.2fr 2fr 0.9fr 0.9fr 1.2fr 0.8fr',
                  gap: 0,
                  background: '#f9fafb',
                  padding: '12px 14px',
                  fontWeight: 800,
                  color: '#111827',
                  fontSize: 14,
                }}
              >
                <div>Nimi</div>
                <div>Suodattimet</div>
                <div>Väli</div>
                <div>Tila</div>
                <div>Viimeksi lähetetty</div>
                <div />
              </div>

              {items.map((it) => (
                <div
                  key={it.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.2fr 2fr 0.9fr 0.9fr 1.2fr 0.8fr',
                    padding: '12px 14px',
                    borderTop: '1px solid #e5e7eb',
                    alignItems: 'center',
                    background: '#fff',
                    gap: 10,
                  }}
                >
                  <div>
                    {editingId === it.id ? (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          value={draftName}
                          onChange={(e) => setDraftName(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: 10,
                            border: '1px solid #e5e7eb',
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => saveName(it.id)}
                          style={{
                            padding: '8px 10px',
                            borderRadius: 10,
                            border: '1px solid #e5e7eb',
                            background: '#fff',
                            fontWeight: 800,
                            cursor: 'pointer',
                          }}
                        >
                          Tallenna
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditName}
                          style={{
                            padding: '8px 10px',
                            borderRadius: 10,
                            border: '1px solid #e5e7eb',
                            background: '#fff',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Peru
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <div style={{ fontWeight: 800 }}>{it.name}</div>
                        <button
                          type="button"
                          onClick={() => startEditName(it)}
                          style={{
                            padding: '6px 10px',
                            borderRadius: 999,
                            border: '1px solid #e5e7eb',
                            background: '#fff',
                            cursor: 'pointer',
                            fontWeight: 700,
                            fontSize: 12,
                            color: '#374151',
                          }}
                        >
                          Muokkaa
                        </button>
                      </div>
                    )}
                  </div>

                  <div style={{ color: '#374151', fontSize: 13 }}>{summarizeFilters(it.filters)}</div>

                  <div>
                    <select
                      value={it.frequency}
                      onChange={(e) => changeFrequency(it.id, e.target.value as 'daily' | 'weekly')}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 10,
                        border: '1px solid #e5e7eb',
                        background: '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      <option value="weekly">Viikoittain</option>
                      <option value="daily">Päivittäin</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'inline-flex', gap: 10, alignItems: 'center', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={it.is_enabled}
                        onChange={(e) => toggleEnabled(it.id, e.target.checked)}
                      />
                      <span style={{ fontWeight: 800, color: it.is_enabled ? '#15803d' : '#6b7280' }}>
                        {it.is_enabled ? 'Päällä' : 'Pois'}
                      </span>
                    </label>
                  </div>

                  <div style={{ color: '#374151', fontSize: 13 }}>{formatDateTimeFi(it.last_sent_at)}</div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => remove(it.id)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 10,
                        border: '1px solid #fecaca',
                        background: '#fff1f2',
                        color: '#991b1b',
                        cursor: 'pointer',
                        fontWeight: 900,
                      }}
                    >
                      Poista
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}