"use client"

import { maxProjectOptions } from "./todaySettingsConfig"

type StepMaxProjectsProps = {
  selectedValue: number
  onChange: (value: number) => void
  opportunityAlerts: boolean
  onAlertsChange: (enabled: boolean) => void
}

export default function StepMaxProjects({
  selectedValue,
  onChange,
  opportunityAlerts,
  onAlertsChange,
}: StepMaxProjectsProps) {
  return (
    <div>
      <h3 className="text-xl font-bold text-gray-900">
        Kuinka paljon haluat nähdä?
      </h3>

      <p className="mt-2 text-gray-600">
        Valitse enimmäismäärä hankkeita, jotka Tänään-näkymä näyttää kerralla.
      </p>

      <div className="mt-4 grid grid-cols-4 gap-2">
        {maxProjectOptions.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            className={`rounded-lg border px-3 py-2.5 text-sm font-semibold ${
              selectedValue === value
                ? "border-gray-900 bg-gray-900 text-white"
                : "hover:bg-gray-50"
            }`}
          >
            {value}
          </button>
        ))}
      </div>

      {/*
        * SÄHKÖPOSTIHÄLYTYKSET SIIRRETTIIN TÄNNE AVAINSANA-ASKELEELTA.
        *
        * Ne eivät liity avainsanoihin mitenkään — ne olivat samalla
        * sivulla vain siksi että siihen jäi tilaa. Kun avainsanalistaan
        * tuli rajausrasti, askel kasvoi yli modaalin korkeuden ja
        * vieritys palasi. Tämä askel taas oli lähes tyhjä: yksi rivi
        * nappeja. Siirto poistaa vierityksen molemmilta.
      */}
      <div className="mt-6 border-t pt-5">
        <h4 className="text-base font-bold text-gray-900">
          Sähköpostihälytykset
        </h4>

        <label className="mt-3 flex items-start gap-3 rounded-lg border p-3 text-sm">
          <input
            type="checkbox"
            checked={opportunityAlerts}
            onChange={(event) => onAlertsChange(event.target.checked)}
            className="mt-0.5 h-4 w-4"
          />
          <span className="text-gray-700">
            <span className="font-semibold text-gray-900">
              Ilmoita kun hanke etenee sinulle otolliseen vaiheeseen.
            </span>{" "}
            Saat sähköpostin kun kiinnostavan alueesi hanke saavuttaa juuri
            roolillesi osuvimman vaiheen (esim. materiaalitoimittaja, kun
            rakentaminen alkaa). Edellyttää valittua yritysprofiilia.
          </span>
        </label>
      </div>
    </div>
  )
}
