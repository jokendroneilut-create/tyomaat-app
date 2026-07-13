"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

export default function PotentialProjectsReviewList({
  projects,
}: {
  projects: any[]
}) {
  const router = useRouter()
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function approveProject(projectId: string) {
    const confirmed = window.confirm(
      "Hyväksytäänkö tämä hanke Projectsiin asiakkaiden näkyville?"
    )

    if (!confirmed) return

    setLoadingId(projectId)
    setError(null)

    try {
      const response = await fetch("/api/tic/projects/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          potentialProjectId: projectId,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "Hyväksyntä epäonnistui")
      }

      router.refresh()
    } catch (err: any) {
      setError(err.message ?? "Tuntematon virhe")
    } finally {
      setLoadingId(null)
    }
  }

 async function rejectProject(projectId: string) {
    const confirmed = window.confirm(
      "Hylätäänkö tämä hanke? Se poistuu hyväksyntäjonosta."
    )

    if (!confirmed) return

    setLoadingId(projectId)
    setError(null)

    try {
      const response = await fetch("/api/tic/projects/reject", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          potentialProjectId: projectId,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "Hylkäys epäonnistui")
      }

      router.refresh()
    } catch (err: any) {
      setError(err.message ?? "Tuntematon virhe")
    } finally {
      setLoadingId(null)
    }
  }

  if (!projects.length) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">Ehdokkaat</h2>
        <p className="mt-2 text-gray-600">
          Ei uusia hyväksyntää odottavia hankkeita.
        </p>
      </div>
    )
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900">
        Ehdokkaat ({projects.length})
      </h2>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-4 space-y-4">
        {projects.map((project) => {
          const metadata = project.metadata ?? {}

          return (
            <article
              key={project.id}
              className="rounded-xl border border-gray-200 p-4"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-500">
                    {metadata.business_value === "high"
                      ? "★★★★★ High"
                      : metadata.business_value === "medium"
                        ? "★★★★☆ Medium"
                        : "★★★☆☆ Review"}
                  </div>

                  <h3 className="mt-1 text-lg font-bold text-gray-900">
                    {metadata.operation ?? project.title}
                  </h3>

                  <p className="mt-1 text-gray-600">
                    {project.address}, {project.municipality}
                  </p>

                  <div className="mt-3 grid gap-2 text-sm text-gray-700 md:grid-cols-2">
                    <div>
                      <strong>Rakennustyyppi:</strong>{" "}
                      {metadata.building_type ?? "-"}
                    </div>
                    <div>
                      <strong>Toimenpide:</strong>{" "}
                      {metadata.construction_type ?? "-"}
                    </div>
                    <div>
                      <strong>Lupa:</strong> {project.permit_number ?? "-"}
                    </div>
                    <div>
                      <strong>Kiinteistö:</strong>{" "}
                      {project.property_id ?? "-"}
                    </div>
                  </div>
                </div>

                <div className="flex flex-row flex-wrap gap-2 sm:w-auto sm:shrink-0 sm:flex-col">
                  <Link
                    href={`/tic/projects/${project.id}`}
                    className="rounded-lg border px-3 py-2 text-center text-sm font-semibold hover:bg-gray-50"
                  >
                    Näytä
                  </Link>

                  <button
                    type="button"
                    onClick={() => approveProject(project.id)}
                    disabled={loadingId === project.id}
                    className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {loadingId === project.id ? "Hyväksytään..." : "Hyväksy"}
                  </button>

                  <button
                    type="button"
                    onClick={() => rejectProject(project.id)}
                    disabled={loadingId === project.id}
                    className="rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    {loadingId === project.id ? "Käsitellään..." : "Hylkää"}
                  </button>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}