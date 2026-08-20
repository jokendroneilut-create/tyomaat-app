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
  confidence: number | null
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
  name_in_description: "nimi mainittu kuvauksessa",
  same_developer: "sama rakennuttaja",
  same_building_type: "sama rakennustyyppi",
  /*
   * Sama katu ja talonumero, vaikka osoite on kirjoitettu eri tavoin.
   * Tämä ei ole täsmäytyksen pistemäärä vaan havainto ihmiselle.
   */
  same_street_address: "sama katuosoite",
  different_name_subjects: "eri kohde nimessä",
}

export default function MergeIntoProject({ candidateId }: { candidateId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [merging, setMerging] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null)
  const [browse, setBrowse] = useState<Suggestion[]>([])
  const [browseLabel, setBrowseLabel] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [threshold, setThreshold] = useState(70)

  async function loadSuggestions(searchQuery = "") {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/tic/projects/match-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          potentialProjectId: candidateId,
          query: searchQuery,
        }),
      })

      const result = await response.json()
      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "Ehdotusten haku epäonnistui")
      }

      setSuggestions(result.suggestions ?? [])
      setBrowse(result.browse ?? [])
      setBrowseLabel(result.browseLabel ?? null)
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

  function renderCard(s: Suggestion) {
    return (
      <div key={s.projectId} className="rounded-xl border border-gray-200 p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-gray-900">{s.name}</p>
            <p className="mt-0.5 text-sm text-gray-600">
              {[s.city, s.region, s.phase].filter(Boolean).join(" · ")}
            </p>
            <p className="mt-0.5 text-sm text-gray-600">
              {[
                s.developer ? `Rakennuttaja: ${s.developer}` : null,
                s.builder ? `Pääurakoitsija: ${s.builder}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>

          {/*
            * Pisteytys puuttuu selattavilta riveiltä: matcher hylkää osuman
            * jonka ainoa todiste on sama kaupunki, joten luottamusta ei ole.
            * Silloin merkkiä ei näytetä lainkaan eikä nollaa, joka näyttäisi
            * arviolta.
            */}
          {s.confidence != null && (
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                s.confidence >= threshold
                  ? "bg-green-100 text-green-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {s.confidence} / {threshold}
            </span>
          )}
        </div>

        {s.reasons.length > 0 && (
          <p className="mt-2 text-xs text-gray-500">
            {s.reasons.map((r) => REASON_LABELS[r] ?? r).join(", ")}
          </p>
        )}

        <button
          type="button"
          onClick={() => mergeInto(s.projectId, s.name)}
          disabled={merging !== null}
          className="mt-3 rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {merging === s.projectId ? "Liitetään…" : "Liitä tähän hankkeeseen"}
        </button>
      </div>
    )
  }

  return (
    <div className="mt-4 border-t border-gray-100 pt-4">
      {suggestions === null ? (
        <button
          type="button"
          onClick={() => loadSuggestions()}
          disabled={loading}
          className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? "Haetaan…" : "Etsi olemassa oleva hanke"}
        </button>
      ) : (
        <>
          <p className="text-sm font-semibold text-gray-900">
            Mahdolliset osumat ({suggestions.length})
          </p>

          {suggestions.length === 0 && (
            <p className="mt-2 text-sm text-gray-600">
              Automaattinen pisteytys ei löytänyt osumia. Etsi hanke nimellä tai
              selaa alta.
            </p>
          )}

          {/*
            * Hakukenttä on tarpeen, koska pisteytys ei voi löytää kaikkea:
            * uutisotsikko ei muistuta hankkeen nimeä, eikä pelkkä sama
            * kaupunki riitä osumaksi. Ihminen tietää mitä etsii.
            */}
          <div className="mt-3 flex gap-2">
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") loadSuggestions(query)
              }}
              placeholder="Hae hankkeen nimellä, kaupungilla tai yrityksellä…"
            />
            <button
              type="button"
              onClick={() => loadSuggestions(query)}
              disabled={loading}
              className="shrink-0 rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
            >
              {loading ? "…" : "Hae"}
            </button>
          </div>

          <div className="mt-3 space-y-2">{suggestions.map(renderCard)}</div>

          {browse.length > 0 && (
            <div className="mt-5">
              <p className="text-sm font-semibold text-gray-900">
                {browseLabel ?? "Muut hankkeet"} ({browse.length})
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Nämä eivät ole pisteytettyjä osumia vaan selattavia vaihtoehtoja.
              </p>
              <div className="mt-3 space-y-2">{browse.map(renderCard)}</div>
            </div>
          )}
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
