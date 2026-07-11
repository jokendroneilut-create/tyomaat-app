import Link from "next/link"

export default function TodayRecommendedProjects({
  projects,
}: {
  projects: any[]
}) {
  return (
    <section className="mt-10 rounded-xl border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold">
        🔥 Päivän tärkeimmät hankkeet
      </h2>

      {projects.length === 0 ? (
        <p className="mt-4 text-gray-500">
          Asetuksiasi vastaavia hankkeita ei löytynyt.
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          {projects.map((project) => {
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

                    <div className="mt-2 flex flex-wrap gap-2 text-sm">
                      {project.phase && (
                        <span className="rounded bg-blue-100 px-2 py-1">
                          {project.phase}
                        </span>
                      )}

                      {project.metadata?.business_value && (
                        <span className="rounded bg-green-100 px-2 py-1">
                          {project.metadata.business_value}
                        </span>
                      )}
                    </div>
                  </div>

                  <Link
                    href={`/projects?open=${encodeURIComponent(project.id)}`}
                    className="shrink-0 rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-gray-50"
                  >
                    Avaa
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}