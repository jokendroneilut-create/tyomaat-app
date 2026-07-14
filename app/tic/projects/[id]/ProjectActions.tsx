"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

export default function ProjectActions({
  candidateId,
}: {
  candidateId: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function approveProject() {
    const confirmed = window.confirm(
      "Hyväksytäänkö tämä hanke Projectsiin asiakkaiden näkyville?"
    )

    if (!confirmed) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/tic/projects/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          potentialProjectId: candidateId,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "Hyväksyntä epäonnistui")
      }

      router.push("/tic/projects")
      router.refresh()
    } catch (err: any) {
      setError(err.message ?? "Tuntematon virhe")
    } finally {
      setLoading(false)
    }
  }

  async function rejectProject() {
    const confirmed = window.confirm(
      "Hylätäänkö tämä hanke? Se poistuu hyväksyntäjonosta."
    )

    if (!confirmed) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/tic/projects/reject", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          potentialProjectId: candidateId,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "Hylkäys epäonnistui")
      }

      router.push("/tic")
      router.refresh()
    } catch (err: any) {
      setError(err.message ?? "Tuntematon virhe")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={approveProject}
        disabled={loading}
        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {loading ? "Hyväksytään..." : "Hyväksy Projectsiin"}
      </button>

      <button
        type="button"
        onClick={rejectProject}
        disabled={loading}
        className="rounded-lg border px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-50"
      >
        {loading ? "Hylätään..." : "Hylkää"}
      </button>

      {error && <div className="w-full text-sm text-red-700">{error}</div>}
    </div>
  )
}