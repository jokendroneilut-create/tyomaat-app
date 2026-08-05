'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

/*
 * Sähköpostihälytysten kytkin oli aiemmin vain /today-näkymän "Mukauta
 * näkymää" -velhon avainsana-askeleessa, eli käytännössä löytymättömissä.
 * Ilmoituksen saanut käyttäjä etsii katkaisijaa Asetuksista.
 *
 * Sama kenttä (user_today_preferences.settings.opportunityAlerts) kuin
 * velhossa, jottei tilaa ole kahta.
 */
export default function NotificationSettingsPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [alertsEnabled, setAlertsEnabled] = useState(true)
  const [hasRole, setHasRole] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
        if (!cancelled) setError(err.message ?? 'Tuntematon virhe')
      } finally {
        if (!cancelled) setLoading(false)
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
    setSaving(true)
    setError(null)

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
      setError(err.message ?? 'Tuntematon virhe')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: 20, maxWidth: 480 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 20 }}>Ilmoitukset</h1>

      <div
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          padding: 20,
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
          Sähköpostihälytykset
        </h2>

        <p style={{ marginBottom: 16, color: '#6b7280', fontSize: 14 }}>
          Hallitse sähköposteja, joita Tyomaat.fi lähettää sinulle.
        </p>

        {loading ? (
          <div style={{ color: '#6b7280', fontSize: 14 }}>Ladataan…</div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            <label
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                cursor: saving ? 'wait' : 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={alertsEnabled}
                disabled={saving || !userId}
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

            {error ? (
              <div style={{ color: '#b91c1c', fontSize: 14 }}>{error}</div>
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
