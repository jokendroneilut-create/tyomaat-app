"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import type { DuplicateCandidate } from "../services/getDuplicateCandidates"

const REASON_LABELS: Record<string, string> = {
  same_permit_number: "Sama lupanumero",
  same_property_id: "Sama kiinteistötunnus",
  same_location: "Sama osoite",
  same_city: "Sama kaupunki",
  same_region: "Sama maakunta",
  exact_title: "Sama nimi",
  similar_title: "Samankaltainen nimi",
  same_developer: "Sama rakennuttaja",
  same_building_type: "Sama rakennustyyppi",
}

export default function DuplicateCandidatesReviewList({
  candidates,
}: {
  candidates: DuplicateCandidate[]
}) {
  const router = useRouter()
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function review(id: string, status: "confirmed_duplicate" | "not_duplicate") {
    setLoadingId(id)
    setError(null)

    try {
      const response = await fetch("/api/tic/duplicates/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? "Tallennus epäonnistui")

      router.refresh()
    } catch (err: any) {
      setError(err.message ?? "Tuntematon virhe")
    } finally {
      setLoadingId(null)
    }
  }

  async function hideProject(id: string, projectId: string) {
    setLoadingId(id)
    setError(null)

    try {
      const response = await fetch("/api/tic/duplicates/hide-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? "Piilotus epäonnistui")

      router.refresh()
    } catch (err: any) {
      setError(err.message ?? "Tuntematon virhe")
    } finally {
      setLoadingId(null)
    }
  }

  if (candidates.length === 0) {
    return (
      <div className="rounded-2xl border bg-white p-6 text-gray-600 shadow-sm">
        Ei tarkistettavia kaksoiskappaleita juuri nyt.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {candidates.map((c) => {
        const busy = loadingId === c.id

        return (
          <div key={c.id} className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-500">
                Varmuus: {c.confidence}%
              </div>
              <div className="flex flex-wrap gap-1">
                {c.reasons.map((r) => (
                  <span
                    key={r}
                    className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                  >
                    {REASON_LABELS[r] ?? r}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {[c.projectA, c.projectB].map((p, idx) =>
                p ? (
                  <div key={p.id} className="rounded-xl border border-gray-200 p-3">
                    <Link
                      href={`/projects?open=${p.id}`}
                      target="_blank"
                      className="font-semibold text-blue-700 hover:underline"
                    >
                      {p.name ?? "(nimetön)"}
                    </Link>
                    <div className="mt-1 text-sm text-gray-500">
                      {p.city ?? "-"} · {p.phase ?? "-"}
                      {!p.is_public && (
                        <span className="ml-2 rounded-full bg-gray-200 px-2 py-0.5 text-xs">
                          Piilotettu
                        </span>
                      )}
                    </div>
                    {p.is_public && (
                      <button
                        disabled={busy}
                        onClick={() => hideProject(c.id, p.id)}
                        className="mt-2 rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        Piilota tämä
                      </button>
                    )}
                  </div>
                ) : (
                  <div key={idx} className="rounded-xl border border-gray-200 p-3 text-sm text-gray-400">
                    Hanketta ei löytynyt (poistettu?)
                  </div>
                )
              )}
            </div>

            <div className="mt-4 flex gap-2">
              <button
                disabled={busy}
                onClick={() => review(c.id, "confirmed_duplicate")}
                className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                Vahvista kaksoiskappale
              </button>
              <button
                disabled={busy}
                onClick={() => review(c.id, "not_duplicate")}
                className="rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Ei sama hanke
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
