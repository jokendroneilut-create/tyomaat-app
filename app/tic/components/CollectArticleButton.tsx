"use client"

import { useState } from "react"

type Props = {
  documentId: string
}

export default function CollectArticleButton({ documentId }: Props) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  async function collectArticle() {
    setLoading(true)
    setResult(null)

    try {
      const response = await fetch("/api/tic/discovery/collect-article", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ documentId }),
      })

      const json = await response.json()
      setResult(json)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-6">
      <button
        onClick={collectArticle}
        disabled={loading}
        className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {loading ? "Haetaan..." : "Hae artikkelin sisältö"}
      </button>

      {result && (
        <pre className="mt-4 overflow-auto rounded-xl bg-gray-100 p-4 text-sm">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  )
}