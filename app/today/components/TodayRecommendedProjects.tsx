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
          Ei uusia korkean prioriteetin hankkeita.
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          {projects.map((project) => (
            <div
              key={project.id}
              className="rounded-lg border p-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-lg">
                    {project.name}
                  </h3>

                  <p className="text-gray-600">
                    {project.location}
                  </p>

                  <div className="mt-2 flex gap-2 text-sm">
                    <span className="rounded bg-blue-100 px-2 py-1">
                      {project.phase}
                    </span>

                    <span className="rounded bg-green-100 px-2 py-1">
                      {project.metadata?.business_value ?? "-"}
                    </span>
                  </div>
                </div>

                <Link
                  href={`/projects/${project.id}`}
                  className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
                >
                  Avaa
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}