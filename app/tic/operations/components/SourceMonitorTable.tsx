export default function SourceMonitorTable({
  sources,
}: {
  sources: any[]
}) {
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
            <th className="px-4 py-3">Lähde</th>
            <th className="px-4 py-3">Tila</th>
            <th className="px-4 py-3">Collector</th>
            <th className="px-4 py-3">Parser</th>
            <th className="px-4 py-3">Viime ajo</th>
            <th className="px-4 py-3">Ajot</th>
            <th className="px-4 py-3">Virheet</th>
          </tr>
        </thead>

        <tbody>
          {sources.map((source) => {
            const hasCurrentError = Boolean(source.last_error_message)

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