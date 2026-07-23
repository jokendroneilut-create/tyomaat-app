"use client"

import { useMemo, useState } from "react"

type SortColumn =
  | "name"
  | "status"
  | "collector"
  | "parser"
  | "last_run_at"
  | "run_count"
  | "error_count"

type SortDirection = "asc" | "desc"

/*
 * "Tila" ei ole suoraan kentän arvo vaan pääteltävä useasta kentästä
 * (ks. hasCurrentError alla) - sille annetaan oma järjestysarvo
 * (Error > Healthy > Disabled), jotta lajittelu on mielekäs eikä pelkkää
 * aakkosjärjestystä satunnaisten badge-tekstien mukaan.
 */
function statusRank(source: any): number {
  const hasCurrentError =
    Boolean(source.last_error_at) &&
    (!source.last_success_at || source.last_error_at > source.last_success_at)

  if (hasCurrentError) return 0
  if (source.enabled) return 1
  return 2
}

export default function SourceMonitorTable({
  sources,
}: {
  sources: any[]
}) {
  const [sortColumn, setSortColumn] = useState<SortColumn>("name")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortColumn(column)
      setSortDirection("asc")
    }
  }

  const sortedSources = useMemo(() => {
    const sorted = [...sources].sort((a, b) => {
      let cmp = 0

      if (sortColumn === "status") {
        cmp = statusRank(a) - statusRank(b)
      } else if (sortColumn === "name") {
        cmp = (a.name ?? "").localeCompare(b.name ?? "", "fi")
      } else if (sortColumn === "collector") {
        cmp = (a.collector ?? "").localeCompare(b.collector ?? "", "fi")
      } else if (sortColumn === "parser") {
        cmp = (a.parser ?? "").localeCompare(b.parser ?? "", "fi")
      } else if (sortColumn === "last_run_at") {
        cmp = (a.last_run_at ?? "").localeCompare(b.last_run_at ?? "")
      } else if (sortColumn === "run_count") {
        cmp = (a.run_count ?? 0) - (b.run_count ?? 0)
      } else if (sortColumn === "error_count") {
        cmp = (a.error_count ?? 0) - (b.error_count ?? 0)
      }

      return sortDirection === "asc" ? cmp : -cmp
    })

    return sorted
  }, [sources, sortColumn, sortDirection])

  if (!sources.length) {
    return (
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Source Monitor</h2>
        <p className="mt-2 text-gray-600">Ei lähteitä.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
      <div className="border-b bg-gray-50 px-4 py-3">
        <h2 className="text-xl font-semibold">Source Monitor</h2>
      </div>

      <table className="min-w-full text-sm">
        <thead className="bg-gray-50">
          <tr className="text-left">
            <SortHeader column="name" label="Lähde" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
            <SortHeader column="status" label="Tila" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
            <SortHeader column="collector" label="Collector" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
            <SortHeader column="parser" label="Parser" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
            <SortHeader column="last_run_at" label="Viime ajo" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
            <SortHeader column="run_count" label="Ajot" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
            <SortHeader column="error_count" label="Virheet" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
          </tr>
        </thead>

        <tbody>
          {sortedSources.map((source) => {
            /*
             * last_error_message ei koskaan tyhjene onnistuneen ajon
             * jälkeen (ks. lib/agent/workers/sourceWorker.ts), joten
             * pelkkä sen olemassaolo näyttäisi ikuisesti "Error"-tilaa
             * yhdenkin kertaalleen sattuneen, jo itsestään korjautuneen
             * virheen jälkeen. Verrataan sen sijaan ajankohtia — vain jos
             * viimeisin virhe on tuoreempi kuin viimeisin onnistuminen.
             */
            const hasCurrentError =
              Boolean(source.last_error_at) &&
              (!source.last_success_at ||
                source.last_error_at > source.last_success_at)

            return (
              <tr key={source.id} className="border-t">
                <td className="px-4 py-3">
                  <div className="font-semibold">{source.name}</div>
                  <div className="text-xs text-gray-500">
                    {source.category}
                  </div>
                </td>

                <td className="px-4 py-3">
                  {hasCurrentError ? (
                    <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
                      Error
                    </span>
                  ) : source.enabled ? (
                    <span className="rounded-full bg-green-50 px-2 py-1 text-xs font-semibold text-green-700">
                      Healthy
                    </span>
                  ) : (
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600">
                      Disabled
                    </span>
                  )}
                </td>

                <td className="px-4 py-3">{source.collector}</td>
                <td className="px-4 py-3">{source.parser}</td>

                <td className="px-4 py-3">
                  {source.last_run_at
                    ? new Date(source.last_run_at).toLocaleString("fi-FI")
                    : "-"}
                </td>

                <td className="px-4 py-3">{source.run_count ?? 0}</td>
                <td className="px-4 py-3">{source.error_count ?? 0}</td>
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
