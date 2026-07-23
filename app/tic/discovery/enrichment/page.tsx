import Link from "next/link"
import { getRecentEnrichments } from "../../services/getRecentEnrichments"
import { displayPhaseLabel } from "@/lib/projects/phases"

export const dynamic = "force-dynamic"

function formatDate(value: string) {
  return new Date(value).toLocaleString("fi-FI")
}

export default async function EnrichmentPage() {
  const enrichments = await getRecentEnrichments(100)

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <Link href="/tic/discovery" className="text-sm text-gray-600">
        ← Takaisin Discoveryyn
      </Link>

      <h1 className="mt-6 text-3xl font-bold text-gray-900">Rikastus</h1>

      <p className="mt-2 text-gray-600">
        Jo hyväksytyt hankkeet, jotka ovat päivittyneet taustalla uudesta
        signaalista (esim. Rajukiven tiedote samasta työmaasta) — ilman
        että hanke on käynyt TIC-hyväksyntäjonon läpi. Eri asia kuin{" "}
        <Link href="/tic/discovery/merges" className="underline">
          Yhdistyneet hankkeet
        </Link>
        , joka koskee vain hyväksymishetkellä havaittuja täsmäytyksiä.
      </p>

      <section className="mt-8 rounded-2xl border bg-white shadow-sm">
        {enrichments.length === 0 ? (
          <div className="p-6 text-gray-600">Ei rikastustapahtumia vielä.</div>
        ) : (
          <div className="divide-y">
            {enrichments.map((item) => (
              <div
                key={item.id}
                className="grid gap-3 p-5 md:grid-cols-5 md:items-start"
              >
                <div className="md:col-span-2">
                  <Link
                    href={`/projects?open=${item.project_id}`}
                    target="_blank"
                    className="font-semibold text-blue-700 hover:underline"
                  >
                    {item.project_name ?? item.project_id}
                  </Link>
                  <div className="text-sm text-gray-500">
                    {item.project_city ?? "-"}
                  </div>
                </div>

                <div className="text-sm">
                  <div className="text-gray-500">Lähde</div>
                  <div>{item.source_name ?? "-"}</div>
                </div>

                <div className="text-sm">
                  <div className="text-gray-500">Vaihe eteni</div>
                  <div>
                    {displayPhaseLabel(item.previous_phase)} →{" "}
                    <span className="font-semibold">
                      {displayPhaseLabel(item.phase)}
                    </span>
                  </div>
                  {item.reason && (
                    <div className="mt-1 text-xs text-gray-500">
                      {item.reason}
                    </div>
                  )}
                </div>

                <div className="text-sm text-gray-500">
                  {formatDate(item.created_at)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
