"use client"

import { useState } from "react"

/*
 * legacyCount poistettu: vanhat yrityslähteet olivat oma putkensa
 * discovery_sourcesin ulkopuolella, joten ne piti laskea erikseen mukaan.
 * Siirron jälkeen ne ovat samassa taulussa (collector =
 * legacyFetchCollector), joten enabledCount sisältää ne jo - erillinen
 * lisäys näytti 34 lähdettä liikaa.
 */
export default function CadenceSummary({
  enabledCount,
  sourcesPerRun,
  runsPerDay,
  fullCycleDays,
  staleThresholdDays,
  guaranteedCount,
}: {
  enabledCount: number
  sourcesPerRun: number
  runsPerDay: number
  fullCycleDays: number
  staleThresholdDays: number
  guaranteedCount: number
}) {
  const regularCount = enabledCount - guaranteedCount
  const regularSlotsPerRun = Math.max(1, sourcesPerRun - guaranteedCount)
  const sourcesPerDay = sourcesPerRun * runsPerDay
  const regularSlotsPerDay = regularSlotsPerRun * runsPerDay
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
            <div className="text-sm text-gray-500">Lähteitä / vrk</div>
            <div className="mt-1 text-2xl font-bold">{sourcesPerDay}</div>
            <div className="text-xs text-gray-400">
              {sourcesPerRun}/ajo × {runsPerDay} ajoa (6h välein)
            </div>
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
            Ajo tapahtuu {runsPerDay} kertaa vuorokaudessa (6 tunnin välein,
            klo 0/6/12/18) ja käsittelee {sourcesPerRun} lähdettä kerrallaan
            eli {sourcesPerDay} lähdettä päivässä, vaikka lähteiden oma
            "refresh_minutes"-asetus toivoisi useimmille päivittäistä ajoa.
            Muutamalla lähteellä on muita korkeampi prioriteetti (esim. Hilma,
            koska sen tarjousajat ovat usein lyhyempiä kuin muiden lähteiden
            ajovälit) — ne valitaan aina ensin ja varaavat siis kiinteän
            paikan joka ajossa. Loput {regularCount} lähdettä ovat keskenään
            samalla perustasolla ja kiertävät jäljelle jäävillä{" "}
            {regularSlotsPerRun} paikalla per ajo ({regularSlotsPerDay}/vrk)
            sen mukaan mikä on odottanut pisimpään.
          </p>
          <p className="mt-2">
            {regularCount} lähdettä ÷ {regularSlotsPerDay}/vrk = täysi kierros
            kestää noin {fullCycleDays} päivää{" "}
            {guaranteedCount > 0
              ? `(${guaranteedCount} korkean prioriteetin lähdettä jäävät tämän ulkopuolelle, koska ne ajetaan joka ajossa)`
              : ""}
            . Tämä on normaali väli yksittäisen perustason lähteen kahden
            ajon välillä — ei merkki ongelmasta. Source Monitor -taulukossa
            lähde merkitään "Myöhässä" vasta jos väli on merkittävästi (1,5x)
            tätä pidempi, eli yli {staleThresholdDays} päivää.
          </p>
        </div>
      )}
    </div>
  )
}
