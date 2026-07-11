"use client"

import { todaySources } from "./todaySettingsConfig"

type StepSourcesProps = {
  selectedSources: string[]
  onChange: (sources: string[]) => void
}

export default function StepSources({
  selectedSources,
  onChange,
}: StepSourcesProps) {
  const allSelected = selectedSources.length === todaySources.length

  function toggleSource(source: string) {
    const nextSources = selectedSources.includes(source)
      ? selectedSources.filter((item) => item !== source)
      : [...selectedSources, source]

    onChange(nextSources)
  }

  function toggleAll(selected: boolean) {
    onChange(selected ? [...todaySources] : [])
  }

  return (
    <div>
      <h3 className="text-xl font-bold text-gray-900">
        Mistä lähteistä Tänään saa etsiä hankkeita?
      </h3>

      <p className="mt-2 text-gray-600">
        Voit valita kaikki lähteet tai rajata näkymän vain haluamiisi lähteisiin.
      </p>

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <label className="flex items-center gap-2 rounded-lg border p-3 text-sm font-semibold">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(event) => toggleAll(event.target.checked)}
          />
          Kaikki lähteet
        </label>

        {todaySources.map((source) => (
          <label
            key={source}
            className="flex items-center gap-2 rounded-lg border p-3 text-sm"
          >
            <input
              type="checkbox"
              checked={selectedSources.includes(source)}
              onChange={() => toggleSource(source)}
            />
            {source}
          </label>
        ))}
      </div>
    </div>
  )
}