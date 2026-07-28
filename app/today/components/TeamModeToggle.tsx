"use client"

import { useState } from "react"

/*
 * Tiimi-integraation opt-in-kytkin /today:ssa. Näytetään vain jos käyttäjä
 * kuuluu tiimiin. Oletus off — tiimi voi olla olemassa, mutta käyttäjä päättää
 * itse haluaako tiimin omistajuudet /today-näkymään. Päällä ollessaan
 * kollegan omistamat piilotetaan oletuksena (hideTeammateOwned).
 */
export default function TeamModeToggle({
  userId,
  initialSettings,
}: {
  userId: string
  initialSettings: Record<string, any>
}) {
  const [teamMode, setTeamMode] = useState(
    initialSettings?.teamModeInToday === true
  )
  const [hideOwned, setHideOwned] = useState(
    initialSettings?.hideTeammateOwned !== false
  )
  const [saving, setSaving] = useState(false)

  async function persist(next: { teamMode: boolean; hideOwned: boolean }) {
    setSaving(true)
    try {
      await fetch("/api/today/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          settings: {
            ...initialSettings,
            teamModeInToday: next.teamMode,
            hideTeammateOwned: next.hideOwned,
          },
        }),
      })
      // Uudelleenlataus, jotta syöte lasketaan uudella asetuksella.
      window.location.reload()
    } catch {
      setSaving(false)
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={teamMode}
          disabled={saving}
          onChange={(event) => {
            const next = event.target.checked
            setTeamMode(next)
            persist({ teamMode: next, hideOwned })
          }}
          className="mt-0.5 h-4 w-4"
        />
        <span className="text-gray-700">
          <span className="font-semibold text-gray-900">
            🧑‍🤝‍🧑 Näytä tiimin omistajuudet
          </span>{" "}
          — huomioi kuka tiimissäsi omistaa minkäkin hankkeen. Kuulut tiimiin,
          mutta tämä on käytössä vain jos otat sen päälle.
        </span>
      </label>

      {teamMode && (
        <label className="mt-3 flex items-start gap-3 border-t pt-3 text-sm">
          <input
            type="checkbox"
            checked={hideOwned}
            disabled={saving}
            onChange={(event) => {
              const next = event.target.checked
              setHideOwned(next)
              persist({ teamMode, hideOwned: next })
            }}
            className="mt-0.5 h-4 w-4"
          />
          <span className="text-gray-700">
            <span className="font-semibold text-gray-900">
              Piilota kollegoiden omistamat hankkeet
            </span>{" "}
            — näet vain omat ja jakamattomat. Poista rasti nähdäksesi myös
            kollegoiden hankkeet (omistaja näkyy merkintänä).
          </span>
        </label>
      )}
    </div>
  )
}
