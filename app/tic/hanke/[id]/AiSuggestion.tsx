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
   * Vain kentät jotka ehdotus täyttää JA jotka ovat hankkeella tyhjät.
   * Hyväksyntä ei saa yliajaa jo tarkistettua tietoa.
   */
  const fields: Record<string, string | number> = {}
  if (suggestion.developer && !current.developer) fields.developer = suggestion.developer
  if (suggestion.builder && !current.builder) fields.builder = suggestion.builder
  if (suggestion.estimated_cost && !current.estimatedCost) {
    fields.estimated_cost = suggestion.estimated_cost
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
              : "Ei tyhjiä kenttiä täytettäväksi"}
        </button>

        {done && <span className="text-sm text-green-700">Hyväksytty</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </section>
  )
}
