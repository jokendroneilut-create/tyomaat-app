'use client'

import { useEffect, useState } from 'react'

type UserRow = { userId: string; email: string; [key: string]: any }
type ProjectRow = { projectId: string; name: string; [key: string]: any }

type AnalyticsData = {
  mostLoggedInUsers: UserRow[]
  mostTimeSpentUsers: UserRow[]
  mostViewedPages: { path: string; seconds: number }[]
  searchWatchUsers: UserRow[]
  mostOpenedProjects: ProjectRow[]
  mostFavoritedProjects: ProjectRow[]
  teamUsers: { userId: string; email: string }[]
  devicePercentages: { device: string; count: number; percentage: number }[]
  totalUsers: number
  totalEvents: number
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds} s`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const remMinutes = minutes % 60
  return `${hours} h ${remMinutes} min`
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div style={{ marginTop: 24, padding: 16, border: '1px solid #e5e7eb', borderRadius: 8 }}>
      <h2 style={{ fontSize: 16, marginBottom: 12 }}>{title}</h2>
      {children}
    </div>
  )
}

function Table({
  columns,
  rows,
  emptyText,
}: {
  columns: { label: string; render: (row: any) => React.ReactNode }[]
  rows: any[]
  emptyText: string
}) {
  if (rows.length === 0) {
    return <p style={{ color: '#6b7280', fontSize: 14 }}>{emptyText}</p>
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', minWidth: 400, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
            {columns.map((c) => (
              <th key={c.label} style={{ padding: '6px 4px', fontSize: 13, color: '#6b7280' }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
              {columns.map((c) => (
                <td key={c.label} style={{ padding: '6px 4px', fontSize: 14 }}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)

      try {
        const res = await fetch('/api/admin/analytics')
        const json = await res.json()

        if (!res.ok) {
          setError(json.error || 'Analytiikan haku epäonnistui')
        } else {
          setData(json)
        }
      } catch {
        setError('Analytiikan haku epäonnistui')
      }

      setLoading(false)
    }

    load()
  }, [])

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <h1>Käyttäjäanalytiikka</h1>
      <p style={{ marginTop: 4, fontSize: 13, color: '#6b7280' }}>
        Perustuu kirjautumis-, sivunkatselu- ja hanke-avaustapahtumiin siitä lähtien kun seuranta otettiin käyttöön — vanhempaa historiaa ei ole.
      </p>

      {loading && <p style={{ marginTop: 16 }}>Ladataan...</p>}
      {error && <p style={{ marginTop: 16, color: '#b91c1c' }}>{error}</p>}

      {data && (
        <>
          <div style={{ marginTop: 16, display: 'flex', gap: 24, fontSize: 14, color: '#374151' }}>
            <div><strong>{data.totalUsers}</strong> käyttäjää</div>
            <div><strong>{data.totalEvents}</strong> tallennettua tapahtumaa</div>
          </div>

          <Section title="📱 Laitejakauma">
            {data.devicePercentages.length === 0 ? (
              <p style={{ color: '#6b7280', fontSize: 14 }}>Ei vielä dataa.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.devicePercentages.map((d) => (
                  <div key={d.device}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                      <span>{d.device === 'mobile' ? 'Mobiili' : 'Tietokone'}</span>
                      <span><strong>{d.percentage}%</strong> ({d.count})</span>
                    </div>
                    <div style={{ height: 8, background: '#f3f4f6', borderRadius: 4, marginTop: 4 }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${d.percentage}%`,
                          background: '#111827',
                          borderRadius: 4,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="🔑 Eniten kirjautuneet käyttäjät">
            <Table
              rows={data.mostLoggedInUsers}
              emptyText="Ei vielä kirjautumisdataa."
              columns={[
                { label: 'Käyttäjä', render: (r) => r.email },
                { label: 'Kirjautumisia', render: (r) => r.loginCount },
              ]}
            />
          </Section>

          <Section title="⏱️ Pisimpään aikaa viettäneet käyttäjät">
            <Table
              rows={data.mostTimeSpentUsers}
              emptyText="Ei vielä käyttöaikadataa."
              columns={[
                { label: 'Käyttäjä', render: (r) => r.email },
                { label: 'Aikaa yhteensä', render: (r) => formatDuration(r.seconds) },
              ]}
            />
          </Section>

          <Section title="📄 Eniten katsotut sivut">
            <Table
              rows={data.mostViewedPages}
              emptyText="Ei vielä sivunkatseludataa."
              columns={[
                { label: 'Sivu', render: (r) => r.path },
                { label: 'Aikaa yhteensä', render: (r) => formatDuration(r.seconds) },
              ]}
            />
          </Section>

          <Section title="🔍 Hakuvahdit asettaneet käyttäjät">
            <Table
              rows={data.searchWatchUsers}
              emptyText="Kukaan ei ole vielä asettanut hakuvahtia."
              columns={[
                { label: 'Käyttäjä', render: (r) => r.email },
                { label: 'Hakuvahteja', render: (r) => r.watchCount },
              ]}
            />
          </Section>

          <Section title="📂 Eniten avatut hankkeet">
            <Table
              rows={data.mostOpenedProjects}
              emptyText="Ei vielä hankeavausdataa."
              columns={[
                { label: 'Hanke', render: (r) => r.name },
                { label: 'Avauksia', render: (r) => r.openCount },
              ]}
            />
          </Section>

          <Section title="⭐ Eniten suosikkeihin lisätyt hankkeet">
            <Table
              rows={data.mostFavoritedProjects}
              emptyText="Ei vielä suosikkeja."
              columns={[
                { label: 'Hanke', render: (r) => r.name },
                { label: 'Suosikkeja', render: (r) => r.favoriteCount },
              ]}
            />
          </Section>

          <Section title="👥 Tiiminäkymän käyttöön ottaneet käyttäjät">
            {data.teamUsers.length === 0 ? (
              <p style={{ color: '#6b7280', fontSize: 14 }}>Kukaan ei ole vielä liittynyt tiimiin.</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14 }}>
                {data.teamUsers.map((u) => (
                  <li key={u.userId}>{u.email}</li>
                ))}
              </ul>
            )}
          </Section>
        </>
      )}
    </div>
  )
}
