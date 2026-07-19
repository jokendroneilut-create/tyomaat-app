"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import PhaseTimeline from "@/app/projects/PhaseTimeline"
import { displayPhaseLabel } from "@/lib/projects/phases"
import { trackEvent } from "@/lib/analytics/trackEvent"
import TodayFeedbackButtons from "./TodayFeedbackButtons"

type Project = {
  id: string
  name: string
  city: string
  region: string | null
  phase: string
  location: string | null
  developer: string | null
  builder: string | null
  property_type: string | null
  apartments: number | null
  floor_area: number | null
  estimated_cost: number | null
  construction_start: string | null
  estimated_completion: string | null
  structural_design: string | null
  hvac_design: string | null
  electrical_design: string | null
  architectural_design: string | null
  geotechnical_design: string | null
  earthworks_contractor: string | null
  additional_info: string | null
  created_at: string

  metadata?: {
    source?: string | null
    source_name?: string | null
    source_url?: string | null
    documents_url?: string | null
    deadline?: string | null
    notice_number?: string | null
    notice_id?: string | null
    contact_persons?:
      | { name: string; title: string | null; phone: string | null; email: string | null }[]
      | null
    [key: string]: unknown
  } | null
}

function formatEUR(n: number | null | undefined) {
  if (n == null) return "-"
  try {
    return new Intl.NumberFormat("fi-FI", { maximumFractionDigits: 0 }).format(n) + " €"
  } catch {
    return `${n} €`
  }
}

function formatM2(n: number | null | undefined) {
  if (n == null) return "-"
  try {
    return new Intl.NumberFormat("fi-FI", { maximumFractionDigits: 0 }).format(n) + " m²"
  } catch {
    return `${n} m²`
  }
}

function getStatusStyle(status: string) {
  switch (status) {
    case "new":
      return { background: "#f3f4f6", color: "#374151" }
    case "contacted":
      return { background: "#dbeafe", color: "#1d4ed8" }
    case "offer_sent":
      return { background: "#fef3c7", color: "#b45309" }
    case "won":
      return { background: "#dcfce7", color: "#166534" }
    case "lost":
      return { background: "#fee2e2", color: "#991b1b" }
    default:
      return { background: "#f3f4f6", color: "#374151" }
  }
}

