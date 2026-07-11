"use client"

import { maxProjectOptions } from "./todaySettingsConfig"

type StepMaxProjectsProps = {
  selectedValue: number
  onChange: (value: number) => void
}

export default function StepMaxProjects({
  selectedValue,
  onChange,
}: StepMaxProjectsProps) {
  return (
    <div>
      <h3 className="text-xl font-bold text-gray-900">
        Kuinka paljon haluat nähdä?
      </h3>

      <p className="mt-2 text-gray-600">
        Valitse enimmäismäärä hankkeita, jotka Tänään-näkymä näyttää kerralla.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        {maxProjectOptions.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            className={`rounded-lg border px-4 py-3 text-sm font-semibold ${
              selectedValue === value
                ? "border-gray-900 bg-gray-900 text-white"
                : "hover:bg-gray-50"
            }`}
          >
            {value}
          </button>
        ))}
      </div>
    </div>
  )
}