import { getRelevanceDecisions } from "../../services/getRelevanceDecisions"

export const dynamic = "force-dynamic"

function formatDate(value: string | null) {
  if (!value) return "-"
  return new Date(value).toLocaleString("fi-FI")
}

export default async function AiRelevancePage() {
  const { decisions, total, surfaced, ignored } = await getRelevanceDecisions(200)

  return (
    <main>
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">🤖 AI-suodatus</h1>
        <p className="mt-2 text-gray-600">
          Automaattisen relevanssiportin päätökset harmaan alueen signaaleille.
          Malli päättää pääseekö signaali katselmointijonoosi (näytetty) vai
          suodattuuko se pois (suodatettu). Se ei koskaan hyväksy mitään
          julkiseksi hankkeeksi — se on aina sinun päätöksesi.
        </p>

        <div className="mt-4 grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-gray-200 p-4">
            <div className="text-sm text-gray-500">Päätöksiä</div>
            <div className="mt-1 text-xl font-semibold">{total}</div>
          </div>
          <div className="rounded-xl border border-gray-200 p-4">
            <div className="text-sm text-gray-500">Näytetty</div>
            <div className="mt-1 text-xl font-semibold text-green-700">
              {surfaced}
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 p-4">
            <div className="text-sm text-gray-500">Suodatettu pois</div>
            <div className="mt-1 text-xl font-semibold text-gray-700">
              {ignored}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6">
        {decisions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-500">
            Ei vielä AI-päätöksiä. Portti aktivoituu kun discovery-putki käsittelee
            uusia harmaan alueen signaaleja (ja ANTHROPIC_API_KEY on asetettu).
          </div>
        ) : (
          <div className="space-y-3">
            {decisions.map((d) => {
              const filtered = d.final_status === "ignored"
              return (
                <article
                  key={d.id}
                  className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-gray-900">
                        {d.title ?? "(ei otsikkoa)"}
                      </h3>
                      <p className="mt-1 text-sm text-gray-500">
                        {d.source_name ?? "tuntematon lähde"} ·{" "}
                        {formatDate(d.created_at)} · {d.model ?? "-"}
                      </p>
                    </div>

                    <span
                      className={
                        "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium " +
                        (filtered
                          ? "bg-gray-100 text-gray-700"
                          : "bg-green-100 text-green-800")
                      }
                    >
                      {filtered ? "Suodatettu pois" : "Näytetty"} ·{" "}
                      {Math.round((d.llm_confidence ?? 0) * 100)} %
                    </span>
                  </div>

                  {d.llm_reason && (
                    <p className="mt-2 text-sm text-gray-700">{d.llm_reason}</p>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}
