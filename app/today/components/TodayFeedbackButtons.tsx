"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"

const REASON_PRESETS = ["Liian pieni hanke", "Väärä alue", "Ei kiinnosta", "Muu syy"]

type ProjectAttributes = {
  region: string | null
  phase: string | null
  property_type: string | null
  business_value: string | null
  construction_type: string | null
  building_type: string | null
  size_class: string | null
  source_name: string | null
}

export default function TodayFeedbackButtons({
  projectId,
  attributes,
  initialRating,
  onDownvote,
}: {
  projectId: string
  attributes: ProjectAttributes
  initialRating?: "up" | "down" | null
  onDownvote?: () => void
}) {
  const [rating, setRating] = useState<"up" | "down" | null>(initialRating ?? null)
  const [showReason, setShowReason] = useState(false)
  const [reasonCategory, setReasonCategory] = useState<string | null>(null)
  const [reasonText, setReasonText] = useState("")
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (initialRating !== undefined) return

    let cancelled = false

    async function loadExisting() {
      const { data: userRes } = await supabase.auth.getUser()
      const userId = userRes?.user?.id
      if (!userId) return

      const { data } = await supabase
        .from("project_feedback")
        .select("rating")
        .eq("user_id", userId)
        .eq("project_id", projectId)
        .maybeSingle()

      if (!cancelled && data) setRating(data.rating)
    }

    loadExisting()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  async function submitRating(next: "up" | "down") {
    setRating(next)
    setShowReason(true)
    setSaved(false)

    const { data: userRes } = await supabase.auth.getUser()
    const userId = userRes?.user?.id
    if (!userId) return

    await supabase.from("project_feedback").upsert(
      {
        user_id: userId,
        project_id: projectId,
        rating: next,
        ...attributes,
      },
      { onConflict: "user_id,project_id" }
    )
  }

  async function submitReason() {
    const { data: userRes } = await supabase.auth.getUser()
    const userId = userRes?.user?.id
    if (!userId || !rating) return

    await supabase.from("project_feedback").upsert(
      {
        user_id: userId,
        project_id: projectId,
        rating,
        reason_category: reasonCategory,
        reason_text: reasonText.trim() || null,
        ...attributes,
      },
      { onConflict: "user_id,project_id" }
    )

    setSaved(true)
    setShowReason(false)

    if (rating === "down") onDownvote?.()
  }

  function skipReason() {
    setShowReason(false)
    if (rating === "down") onDownvote?.()
  }

  return (
    <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 8 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button
          type="button"
          onClick={() => submitRating("up")}
          title="Kiinnostava hanke"
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: "4px 10px",
            background: rating === "up" ? "#dcfce7" : "#fff",
            cursor: "pointer",
          }}
        >
          👍
        </button>

        <button
          type="button"
          onClick={() => submitRating("down")}
          title="Ei kiinnostava hanke"
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: "4px 10px",
            background: rating === "down" ? "#fee2e2" : "#fff",
            cursor: "pointer",
          }}
        >
          👎
        </button>

        {saved && (
          <span style={{ fontSize: 12, color: "#6b7280" }}>Kiitos palautteesta!</span>
        )}
      </div>

      {showReason && (
        <div style={{ marginTop: 8, padding: 8, background: "#f9fafb", borderRadius: 8 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {REASON_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setReasonCategory(preset === reasonCategory ? null : preset)}
                style={{
                  fontSize: 12,
                  padding: "4px 8px",
                  borderRadius: 999,
                  border: "1px solid #e5e7eb",
                  background: reasonCategory === preset ? "#111827" : "#fff",
                  color: reasonCategory === preset ? "#fff" : "#374151",
                  cursor: "pointer",
                }}
              >
                {preset}
              </button>
            ))}
          </div>

          <textarea
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
            placeholder="Lisätietoja (valinnainen)"
            rows={2}
            style={{
              width: "100%",
              marginTop: 6,
              padding: 6,
              fontSize: 13,
              borderRadius: 6,
              border: "1px solid #e5e7eb",
              background: "#fff",
            }}
          />

          <div style={{ marginTop: 6, display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={submitReason}
              style={{
                fontSize: 12,
                padding: "4px 10px",
                borderRadius: 6,
                background: "#111827",
                color: "#fff",
                border: "none",
                cursor: "pointer",
              }}
            >
              Lähetä
            </button>

            <button
              type="button"
              onClick={skipReason}
              style={{
                fontSize: 12,
                padding: "4px 10px",
                borderRadius: 6,
                background: "#fff",
                border: "1px solid #e5e7eb",
                cursor: "pointer",
              }}
            >
              Ohita
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
