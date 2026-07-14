'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function LoginPage() {
  const [nextPath, setNextPath] = useState('/today')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetMessage, setResetMessage] = useState<string | null>(null)
  const [resetError, setResetError] = useState<string | null>(null)

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const next = params.get('next')

      if (next && next.startsWith('/')) {
        setNextPath(next)
      }
    } catch {}
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    // Täysi reload varmistaa, että middleware näkee uudet evästeet heti.
    window.location.href = nextPath
  }

  async function onResetSubmit(e: React.FormEvent) {
    e.preventDefault()
    setResetError(null)
    setResetMessage(null)
    setResetLoading(true)

    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/auth/callback?next=/set-password`,
    })

    setResetLoading(false)

    if (error) {
      setResetError(error.message)
      return
    }

    setResetMessage(
      'Jos sähköpostiosoite löytyy järjestelmästämme, olemme lähettäneet siihen linkin salasanan vaihtamista varten.'
    )
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

        <button
          disabled={loading}
          style={{ marginTop: 12, padding: 10, width: '100%' }}
        >
          {loading ? 'Kirjaudutaan…' : 'Kirjaudu'}
        </button>
      </form>

      <div style={{ marginTop: 16, textAlign: 'center' }}>
        <button
          type="button"
          onClick={() => {
            setShowForgotPassword(!showForgotPassword)
            setResetMessage(null)
            setResetError(null)
          }}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            color: '#2563eb',
            fontSize: 14,
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          Unohditko salasanasi?
        </button>
      </div>

      {showForgotPassword && (
        <form
          onSubmit={onResetSubmit}
          style={{
            marginTop: 16,
            padding: 16,
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            background: '#f9fafb',
          }}
        >
          <p style={{ marginTop: 0, marginBottom: 8, fontSize: 14, color: '#374151' }}>
            Syötä sähköpostiosoitteesi, niin lähetämme linkin jolla voit asettaa uuden salasanan.
          </p>

          <input
            placeholder="Sähköposti"
            type="email"
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
            style={{
              width: '100%',
              padding: 10,
              background: '#fff',
              border: '1px solid #d1d5db',
              borderRadius: 6,
            }}
            autoComplete="email"
          />

          <button
            disabled={resetLoading || !resetEmail}
            style={{
              marginTop: 10,
              padding: 10,
              width: '100%',
              background: '#111827',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {resetLoading ? 'Lähetetään…' : 'Lähetä palautuslinkki'}
          </button>

          {resetMessage && (
            <div style={{ marginTop: 10, fontSize: 13, color: '#166534' }}>
              {resetMessage}
            </div>
          )}

          {resetError && (
            <div style={{ marginTop: 10, fontSize: 13, color: '#b91c1c' }}>
              {resetError}
            </div>
          )}
        </form>
      )}
    </div>
  )
}