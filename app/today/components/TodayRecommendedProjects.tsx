"use client"

import { useState } from "react"
import TodayProjectModal from "./TodayProjectModal"
import TodayFeedbackButtons from "./TodayFeedbackButtons"
import TodayFavoriteActions from "./TodayFavoriteActions"

export default function TodayRecommendedProjects({
  projects,
  userId,
  feedback,
  favorites,
}: {
  projects: any[]
  userId?: string | null
  feedback?: Record<string, "up" | "down">
  favorites?: Record<string, boolean>
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())

  const visibleProjects = projects.filter((p) => !hiddenIds.has(p.id))

  return (
    <section className="mt-10 rounded-xl border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold">
        🔥 Päivän tärkeimmät hankkeet
      </h2>

      {visibleProjects.length === 0 ? (
        <p className="mt-4 text-gray-500">
          Asetuksiasi vastaavia hankkeita ei löytynyt.
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          {visibleProjects.map((project) => {
            const location =
              project.location ||
              [project.city, project.region].filter(Boolean).join(", ")

            return (
              <div
                key={project.id}
                className="rounded-lg border p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold">
                      {project.name}
                    </h3>

                    {location && (
                      <p className="mt-1 text-gray-600">
                        {location}
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                      {typeof project.today_match === "number" && (
                        <span
                          className={`rounded-full px-2.5 py-1 font-semibold ${
                            project.today_match >= 70
                              ? "bg-emerald-100 text-emerald-800"
                              : project.today_match >= 40
                                ? "bg-amber-100 text-amber-800"
                                : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {project.today_match} % osuma
                        </span>
                      )}

                      {project.phase && (
                        <span className="rounded bg-blue-100 px-2 py-1">
                          {project.phase}
                        </span>
                      )}
                    </div>

                    {Array.isArray(project.today_reasons) &&
                      project.today_reasons.length > 0 && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-sm">
                          <span className="font-medium text-gray-500">
                            Miksi sinulle:
                          </span>
                          {project.today_reasons.map((reason: string) => (
                            <span
                              key={reason}
                              className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-800 ring-1 ring-amber-200"
                            >
                              {reason}
                            </span>
                          ))}
                        </div>
                      )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setOpenId(project.id)}
                    className="shrink-0 rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-gray-50"
                  >
                    Avaa
                  </button>
                </div>

                {userId && (
                  <TodayFeedbackButtons
                    projectId={project.id}
                    initialRating={feedback?.[project.id] ?? null}
                    attributes={{
                      region: project.region ?? null,
                      phase: project.phase ?? null,
                      property_type: project.property_type ?? null,
                      business_value: project.metadata?.business_value ?? null,
                      construction_type: project.metadata?.construction_type ?? null,
                      building_type: project.metadata?.building_type ?? null,
                      size_class: project.metadata?.size_class ?? null,
                      source_name: project.metadata?.source_name ?? null,
                    }}
                    onDownvote={() =>
                      setHiddenIds((prev) => new Set(prev).add(project.id))
                    }
                  />
                )}

                {userId && (
                  <TodayFavoriteActions
                    projectId={project.id}
                    initialFavorite={!!favorites?.[project.id]}
                    onHide={() =>
                      setHiddenIds((prev) => new Set(prev).add(project.id))
                    }
                  />
                )}
              </div>
            )
          })}
        </div>
      )}

      {openId && (
        <TodayProjectModal projectId={openId} onClose={() => setOpenId(null)} />
      )}
    </section>
  )
}