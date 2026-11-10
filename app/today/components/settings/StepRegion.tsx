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

      <div className="mt-4">
        <label className="flex items-center gap-3 rounded-lg border px-3 py-2.5 font-semibold">
          <input
            type="checkbox"
            checked={wholeFinland}
            onChange={(event) => toggleWholeFinland(event.target.checked)}
          />
          Koko Suomi
        </label>
      </div>

      {/*
        * EI VIERITYSTÄ VIERITYKSEN SISÄLLÄ.
        *
        * Johannes 11.11.2026: *"Kaikista pahin minusta on tuo kuvassa näkyvä
        * vieritys vierityksen sisällä."* Tässä oli `max-h-[300px]
        * overflow-y-auto` modaalin oman vieritysalueen sisällä, eli kaksi
        * vierityspalkkia päällekkäin.
        *
        * 18 maakuntaa kahdessa sarakkeessa on yhdeksän riviä eikä mahdu.
        * Kolmessa sarakkeessa rivejä on kuusi, ja matalampi rivikorkeus
        * (py-2 eikä p-3) tuo koko listan noin 250 pikseliin — se mahtuu
        * näkyviin kerralla, joten sisäkkäistä vieritystä ei tarvita.
        * Pisin nimi on "Pohjois-Pohjanmaa", joka mahtuu sarakkeen leveyteen.
      */}
      <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
        {regions.map((region) => (
          <label
            key={region}
            className="flex items-center gap-2 rounded-lg border px-2.5 py-2 text-sm"
          >
            <input
              type="checkbox"
              className="shrink-0"
              checked={selectedRegions.includes(region)}
              onChange={() => toggleRegion(region)}
            />
            <span className="truncate">{region}</span>
          </label>
        ))}
      </div>
    </div>
  )
}
