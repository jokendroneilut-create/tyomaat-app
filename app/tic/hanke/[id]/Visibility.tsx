"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

/*
 * Hankkeen piilotus asiakkailta — ja palautus näkyviin.
 *
 * Ennen tätä ainoa tapa oli dashboardin kytkin, joka kirjoittaa `is_public`in
 * suoraan ilman perustelua. Piilotus on kuitenkin päätös ("tämä ei ole
 * hanke"), ja perustelematon päätös on seuraavalle katsojalle arvoitus.
 * Perustelu on siksi pakollinen piilotettaessa muttei palautettaessa.
 */

const PRESETS = [
  "Ei hanke — pelkkä uutinen tai markkinointi",
  "Duplikaatti",
  "Väärä tieto",
  "Ulkomainen tai muuten ei kuulu palveluun",
]

export default function Visibility({
  projectId,
  isPublic,
  hiddenReason,
}: {
  projectId: string
  isPublic: boolean
  hiddenReason?: string | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(nextPublic: boolean) {
    setSaving(true)
    setError(null)

    try {
      const response = await fetch("/api/tic/projects/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          fields: { is_public: nextPublic },
          ...(nextPublic ? {} : { reason }),
        }),
      })

      const result = await response.json()

      if (!response.ok || !result?.ok) {
        setError(result?.error ?? "Toiminto epäonnistui")
        return
      }

      setOpen(false)
      setReason("")
      router.refresh()
    } catch (err: any) {
      setError(String(err?.message ?? err))
    } finally {
      setSaving(false)
    }
  }

  if (!isPublic) {
    return (
      <section className="mt-6 rounded-2xl border border-gray-300 bg-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900">
          Piilotettu asiakkailta
        </h2>

        <p className="mt-1 text-sm text-gray-700">
          {hiddenReason ? `Syy: ${hiddenReason}` : "Syytä ei ole kirjattu."}
        </p>

        <button
          type="button"
          onClick={() => submit(true)}
          disabled={saving}
          className="mt-4 rounded-lg border border-gray-400 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-40"
        >
          {saving ? "Palautetaan…" : "Palauta näkyviin"}
        </button>

        {error && <span className="ml-3 text-sm text-red-600">{error}</span>}
      </section>
    )
  }

  return (
    <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">Näkyvyys</h2>

      <p className="mt-1 text-sm text-gray-600">
        Hanke näkyy asiakkaille. Piilota jos tämä ei ole hanke — esimerkiksi
        pelkkä uutinen tai yrityksen markkinointi.
      </p>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
        >
          Piilota asiakkailta
        </button>
      ) : (
        <div className="mt-4">
          <span className="text-sm font-medium text-gray-700">
            Perustelu (pakollinen)
          </span>

          <div className="mt-2 flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setReason(preset)}
                className={`rounded-full border px-3 py-1 text-xs ${
                  reason === preset
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "border-gray-300 hover:bg-gray-50"
                }`}
              >
                {preset}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="tai kirjoita oma syy"
            className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />

          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => submit(false)}
              disabled={saving || !reason.trim()}
              className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              {saving ? "Piilotetaan…" : "Piilota"}
            </button>

            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setReason("")
                setError(null)
              }}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
            >
              Peruuta
            </button>

            {error && <span className="text-sm text-red-600">{error}</span>}
          </div>
        </div>
      )}
    </section>
  )
}
