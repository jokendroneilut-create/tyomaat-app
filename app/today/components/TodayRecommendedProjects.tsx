"use client"

import { useState } from "react"
import TodayProjectModal from "./TodayProjectModal"
import TodayFeedbackButtons from "./TodayFeedbackButtons"
import TodayFavoriteActions from "./TodayFavoriteActions"
import { eraNakyma } from "../services/naytaLisaa"

export default function TodayRecommendedProjects({
  projects,
  userId,
  feedback,
  favorites,
  teamMode = false,
  initialCount,
  totalCount,
}: {
  projects: any[]
  userId?: string | null
  feedback?: Record<string, "up" | "down">
  favorites?: Record<string, boolean>
  teamMode?: boolean
  /* Ensimmäinen erä = käyttäjän asetus (oletus 20). */
  initialCount?: number
  /* Kaikki pisteytetyt, myös ne joita ei ladattu. */
  totalCount?: number
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())

  /*
   * NAYTA LISAA. Aiemmin palvelin lähetti vain asetuksen verran rivejä,
   * joten listan lopussa ei ollut mihin jatkaa. Nyt rivejä on ladattu
   * enemmän kuin näytetään, ja nappi paljastaa seuraavan erän.
   */
  const eraKoko = Math.max(1, initialCount ?? 20)
  const [nakyvissa, setNakyvissa] = useState(eraKoko)

  const {
    nakyvat: visibleProjects,
    jaljella,
    lataamatta,
  } = eraNakyma({
    rivit: projects.filter((p) => !hiddenIds.has(p.id)),
    nakyvissa,
    kaikkiPisteytetyt: totalCount,
  })

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

                      {teamMode &&
                        (project.team_owner_id === userId ? (
                          <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-800">
                            🟢 Sinä
                          </span>
                        ) : project.team_owner_id ? (
                          <span className="rounded-full bg-blue-100 px-2.5 py-1 font-semibold text-blue-800">
                            🔵 Omistaja: {project.team_owner_name ?? "tiimin jäsen"}
                          </span>
                        ) : (
                          <span className="rounded-full bg-gray-100 px-2.5 py-1 font-semibold text-gray-600">
                            ⚪ Vapaa
                          </span>
                        ))}
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

      {jaljella > 0 && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => setNakyvissa((n) => n + eraKoko)}
            className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Näytä lisää ({jaljella} jäljellä)
          </button>
        </div>
      )}

      {jaljella === 0 && lataamatta > 0 && (
        <p className="mt-6 text-center text-sm text-gray-500">
          Näytetty {visibleProjects.length} hanketta.{" "}
          <a href="/projects" className="font-semibold text-blue-600 hover:underline">
            Selaa kaikkia {(totalCount ?? 0).toLocaleString("fi")} hanketta
          </a>
        </p>
      )}

      {openId && (
        <TodayProjectModal projectId={openId} onClose={() => setOpenId(null)} />
      )}
    </section>
  )
}