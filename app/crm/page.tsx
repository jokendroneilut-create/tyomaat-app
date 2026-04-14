'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

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

export default function CRMPage() {
  const [loading, setLoading] = useState(true)
  const [projects, setProjects] = useState<Project[]>([])
  const [statuses, setStatuses] = useState<Record<string, string>>({})
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [statusFilter, setStatusFilter] = useState<string>('')

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
      if (!confirm('Haluatko varmasti poistaa tämän omista?')) {
  return
}
      const { error } = await supabase
        .from('user_project_favorites')
        .delete()
        .eq('user_id', userId)
        .eq('project_id', projectId)

      if (error) {
        console.error(error)
        return
      }

      const next = new Set(favorites)
      next.delete(projectId)
      setFavorites(next)
      setProjects((prev) => prev.filter((p) => p.id !== projectId))
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

      const { data: proj, error: projError } = await supabase
        .from('projects')
        .select('id,name,city,region,phase,created_at')
        .eq('id', projectId)
        .single()

      if (projError) {
        console.error(projError)
        return
      }

      if (proj) {
        setProjects((prev) => [proj as Project, ...prev.filter((p) => p.id !== projectId)])
      }
    }
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
                {p.city} • {p.region || '-'} • {p.phase} • <strong>{humanizeStatus(statuses[p.id] ?? 'new')}</strong>
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
                  {favorites.has(p.id) ? '★ Poista omista' : '☆ Omiin'}
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
    </div>
  )
}