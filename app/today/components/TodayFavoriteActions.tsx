"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabaseClient"

export default function TodayFavoriteActions({
  projectId,
  initialFavorite = false,
  onHide,
}: {
  projectId: string
  initialFavorite?: boolean
  onHide?: () => void
}) {
  const [favorite, setFavorite] = useState(initialFavorite)
  const [hidden, setHidden] = useState(false)
  const [saving, setSaving] = useState(false)

  async function toggleFavorite() {
    setSaving(true)

    const { data: userRes } = await supabase.auth.getUser()
    const userId = userRes?.user?.id
    if (!userId) {
      setSaving(false)
      return
    }

    if (favorite) {
      await supabase
        .from("user_project_favorites")
        .delete()
        .eq("user_id", userId)
        .eq("project_id", projectId)

      setFavorite(false)
    } else {
      await supabase
        .from("user_project_favorites")
        .insert({ user_id: userId, project_id: projectId })

      setFavorite(true)
    }

    setSaving(false)
  }

  async function hideFromToday() {
    setSaving(true)

    const { data: userRes } = await supabase.auth.getUser()
    const userId = userRes?.user?.id
    if (!userId) {
      setSaving(false)
      return
    }

    await supabase
      .from("user_project_favorites")
      .update({ hidden_from_today: true })
      .eq("user_id", userId)
      .eq("project_id", projectId)

    setSaving(false)
    setHidden(true)
    onHide?.()
  }

  if (hidden) {
    return (
      <div style={{ marginTop: 8, fontSize: 13, color: "#6b7280" }}>
        Piilotettu Tänään-näkymästä.
      </div>
    )
  }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}
    >
      <button
        type="button"
        onClick={toggleFavorite}
        disabled={saving}
        title="Lisää omiin suosikkeihin"
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          padding: "4px 10px",
          background: favorite ? "#fef9c3" : "#fff",
          cursor: "pointer",
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        {favorite ? "★ Omissa" : "☆ Lisää omiin"}
      </button>

      {favorite && (
        <button
          type="button"
          onClick={hideFromToday}
          disabled={saving}
          title="Hanke on jo seurannassa — piilota se Tänään-näkymästä ettei se nouse joka päivä listan kärkeen"
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: "4px 10px",
            background: "#fff",
            color: "#6b7280",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          🙈 Piilota Tänään-näkymästä
        </button>
      )}
    </div>
  )
}
