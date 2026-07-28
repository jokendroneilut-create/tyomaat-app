"use client"

import { useState } from "react"
import {
  companyProfiles,
  salesMoments,
  regions as ALL_REGIONS,
  todaySources,
} from "./settings/todaySettingsConfig"

type Props = {
  userId: string
  // Nykyiset asetukset (oletukset mukana) — säilytetään tallennuksessa,
  // jotta rooli ei pyyhi muita valintoja.
  initialSettings: Record<string, any>
}

/*
 * Aktivointi-onboarding: pakolliset valinnat ensimmäisellä /today-käynnillä
 * (näytetään kunnes companyProfile on asetettu). Rooli + paras myyntihetki
 * ovat PAKOLLISIA — ilman niitä näkymä ei suodatu/pisteydy oikein. Alue on
 * valinnainen (oletus koko Suomi). Lähteet asetetaan oletuksena KAIKKI päälle.
 */
export default function RoleActivationModal({ userId, initialSettings }: Props) {
  const [role, setRole] = useState<string | null>(
    initialSettings?.companyProfile ?? null
  )
  const [selectedMoments, setSelectedMoments] = useState<string[]>(
    Array.isArray(initialSettings?.bestSalesMoments)
      ? initialSettings.bestSalesMoments
      : []
  )
  const [wholeFinland, setWholeFinland] = useState(true)
  const [selectedRegions, setSelectedRegions] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSave = Boolean(role) && selectedMoments.length > 0

  function toggleMoment(moment: string) {
    setSelectedMoments((current) =>
      current.includes(moment)
        ? current.filter((m) => m !== moment)
        : [...current, moment]
    )
  }

  function toggleRegion(region: string) {
    setWholeFinland(false)
    setSelectedRegions((current) =>
      current.includes(region)
        ? current.filter((r) => r !== region)
        : [...current, region]
    )
  }

  async function save() {
    if (!canSave) return
    setSaving(true)
    setError(null)

    try {
      const regions =
        wholeFinland || selectedRegions.length === 0
          ? ["Koko Suomi"]
          : selectedRegions

      // Lähteet: oletuksena KAIKKI päälle (säilytä olemassa olevat jos on).
      const sources =
        Array.isArray(initialSettings?.sources) &&
        initialSettings.sources.length > 0
          ? initialSettings.sources
          : [...todaySources]

      const response = await fetch("/api/today/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          settings: {
            ...initialSettings,
            companyProfile: role,
            bestSalesMoments: selectedMoments,
            regions,
            sources,
          },
        }),
      })

      const json = await response.json()
      if (!response.ok || !json.ok) {
        throw new Error(json.error ?? "Tallennus epäonnistui")
      }

      // Uudelleenlataus, jotta /today pisteyttää roolilla ja modaali katoaa.
      window.location.reload()
    } catch (err: any) {
      setError(err?.message ?? "Tallennus epäonnistui")
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="shrink-0 border-b px-6 py-5">
          <h2 className="text-2xl font-bold text-gray-900">
            Tervetuloa Tänään-näkymään 👋
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Kerro roolisi ja parhaat myyntihetkesi, niin näytämme juuri sinulle
            sopivimmat hankkeet ja hälytämme, kun hanke etenee sinulle otolliseen
            vaiheeseen.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <label className="block text-sm font-semibold text-gray-700">
            Roolisi <span className="text-red-600">*</span>
          </label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {companyProfiles.map((profile) => (
              <button
                key={profile}
                type="button"
                onClick={() => setRole(profile)}
                className={
                  "rounded-lg border px-3 py-2 text-sm font-medium " +
                  (role === profile
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "border-gray-300 text-gray-800 hover:bg-gray-50")
                }
              >
                {profile}
              </button>
            ))}
          </div>

          <label className="mt-6 block text-sm font-semibold text-gray-700">
            Parhaat myyntihetket <span className="text-red-600">*</span>
          </label>
          <p className="mt-1 text-xs text-gray-500">
            Missä hankkeen vaiheessa haluat tarttua? Valitse vähintään yksi.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {salesMoments.map((moment) => {
              const active = selectedMoments.includes(moment)
              return (
                <button
                  key={moment}
                  type="button"
                  onClick={() => toggleMoment(moment)}
                  className={
                    "rounded-full border px-2.5 py-1 text-xs " +
                    (active
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-300 text-gray-700 hover:bg-gray-50")
                  }
                >
                  {moment}
                </button>
              )
            })}
          </div>

          <label className="mt-6 block text-sm font-semibold text-gray-700">
            Alue (valinnainen)
          </label>
          <label className="mt-2 flex items-center gap-2 text-sm text-gray-800">
            <input
              type="checkbox"
              checked={wholeFinland}
              onChange={(event) => {
                setWholeFinland(event.target.checked)
                if (event.target.checked) setSelectedRegions([])
              }}
              className="h-4 w-4"
            />
            Koko Suomi
          </label>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {ALL_REGIONS.map((region) => {
              const active = !wholeFinland && selectedRegions.includes(region)
              return (
                <button
                  key={region}
                  type="button"
                  onClick={() => toggleRegion(region)}
                  className={
                    "rounded-full border px-2.5 py-1 text-xs " +
                    (active
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-300 text-gray-700 hover:bg-gray-50")
                  }
                >
                  {region}
                </button>
              )
            })}
          </div>

          <p className="mt-3 text-xs text-gray-400">
            Voit muuttaa näitä myöhemmin "Mukauta näkymää" -asetuksista.
          </p>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t px-6 py-4">
          <button
            type="button"
            onClick={save}
            disabled={!canSave || saving}
            className="w-full rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Tallennetaan..." : "Tallenna ja jatka"}
          </button>
          {!canSave && (
            <p className="mt-2 text-center text-xs text-gray-400">
              Valitse rooli ja vähintään yksi myyntihetki jatkaaksesi
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
