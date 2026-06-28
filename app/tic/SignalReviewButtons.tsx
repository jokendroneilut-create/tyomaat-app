"use client"

import { useState } from "react"

type Props = {
  signalId: string
  initialStatus: string
}

export default function SignalReviewButtons({
  signalId,
  initialStatus,
}: Props) {
  const [status, setStatus] = useState(initialStatus)
  const [loading, setLoading] = useState(false)

  async function review(action: "approve" | "reject") {
    setLoading(true)

    try {
      const res = await fetch("/api/tic/review-signal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          signalId,
          action,
        }),
      })

      const json = await res.json()

      if (!json.ok) {
        alert(json.error)
        return
      }

      setStatus(action === "approve" ? "approved" : "ignored")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
      <button
        disabled={loading || status === "approved"}
        onClick={() => review("approve")}
      >
        ✅ Hyväksy
      </button>

      <button
        disabled={loading || status === "ignored"}
        onClick={() => review("reject")}
      >
        ❌ Hylkää
      </button>

      <span style={{ marginLeft: 12 }}>
        <strong>{status}</strong>
      </span>
    </div>
  )
}