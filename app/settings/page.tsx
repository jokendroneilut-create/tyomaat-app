'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function SettingsPage() {
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSave = async () => {
    setError(null)
    setSuccess(false)

    if (!password || password.length < 8) {
      setError('Salasanan pitää olla vähintään 8 merkkiä.')
      return
    }

    if (password !== password2) {
      setError('Salasanat eivät täsmää.')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.updateUser({ password })

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    setPassword('')
    setPassword2('')
    setSuccess(true)
  }

  return (
    <div style={{ padding: 20, maxWidth: 480 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 20 }}>Asetukset</h1>

      <div
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          padding: 20,
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Vaihda salasana</h2>

        <p style={{ marginBottom: 16, color: '#6b7280', fontSize: 14 }}>
          Aseta itsellesi uusi salasana kirjautumista varten.
        </p>

        <div style={{ display: 'grid', gap: 10 }}>
          <input
            type="password"
            placeholder="Uusi salasana"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              padding: 10,
              borderRadius: 8,
              border: '1px solid #d1d5db',
            }}
          />

          <input
            type="password"
            placeholder="Vahvista uusi salasana"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            style={{
              padding: 10,
              borderRadius: 8,
              border: '1px solid #d1d5db',
            }}
          />

          {error ? (
            <div style={{ color: '#b91c1c', fontSize: 14 }}>{error}</div>
          ) : null}

          {success ? (
            <div style={{ color: '#15803d', fontSize: 14 }}>Salasana vaihdettu.</div>
          ) : null}

          <button
            onClick={handleSave}
            disabled={loading}
            style={{
              padding: 10,
              borderRadius: 8,
              border: 'none',
              background: '#111827',
              color: 'white',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {loading ? 'Tallennetaan...' : 'Tallenna salasana'}
          </button>
        </div>
      </div>
    </div>
  )
}
