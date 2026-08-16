"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

/*
 * Mallin ehdotus osapuolista — ihmisen hyväksyttäväksi (D-078).
 *
 * Ehdotus EI ole asiakkaalle näkyvää dataa: se elää `metadata.ai_suggestion`
 * -kentässä kunnes joku painaa tästä hyväksy. Hyväksyntä kirjoittaa saman
 * muokkausreitin kautta kuin käsin tehty korjaus (D-076), joten arvot
 * merkitään `cost_source: "manual"`iksi ja jättävät muokkausjäljen —
 * hyväksytty ehdotus on ihmisen päätös, ei koneen.
 *
 * Lähteet näytetään klikattavina, koska tarkistaminen on koko pointti.
 */

type Suggestion = {
  developer: string | null
  builder: string | null
  estimated_cost: number | null
  confidence: "high" | "medium" | "low"
  sources: string[]
  reason: string
  model: string
  created_at: string
  own_development?: boolean
  verified?: string
}

const CONFIDENCE_STYLE: Record<string, string> = {
  high: "bg-green-100 text-green-800",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-red-100 text-red-800",
}

export default function AiSuggestion({
  projectId,
  suggestion,
  current,
}: {
  projectId: string
  suggestion: Suggestion
  current: { developer: string; builder: string; estimatedCost: string }
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  /*
   * MIKSI TÄSSÄ NÄYTETÄÄN MYÖS RISTIRIIDAT, EI VAIN TYHJIÄ KENTTIÄ.
   *
   * Ensimmäinen versio hyväksyi vain tyhjiin kenttiin, "jottei yliaja
   * tarkistettua tietoa". Vaikutus oli päinvastainen: kun kenttä oli jo
   * täynnä, nappi lukittui — ja ainoa tapa hyväksyä ehdotus oli tyhjentää
   * kenttä ensin käsin. Mitattu 16.8.2026: yhdellä hankkeella urakoitsija
   * "Marvea Uusimaa Oy" tyhjeni juuri sitä ennen kuin ehdotus hyväksyttiin.
   * Varovaisuudeksi tarkoitettu sääntö siis houkutteli tuhoamaan tiedon.
   *
   * Nyt eroavat arvot näytetään muodossa "nykyinen → ehdotettu" ja käyttäjä
   * valitsee. Sama arvo ei tuota valintaa lainkaan.
   */
  type Change = { key: string; label: string; from: string; to: string | number }

  const changes: Change[] = []

  const consider = (
    key: string,
    label: string,
    currentValue: string,
    suggested: string | number | null
  ) => {
    if (suggested === null || suggested === "") return
    if (String(currentValue).trim() === String(suggested).trim()) return
    changes.push({ key, label, from: currentValue, to: suggested })
  }

  consider("developer", "Rakennuttaja", current.developer, suggestion.developer)
  consider("builder", "Pääurakoitsija", current.builder, suggestion.builder)
  consider(
    "estimated_cost",
    "Kustannus",
    current.estimatedCost,
    suggestion.estimated_cost
  )

  const [selected, setSelected] = useState<string[]>(() =>
    /* Tyhjään kenttään lisäys on oletuksena valittu; korvaus ei ole. */
    changes.filter((c) => !c.from).map((c) => c.key)
  )

  const fields: Record<string, string | number> = {}
  for (const change of changes) {
    if (selected.includes(change.key)) fields[change.key] = change.to
  }

  const acceptable = Object.keys(fields)

  async function accept() {
    setSaving(true)
    setError(null)

    try {
      const response = await fetch("/api/tic/projects/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, fields }),
      })

      const result = await response.json()

      if (!response.ok || !result?.ok) {
        setError(result?.error ?? "Hyväksyntä epäonnistui")
        return
      }

      setDone(true)
      router.refresh()
    } catch (err: any) {
      setError(String(err?.message ?? err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-6">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold text-gray-900">Mallin ehdotus</h2>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-bold ${
            CONFIDENCE_STYLE[suggestion.confidence] ?? "bg-gray-100 text-gray-700"
          }`}
        >
          {suggestion.confidence}
        </span>
        <span className="text-xs text-gray-500">
          {suggestion.model} · {new Date(suggestion.created_at).toLocaleDateString("fi-FI")}
        </span>
      </div>

      <p className="mt-1 text-sm text-gray-600">
        Haettu verkosta. <strong>Tarkista lähteistä ennen hyväksyntää</strong> — hyväksyntä
        kirjoittaa arvot asiakkaalle näkyviin.
      </p>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-gray-500">Rakennuttaja</dt>
          <dd className="font-medium">{suggestion.developer ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Pääurakoitsija</dt>
          <dd className="font-medium">{suggestion.builder ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Kustannus</dt>
          <dd className="font-medium">
            {suggestion.estimated_cost
              ? `${suggestion.estimated_cost.toLocaleString("fi-FI")} €`
              : "—"}
          </dd>
        </div>
      </dl>

      {suggestion.own_development ? (
        <p className="mt-3 rounded-lg bg-white px-3 py-2 text-sm text-gray-700">
          <strong>Omaperusteinen hanke:</strong> sama yritys on tarkoituksella
          sekä rakennuttaja että urakoitsija.
        </p>
      ) : null}

      {suggestion.verified ? (
        <p className="mt-3 rounded-lg border border-green-300 bg-white px-3 py-2 text-sm text-gray-800">
          <strong>Tarkistettu lähteestä:</strong> {suggestion.verified}
        </p>
      ) : null}

      {suggestion.reason ? (
        <p className="mt-4 text-sm text-gray-700">{suggestion.reason}</p>
      ) : null}

      <div className="mt-4">
        <span className="text-sm font-medium text-gray-700">
          Lähteet ({suggestion.sources.length})
        </span>
        <ul className="mt-1 space-y-1">
          {suggestion.sources.map((url) => (
            <li key={url}>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-blue-700 underline break-all"
              >
                {url}
              </a>
            </li>
          ))}
        </ul>
      </div>

      {changes.length ? (
        <div className="mt-5 space-y-2">
          <span className="text-sm font-medium text-gray-700">
            Valitse mitkä kirjoitetaan
          </span>

          {changes.map((change) => (
            <label
              key={change.key}
              className="flex items-start gap-2 rounded-lg bg-white px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                className="mt-1"
                checked={selected.includes(change.key)}
                onChange={(e) =>
                  setSelected((current) =>
                    e.target.checked
                      ? [...current, change.key]
                      : current.filter((k) => k !== change.key)
                  )
                }
              />
              <span>
                <span className="font-medium">{change.label}:</span>{" "}
                {change.from ? (
                  <>
                    <span className="text-red-700 line-through">{change.from}</span>{" "}
                    <span aria-hidden>→</span>{" "}
                    <span className="font-medium">{change.to}</span>
                    <span className="ml-2 text-xs text-amber-700">
                      korvaa nykyisen arvon
                    </span>
                  </>
                ) : (
                  <span className="font-medium">{change.to}</span>
                )}
              </span>
            </label>
          ))}
        </div>
      ) : (
        <p className="mt-5 text-sm text-gray-600">
          Ehdotus vastaa hankkeen nykyisiä tietoja — ei muutettavaa.
        </p>
      )}

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={accept}
          disabled={saving || done || acceptable.length === 0}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {saving
            ? "Hyväksytään…"
            : acceptable.length
              ? `Hyväksy (${acceptable.length} kenttää)`
              : "Ei valintoja"}
        </button>

        {done && <span className="text-sm text-green-700">Hyväksytty</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </section>
  )
}
