import Link from "next/link"
import { notFound } from "next/navigation"
import { getCandidate } from "../../services/getCandidate"
import ProjectActions from "./ProjectActions"

export const dynamic = "force-dynamic"

type Props = {
  params: Promise<{
    id: string
  }>
}

function formatDate(value: string | null) {
  if (!value) return "Ei havaintoa"
  return new Date(value).toLocaleString("fi-FI")
}

export default async function CandidateDetailPage({ params }: Props) {
  const { id } = await params
  const detail = await getCandidate(id)

  if (!detail) {
    notFound()
  }

  const { candidate, signals } = detail
  const metadata = candidate.metadata ?? {}
  const contactPersons: { name: string; title: string | null; phone: string | null; email: string | null }[] =
    Array.isArray(metadata.contact_persons) ? metadata.contact_persons : []

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <Link href="/tic" className="text-sm text-gray-600 hover:text-gray-900">
        ← Takaisin TICiin
      </Link>

      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {candidate.title}
            </h1>

            <p className="mt-2 text-gray-600">
              {candidate.city ?? "Ei kaupunkia"}
              {candidate.location ? ` · ${candidate.location}` : ""}
            </p>

            {candidate.reason && (
              <p className="mt-4 text-gray-700">{candidate.reason}</p>
            )}
          </div>

          <div className="text-right">
  <div className="text-4xl font-bold text-gray-900">
    {candidate.score ?? 0}
  </div>

  <div className="mb-4 text-sm text-gray-500">
    prioriteetti
  </div>

  <ProjectActions candidateId={candidate.id} />
</div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-gray-200 p-4">
            <div className="text-sm text-gray-500">Luottamus</div>
            <div className="mt-1 text-xl font-semibold">
              {candidate.confidence ?? 0}%
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 p-4">
            <div className="text-sm text-gray-500">Signaaleja</div>
            <div className="mt-1 text-xl font-semibold">
              {candidate.signal_count}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 p-4">
            <div className="text-sm text-gray-500">Lähteitä</div>
            <div className="mt-1 text-xl font-semibold">
              {candidate.source_count}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 p-4">
            <div className="text-sm text-gray-500">Viimeisin havainto</div>
            <div className="mt-1 text-sm font-semibold">
              {formatDate(candidate.last_signal_at)}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">
          Esikatselu — näin hanke näkyisi hyväksynnän jälkeen
        </h2>

        <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2 text-sm text-gray-800 md:grid-cols-2">
          <p><strong>Maakunta:</strong> {metadata.region ?? "-"}</p>
          <p><strong>Kaupunki:</strong> {candidate.city ?? "-"}</p>
          <p><strong>Sijainti / osoite:</strong> {candidate.location ?? "-"}</p>
          <p><strong>🏗️ Rakennuttaja:</strong> {metadata.developer ?? "-"}</p>
          <p><strong>🏢 Kohdetyyppi:</strong> {metadata.building_type ?? "-"}</p>
          <p><strong>Vaihe:</strong> {metadata.phase_hint ?? metadata.decision_status ?? "-"}</p>
          {typeof metadata.site_area_m2 === "number" && (
            <p><strong>📐 Kaava-alueen pinta-ala:</strong> {Math.round(metadata.site_area_m2).toLocaleString("fi-FI")} m²</p>
          )}
        </div>

        {contactPersons.length > 0 && (
          <div className="mt-6 border-t border-gray-100 pt-4">
            <p className="mb-2 font-semibold text-gray-900">Yhteyshenkilöt</p>
            {contactPersons.map((contact, i) => (
              <p key={i} className="text-sm text-gray-800">
                {contact.name}
                {contact.title ? `, ${contact.title}` : ""}
                {contact.phone ? ` — ${contact.phone}` : ""}
                {contact.email ? ` — ${contact.email}` : ""}
              </p>
            ))}
          </div>
        )}

        {(metadata.description || metadata.operation) && (
          <div className="mt-6 border-t border-gray-100 pt-4">
            <p className="mb-2 font-semibold text-gray-900">Lisätietoja</p>
            <p className="whitespace-pre-line text-sm text-gray-700">
              {metadata.description ?? metadata.operation}
            </p>
          </div>
        )}

        {(metadata.source_url || metadata.documents_url) && (
          <div className="mt-6 flex flex-wrap gap-3 border-t border-gray-100 pt-4">
            {metadata.source_url && (
              <a
                href={metadata.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-gray-900 underline"
              >
                Avaa alkuperäinen ilmoitus →
              </a>
            )}
            {metadata.documents_url && (
              <a
                href={metadata.documents_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-gray-900 underline"
              >
                Avaa lähdesivu / asiakirjat →
              </a>
            )}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold text-gray-900">
          Signaalit ja lähteet
        </h2>

        <div className="mt-4 space-y-3">
          {signals.map((signal) => (
            <article
              key={signal.id}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {signal.title}
                  </h3>

                  <p className="mt-1 text-sm text-gray-600">
                    {signal.source_name ?? "Tuntematon lähde"} ·{" "}
                    {signal.normalized_signal_type ?? "luokittelematon"} ·{" "}
                    {formatDate(signal.created_at)}
                  </p>
                </div>

                <div className="text-right text-sm">
                  <div className="font-semibold">
                    {signal.relevance_score ?? 0}
                  </div>
                  <div className="text-gray-500">pistettä</div>
                </div>
              </div>

              {signal.classification_reason && (
                <p className="mt-3 text-sm text-gray-700">
                  {signal.classification_reason}
                </p>
              )}

              {signal.source_url && (
                <a
                  href={signal.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block text-sm font-medium text-gray-900 underline"
                >
                  Avaa lähde →
                </a>
              )}
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}