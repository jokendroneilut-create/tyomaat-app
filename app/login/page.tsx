'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function LoginPage() {
  const [nextPath, setNextPath] = useState('/dashboard')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const next = params.get('next')
      if (next) setNextPath(next)
    } catch {}
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    // ✅ täysi reload varmistaa että middleware näkee uudet cookiet heti
    window.location.href = nextPath
  }

  return (
    <div style={{ maxWidth: 420, margin: '40px auto', padding: 20 }}>
      <h1>Kirjaudu</h1>

      {error && (
        <div
          style={{
            marginTop: 10,
            padding: 10,
            border: '1px solid #ffb4b4',
            background: '#ffecec',
            borderRadius: 8,
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} style={{ marginTop: 12 }}>
        <input
          placeholder="Sähköposti"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: '100%', padding: 10, marginTop: 8 }}
          autoComplete="email"
        />
        <input
          placeholder="Salasana"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: '100%', padding: 10, marginTop: 8 }}
          autoComplete="current-password"
        />
        <button disabled={loading} style={{ marginTop: 12, padding: 10, width: '100%' }}>
          {loading ? 'Kirjaudutaan…' : 'Kirjaudu'}
        </button>
      </form>
    </div>
  )
}