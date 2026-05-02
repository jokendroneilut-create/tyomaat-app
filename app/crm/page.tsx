'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import ConfirmModal from '../components/ConfirmModal'

type Project = {
  id: string
  name: string
  city: string
  region: string | null
  phase: string
  created_at: string
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

export default function CRMPage() {
  const [loading, setLoading] = useState(true)
  const [projects, setProjects] = useState<Project[]>([])
  const [statuses, setStatuses] = useState<Record<string, string>>({})
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [confirmOpen, setConfirmOpen] = useState(false)
const [confirmProjectId, setConfirmProjectId] = useState<string | null>(null)

  useEffect(() => {
    const run = async () => {
      setLoading(true)

      const { data: userRes } = await supabase.auth.getUser()
      const userId = userRes?.user?.id

      if (!userId) {
        setProjects([])
        setStatuses({})
        setFavorites(new Set())
        setLoading(false)
        return
      }

      const [{ data: favs }, { data: stats }] = await Promise.all([
        supabase.from('user_project_favorites').select('project_id').eq('user_id', userId),
        supabase.from('user_project_status').select('project_id,status').eq('user_id', userId),
      ])

      const favIds = (favs ?? []).map((r: any) => r.project_id)
      setFavorites(new Set(favIds))

      const m: Record<string, string> = {}
      ;(stats ?? []).forEach((r: any) => {
        m[r.project_id] = r.status
      })
      setStatuses(m)

      if (favIds.length === 0) {
        setProjects([])
        setLoading(false)
        return
      }

      const { data: projs, error } = await supabase
        .from('projects')
        .select('id,name,city,region,phase,created_at')
        .in('id', favIds)
        .order('created_at', { ascending: false })

      if (error) {
        console.error(error)
        setProjects([])
      } else {
        setProjects((projs as Project[]) ?? [])
      }

      setLoading(false)
    }

    run()
  }, [])

  const toggleFavorite = async (projectId: string) => {
    const { data: userRes } = await supabase.auth.getUser()
    const userId = userRes?.user?.id
    if (!userId) return

    if (favorites.has(projectId)) {
      setConfirmProjectId(projectId)
setConfirmOpen(true)
return

      
    } else {
      const { error } = await supabase
        .from('user_project_favorites')
        .insert({ user_id: userId, project_id: projectId })

      if (error) {
        console.error(error)
        return
      }

      const next = new Set(favorites)
      next.add(projectId)
      setFavorites(next)
    }
  }

const confirmRemoveFavorite = async () => {
  if (!confirmProjectId) return

  const { data: userRes } = await supabase.auth.getUser()
  const userId = userRes?.user?.id
  if (!userId) return

  const { error } = await supabase
    .from('user_project_favorites')
    .delete()
    .eq('user_id', userId)
    .eq('project_id', confirmProjectId)

  if (error) {
    console.error(error)
    return
  }

  const next = new Set(favorites)
  next.delete(confirmProjectId)
  setFavorites(next)
  setProjects((prev) => prev.filter((p) => p.id !== confirmProjectId))

  setConfirmOpen(false)
  setConfirmProjectId(null)
}

  const setProjectStatus = async (projectId: string, status: string) => {
    const { data: userRes } = await supabase.auth.getUser()
    const userId = userRes?.user?.id
    if (!userId) return

    const { error } = await supabase.from('user_project_status').upsert(
      {
        user_id: userId,
        project_id: projectId,
        status,
      },
      {
        onConflict: 'user_id,project_id',
      }
    )

    if (error) {
      console.error(error)
      return
    }

    setStatuses((prev) => ({
      ...prev,
      [projectId]: status,
    }))
  }

  const filtered = useMemo(() => {
    if (!statusFilter) return projects
    return projects.filter((p) => (statuses[p.id] ?? 'new') === statusFilter)
  }, [projects, statuses, statusFilter])

  if (loading) return <p style={{ padding: 20 }}>Ladataan...</p>

  return (
    <div style={{ padding: 20 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>Omat projektit</h1>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 14 }}>Status:</label>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Kaikki</option>
          <option value="new">Uusi</option>
          <option value="contacted">Kontaktoitu</option>
          <option value="offer_sent">Tarjous lähetetty</option>
          <option value="won">Voitettu</option>
          <option value="lost">Hävitty</option>
        </select>

        <div style={{ fontSize: 14, color: '#6b7280' }}>
          Näytetään <strong>{filtered.length}</strong> / {projects.length}
        </div>
      </div>

      {projects.length === 0 ? (
        <p>Et ole vielä lisännyt projekteja omiin.</p>
      ) : filtered.length === 0 ? (
        <p>Ei projekteja tällä status-filtterillä.</p>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {filtered.map((p) => (
            <div
              key={p.id}
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 12,
                padding: 12,
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: 6 }}>{p.name}</div>

              <div style={{ fontSize: 14, color: '#374151', marginBottom: 10 }}>
                {p.city} • {p.region || '-'} • {p.phase} •{' '}
                <span
                  style={{
                    ...getStatusStyle(statuses[p.id] ?? 'new'),
                    padding: '4px 8px',
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {humanizeStatus(statuses[p.id] ?? 'new')}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={() => toggleFavorite(p.id)}
                  style={{
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    padding: '8px 12px',
                    background: '#fff',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  ★ Poista omista
                </button>

                <select
                  value={statuses[p.id] ?? 'new'}
                  onChange={(e) => setProjectStatus(p.id, e.target.value)}
                  style={{
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    padding: '8px 10px',
                    background: '#fff',
                    cursor: 'pointer',
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
      )}
     <ConfirmModal
        open={confirmOpen}
        title="Poista omista?"
        message="Haluatko varmasti poistaa tämän projektin omista?"
        confirmText="Poista"
        cancelText="Peruuta"
        danger
        onCancel={() => {
          setConfirmOpen(false)
          setConfirmProjectId(null)
        }}
        onConfirm={confirmRemoveFavorite}
      />
    </div>
  )
}