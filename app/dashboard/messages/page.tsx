'use client'

import { Fragment, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type LogEntry = {
  id: string
  sent_at: string
  subject: string
  recipient_count: number
  recipients: string[]
  test_only: boolean
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('fi-FI')
}

export default function MessagesPage() {
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [testOnly, setTestOnly] = useState(true)
  const [result, setResult] = useState<string | null>(null)

  const [log, setLog] = useState<LogEntry[]>([])
  const [logLoading, setLogLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchLog = async () => {
    setLogLoading(true)

    try {
      const res = await fetch('/api/admin/message-log')
      const json = await res.json()

      if (res.ok) {
        setLog(json.log)
      }
    } catch {
      // hiljainen epäonnistuminen — lokin lataus ei ole kriittinen
    }

    setLogLoading(false)
  }

  useEffect(() => {
    fetchLog()
  }, [])

  const handleSend = async () => {
  const ok = window.confirm(
  testOnly
    ? 'Haluatko varmasti lähettää testiviestin vain itsellesi?'
    : 'Haluatko varmasti lähettää tämän viestin kaikille käyttäjille?'
)

  if (!ok) return

  setLoading(true)
  setResult(null)

    try {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const token = session?.access_token

  if (!token) {
    setResult('Virhe: et ole kirjautunut sisään')
    setLoading(false)
    return
  }

  const res = await fetch('/api/admin/send-broadcast', {
        method: 'POST',
        headers: {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
},
        body: JSON.stringify({ subject, message, testOnly }),
      })

      const json = await res.json()

      if (!res.ok) {
  setResult(`Virhe: ${json.error}`)
} else {
  const baseMessage = json.testOnly
    ? 'Testiviesti lähetetty sinulle'
    : `Viesti lähetetty ${json.sent} käyttäjälle`

  setResult(
    json.logFailed
      ? `${baseMessage} — HUOM: lokiin kirjaus epäonnistui, viesti ei näy alla olevassa listassa`
      : baseMessage
  )
  setSubject('')
  setMessage('')
  fetchLog()
}
    } catch (err: any) {
      setResult('Virhe lähetyksessä')
    }

    setLoading(false)
  }

  return (
    <div style={{ padding: 24, maxWidth: 700 }}>
      <h1>Lähetä viesti asiakkaille</h1>

      <div style={{ marginTop: 16 }}>
        <label>Otsikko</label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          style={{
            width: '100%',
            padding: 8,
            marginTop: 4,
            background: '#fff',
            border: '1px solid #d1d5db',
            borderRadius: 6,
          }}
        />
      </div>

      <div style={{ marginTop: 16 }}>
        <label>Viesti</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={6}
          style={{
            width: '100%',
            padding: 8,
            marginTop: 4,
            background: '#fff',
            border: '1px solid #d1d5db',
            borderRadius: 6,
          }}
        />
      </div>

<div style={{ marginTop: 16 }}>
  <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <input
      type="checkbox"
      checked={testOnly}
      onChange={(e) => setTestOnly(e.target.checked)}
    />
    Lähetä vain testiviestinä minulle
  </label>
</div>

      <button
        onClick={handleSend}
        disabled={loading || !subject || !message}
        style={{
          marginTop: 20,
          padding: '10px 16px',
          background: '#111827',
          color: 'white',
          borderRadius: 8,
          fontWeight: 700,
        }}
      >
        {loading ? 'Lähetetään...' : 'Lähetä viesti'}
      </button>

      {result && (
        <div style={{ marginTop: 16 }}>
          {result}
        </div>
      )}

      <div style={{ marginTop: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 18 }}>Lähetetyt viestit ({log.length})</h2>
          <button
            onClick={fetchLog}
            disabled={logLoading}
            style={{
              padding: '6px 12px',
              background: '#f3f4f6',
              borderRadius: 6,
              border: '1px solid #e5e7eb',
              cursor: 'pointer',
            }}
          >
            {logLoading ? 'Päivitetään...' : 'Päivitä'}
          </button>
        </div>

        <div style={{ marginTop: 12, overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 500, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ padding: '8px 4px' }}>Ajankohta</th>
                <th style={{ padding: '8px 4px' }}>Otsikko</th>
                <th style={{ padding: '8px 4px' }}>Vastaanottajia</th>
              </tr>
            </thead>
            <tbody>
              {log.map((entry) => (
                <Fragment key={entry.id}>
                  <tr
                    style={{ borderBottom: '1px solid #f0f0f0', cursor: 'pointer' }}
                    onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                  >
                    <td style={{ padding: '8px 4px' }}>{formatDate(entry.sent_at)}</td>
                    <td style={{ padding: '8px 4px' }}>
                      {entry.subject}
                      {entry.test_only && (
                        <span style={{ marginLeft: 6, fontSize: 12, color: '#b45309' }}>(testi)</span>
                      )}
                    </td>
                    <td style={{ padding: '8px 4px' }}>{entry.recipient_count}</td>
                  </tr>
                  {expandedId === entry.id && (
                    <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td colSpan={3} style={{ padding: '4px 4px 12px 4px', fontSize: 13, color: '#6b7280' }}>
                        {entry.recipients.join(', ')}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}

              {!logLoading && log.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ padding: 16, textAlign: 'center', color: '#6b7280' }}>
                    Ei vielä lähetettyjä viestejä.
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
