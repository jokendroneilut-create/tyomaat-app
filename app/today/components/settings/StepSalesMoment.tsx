"use client"

import { salesMoments } from "./todaySettingsConfig"

type StepSalesMomentProps = {
  selectedMoments: string[]
  onChange: (moments: string[]) => void
  derivedFromRole?: string | null
}

export default function StepSalesMoment({
  selectedMoments,
  onChange,
  derivedFromRole,
}: StepSalesMomentProps) {
  const allSelected = selectedMoments.length === salesMoments.length

  function toggleMoment(moment: string) {
    const nextMoments = selectedMoments.includes(moment)
      ? selectedMoments.filter((item) => item !== moment)
      : [...selectedMoments, moment]

    onChange(nextMoments)
  }

  function toggleAll(selected: boolean) {
    onChange(selected ? [...salesMoments] : [])
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <h3 className="text-xl font-bold text-gray-900">
          Paras myyntihetki
        </h3>

        <span
          title="Valitse missä hankkeen vaiheessa haluat nähdä sen Tänään-näkymässä."
          className="inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs font-bold text-gray-600"
        >
          ?
        </span>
      </div>

      <p className="mt-2 text-gray-600">
        Voit valita yhden tai useamman vaiheen.
      </p>

      {derivedFromRole && selectedMoments.length > 0 && (
        <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          Johdettu roolistasi ({derivedFromRole}):{" "}
          <span className="font-semibold">{selectedMoments.join(", ")}</span>.
          Voit muokata valintaa vapaasti.
        </div>
      )}

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <label className="flex items-center gap-2 rounded-lg border p-3 text-sm font-semibold">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(event) => toggleAll(event.target.checked)}
          />
          Kaikki vaiheet
        </label>

        {salesMoments.map((moment) => (
          <label
            key={moment}
            className="flex items-center gap-2 rounded-lg border p-3 text-sm"
          >
            <input
              type="checkbox"
              checked={selectedMoments.includes(moment)}
              onChange={() => toggleMoment(moment)}
            />
            {moment}
          </label>
        ))}
      </div>
    </div>
  )
}