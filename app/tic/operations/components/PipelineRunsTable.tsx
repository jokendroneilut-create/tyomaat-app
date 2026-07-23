"use client"

import { useMemo, useState } from "react"

type SortColumn =
  | "created_at"
  | "duration_ms"
  | "sources_run"
  | "article_runs"
  | "pdf_runs"
  | "text_runs"
  | "fact_runs"
  | "identity_runs"

type SortDirection = "asc" | "desc"

type PipelineRun = {
  id: string
  created_at: string
  duration_ms: number
  sources_run: number
  article_runs: number
  pdf_runs: number
  text_runs: number
  fact_runs: number
  identity_runs: number
  max_source_count: number | null
  source_ids: string[]
}

function percentColor(pct: number): string {
  if (pct >= 90) return "text-red-700 bg-red-50"
  if (pct >= 70) return "text-amber-700 bg-amber-50"
  return "text-green-700 bg-green-50"
}

export default function PipelineRunsTable({
  runs,
  maxDurationSeconds,
  platformHardLimitSeconds,
}: {
  runs: PipelineRun[]
  maxDurationSeconds: number
  platformHardLimitSeconds: number
}) {
  const [sortColumn, setSortColumn] = useState<SortColumn>("created_at")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortColumn(column)
      setSortDirection("asc")
    }
  }

  const sortedRuns = useMemo(() => {
    const sorted = [...runs].sort((a, b) => {
      let cmp = 0
      if (sortColumn === "created_at") {
        cmp = a.created_at.localeCompare(b.created_at)
      } else {
        cmp = (a[sortColumn] ?? 0) - (b[sortColumn] ?? 0)
      }
      return sortDirection === "asc" ? cmp : -cmp
    })
    return sorted
  }, [runs, sortColumn, sortDirection])

  const budgetNote = (
    <p className="mt-1 text-sm text-gray-600">
      Koko yöajon (kaikki vaiheet) kokonaiskesto suhteessa asetettuun{" "}
      <strong>{maxDurationSeconds}s</strong> turvarajaan. Vercelin todellinen
      kova katto (Fluid Compute päällä) on <strong>{platformHardLimitSeconds}s</strong> —
      {" "}{maxDurationSeconds}s on siis tarkoituksella jätetty selvästi sen
      alle, ei itse alusta rajoita tähän.
    </p>
  )

  if (!runs.length) {
    return (
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Ajot</h2>
        {budgetNote}
        <p className="mt-2 text-gray-600">
          Ei vielä tallennettuja ajoja. Seuraava yöajo (klo 03:00) tallentaa
          ensimmäisen rivin tähän.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
      <div className="border-b bg-gray-50 px-4 py-3">
        <h2 className="text-xl font-semibold">Ajot</h2>
        {budgetNote}
      </div>

      <table className="min-w-full text-sm">
        <thead className="bg-gray-50">
          <tr className="text-left">
            <SortHeader column="created_at" label="Ajettu" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
            <SortHeader column="duration_ms" label="Kesto" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
            <th className="px-4 py-3">% budjetista</th>
            <SortHeader column="sources_run" label="Lähteitä" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
            <SortHeader column="article_runs" label="Artikkelit" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
            <SortHeader column="pdf_runs" label="PDF:t" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
            <SortHeader column="text_runs" label="Tekstit" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
            <SortHeader column="fact_runs" label="Faktat" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
            <SortHeader column="identity_runs" label="Tunnistus" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
          </tr>
        </thead>

        <tbody>
          {sortedRuns.map((run) => {
            const seconds = run.duration_ms / 1000
            const pct = (seconds / maxDurationSeconds) * 100

            return (
              <tr key={run.id} className="border-t">
                <td className="px-4 py-3 text-gray-600">
                  {new Date(run.created_at).toLocaleString("fi-FI")}
                </td>
                <td className="px-4 py-3 font-semibold">
                  {seconds.toFixed(1)} s
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${percentColor(pct)}`}
                  >
                    {pct.toFixed(0)} %
                  </span>
                </td>
                <td className="px-4 py-3">{run.sources_run}</td>
                <td className="px-4 py-3">{run.article_runs}</td>
                <td className="px-4 py-3">{run.pdf_runs}</td>
                <td className="px-4 py-3">{run.text_runs}</td>
                <td className="px-4 py-3">{run.fact_runs}</td>
                <td className="px-4 py-3">{run.identity_runs}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function SortHeader({
  column,
  label,
  sortColumn,
  sortDirection,
  onSort,
}: {
  column: SortColumn
  label: string
  sortColumn: SortColumn
  sortDirection: SortDirection
  onSort: (column: SortColumn) => void
}) {
  const active = sortColumn === column
  const arrow = active ? (sortDirection === "asc" ? " ▲" : " ▼") : ""

  return (
    <th className="px-4 py-3">
      <button
        type="button"
        onClick={() => onSort(column)}
        className="font-inherit cursor-pointer border-none bg-transparent p-0 text-left"
        style={{ fontWeight: active ? 800 : 700 }}
      >
        {label}
        {arrow}
      </button>
    </th>
  )
}
