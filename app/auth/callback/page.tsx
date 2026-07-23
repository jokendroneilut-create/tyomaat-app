'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search)
      const token_hash = params.get('token_hash')
      const type = params.get('type')
      const next = params.get('next') || '/today'

      if (!token_hash || !type) {
        setError(
          'Linkki puuttuu tarvittavia tietoja. Se on voinut avautua vahingossa (esim. sähköpostiohjelman linkintarkistus) tai olla virheellinen.'
        )
        return
      }

      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash,
        type: type as any,
      })

      if (verifyError) {
        console.error('AUTH CALLBACK ERROR:', verifyError)
        setError(
          'Linkki ei ole enää voimassa. Se on voinut jo vanhentua, tulla käytettyä kertaalleen, tai avautua eri laitteella/selaimella kuin millä sitä yritetään käyttää nyt.'
        )
        return
      }

      /*
       * Kutsu- ja salasanan-nollauslinkit eivät saa koskaan pudottaa
       * käyttäjää suoraan sovellukseen ilman salasanan asettamista -
       * aiemmin näin kävi, koska next oletti aina "/today" eikä kutsu
       * itse pyytänyt erillistä kohdetta. Käyttäjä näytti silloin
       * "aktivoituneelta" (email vahvistettu, kirjautunut) vaikka hänellä
       * ei koskaan ollut salasanaa - toimi vain niin kauan kuin sama
       * kirjautumisistunto pysyi voimassa.
       */
      if (type === 'invite' || type === 'recovery') {
        router.push('/set-password')
        return
      }

      router.push(next)
    }

    run()
  }, [router])

  if (error) {
    return (
      <div style={{ maxWidth: 420, margin: '80px auto', padding: 24, textAlign: 'center' }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 12 }}>
          Linkki ei toiminut
        </h1>
        <p style={{ color: '#4b5563', marginBottom: 20 }}>{error}</p>
        <p style={{ color: '#4b5563', marginBottom: 20 }}>
          Pyydä ylläpitäjältä uusi kutsu, tai ota yhteyttä{' '}
          <a href="mailto:info@tyomaat.fi" style={{ color: '#111827', fontWeight: 600 }}>
            info@tyomaat.fi
          </a>
          .
        </p>
        <a href="/login" style={{ color: '#111827', fontWeight: 600, textDecoration: 'underline' }}>
          Kirjautumissivulle →
        </a>
      </div>
    )
  }

  return <div style={{ padding: 24 }}>Kirjaudutaan...</div>
}