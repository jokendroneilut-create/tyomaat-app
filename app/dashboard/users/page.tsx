'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { daysLeft, daysSince, trialState, type TrialState } from '@/lib/users/trial'

type AdminUser = {
  id: string
  email: string | null
  created_at: string
  last_sign_in_at: string | null
  confirmed: boolean
  locked?: boolean
  lockedReason?: string | null

  /* Jarjestelmarooli ja hankkinut myyja. Vain adminille merkityksellisia. */
  role?: 'admin' | 'seller' | 'user'
  ownerId?: string | null
  ownerEmail?: string | null
}

type Seller = { id: string; email: string | null }

type SortColumn = 'email' | 'created_at' | 'age_days' | 'last_sign_in_at' | 'confirmed'
type SortDirection = 'asc' | 'desc'

function formatDate(value: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleString('fi-FI')
}

const TRIAL_STYLE: Record<TrialState, { color: string; weight: number }> = {
  ohi: { color: '#b91c1c', weight: 700 },
  pian: { color: '#b45309', weight: 600 },
  kesken: { color: '#374151', weight: 400 },
}

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /*
   * Kutsujan oma rooli. Myyja nakee vain hankkimansa asiakkaat eika saa
   * kutsua, lukita tai poistaa ketaan. Rajaus tehdaan palvelimella
   * (/api/admin/list-users); tama ohjaa vain sita mita napit nayttavat.
   */
  const [viewerRole, setViewerRole] = useState<'admin' | 'seller' | 'user'>('user')
  const [sellers, setSellers] = useState<Seller[]>([])
  const [savingId, setSavingId] = useState<string | null>(null)

  const isAdminView = viewerRole === 'admin'

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteResult, setInviteResult] = useState<string | null>(null)

  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [lockingId, setLockingId] = useState<string | null>(null)

  const [sortColumn, setSortColumn] = useState<SortColumn>('created_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortColumn(column)
      /*
       * Ika ja kirjautuminen ovat kiinnostavia suurimmasta paasta:
       * paattyneet kokeilut ja tuoreimmat kirjautumiset ensin.
       */
      setSortDirection(column === 'age_days' || column === 'last_sign_in_at' ? 'desc' : 'asc')
    }
  }

  const trialSummary = useMemo(() => {
    let ohi = 0
    let pian = 0
    for (const u of users) {
      const tila = trialState(daysSince(u.created_at))
      if (tila === 'ohi') ohi += 1
      else if (tila === 'pian') pian += 1
    }
    return { ohi, pian }
  }, [users])

  const sortedUsers = useMemo(() => {
    const sorted = [...users].sort((a, b) => {
      let cmp = 0

      if (sortColumn === 'email') {
        cmp = (a.email ?? '').localeCompare(b.email ?? '', 'fi')
      } else if (sortColumn === 'age_days') {
        /*
         * Luonnollinen suunta, jotta nuoli vastaa nakemaa: alas = suurin
         * ika ensin eli paattyneet karkeen. Ensimmainen versio kaansi
         * vertailun tassa, jolloin nuoli alas naytti nuorimmat.
         */
        cmp = (daysSince(a.created_at) ?? -1) - (daysSince(b.created_at) ?? -1)
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

  /*
   * silent: käytetään kutsun lähetyksen jälkeisessä automaattisessa
   * päivityksessä. Kutsu itse on siinä vaiheessa jo onnistunut - jos
   * pelkkä listan haku kaatuu (esim. hetkellinen istunto-ongelma heti
   * uudelleenkirjautumisen jälkeen), sitä ei pidä näyttää hälyttävänä
   * virheenä joka sekoittuu onnistuneen kutsun ilmoitukseen. Lista
   * päivittyy joka tapauksessa seuraavalla "Päivitä"-klikkauksella.
   */
  const fetchUsers = async (silent = false) => {
    setLoading(true)
    if (!silent) setError(null)

    const token = await getToken()

    if (!token) {
      if (!silent) setError('Et ole kirjautunut sisään')
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/admin/list-users', {
        headers: { Authorization: `Bearer ${token}` },
      })

      const json = await res.json()

      if (!res.ok) {
        if (!silent) setError(json.error || 'Käyttäjien haku epäonnistui')
      } else {
        setUsers(json.users)
        if (json.role) setViewerRole(json.role)
        setSellers(json.sellers ?? [])
      }
    } catch {
      if (!silent) setError('Käyttäjien haku epäonnistui')
    }

    setLoading(false)
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  /*
   * Yhteinen kutsu admin-reiteille. Palvelin tarkistaa roolin joka
   * kerta, joten tama on vain kayttoliittyman puoli.
   */
  const laheta = async (polku: string, body: any) => {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return { error: 'Et ole kirjautunut sisään' }

    const res = await fetch(polku, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })

    return res.json().catch(() => ({ error: 'Vastauksen luku epäonnistui' }))
  }

  const handleRole = async (user: AdminUser, role: 'seller' | 'admin' | null) => {
    setSavingId(user.id)
    setError(null)

    const json = await laheta('/api/admin/set-user-role', { userId: user.id, role })

    if (json?.error) setError(json.error)
    else await fetchUsers(true)

    setSavingId(null)
  }

  const handleAssign = async (user: AdminUser, sellerId: string | null) => {
    setSavingId(user.id)
    setError(null)

    const json = await laheta('/api/admin/assign-customer', { userId: user.id, sellerId })

    if (json?.error) setError(json.error)
    else await fetchUsers(true)

    setSavingId(null)
  }

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
        await fetchUsers(true)
      }
    } catch {
      setInviteResult('Virhe kutsun lähetyksessä')
    }

    setInviting(false)
  }

  /*
   * LUKITUS JA VAPAUTUS.
   *
   * Lukitus estää kirjautumisen mutta säilyttää tilin, historian ja
   * analytiikan — toisin kuin poisto, joka on peruuttamaton. Siksi tämä on
   * se toimenpide johon tartutaan ensin, jos käyttö näyttää väärinkäytöltä.
   *
   * KAKSI ESTETTÄ VAHINGOLLE. Perustelu on pakollinen, eli lukitus vaatii
   * ajatuksen; ja erillinen vahvistus, jossa sähköposti on luettavissa,
   * eli se vaatii katseen oikeaan riviin. Vapautus ei vaadi kumpaakaan.
   */
  const handleLock = async (user: AdminUser) => {
    const locked = Boolean(user.locked)

    let reason = ''

    if (!locked) {
      const input = window.prompt(
        `Lukitse tunnus ${user.email}?\n\n` +
          'Kirjautuminen estyy heti. Tili, historia ja analytiikka säilyvät, ' +
          'ja lukituksen voi purkaa milloin tahansa.\n\n' +
          'Kirjoita perustelu (pakollinen):'
      )

      if (input === null) return

      reason = input.trim()

      if (!reason) {
        setError('Lukitseminen vaatii perustelun')
        return
      }

      const confirmed = window.confirm(
        `Varmista vielä:\n\nLUKITAAN ${user.email}\nSyy: ${reason}\n\nJatketaanko?`
      )

      if (!confirmed) return
    }

    setLockingId(user.id)
    setError(null)

    const token = await getToken()

    if (!token) {
      setError('Et ole kirjautunut sisään')
      setLockingId(null)
      return
    }

    try {
      const res = await fetch('/api/admin/lock-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId: user.id, lock: !locked, reason }),
      })

      const json = await res.json()

      if (!res.ok) {
        setError(json.error || 'Toiminto epäonnistui')
      } else {
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, locked: !locked } : u))
        )
      }
    } catch {
      setError('Toiminto epäonnistui')
    }

    setLockingId(null)
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
    /*
     * Taulukossa on kuusi saraketta, joista kolme on paivamaaria.
     * 900 pikselissa sahkopostisarake leikkautui ja paivamaarat
     * katkesivat kolmelle riville.
     */
    <div style={{ padding: 24, maxWidth: 1280 }}>
      <h1>{isAdminView ? 'Käyttäjät' : 'Omat asiakkaat'}</h1>

      {!isAdminView && (
        <p style={{ marginTop: 8, color: '#6b7280', fontSize: 14 }}>
          Näet hankkimasi asiakkaat ja sen, ovatko he ottaneet tuotteen
          käyttöön. Kokeilun tila lasketaan tunnuksen iästä.
        </p>
      )}

      {isAdminView && (
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
      )}

      {error && (
        <div style={{ marginTop: 16, color: '#b91c1c' }}>{error}</div>
      )}

      <div style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 18 }}>
            {isAdminView ? 'Kaikki käyttäjät' : 'Asiakkaani'} ({users.length})
            {/*
              * Luvut otsikkoon, jotta paattyneet nakyvat ilman selaamista.
              * Tama on sivun varsinainen tarkoitus: muistaa mitka
              * testitunnukset ovat umpeutuneet.
              */}
            {trialSummary.ohi > 0 || trialSummary.pian > 0 ? (
              <span style={{ marginLeft: 12, fontSize: 14, fontWeight: 400 }}>
                {trialSummary.ohi > 0 ? (
                  <span style={{ color: '#b91c1c', fontWeight: 700 }}>
                    {trialSummary.ohi} kokeilu ohi
                  </span>
                ) : null}
                {trialSummary.ohi > 0 && trialSummary.pian > 0 ? (
                  <span style={{ color: '#9ca3af' }}> · </span>
                ) : null}
                {trialSummary.pian > 0 ? (
                  <span style={{ color: '#b45309', fontWeight: 600 }}>
                    {trialSummary.pian} päättyy viikon sisällä
                  </span>
                ) : null}
              </span>
            ) : null}
          </h2>
          <button
            onClick={() => fetchUsers()}
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
          <table style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
              <SortHeader column="email" label="Sähköposti" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
              <SortHeader column="created_at" label="Luotu" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
              <SortHeader column="age_days" label="Ikä (pv)" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
              <SortHeader column="last_sign_in_at" label="Viimeksi kirjautunut" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
              <SortHeader column="confirmed" label="Tila" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
              {isAdminView && <th style={{ padding: '8px 4px' }}>Myyjä</th>}
              {isAdminView && <th style={{ padding: '8px 4px' }} />}
            </tr>
          </thead>

          <tbody>
            {sortedUsers.map((u) => (
              <tr key={u.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '8px 4px' }}>{u.email}</td>
                <td style={{ padding: '8px 4px', whiteSpace: 'nowrap' }}>{formatDate(u.created_at)}</td>
                <td style={{ padding: '8px 4px', whiteSpace: 'nowrap' }}>
                  {(() => {
                    const days = daysSince(u.created_at)
                    const tila = trialState(days)
                    const tyyli = TRIAL_STYLE[tila]
                    return (
                      <span style={{ color: tyyli.color, fontWeight: tyyli.weight }}>
                        {days == null ? '-' : days}
                        {tila === 'ohi' ? ' · kokeilu ohi' : null}
                        {tila === 'pian' ? ` · ${daysLeft(days)} pv jäljellä` : null}
                      </span>
                    )
                  })()}
                </td>
                <td style={{ padding: '8px 4px', whiteSpace: 'nowrap' }}>{formatDate(u.last_sign_in_at)}</td>
                <td style={{ padding: '8px 4px' }}>
                  {u.locked ? (
                    <span style={{ color: '#b91c1c', fontWeight: 700 }} title={u.lockedReason ?? undefined}>
                      🔒 Lukittu
                      {u.lockedReason ? (
                        <span style={{ display: 'block', fontWeight: 400, fontSize: 12, color: '#6b7280' }}>
                          {u.lockedReason}
                        </span>
                      ) : null}
                    </span>
                  ) : u.confirmed ? (
                    <span style={{ color: '#15803d', fontWeight: 600 }}>Aktivoitu</span>
                  ) : (
                    <span style={{ color: '#b45309', fontWeight: 600 }}>Odottaa kutsun hyväksyntää</span>
                  )}
                </td>

                {isAdminView && (
                  <td style={{ padding: '8px 4px', whiteSpace: 'nowrap' }}>
                    {/*
                      * Myyja itse ei ole kenenkaan asiakas, joten
                      * hanelle nayetaan roolin poisto liitoksen sijaan.
                      */}
                    {u.role === 'seller' ? (
                      <button
                        onClick={() => handleRole(u, null)}
                        disabled={savingId === u.id}
                        style={{
                          padding: '4px 8px',
                          borderRadius: 6,
                          border: '1px solid #d1d5db',
                          background: '#dbeafe',
                          color: '#1d4ed8',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                        title="Poista myyjärooli"
                      >
                        Myyjä ✕
                      </button>
                    ) : u.role === 'admin' ? (
                      <span style={{ color: '#6b7280' }}>admin</span>
                    ) : (
                      <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                        <select
                          value={u.ownerId ?? ''}
                          disabled={savingId === u.id}
                          onChange={(e) => handleAssign(u, e.target.value || null)}
                          style={{
                            padding: '4px 6px',
                            borderRadius: 6,
                            border: '1px solid #d1d5db',
                            background: '#fff',
                          }}
                        >
                          <option value="">— ei myyjää —</option>
                          {sellers.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.email}
                            </option>
                          ))}
                        </select>

                        <button
                          onClick={() => handleRole(u, 'seller')}
                          disabled={savingId === u.id}
                          style={{
                            padding: '4px 8px',
                            borderRadius: 6,
                            border: '1px solid #d1d5db',
                            background: '#fff',
                            cursor: 'pointer',
                          }}
                          title="Tee tästä käyttäjästä myyjä"
                        >
                          + myyjäksi
                        </button>
                      </span>
                    )}
                  </td>
                )}

                {isAdminView && (
                <td style={{ padding: '8px 4px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button
                    onClick={() => handleLock(u)}
                    disabled={lockingId === u.id}
                    style={{
                      padding: '6px 12px',
                      marginRight: 8,
                      background: u.locked ? '#dcfce7' : '#fef3c7',
                      color: u.locked ? '#15803d' : '#92400e',
                      borderRadius: 6,
                      border: 'none',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {lockingId === u.id
                      ? 'Odota...'
                      : u.locked
                        ? 'Vapauta'
                        : 'Lukitse'}
                  </button>

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
                )}
              </tr>
            ))}

            {!loading && users.length === 0 && (
              <tr>
                <td
                  colSpan={isAdminView ? 7 : 5}
                  style={{ padding: 16, textAlign: 'center', color: '#6b7280' }}
                >
                  {isAdminView
                    ? 'Ei käyttäjiä'
                    : 'Sinulle ei ole vielä liitetty asiakkaita.'}
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
    <th style={{ padding: '8px 4px', whiteSpace: 'nowrap' }}>
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
