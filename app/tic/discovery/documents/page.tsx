import Link from "next/link"
import { getSourceDocuments } from "../../services/getSourceDocuments"

export const dynamic = "force-dynamic"

function formatDate(value: string | null) {
  if (!value) return "-"
  return new Date(value).toLocaleString("fi-FI")
}

export default async function DiscoveryDocumentsPage() {
  const documents = await getSourceDocuments()

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <Link href="/tic/discovery" className="text-sm text-gray-600">
        ← Takaisin Discoveryyn
      </Link>

      <h1 className="mt-6 text-3xl font-bold text-gray-900">
        Discovery Documents
      </h1>

      <div className="mt-6 rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="divide-y divide-gray-200">
          {documents.map((doc) => (
            <div key={doc.id} className="p-4">
              <div className="font-semibold text-gray-900">
                {doc.title ?? "Nimetön dokumentti"}
              </div>

              <div className="mt-1 text-sm text-gray-600">
                {doc.source_name} · {doc.document_type} · {doc.status ?? "-"} ·{" "}
                {formatDate(doc.created_at)}
              </div>

              {doc.error_message && (
                <p className="mt-2 text-sm text-red-600">
                  {doc.error_message}
                </p>
              )}

              <div className="mt-2 flex gap-4">
                <Link
                  href={`/tic/discovery/documents/${doc.id}`}
                  className="text-sm underline"
                >
                  Avaa dokumentti →
                </Link>

                <a
                  href={doc.document_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm underline"
                >
                  Avaa lähde →
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}