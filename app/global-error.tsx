"use client"

/*
 * VIRHERAJA JUURILAYOUTILLE (D-246).
 *
 * `app/error.tsx` ei voi nayttaa mitaan jos juurilayout itse kaatuu, koska
 * se renderoidaan layoutin SISALLA. Tama raja korvaa koko dokumentin, ja
 * siksi sen on tuotettava oma <html> ja <body>. Se on viimeinen verkko:
 * mitaan sovelluksen omaa tyylia tai komponenttia ei saa kayttaa, koska
 * juuri niiden lataaminen on voinut olla se mika kaatui.
 */

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="fi">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          margin: 0,
          padding: "48px 24px",
          textAlign: "center",
          color: "#111827",
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>Palvelussa on häiriö</h1>

        <p style={{ marginTop: 12, fontSize: 14, color: "#4b5563" }}>
          Sivua ei voitu näyttää. Yritä uudelleen hetken kuluttua.
        </p>

        <button
          onClick={reset}
          style={{
            marginTop: 24,
            padding: "10px 20px",
            fontSize: 14,
            fontWeight: 600,
            color: "#fff",
            background: "#2563eb",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          Yritä uudelleen
        </button>

        {error.digest && (
          <p style={{ marginTop: 32, fontSize: 12, color: "#9ca3af" }}>
            Virhetunnus: <span style={{ fontFamily: "monospace" }}>{error.digest}</span>
          </p>
        )}
      </body>
    </html>
  )
}
