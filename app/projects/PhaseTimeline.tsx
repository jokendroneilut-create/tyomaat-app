import {
  CANONICAL_PHASES,
  PHASE_KEYS_IN_ORDER,
  normalizeLegacyPhase,
} from "@/lib/projects/phases"

type PhaseHistoryRow = { phase: string; created_at: string }

export default function PhaseTimeline({
  rawPhase,
  history,
}: {
  rawPhase: string | null
  history: PhaseHistoryRow[]
}) {
  const currentKey = normalizeLegacyPhase(rawPhase)

  if (currentKey === "cancelled") {
    return (
      <div
        style={{
          padding: 12,
          background: "#fee2e2",
          borderRadius: 8,
          color: "#991b1b",
        }}
      >
        Hanke on peruttu
      </div>
    )
  }

  const currentOrder =
    CANONICAL_PHASES.find((p) => p.key === currentKey)?.order ?? null

  const earliestByKey = new Map(
    history.map((h) => [h.phase, h.created_at])
  )

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
      {PHASE_KEYS_IN_ORDER.map((key) => {
        const def = CANONICAL_PHASES.find((p) => p.key === key)!
        const achieved =
          currentOrder != null && def.order != null && def.order <= currentOrder
        const isCurrent = key === currentKey
        const date = earliestByKey.get(key)

        return (
          <div
            key={key}
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              fontSize: 13,
              background: isCurrent ? "#111827" : achieved ? "#dcfce7" : "#f3f4f6",
              color: isCurrent ? "#fff" : achieved ? "#166534" : "#9ca3af",
            }}
          >
            {def.label}
            {date ? ` · ${new Date(date).toLocaleDateString("fi-FI")}` : ""}
          </div>
        )
      })}
      {!currentKey && rawPhase && (
        <div style={{ fontSize: 12, color: "#6b7280" }}>
          (Tuntematon vaihearvo tietokannassa: &quot;{rawPhase}&quot;)
        </div>
      )}
    </div>
  )
}
