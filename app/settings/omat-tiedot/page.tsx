"use client"

import { useEffect, useState } from "react"

/*
 * OMAT TIEDOT (D-238).
 *
 * Nimi ja puhelin ovat asiakkaan omia ja muokattavissa. Yritys ja
 * sahkoposti naytetaan mutta ne eivat ole muokattavissa:
 *
 *   - YRITYS on adminin asettama ja laskutuksen avain
 *     (`customer_billing.tunniste`). Jos asiakas kirjoittaisi
 *     "Koneunion" kun kannassa on "Koneunion Oy", laskutusrivi irtoaisi
 *     tunnuksesta. Johannes 6.10.2026: "Ei anneta asiakkaan muokata
 *     yrityksen nimea, mutta naytetaan se."
 *   - SAHKOPOSTI on kirjautumistunnus, jonka vaihto on oma ketjunsa.
 *
 * TEHTAVANIMIKETTA EI KYSYTA: "liian henkilokohtaista tietoa."
 */

type Tiedot = {
  etunimi: string
  sukunimi: string
  puhelin: string
  sahkoposti: string
  yritys: string | null
}

export default function OmatTiedotPage() {
  const [tiedot, setTiedot] = useState<Tiedot | null>(null)
  const [tallentaa, setTallentaa] = useState(false)
  const [virhe, setVirhe] = useState<string | null>(null)
  const [valmis, setValmis] = useState(false)

  useEffect(() => {
    fetch("/api/profiili")
      .then((r) => r.json())
      .then((tulos) => {
        if (tulos?.ok) setTiedot(tulos.profiili)
        else setVirhe(tulos?.error ?? "Tietojen haku epäonnistui")
      })
      .catch((e) => setVirhe(String(e?.message ?? e)))
  }, [])

  async function tallenna() {
    if (!tiedot || !tiedot.etunimi.trim()) return
    setTallentaa(true)
    setVirhe(null)
    setValmis(false)

    try {
      const vastaus = await fetch("/api/profiili", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          etunimi: tiedot.etunimi,
          sukunimi: tiedot.sukunimi,
          puhelin: tiedot.puhelin,
        }),
      })
      const tulos = await vastaus.json()
      if (!vastaus.ok || !tulos?.ok) {
        setVirhe(tulos?.error ?? "Tallennus epäonnistui")
        return
      }
      setValmis(true)
    } catch (err: any) {
      setVirhe(String(err?.message ?? err))
    } finally {
      setTallentaa(false)
    }
  }

  const kentta: React.CSSProperties = {
    width: "100%",
    border: "1px solid #d1d5db",
    borderRadius: 8,
    padding: "8px 10px",
    fontSize: 14,
  }

  const lukuKentta: React.CSSProperties = {
    ...kentta,
    background: "#f9fafb",
    color: "#6b7280",
  }

  return (
    <div style={{ padding: 20, maxWidth: 480 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 20 }}>Omat tiedot</h1>

      <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 20 }}>
        {virhe && (
          <p
            style={{
              background: "#fef2f2",
              color: "#991b1b",
              borderRadius: 8,
              padding: "8px 10px",
              fontSize: 14,
              marginBottom: 12,
            }}
          >
            {virhe}
          </p>
        )}

        {!tiedot ? (
          <p style={{ color: "#6b7280", fontSize: 14 }}>Haetaan…</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            <label style={{ display: "grid", gap: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Etunimi</span>
              <input
                style={kentta}
                value={tiedot.etunimi}
                onChange={(e) => setTiedot({ ...tiedot, etunimi: e.target.value })}
              />
            </label>

            <label style={{ display: "grid", gap: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Sukunimi</span>
              <input
                style={kentta}
                value={tiedot.sukunimi}
                onChange={(e) => setTiedot({ ...tiedot, sukunimi: e.target.value })}
              />
            </label>

            <label style={{ display: "grid", gap: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Puhelin</span>
              <input
                style={kentta}
                value={tiedot.puhelin}
                inputMode="tel"
                onChange={(e) => setTiedot({ ...tiedot, puhelin: e.target.value })}
              />
            </label>

            <label style={{ display: "grid", gap: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Yritys</span>
              <input style={lukuKentta} value={tiedot.yritys ?? "—"} readOnly />
              <span style={{ fontSize: 12, color: "#6b7280" }}>
                Yrityksen nimi on sovittu tilauksessa. Jos se on väärin, kerro
                palautteella niin korjaamme sen.
              </span>
            </label>

            <label style={{ display: "grid", gap: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Sähköposti</span>
              <input style={lukuKentta} value={tiedot.sahkoposti} readOnly />
              <span style={{ fontSize: 12, color: "#6b7280" }}>
                Sähköposti on kirjautumistunnuksesi.
              </span>
            </label>

            <button
              onClick={tallenna}
              disabled={tallentaa || !tiedot.etunimi.trim()}
              style={{
                marginTop: 4,
                background: "#2563eb",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "10px 14px",
                fontSize: 14,
                fontWeight: 700,
                cursor: tallentaa ? "default" : "pointer",
                opacity: tallentaa || !tiedot.etunimi.trim() ? 0.6 : 1,
              }}
            >
              {tallentaa ? "Tallennetaan…" : "Tallenna"}
            </button>

            {valmis && (
              <p style={{ color: "#166534", fontSize: 14 }}>Tiedot tallennettu.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
