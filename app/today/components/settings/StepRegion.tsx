"use client"

import { regions } from "./todaySettingsConfig"

type StepRegionProps = {
  wholeFinland: boolean
  selectedRegions: string[]
  onWholeFinlandChange: (selected: boolean) => void
  onRegionsChange: (regions: string[]) => void
}

export default function StepRegion({
  wholeFinland,
  selectedRegions,
  onWholeFinlandChange,
  onRegionsChange,
}: StepRegionProps) {
  function toggleRegion(region: string) {
    const nextRegions = selectedRegions.includes(region)
      ? selectedRegions.filter((item) => item !== region)
      : [...selectedRegions, region]

    onRegionsChange(nextRegions)
    onWholeFinlandChange(nextRegions.length === regions.length)
  }

  function toggleWholeFinland(selected: boolean) {
    onWholeFinlandChange(selected)
    onRegionsChange(selected ? [...regions] : [])
  }

  return (
    <div>
      <h3 className="text-xl font-bold text-gray-900">Missä toimit?</h3>

      <p className="mt-2 text-gray-600">
        Valitse koko Suomi tai ne maakunnat, joiden hankkeita haluat nähdä.
      </p>

      <div className="mt-5">
        <label className="flex items-center gap-3 rounded-lg border p-4 font-semibold">
          <input
            type="checkbox"
            checked={wholeFinland}
            onChange={(event) => toggleWholeFinland(event.target.checked)}
          />
          Koko Suomi
        </label>
      </div>

      <div className="mt-4 grid max-h-[300px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
        {regions.map((region) => (
          <label
            key={region}
            className="flex items-center gap-2 rounded-lg border p-3 text-sm"
          >
            <input
              type="checkbox"
              checked={selectedRegions.includes(region)}
              onChange={() => toggleRegion(region)}
            />
            {region}
          </label>
        ))}
      </div>
    </div>
  )
}