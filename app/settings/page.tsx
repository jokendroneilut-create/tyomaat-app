'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function SettingsPage() {
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  /*
   * Sähköpostihälytysten kytkin oli aiemmin vain /today-näkymän "Mukauta
   * näkymää" -velhon avainsana-askeleessa, eli käytännössä löytymättömissä.
   * Ilmoituksen saanut käyttäjä etsii katkaisijaa Asetuksista.
   *
   * Sama kenttä (user_today_preferences.settings.opportunityAlerts) kuin
   * velhossa, jottei tilaa ole kahta.
   */
  const [userId, setUserId] = useState<string | null>(null)
  const [alertsEnabled, setAlertsEnabled] = useState(true)
  const [hasRole, setHasRole] = useState(true)
  const [alertsLoading, setAlertsLoading] = useState(true)
  const [alertsSaving, setAlertsSaving] = useState(false)
  const [alertsError, setAlertsError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadAlerts() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) throw new Error('Kirjautunutta käyttäjää ei löytynyt.')
        if (cancelled) return

        setUserId(user.id)

        const response = await fetch(
          `/api/today/preferences?userId=${encodeURIComponent(user.id)}`,
          { cache: 'no-store' }
        )
        const result = await response.json()

        if (!response.ok || !result.ok) {
          throw new Error(result.error ?? 'Asetusten lataaminen epäonnistui.')
        }
        if (cancelled) return

        setAlertsEnabled(result.settings?.opportunityAlerts !== false)
        setHasRole(Boolean(result.settings?.companyProfile))
      } catch (err: any) {
        if (!cancelled) setAlertsError(err.message ?? 'Tuntematon virhe')
      } finally {
        if (!cancelled) setAlertsLoading(false)
      }
    }

    loadAlerts()

    return () => {
      cancelled = true
    }
  }, [])

  async function handleAlertsChange(enabled: boolean) {
    if (!userId) return

    // Näytetään valinta heti; virheen sattuessa palautetaan entinen.
    const previous = alertsEnabled
    setAlertsEnabled(enabled)
    setAlertsSaving(true)
    setAlertsError(null)

    try {
      const response = await fetch('/api/today/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          settings: { opportunityAlerts: enabled },
        }),
      })

      const result = await response.json()
      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? 'Tallennus epäonnistui.')
      }
    } catch (err: any) {
      setAlertsEnabled(previous)
      setAlertsError(err.message ?? 'Tuntematon virhe')
    } finally {
      setAlertsSaving(false)
    }
  }

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

      <div
        id="ilmoitukset"
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          padding: 20,
          marginTop: 20,
          // Navi on kiinteä, joten ankkuri jäisi muuten sen alle.
          scrollMarginTop: 80,
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Ilmoitukset</h2>

        <p style={{ marginBottom: 16, color: '#6b7280', fontSize: 14 }}>
          Hallitse sähköposteja, joita Tyomaat.fi lähettää sinulle.
        </p>

        {alertsLoading ? (
          <div style={{ color: '#6b7280', fontSize: 14 }}>Ladataan…</div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            <label
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                cursor: alertsSaving ? 'wait' : 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={alertsEnabled}
                disabled={alertsSaving || !userId}
                onChange={(e) => handleAlertsChange(e.target.checked)}
                style={{ marginTop: 3, width: 16, height: 16 }}
              />
              <span style={{ fontSize: 14 }}>
                <span style={{ fontWeight: 700, color: '#111827' }}>
                  Ilmoita kun hanke etenee sinulle otolliseen vaiheeseen.
                </span>{' '}
                <span style={{ color: '#6b7280' }}>
                  Saat sähköpostin kun alueesi hanke saavuttaa juuri roolillesi
                  osuvimman vaiheen. Korkeintaan yksi viesti vuorokaudessa.
                </span>
              </span>
            </label>

            {!hasRole ? (
              <div style={{ color: '#6b7280', fontSize: 13 }}>
                Näitä ilmoituksia ei lähetetä ennen kuin olet valinnut
                yritysprofiilin Tänään-näkymän kohdasta “Mukauta näkymää”.
              </div>
            ) : null}

            {alertsError ? (
              <div style={{ color: '#b91c1c', fontSize: 14 }}>{alertsError}</div>
            ) : null}

            <div
              style={{
                borderTop: '1px solid #e5e7eb',
                paddingTop: 12,
                color: '#6b7280',
                fontSize: 13,
              }}
            >
              Hakuvahtien sähköpostikoosteet ovat erikseen jokaisella vahdilla —
              ne kytketään päälle ja pois{' '}
              <a href="/watchlists" style={{ color: '#111827', fontWeight: 600 }}>
                Hakuvahdit
              </a>
              -sivulla.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
