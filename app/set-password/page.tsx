'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

/*
 * Istunnon tila kutsu-/palautuslinkiltä tullessa:
 *  - 'checking': odotetaan että client hydratoi istunnon (evästeestä tai
 *    verifyOtp:n muistista). Mobiilissa tämä voi kestää hetken sivunlatauksen
 *    jälkeen, ja aiemmin updateUser ehti ajaa ENNEN tätä → "Auth session
 *    missing". Nyt tallennus on estetty kunnes istunto on varmistettu.
 *  - 'ready': istunto löytyi, salasanan voi asettaa.
 *  - 'missing': ei istuntoa (linkki vanhentunut/käytetty/eri selain) →
 *    näytä selkeä ohje, älä rikkinäistä lomaketta.
 */
type SessionState = 'checking' | 'ready' | 'missing'

export default function SetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionState, setSessionState] = useState<SessionState>('checking')

  useEffect(() => {
    let mounted = true

    // getUser() pakottaa istunnon hydratoinnin evästeestä + varmistaa sen
    // palvelimelta. Luotettavampi kuin pelkkä getSession() heti latauksen jälkeen.
    supabase.auth.getUser().then(({ data, error }) => {
      if (!mounted) return
      setSessionState(data?.user && !error ? 'ready' : 'missing')
    })

    // Jos istunto valmistuu vasta hetken kuluttua (async-hydrointi), päivitä tila.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      if (session) setSessionState('ready')
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

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

    let { error } = await supabase.auth.updateUser({ password })

    // Puolustus: jos istunto ei jostain syystä ehtinyt tallentua clientille,
    // yritä palauttaa se kertaalleen evästeen refresh-tokenista ennen kuin
    // näytetään virhe. Tämä kattaa mobiilin hydrointiviiveet.
    if (error && /auth session missing|session_not_found/i.test(error.message)) {
      const { data: refreshed } = await supabase.auth.refreshSession()
      if (refreshed?.session) {
        ;({ error } = await supabase.auth.updateUser({ password }))
      }
    }

    setLoading(false)

    if (error) {
      if (/auth session missing|session_not_found/i.test(error.message)) {
        setSessionState('missing')
        return
      }
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

      {sessionState === 'checking' && (
        <p style={{ color: '#4b5563' }}>Vahvistetaan kutsulinkkiä…</p>
      )}

      {sessionState === 'missing' && (
        <div>
          <p style={{ marginBottom: 12, color: '#4b5563' }}>
            Kirjautumislinkki ei ole enää voimassa tällä sivulla. Linkki on voinut
            vanhentua, tulla jo käytetyksi, tai avautua eri selaimessa kuin missä
            olet nyt.
          </p>
          <p style={{ marginBottom: 20, color: '#4b5563' }}>
            Avaa sähköpostin kutsulinkki uudelleen <strong>samassa selaimessa</strong>,
            tai pyydä ylläpitäjältä uusi kutsu. Voit myös käyttää{' '}
            <a href="/login" style={{ color: '#111827', fontWeight: 600, textDecoration: 'underline' }}>
              kirjautumissivun
            </a>{' '}
            &quot;Unohditko salasanasi?&quot; -linkkiä.
          </p>
        </div>
      )}

      {sessionState === 'ready' && (
        <>
          <p style={{ marginBottom: 20, color: '#4b5563' }}>
            Luo itsellesi uusi salasana palveluun kirjautumista varten.
          </p>

          <div style={{ display: 'grid', gap: 12 }}>
            <input
              type="password"
              placeholder="Uusi salasana"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
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
              autoComplete="new-password"
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
        </>
      )}
    </div>
  )
}
