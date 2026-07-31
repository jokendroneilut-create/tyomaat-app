"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

/*
 * "Liitä hankkeeseen" — kolmas vaihtoehto hyväksy/hylkää-parin rinnalle.
 *
 * Osa ehdokkaista ei ole uusi hanke eikä roskaa, vaan uutta tietoa jo
 * tunnetusta hankkeesta: esimerkiksi uutinen urakoitsijan valinnasta.
 * Automaattinen yhdistäminen vaatii luottamuksen 70, ja sen alle jäävät
 * osumat ovat juuri niitä joissa ihmisen silmä ratkaisee - otsikot voivat
 * olla täysin eri, vaikka kyse on samasta kohteesta.
 *
 * Liittäminen käyttää samaa hyväksyntäreittiä kuin tavallinen hyväksyntä,
 * joten kentät täydentyvät samalla logiikalla: tyhjät täyttyvät, olemassa
 * olevia ei ylikirjoiteta.
 */
type Suggestion = {
  projectId: string
  name: string
  city: string | null
  region: string | null
  phase: string | null
  developer: string | null
  builder: string | null
  confidence: number
  reasons: string[]
}

const REASON_LABELS: Record<string, string> = {
  same_permit_number: "sama lupanumero",
  same_property_id: "sama kiinteistötunnus",
  same_location: "sama osoite",
  same_city: "sama kaupunki",
  same_region: "sama maakunta",
  exact_title: "sama nimi",
  exact_distinctive_title: "sama erottuva nimi",
  similar_title: "samankaltainen nimi",
  similar_description: "samankaltainen kuvaus",
  same_developer: "sama rakennuttaja",
  same_building_type: "sama rakennustyyppi",
}

export default function MergeIntoProject({ candidateId }: { candidateId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [merging, setMerging] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null)
  const [threshold, setThreshold] = useState(70)

  async function loadSuggestions() {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/tic/projects/match-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ potentialProjectId: candidateId }),
      })

      const result = await response.json()
      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "Ehdotusten haku epäonnistui")
      }

      setSuggestions(result.suggestions ?? [])
      setThreshold(result.autoMergeThreshold ?? 70)
    } catch (err: any) {
      setError(err.message ?? "Tuntematon virhe")
    } finally {
      setLoading(false)
    }
  }

  async function mergeInto(projectId: string, name: string) {
    const confirmed = window.confirm(
      `Liitetäänkö tämä ehdokas hankkeeseen "${name}"?\n\n` +
        "Ehdokkaan tiedot täydentävät hankkeen tyhjiä kenttiä. " +
        "Olemassa olevia arvoja ei ylikirjoiteta."
    )

    if (!confirmed) return

    setMerging(projectId)
    setError(null)

    try {
      const response = await fetch("/api/tic/projects/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          potentialProjectId: candidateId,
          mergeIntoProjectId: projectId,
        }),
      })

      const result = await response.json()
      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "Liittäminen epäonnistui")
      }

      router.push("/tic")
      router.refresh()
    } catch (err: any) {
      setError(err.message ?? "Tuntematon virhe")
      setMerging(null)
    }
  }

  return (
    <div className="mt-4 border-t border-gray-100 pt-4">
      {suggestions === null ? (
        <button
          type="button"
          onClick={loadSuggestions}
          disabled={loading}
          className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? "Haetaan…" : "Etsi olemassa oleva hanke"}
        </button>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-gray-900">
              Mahdolliset osumat ({suggestions.length})
            </p>
            <button
              type="button"
              onClick={loadSuggestions}
              disabled={loading}
              className="text-sm text-gray-500 underline disabled:opacity-50"
            >
              päivitä
            </button>
          </div>

          {suggestions.length === 0 && (
            <p className="mt-2 text-sm text-gray-600">
              Ei riittävän samankaltaisia hankkeita — tämä näyttää uudelta hankkeelta.
            </p>
          )}

          <div className="mt-3 space-y-2">
            {suggestions.map((s) => (
              <div
                key={s.projectId}
                className="rounded-xl border border-gray-200 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">{s.name}</p>
                    <p className="mt-0.5 text-sm text-gray-600">
                      {[s.city, s.region, s.phase].filter(Boolean).join(" · ")}
                    </p>
                    <p className="mt-0.5 text-sm text-gray-600">
                      {[
                        s.developer ? `Rakennuttaja: ${s.developer}` : null,
                        s.builder ? `Urakoitsija: ${s.builder}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>

                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      s.confidence >= threshold
                        ? "bg-green-100 text-green-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {s.confidence} / {threshold}
                  </span>
                </div>

                <p className="mt-2 text-xs text-gray-500">
                  {s.reasons.map((r) => REASON_LABELS[r] ?? r).join(", ")}
                </p>

                <button
                  type="button"
                  onClick={() => mergeInto(s.projectId, s.name)}
                  disabled={merging !== null}
                  className="mt-3 rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {merging === s.projectId ? "Liitetään…" : "Liitä tähän hankkeeseen"}
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  )
}
