"use client"

import { useState } from "react"

export default function CadenceSummary({
  enabledCount,
  sourcesPerRun,
  fullCycleDays,
  staleThresholdDays,
}: {
  enabledCount: number
  sourcesPerRun: number
  fullCycleDays: number
  staleThresholdDays: number
}) {
  const [showInfo, setShowInfo] = useState(false)

  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4">
          <div>
            <div className="text-sm text-gray-500">Lähteitä käytössä</div>
            <div className="mt-1 text-2xl font-bold">{enabledCount}</div>
          </div>

          <div>
            <div className="text-sm text-gray-500">Ajetaan yössä</div>
            <div className="mt-1 text-2xl font-bold">{sourcesPerRun}</div>
          </div>

          <div>
            <div className="text-sm text-gray-500">Täysi kierros</div>
            <div className="mt-1 text-2xl font-bold">~{fullCycleDays} pv</div>
          </div>

          <div>
            <div className="text-sm text-gray-500">Myöhässä jos yli</div>
            <div className="mt-1 text-2xl font-bold">{staleThresholdDays} pv</div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowInfo((v) => !v)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gray-300 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          aria-label="Miten tämä lasketaan"
        >
          i
        </button>
      </div>

      {showInfo && (
        <div className="mt-4 rounded-lg bg-gray-50 p-4 text-sm text-gray-700">
          <p>
            Yöllinen ajo (klo 03:00) käsittelee vain {sourcesPerRun} lähdettä
            kerrallaan, vaikka lähteiden oma "refresh_minutes"-asetus toivoisi
            useimmille päivittäistä ajoa. Kaikilla lähteillä on sama
            prioriteetti, joten ne käydään käytännössä läpi vuorotellen sen
            mukaan mikä on odottanut pisimpään.
          </p>
          <p className="mt-2">
            {enabledCount} lähdettä ÷ {sourcesPerRun}/yö = täysi kierros
            kestää noin {fullCycleDays} päivää. Tämä on normaali väli
            yksittäisen lähteen kahden ajon välillä — ei merkki ongelmasta.
            Source Monitor -taulukossa lähde merkitään "Myöhässä" vasta jos
            väli on merkittävästi (1,5x) tätä pidempi, eli yli{" "}
            {staleThresholdDays} päivää.
          </p>
        </div>
      )}
    </div>
  )
}