export default function TodayProjectModal({
  projectId,
  onClose,
}: {
  projectId: string
  onClose: () => void
}) {
  const [project, setProject] = useState<Project | null>(null)
  const [phaseHistory, setPhaseHistory] = useState<
    { phase: string; created_at: string }[]
  >([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [userId, setUserId] = useState<string | null>(null)
  const [favorite, setFavorite] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [status, setStatus] = useState("new")

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      const { data: userRes } = await supabase.auth.getUser()
      const uid = userRes?.user?.id ?? null
      if (!cancelled) setUserId(uid)

      const { data, error: fetchError } = await supabase
        .from("projects")
        .select(
          `
          id, name, city, region, phase, location, developer, builder, property_type,
          apartments, floor_area, estimated_cost, construction_start, estimated_completion,
          structural_design, hvac_design, electrical_design, architectural_design,
          geotechnical_design, earthworks_contractor, additional_info,
          metadata, created_at
        `
        )
        .eq("id", projectId)
        .single()

      if (cancelled) return

      if (fetchError || !data) {
        setError("Hankkeen tietojen lataaminen epäonnistui.")
        setLoading(false)
        return
      }

      setProject(data as Project)
      trackEvent({ event_type: "project_open", project_id: projectId })

      const { data: historyData } = await supabase
        .from("project_phase_history")
        .select("phase, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true })

      if (!cancelled) setPhaseHistory(historyData ?? [])

      if (uid) {
        const { data: favRow } = await supabase
          .from("user_project_favorites")
          .select("project_id, hidden_from_today")
          .eq("user_id", uid)
          .eq("project_id", projectId)
          .maybeSingle()

        if (!cancelled) {
          setFavorite(!!favRow)
          setHidden(!!favRow?.hidden_from_today)
        }

        const { data: statusRow } = await supabase
          .from("user_project_status")
          .select("status")
          .eq("user_id", uid)
          .eq("project_id", projectId)
          .maybeSingle()

        if (!cancelled) setStatus(statusRow?.status ?? "new")
      }

      if (!cancelled) setLoading(false)
    }

    load()

    return () => {
      cancelled = true
    }
  }, [projectId])

  async function toggleFavorite() {
    if (!userId || !project) return

    if (favorite) {
      await supabase
        .from("user_project_favorites")
        .delete()
        .eq("user_id", userId)
        .eq("project_id", project.id)

      setFavorite(false)
      setHidden(false)
    } else {
      await supabase
        .from("user_project_favorites")
        .insert({ user_id: userId, project_id: project.id })

      setFavorite(true)
    }
  }

  async function hideFromToday() {
    if (!userId || !project) return

    await supabase
      .from("user_project_favorites")
      .update({ hidden_from_today: true })
      .eq("user_id", userId)
      .eq("project_id", project.id)

    setHidden(true)
  }

  async function changeStatus(next: string) {
    if (!userId || !project) return

    await supabase
      .from("user_project_status")
      .upsert(
        { user_id: userId, project_id: project.id, status: next },
        { onConflict: "user_id,project_id" }
      )

    setStatus(next)
  }

  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      className="projects-modalBackdrop"
    >
      <div className="projects-modal">
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
            Ladataan...
          </div>
        ) : error || !project ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <div style={{ color: "#b91c1c" }}>
              {error ?? "Hanketta ei löytynyt."}
            </div>
            <button
              className="projects-btn"
              onClick={onClose}
              style={{ marginTop: 16 }}
            >
              Sulje
            </button>
          </div>
        ) : (
          <>
            <div className="projects-modalTop">
              <div>
                <h2 className="projects-modalTitle">{project.name}</h2>
                <div className="projects-modalSub">
                  {project.city} • {project.region || "-"} •{" "}
                  {displayPhaseLabel(project.phase)}
                </div>
                <PhaseTimeline rawPhase={project.phase} history={phaseHistory} />

                <TodayFeedbackButtons
                  projectId={project.id}
                  attributes={{
                    region: project.region ?? null,
                    phase: project.phase ?? null,
                    property_type: project.property_type ?? null,
                    business_value: (project.metadata?.business_value as string | null) ?? null,
                    construction_type: (project.metadata?.construction_type as string | null) ?? null,
                    building_type: (project.metadata?.building_type as string | null) ?? null,
                    size_class: (project.metadata?.size_class as string | null) ?? null,
                    source_name: (project.metadata?.source_name as string | null) ?? null,
                  }}
                />
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  flexWrap: "wrap",
                  justifyContent: "flex-end",
                }}
              >
                <select
                  className="projects-select"
                  value={status}
                  onChange={(e) => changeStatus(e.target.value)}
                  style={{
                    minWidth: 160,
                    maxWidth: 220,
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "1px solid #e5e7eb",
                    fontWeight: 700,
                    ...getStatusStyle(status),
                  }}
                >
                  <option value="new">Uusi</option>
                  <option value="contacted">Kontaktoitu</option>
                  <option value="offer_sent">Tarjous lähetetty</option>
                  <option value="won">Voitettu</option>
                  <option value="lost">Hävitty</option>
                </select>

                <button className="projects-btn" onClick={toggleFavorite}>
                  {favorite ? "★ Omat" : "☆ Omiin"}
                </button>

                {favorite && (
                  <button
                    className="projects-btn"
                    onClick={hideFromToday}
                    disabled={hidden}
                    title="Hanke on jo seurannassa — piilota se Tänään-näkymästä ettei se nouse joka päivä listan kärkeen"
                  >
                    {hidden ? "🙈 Piilotettu" : "🙈 Piilota Tänään"}
                  </button>
                )}

                <button className="projects-btn" onClick={onClose}>
                  Sulje
                </button>

                <a
                  href={`mailto:info@tyomaat.fi?subject=${encodeURIComponent(
                    `Palaute kohteesta: ${project.name}`
                  )}&body=${encodeURIComponent(
                    `Kohde: ${project.name}\nID: ${project.id}\nLinkki: ${window.location.origin}/projects?open=${project.id}\n\nKirjoita palaute tähän:`
                  )}`}
                  className="projects-btn"
                  style={{ background: "#e5e7eb", textDecoration: "none" }}
                >
                  Anna palautetta
                </a>
              </div>
            </div>

            <hr className="projects-hr" />

            <div className="projects-modalGrid">
              <div>
                <p>
                  <strong>Maakunta:</strong> {project.region || "-"}
                </p>
                <p>
                  <strong>Kaupunki:</strong> {project.city}
                </p>
                <p>
                  <strong>Sijainti / osoite:</strong> {project.location || "-"}
                </p>
                <p>
                  <strong>🏗️ Rakennuttaja:</strong> {project.developer || "-"}
                </p>
                <p>
                  <strong>👷 Rakennusliike:</strong> {project.builder || "-"}
                </p>
                <p>
                  <strong>🏢 Kohdetyyppi:</strong> {project.property_type || "-"}
                </p>
              </div>

              <div>
                <p>
                  <strong>🏠 Asuntoja:</strong> {project.apartments ?? "-"}
                </p>
                <p>
                  <strong>📐 Kerrosala:</strong> {formatM2(project.floor_area)}
                </p>
                <p>
                  <strong>💰 Arvioitu kustannus:</strong>{" "}
                  {formatEUR(project.estimated_cost)}
                </p>
                <p>
                  <strong>📅 Rakentamisen aloitus:</strong>{" "}
                  {project.construction_start || "-"}
                </p>
                <p>
                  <strong>📅 Arvioitu valmistuminen:</strong>{" "}
                  {project.estimated_completion || "-"}
                </p>
              </div>
            </div>

            <hr className="projects-hr" />

            <div className="projects-modalGrid">
              <div>
                <p>
                  <strong>Rakennesuunnittelu:</strong>{" "}
                  {project.structural_design || "-"}
                </p>
                <p>
                  <strong>LVIA-suunnittelu:</strong> {project.hvac_design || "-"}
                </p>
                <p>
                  <strong>Sähkösuunnittelu:</strong>{" "}
                  {project.electrical_design || "-"}
                </p>
              </div>

              <div>
                <p>
                  <strong>Arkkitehtisuunnittelu:</strong>{" "}
                  {project.architectural_design || "-"}
                </p>
                <p>
                  <strong>Pohjarakennesuunnittelu:</strong>{" "}
                  {project.geotechnical_design || "-"}
                </p>
                <p>
                  <strong>Maanrakentaja:</strong>{" "}
                  {project.earthworks_contractor || "-"}
                </p>
              </div>
            </div>

            {project.metadata?.deadline ||
            project.metadata?.source_url ||
            project.metadata?.documents_url ? (
              <>
                <hr className="projects-hr" />

                <div>
                  <p style={{ marginBottom: 8 }}>
                    <strong>Hankintatiedot</strong>
                  </p>

                  {project.metadata?.source_name ? (
                    <p>
                      <strong>Lähde:</strong> {project.metadata.source_name}
                    </p>
                  ) : null}

                  {project.metadata?.notice_number ? (
                    <p>
                      <strong>Ilmoitusnumero:</strong>{" "}
                      {project.metadata.notice_number}
                    </p>
                  ) : null}

                  {project.metadata?.deadline ? (
                    <p>
                      <strong>Tarjousten määräaika:</strong>{" "}
                      {new Date(project.metadata.deadline).toLocaleString(
                        "fi-FI"
                      )}
                    </p>
                  ) : null}

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 10,
                      marginTop: 12,
                    }}
                  >
                    {project.metadata?.source_url &&
                    !(
                      project.metadata?.source_name?.toLowerCase() ===
                        "hilma" && project.metadata?.documents_url
                    ) ? (
                      <a
                        href={project.metadata.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="projects-btn"
                        style={{ textDecoration: "none" }}
                      >
                        Avaa alkuperäinen ilmoitus
                      </a>
                    ) : null}

                    {project.metadata?.documents_url ? (
                      <a
                        href={project.metadata.documents_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="projects-btn"
                        style={{ textDecoration: "none" }}
                      >
                        Avaa Hilma / tarjousasiakirjat
                      </a>
                    ) : null}
                  </div>
                </div>
              </>
            ) : null}

            {project.metadata?.contact_persons &&
            project.metadata.contact_persons.length > 0 ? (
              <>
                <hr className="projects-hr" />
                <p style={{ marginBottom: 8 }}>
                  <strong>Yhteyshenkilöt</strong>
                </p>
                {project.metadata.contact_persons.map((contact, i) => (
                  <p key={i}>
                    {contact.name}
                    {contact.title ? `, ${contact.title}` : ""}
                    {contact.phone ? (
                      <>
                        {" — "}
                        <a href={`tel:${contact.phone}`}>{contact.phone}</a>
                      </>
                    ) : null}
                    {contact.email ? (
                      <>
                        {" — "}
                        <a href={`mailto:${contact.email}`}>{contact.email}</a>
                      </>
                    ) : null}
                  </p>
                ))}
              </>
            ) : null}

            {project.additional_info ? (
              <>
                <hr className="projects-hr" />
                <p style={{ marginBottom: 6 }}>
                  <strong>Lisätietoja:</strong>
                </p>
                <p className="projects-pre">{project.additional_info}</p>
              </>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
