"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { CANONICAL_PHASES } from "@/lib/projects/phases"
import { REGIONS } from "@/lib/geo/municipalities"

const PHASE_OPTIONS = CANONICAL_PHASES.map((p) => p.label)

type Props = {
  candidateId: string
  initial: {
    title: string
    region: string
    city: string
    address: string
    developer: string
    buildingType: string
    phaseHint: string
  }
}

export default function EditableCandidate({ candidateId, initial }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState(initial.title)
  const [region, setRegion] = useState(initial.region)
  const [city, setCity] = useState(initial.city)
  const [address, setAddress] = useState(initial.address)
  const [developer, setDeveloper] = useState(initial.developer)
  const [buildingType, setBuildingType] = useState(initial.buildingType)
  const [phaseHint, setPhaseHint] = useState(initial.phaseHint)

  function cancelEdit() {
    setTitle(initial.title)
    setRegion(initial.region)
    setCity(initial.city)
    setAddress(initial.address)
    setDeveloper(initial.developer)
    setBuildingType(initial.buildingType)
    setPhaseHint(initial.phaseHint)
    setError(null)
    setEditing(false)
  }

  async function save() {
    setSaving(true)
    setError(null)

    try {
      const response = await fetch("/api/tic/projects/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          potentialProjectId: candidateId,
          title,
          region,
          municipality: city,
          address,
          developer,
          buildingType,
          phaseHint,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "Tallennus epäonnistui")
      }

      setEditing(false)
      router.refresh()
    } catch (err: any) {
      setError(err.message ?? "Tuntematon virhe")
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <div>
        <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2 text-sm text-gray-800 md:grid-cols-2">
          <p><strong>Maakunta:</strong> {region || "-"}</p>
          <p><strong>Kaupunki:</strong> {city || "-"}</p>
          <p><strong>Sijainti / osoite:</strong> {address || "-"}</p>
          <p><strong>🏗️ Rakennuttaja:</strong> {developer || "-"}</p>
          <p><strong>🏢 Kohdetyyppi:</strong> {buildingType || "-"}</p>
          <p><strong>Vaihe:</strong> {phaseHint || "-"}</p>
        </div>

        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-4 rounded-lg border px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          Muokkaa tietoja
        </button>
      </div>
    )
  }

  return (
    <div className="mt-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-semibold text-gray-700">Otsikko</span>
          <input
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        <label className="text-sm">
          <span className="mb-1 block font-semibold text-gray-700">Vaihe</span>
          <select
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            value={phaseHint}
            onChange={(e) => setPhaseHint(e.target.value)}
          >
            <option value="">-</option>
            {PHASE_OPTIONS.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="mb-1 block font-semibold text-gray-700">Maakunta</span>
          <select
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
          >
            <option value="">-</option>
            {REGIONS.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="mb-1 block font-semibold text-gray-700">Kaupunki</span>
          <input
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
        </label>

        <label className="text-sm">
          <span className="mb-1 block font-semibold text-gray-700">Sijainti / osoite</span>
          <input
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </label>

        <label className="text-sm">
          <span className="mb-1 block font-semibold text-gray-700">🏗️ Rakennuttaja</span>
          <input
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            value={developer}
            onChange={(e) => setDeveloper(e.target.value)}
          />
        </label>

        <label className="text-sm">
          <span className="mb-1 block font-semibold text-gray-700">🏢 Kohdetyyppi</span>
          <input
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            value={buildingType}
            onChange={(e) => setBuildingType(e.target.value)}
          />
        </label>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Tallennetaan..." : "Tallenna muutokset"}
        </button>

        <button
          type="button"
          onClick={cancelEdit}
          disabled={saving}
          className="rounded-lg border px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-50"
        >
          Peruuta
        </button>
      </div>

      {error && <div className="mt-2 text-sm text-red-700">{error}</div>}
    </div>
  )
}
