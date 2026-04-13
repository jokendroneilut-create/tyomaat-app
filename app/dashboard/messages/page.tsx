'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function MessagesPage() {
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [testOnly, setTestOnly] = useState(true)
  const [result, setResult] = useState<string | null>(null)

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
  setResult(
    json.testOnly
      ? 'Testiviesti lähetetty sinulle'
      : `Viesti lähetetty ${json.sent} käyttäjälle`
  )
  setSubject('')
  setMessage('')
}
    } catch (err: any) {
      setResult('Virhe lähetyksessä')
    }

    setLoading(false)
  }

  return (
    <div style={{ padding: 24, maxWidth: 600 }}>
      <h1>Lähetä viesti asiakkaille</h1>

      <div style={{ marginTop: 16 }}>
        <label>Otsikko</label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          style={{ width: '100%', padding: 8, marginTop: 4 }}
        />
      </div>

      <div style={{ marginTop: 16 }}>
        <label>Viesti</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={6}
          style={{ width: '100%', padding: 8, marginTop: 4 }}
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
    </div>
  )
}