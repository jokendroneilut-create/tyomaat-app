import Link from "next/link"
import { getRecentMerges } from "../../services/getRecentMerges"

export const dynamic = "force-dynamic"

function formatDate(value: string) {
  return new Date(value).toLocaleString("fi-FI")
}

export default async function MergesPage() {
  const merges = await getRecentMerges(100)

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <Link href="/tic/discovery" className="text-sm text-gray-600">
        ← Takaisin Discoveryyn
      </Link>

      <h1 className="mt-6 text-3xl font-bold text-gray-900">
        Yhdistyneet hankkeet
      </h1>

      <p className="mt-2 text-gray-600">
        Ehdokkaat, jotka hyväksynnän yhteydessä tunnistettiin jo olemassa
        olevaksi hankkeeksi — hankkeen tiedot päivittyivät sen sijaan että
        uusi hanke olisi luotu.
      </p>

      <section className="mt-8 rounded-2xl border bg-white shadow-sm">
        {merges.length === 0 ? (
          <div className="p-6 text-gray-600">Ei yhdistymisiä vielä.</div>
        ) : (
          <div className="divide-y">
            {merges.map((merge) => (
              <div
                key={merge.id}
                className="grid gap-3 p-5 md:grid-cols-5 md:items-start"
              >
                <div className="md:col-span-2">
                  <div className="font-semibold text-gray-900">
                    {merge.candidate_title ?? "-"}
                  </div>
                  <div className="text-sm text-gray-500">
                    {merge.source_name ?? "-"}
                  </div>
                </div>

                <div className="text-sm">
                  <div className="text-gray-500">Yhdistyi hankkeeseen</div>
                  <Link
                    href={`/projects?open=${merge.project_id}`}
                    target="_blank"
                    className="font-semibold text-blue-700 hover:underline"
                  >
                    {merge.project_name ?? merge.project_id}
                  </Link>
                </div>

                <div className="text-sm">
                  <div className="text-gray-500">Varmuus / tapa</div>
                  <div>
                    {merge.confidence != null ? `${merge.confidence}%` : "-"}
                    {" · "}
                    {merge.matchedVia === "identifier"
                      ? "tunniste (tarkka)"
                      : "sumea täsmäytys"}
                  </div>
                  {merge.phaseAdvanced && (
                    <div className="mt-1 text-xs font-semibold text-emerald-700">
                      Vaihe eteni
                    </div>
                  )}
                </div>

                <div className="text-sm text-gray-500">
                  {formatDate(merge.created_at)}
                  {merge.source_url && (
                    <div className="mt-1">
                      <a
                        href={merge.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-700 hover:underline"
                      >
                        Lähde
                      </a>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
