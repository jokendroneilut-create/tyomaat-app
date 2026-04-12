'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function SetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    setError(null)

    if (!password || password.length < 8) {
      setError('Salasanan pitää olla vähintään 8 merkkiä.')
      return
    }

    if (password !== password2) {
      setError('Salasanat eivät täsmää.')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.updateUser({
      password,
    })

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    router.push('/projects')
  }

  return (
    <div style={{ maxWidth: 420, margin: '60px auto', padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 16 }}>
        Aseta salasana
      </h1>

      <p style={{ marginBottom: 20, color: '#4b5563' }}>
        Luo itsellesi uusi salasana palveluun kirjautumista varten.
      </p>

      <div style={{ display: 'grid', gap: 12 }}>
        <input
          type="password"
          placeholder="Uusi salasana"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            padding: 12,
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
            padding: 12,
            borderRadius: 8,
            border: '1px solid #d1d5db',
          }}
        />

        {error ? (
          <div style={{ color: '#b91c1c', fontSize: 14 }}>{error}</div>
        ) : null}

        <button
          onClick={handleSave}
          disabled={loading}
          style={{
            padding: 12,
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
  )
}