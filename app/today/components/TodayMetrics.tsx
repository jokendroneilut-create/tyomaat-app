"use client"

import { useState } from "react"
import TodayProjectModal from "./TodayProjectModal"

type MetricProject = {
  id: string
  name: string
  city: string | null
  region: string | null
  phase: string | null
}

type PopupKey = "new" | "highValue"

export default function TodayMetrics({
  metrics,
  metricProjects,
  regions,
}: {
  metrics: {
    regionTotal: number
    newProjects: number
    highValue: number
  }
  metricProjects: {
    new: MetricProject[]
    highValue: MetricProject[]
  }
  regions?: string[]
}) {
  const [openPopup, setOpenPopup] = useState<PopupKey | null>(null)
  const [openProjectId, setOpenProjectId] = useState<string | null>(null)

  const regionHref =
    regions && regions.length > 0
      ? `/projects?region=${encodeURIComponent(regions[0])}`
      : "/projects"

  const popups: Record<PopupKey, { title: string; projects: MetricProject[] }> = {
    new: { title: "Uudet hankkeet alueellasi, 7 pv", projects: metricProjects.new },
    highValue: { title: "Suositellut hankkeet, 7 pv", projects: metricProjects.highValue },
  }

  return (
    <div className="mt-8 grid gap-6 md:grid-cols-3">
      <a href={regionHref} className="block">
        <MetricCard title="Kaikki hankkeet alueellasi" value={metrics.regionTotal} />
      </a>

      <button type="button" onClick={() => setOpenPopup("new")} className="block text-left">
        <MetricCard title="Uudet hankkeet alueellasi, 7 pv" value={metrics.newProjects} />
      </button>

      <button type="button" onClick={() => setOpenPopup("highValue")} className="block text-left">
        <MetricCard title="Suositellut hankkeet, 7 pv" value={metrics.highValue} />
      </button>

      {openPopup && (
        <div
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpenPopup(null)
          }}
          className="projects-modalBackdrop"
        >
          <div className="projects-modal" style={{ maxWidth: 560 }}>
            <div className="projects-modalTop">
              <h2 className="projects-modalTitle">{popups[openPopup].title}</h2>

              <button className="projects-btn" onClick={() => setOpenPopup(null)}>
                Sulje
              </button>
            </div>

            <hr className="projects-hr" />

            {popups[openPopup].projects.length === 0 ? (
              <p style={{ color: "#6b7280" }}>Ei hankkeita.</p>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {popups[openPopup].projects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => setOpenProjectId(project.id)}
                    style={{
                      textAlign: "left",
                      border: "1px solid #e5e7eb",
                      borderRadius: 10,
                      padding: "10px 12px",
                      background: "#fff",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>{project.name}</div>
                    <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>
                      {[project.city, project.region, project.phase]
                        .filter(Boolean)
                        .join(" • ")}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {openProjectId && (
        <TodayProjectModal
          projectId={openProjectId}
          onClose={() => setOpenProjectId(null)}
        />
      )}
    </div>
  )
}

function MetricCard({
  title,
  value,
}: {
  title: string
  value: number
}) {
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm transition hover:border-gray-300 hover:shadow-md">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="mt-2 text-3xl font-bold">{value}</div>
    </div>
  )
}
