'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type AdminUser = {
  id: string
  email: string | null
  created_at: string
  last_sign_in_at: string | null
  confirmed: boolean
}

type SortColumn = 'email' | 'created_at' | 'last_sign_in_at' | 'confirmed'
type SortDirection = 'asc' | 'desc'

function formatDate(value: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleString('fi-FI')
}

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteResult, setInviteResult] = useState<string | null>(null)

  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [sortColumn, setSortColumn] = useState<SortColumn>('created_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const sortedUsers = useMemo(() => {
    const sorted = [...users].sort((a, b) => {
      let cmp = 0

      if (sortColumn === 'email') {
        cmp = (a.email ?? '').localeCompare(b.email ?? '', 'fi')
      } else if (sortColumn === 'confirmed') {
        cmp = Number(a.confirmed) - Number(b.confirmed)
      } else {
        const aVal = a[sortColumn] ?? ''
        const bVal = b[sortColumn] ?? ''
        cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
      }

      return sortDirection === 'asc' ? cmp : -cmp
    })

    return sorted
  }, [users, sortColumn, sortDirection])

  const getToken = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    return session?.access_token ?? null
  }

  const fetchUsers = async () => {
    setLoading(true)
    setError(null)

    const token = await getToken()

    if (!token) {
      setError('Et ole kirjautunut sisään')
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/admin/list-users', {
        headers: { Authorization: `Bearer ${token}` },
      })

      const json = await res.json()

      if (!res.ok) {
        setError(json.error || 'Käyttäjien haku epäonnistui')
      } else {
        setUsers(json.users)
      }
    } catch {
      setError('Käyttäjien haku epäonnistui')
    }

    setLoading(false)
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleInvite = async () => {
    const email = inviteEmail.trim().toLowerCase()
    if (!email) return

    setInviting(true)
    setInviteResult(null)

    const token = await getToken()

    if (!token) {
      setInviteResult('Virhe: et ole kirjautunut sisään')
      setInviting(false)
      return
    }

    try {
      const res = await fetch('/api/admin/invite-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email }),
      })

      const json = await res.json()

      if (!res.ok) {
        setInviteResult(`Virhe: ${json.error}`)
      } else {
        setInviteResult(`Kutsu lähetetty osoitteeseen ${email}`)
        setInviteEmail('')
        await fetchUsers()
      }
    } catch {
      setInviteResult('Virhe kutsun lähetyksessä')
    }

    setInviting(false)
  }

  const handleDelete = async (user: AdminUser) => {
    const ok = window.confirm(
      `Haluatko varmasti poistaa käyttäjän ${user.email}? Tätä ei voi perua.`
    )
    if (!ok) return

    setDeletingId(user.id)

    const token = await getToken()

    if (!token) {
      setError('Et ole kirjautunut sisään')
      setDeletingId(null)
      return
    }

    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId: user.id }),
      })

      const json = await res.json()

      if (!res.ok) {
        setError(json.error || 'Poisto epäonnistui')
      } else {
        setUsers((prev) => prev.filter((u) => u.id !== user.id))
      }
    } catch {
      setError('Poisto epäonnistui')
    }

    setDeletingId(null)
  }

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <h1>Käyttäjät</h1>

      <div style={{ marginTop: 16, padding: 16, border: '1px solid #e5e7eb', borderRadius: 8 }}>
        <label style={{ fontWeight: 700 }}>Lisää uusi käyttäjä</label>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          <input
            type="email"
            placeholder="sahkoposti@esimerkki.fi"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            style={{ flex: 1, padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }}
          />

          <button
            onClick={handleInvite}
            disabled={inviting || !inviteEmail.trim()}
            style={{
              padding: '8px 16px',
              background: '#111827',
              color: 'white',
              borderRadius: 6,
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {inviting ? 'Lähetetään...' : 'Lähetä kutsu'}
          </button>
        </div>

        <p style={{ marginTop: 8, fontSize: 13, color: '#6b7280' }}>
          Käyttäjä saa sähköpostiin linkin, jolla hän asettaa itse oman salasanansa. Ei tarvitse keksiä tai lähettää salasanaa käsin.
        </p>

        {inviteResult && <div style={{ marginTop: 8 }}>{inviteResult}</div>}
      </div>

      {error && (
        <div style={{ marginTop: 16, color: '#b91c1c' }}>{error}</div>
      )}

      <div style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 18 }}>Kaikki käyttäjät ({users.length})</h2>
          <button
            onClick={fetchUsers}
            disabled={loading}
            style={{
              padding: '6px 12px',
              background: '#f3f4f6',
              borderRadius: 6,
              border: '1px solid #e5e7eb',
              cursor: 'pointer',
            }}
          >
            {loading ? 'Päivitetään...' : 'Päivitä'}
          </button>
        </div>

        <div style={{ marginTop: 12, overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
              <SortHeader column="email" label="Sähköposti" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
              <SortHeader column="created_at" label="Luotu" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
              <SortHeader column="last_sign_in_at" label="Viimeksi kirjautunut" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
              <SortHeader column="confirmed" label="Tila" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
              <th style={{ padding: '8px 4px' }} />
            </tr>
          </thead>

          <tbody>
            {sortedUsers.map((u) => (
              <tr key={u.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '8px 4px' }}>{u.email}</td>
                <td style={{ padding: '8px 4px' }}>{formatDate(u.created_at)}</td>
                <td style={{ padding: '8px 4px' }}>{formatDate(u.last_sign_in_at)}</td>
                <td style={{ padding: '8px 4px' }}>
                  {u.confirmed ? (
                    <span style={{ color: '#15803d', fontWeight: 600 }}>Aktivoitu</span>
                  ) : (
                    <span style={{ color: '#b45309', fontWeight: 600 }}>Odottaa kutsun hyväksyntää</span>
                  )}
                </td>
                <td style={{ padding: '8px 4px', textAlign: 'right' }}>
                  <button
                    onClick={() => handleDelete(u)}
                    disabled={deletingId === u.id}
                    style={{
                      padding: '6px 12px',
                      background: '#fee2e2',
                      color: '#b91c1c',
                      borderRadius: 6,
                      border: 'none',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {deletingId === u.id ? 'Poistetaan...' : 'Poista'}
                  </button>
                </td>
              </tr>
            ))}

            {!loading && users.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: 16, textAlign: 'center', color: '#6b7280' }}>
                  Ei käyttäjiä
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}

function SortHeader({
  column,
  label,
  sortColumn,
  sortDirection,
  onSort,
}: {
  column: SortColumn
  label: string
  sortColumn: SortColumn
  sortDirection: SortDirection
  onSort: (column: SortColumn) => void
}) {
  const active = sortColumn === column
  const arrow = active ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : ''

  return (
    <th style={{ padding: '8px 4px' }}>
      <button
        onClick={() => onSort(column)}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          font: 'inherit',
          fontWeight: active ? 800 : 700,
          cursor: 'pointer',
          color: 'inherit',
        }}
      >
        {label}
        {arrow}
      </button>
    </th>
  )
}
