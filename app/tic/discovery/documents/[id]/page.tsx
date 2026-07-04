import Link from "next/link"
import { notFound } from "next/navigation"

import { getSourceDocument } from "../../../services/getSourceDocument"
import CollectArticleButton from "../../../components/CollectArticleButton"

export const dynamic = "force-dynamic"

type Props = {
  params: Promise<{
    id: string
  }>
}

export default async function SourceDocumentPage({ params }: Props) {
  const { id } = await params

  const document = await getSourceDocument(id)

  if (!document) {
    notFound()
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <Link
        href="/tic/discovery/documents"
        className="text-sm text-gray-600"
      >
        ← Takaisin dokumentteihin
      </Link>

      <h1 className="mt-6 text-3xl font-bold text-gray-900">
        {document.title ?? "Nimetön dokumentti"}
      </h1>

      <p className="mt-2 text-gray-600">
        {document.source_name} · {document.document_type} ·{" "}
        {document.status ?? "-"}
      </p>

      <a
        href={document.document_url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-block text-sm underline"
      >
        Avaa alkuperäinen lähde →
      </a>

      <CollectArticleButton documentId={document.id} />

      <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-xl font-semibold">Raw payload</h2>

        <pre className="mt-4 max-h-[300px] overflow-auto rounded bg-gray-100 p-4 text-xs">
          {JSON.stringify(document.raw_payload, null, 2)}
        </pre>
      </section>

      <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-xl font-semibold">Raw HTML</h2>

        <pre className="mt-4 max-h-[700px] overflow-auto rounded bg-gray-100 p-4 text-xs whitespace-pre-wrap">
          {document.raw_text ?? "Ei sisältöä"}
        </pre>
      </section>
    </main>
  )
}