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
  /* Lahetetty teksti; null ennen DDL:aa ja vanhoissa riveissa. */
  viesti?: string | null
}

/*
 * KOKEILUMUISTUTUKSET (D-340). Lahtevat automaattisesti cronilla, joten
 * tama on ainoa paikka josta nakee mita on lahtenyt.
 */
type MuistutusRivi = {
  id: string
  sent_at: string
  email: string | null
  virstanpylvas: number
  paivia_jaljella: number | null
  tila: string
  /* Lahetetty teksti sellaisena kuin se lahti; null ennen DDL:aa ja ohitetuilla. */
  otsikko?: string | null
  viesti?: string | null
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

  const [muistutukset, setMuistutukset] = useState<MuistutusRivi[]>([])
  const [muistutusLoading, setMuistutusLoading] = useState(true)
  const [muistutusPuuttuu, setMuistutusPuuttuu] = useState<string | null>(null)
  const [avattuMuistutus, setAvattuMuistutus] = useState<string | null>(null)

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

  const fetchMuistutukset = async () => {
    setMuistutusLoading(true)

    try {
      const res = await fetch('/api/admin/trial-reminder-log')
      const json = await res.json()

      if (res.ok) {
        setMuistutukset(json.log ?? [])
        setMuistutusPuuttuu(json.puuttuu ?? null)
      }
    } catch {
      // hiljainen epaonnistuminen - lokin lataus ei ole kriittinen
    }

    setMuistutusLoading(false)
  }

  useEffect(() => {
    fetchLog()
    fetchMuistutukset()
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
    /*
     * KAKSI PALSTAA (D-340).
     *
     * Johannes 24.10.2026: *"asettele kokeilumuistutukset oikealle
     * puolelle. Jono pitenee niin se painuu muuten koko ajan
     * alaspain."* Joukkoviestien loki kasvaa rajatta, joten allekkain
     * muistutukset valuisivat nakyvista. Oikea palsta on lisaksi
     * `sticky`, joten se pysyy nakyvissa kun vasenta vieritetaan.
     *
     * Kapealla naytolla `flexWrap` palauttaa palstat allekkain.
     */
    <div style={{ padding: 24, maxWidth: 1240 }}>
      <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 460px', minWidth: 0, maxWidth: 700 }}>
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
                      <td colSpan={3} style={{ padding: '4px 4px 16px 4px' }}>
                        <div
                          style={{
                            fontSize: 13,
                            color: '#374151',
                            whiteSpace: 'pre-wrap',
                            background: '#f9fafb',
                            border: '1px solid #e5e7eb',
                            borderRadius: 6,
                            padding: 12,
                          }}
                        >
                          {entry.viesti ?? 'Viestin tekstiä ei ole tallessa (lähetetty ennen 24.10.2026).'}
                        </div>
                        <div style={{ marginTop: 8, fontSize: 13, color: '#6b7280' }}>
                          {entry.recipients.join(', ')}
                        </div>
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

      {/*
        * KOKEILUMUISTUTUKSET (D-340). Nama lahtevat automaattisesti
        * cronilla neljassa vaiheessa (21, 14 ja 7 paivaa jaljella seka
        * paattymispaivana), joten loki on ainoa paikka josta lahteneet
        * nakee.
        */}
      <div style={{ flex: '1 1 420px', minWidth: 0, position: 'sticky', top: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 18 }}>Kokeilumuistutukset ({muistutukset.length})</h2>
          <button
            onClick={fetchMuistutukset}
            disabled={muistutusLoading}
            style={{
              padding: '6px 12px',
              background: '#f3f4f6',
              borderRadius: 6,
              border: '1px solid #e5e7eb',
              cursor: 'pointer',
            }}
          >
            {muistutusLoading ? 'Päivitetään...' : 'Päivitä'}
          </button>
        </div>

        <p style={{ marginTop: 6, fontSize: 13, color: '#6b7280' }}>
          Lähtevät automaattisesti Trial-asiakkaille kun kokeilua on jäljellä 21, 14 ja 7
          päivää sekä kokeilun päättyessä. Ei lukituille eikä muille laskutustiloille.
          Avaa rivi nähdäksesi lähetetyn viestin.
        </p>

        <div style={{ marginTop: 12, overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 440, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ padding: '8px 4px' }}>Ajankohta</th>
                <th style={{ padding: '8px 4px' }}>Vastaanottaja</th>
                <th style={{ padding: '8px 4px' }}>Vaihe</th>
                <th style={{ padding: '8px 4px' }}>Jäljellä</th>
              </tr>
            </thead>
            <tbody>
              {muistutukset.map((rivi) => (
                <Fragment key={rivi.id}>
                  <tr
                    style={{
                      borderBottom: '1px solid #f0f0f0',
                      cursor: rivi.viesti ? 'pointer' : 'default',
                    }}
                    onClick={() =>
                      rivi.viesti &&
                      setAvattuMuistutus(avattuMuistutus === rivi.id ? null : rivi.id)
                    }
                  >
                    <td style={{ padding: '8px 4px' }}>{formatDate(rivi.sent_at)}</td>
                    <td style={{ padding: '8px 4px' }}>{rivi.email ?? '-'}</td>
                    <td style={{ padding: '8px 4px' }}>
                      {/* Nolla on päättymisviesti, ei "0 pv jäljellä". */}
                      {rivi.virstanpylvas === 0 ? 'päättynyt' : `${rivi.virstanpylvas} pv`}
                      {rivi.tila === 'ohitettu' && (
                        <span style={{ marginLeft: 6, fontSize: 12, color: '#b45309' }}>
                          (ohitettu)
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '8px 4px' }}>
                      {rivi.paivia_jaljella == null || rivi.paivia_jaljella <= 0
                        ? '-'
                        : `${rivi.paivia_jaljella} pv`}
                    </td>
                  </tr>
                  {avattuMuistutus === rivi.id && rivi.viesti && (
                    <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td colSpan={4} style={{ padding: '4px 4px 16px 4px' }}>
                        {/*
                          * Teksti nayttaa mita LAHETETTIIN, ei mita
                          * lahetettaisiin nyt: se luetaan lokista eika
                          * rakenneta uudelleen.
                          */}
                        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                          {rivi.otsikko ?? '(ei otsikkoa)'}
                        </div>
                        <div
                          style={{
                            fontSize: 13,
                            color: '#374151',
                            whiteSpace: 'pre-wrap',
                            background: '#f9fafb',
                            border: '1px solid #e5e7eb',
                            borderRadius: 6,
                            padding: 12,
                          }}
                        >
                          {rivi.viesti}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}

              {!muistutusLoading && muistutukset.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: 16, textAlign: 'center', color: '#6b7280' }}>
                    {muistutusPuuttuu
                      ? 'Lokitaulua ei ole vielä luotu.'
                      : 'Ei vielä lähetettyjä muistutuksia.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      </div>
    </div>
  )
}
