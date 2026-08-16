"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { CANONICAL_PHASES } from "@/lib/projects/phases"
import { REGIONS } from "@/lib/geo/municipalities"

const PHASE_OPTIONS = CANONICAL_PHASES.map((p) => p.label)

/*
 * Hyväksytyn hankkeen kenttien korjaus (D-076).
 *
 * Erillinen `EditableCandidate`ista, koska ne kirjoittavat eri tauluun:
 * tämä `projects`iin, se `potential_projects`iin. Yhdistäminen näyttäisi
 * säästöltä mutta piilottaisi juuri sen eron joka aiheutti alkuperäisen
 * ongelman — käsin syötetyt tiedot menivät ehdokkaalle eivätkä koskaan
 * päätyneet hankkeelle.
 */

type Props = {
  projectId: string
  initial: {
    name: string
    region: string
    city: string
    location: string
    developer: string
    builder: string
    propertyType: string
    phase: string
    estimatedCost: string
    estimatedCompletion: string
    additionalInfo: string
  }
}

const FIELD_LABELS: Record<keyof Props["initial"], string> = {
  name: "Nimi",
  region: "Maakunta",
  city: "Kaupunki",
  location: "Sijainti / osoite",
  developer: "Rakennuttaja",
  builder: "Pääurakoitsija",
  propertyType: "Kohdetyyppi",
  phase: "Vaihe",
  estimatedCost: "Arvioitu kustannus (€)",
  estimatedCompletion: "Arvioitu valmistuminen",
  additionalInfo: "Kuvaus",
}

export default function EditProject({ projectId, initial }: Props) {
  const router = useRouter()
  const [values, setValues] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string[] | null>(null)

  /*
   * LOMAKKEEN TILA ON SYNKATTAVA PROPSIIN — muuten se kumoaa muut muutokset.
   *
   * `useState(initial)` alustaa vain kerran eikä päivity kun propsi muuttuu.
   * Kun ehdotus hyväksytään, kortti kirjoittaa arvon ja kutsuu
   * `router.refresh()`: palvelin renderöi uuden arvon, mutta lomakkeen oma
   * tila jää vanhaan tyhjään. Silloin `changedKeys` näkee eron ja tulkitsee
   * sen KÄYTTÄJÄN tyhjennykseksi — "Tallenna" kirjoittaa tyhjän juuri
   * hyväksytyn arvon päälle.
   *
   * Mitattu 16.8.2026: hanke "Asunto Oy Hyvinkään Altus" menetti näin
   * urakoitsijansa kahdesti peräkkäin, ja tallennus näytti onnistuneen.
   *
   * Synkataan kun palvelimen data OIKEASTI muuttuu, ei joka renderillä —
   * muuten kesken oleva kirjoitus katoaisi näppäimen alta.
   */
  const initialKey = JSON.stringify(initial)
  const [syncedKey, setSyncedKey] = useState(initialKey)

  if (syncedKey !== initialKey) {
    setSyncedKey(initialKey)
    setValues(initial)
    setSaved(null)
  }

  const set = (key: keyof Props["initial"]) => (value: string) =>
    setValues((current) => ({ ...current, [key]: value }))

  const changedKeys = (Object.keys(values) as (keyof Props["initial"])[]).filter(
    (key) => values[key] !== initial[key]
  )

  async function save() {
    setSaving(true)
    setError(null)
    setSaved(null)

    try {
      /*
       * Lähetetään vain muuttuneet kentät. Reitti tulkitsee tyhjän
       * merkkijonon tyhjennykseksi, joten koko lomakkeen lähettäminen
       * pyyhkisi kentät joita ei ole ladattu lomakkeelle.
       */
      const fields: Record<string, string | number | null> = {}

      for (const key of changedKeys) {
        const value = values[key]

        if (key === "estimatedCost") {
          fields.estimated_cost = value.trim() === "" ? null : Number(value)
          continue
        }

        const apiKey =
          key === "propertyType"
            ? "property_type"
            : key === "additionalInfo"
              ? "additional_info"
              : key === "estimatedCompletion"
                ? "estimated_completion"
                : key

        fields[apiKey] = value
      }

      const response = await fetch("/api/tic/projects/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, fields }),
      })

      const result = await response.json()

      if (!response.ok || !result?.ok) {
        setError(result?.error ?? "Tallennus epäonnistui")
        return
      }

      setSaved(result.changed ?? [])
      router.refresh()
    } catch (err: any) {
      setError(String(err?.message ?? err))
    } finally {
      setSaving(false)
    }
  }

  const textField = (key: keyof Props["initial"]) => (
    <label key={key} className="block">
      <span className="text-sm font-medium text-gray-700">{FIELD_LABELS[key]}</span>
      <input
        type="text"
        value={values[key]}
        onChange={(e) => set(key)(e.target.value)}
        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
      />
    </label>
  )

  return (
    <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">Korjaa tietoja</h2>

      <p className="mt-1 text-sm text-gray-600">
        Käsin syötetty arvo on vahvin: se ei kumoudu seuraavalla poiminnalla.
        Tyhjä kenttä tyhjentää arvon.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {textField("name")}
        {textField("developer")}
        {textField("builder")}
        {textField("propertyType")}

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Maakunta</span>
          <select
            value={values.region}
            onChange={(e) => set("region")(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">—</option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        {textField("city")}
        {textField("location")}

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Vaihe</span>
          <select
            value={values.phase}
            onChange={(e) => set("phase")(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">—</option>
            {PHASE_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        {textField("estimatedCost")}
        {textField("estimatedCompletion")}
      </div>

      <label className="mt-4 block">
        <span className="text-sm font-medium text-gray-700">Kuvaus</span>
        <textarea
          value={values.additionalInfo}
          onChange={(e) => set("additionalInfo")(e.target.value)}
          rows={6}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </label>

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving || changedKeys.length === 0}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {saving ? "Tallennetaan…" : `Tallenna (${changedKeys.length})`}
        </button>

        <button
          type="button"
          onClick={() => {
            setValues(initial)
            setError(null)
            setSaved(null)
          }}
          disabled={saving || changedKeys.length === 0}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm disabled:opacity-40"
        >
          Peruuta
        </button>

        {saved && (
          <span className="text-sm text-green-700">
            {saved.length ? `Tallennettu: ${saved.join(", ")}` : "Ei muutoksia"}
          </span>
        )}

        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </section>
  )
}
