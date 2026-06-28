import { createClient } from "@supabase/supabase-js"
import TicDailySummary from "./components/TicDailySummary"
import SignalReviewButtons from "./SignalReviewButtons"

export const dynamic = "force-dynamic"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function TicPage() {
  const { data: signals, error } = await supabaseAdmin
    .from("project_signals")
    .select(`
      id,
      created_at,
      title,
      city,
      source_name,
      source_url,
      normalized_signal_type,
      relevance_score,
      review_status,
      classification_reason
    `)
    .order("relevance_score", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Työmaat Intelligence Center</h1>
        <p>Virhe: {error.message}</p>
      </main>
    )
  }

  const total = signals?.length ?? 0

  const needsReview =
    signals?.filter((s) => s.review_status === "needs_review").length ?? 0

  const approved =
    signals?.filter((s) => s.review_status === "approved").length ?? 0

  const ignored =
    signals?.filter((s) => s.review_status === "ignored").length ?? 0

  const highPriority =
    signals?.filter((s) => Number(s.relevance_score ?? 0) >= 90).length ?? 0

  const tenders =
    signals?.filter(
      (s) => s.normalized_signal_type === "tender_started"
    ).length ?? 0

  const zoning =
    signals?.filter(
      (s) => s.normalized_signal_type === "zoning"
    ).length ?? 0

  return (
    <main style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
      <h1>Työmaat Intelligence Center</h1>

      <p style={{ color: "#666", marginBottom: 24 }}>
        Päivittäinen työpöytä rakennusmarkkinan seurantaan.
      </p>

      <TicDailySummary
        needsReview={needsReview}
        highPriority={highPriority}
        tenders={tenders}
        zoning={zoning}
        ignored={ignored}
      />

      <h2 style={{ marginTop: 40 }}>Tärkeimmät uudet signaalit</h2>

      <div style={{ display: "grid", gap: 16, marginTop: 24 }}>
        {signals?.map((signal) => (
          <div
            key={signal.id}
            style={{
              border: "1px solid #ddd",
              borderRadius: 12,
              padding: 20,
              background: "#fff",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 24,
              }}
            >
              <div style={{ flex: 1 }}>
                <h3 style={{ marginTop: 0 }}>
                  {signal.title}
                </h3>

                <div
                  style={{
                    color: "#666",
                    marginBottom: 12,
                    fontSize: 14,
                  }}
                >
                  {signal.city ?? "Ei kaupunkia"} •{" "}
                  {signal.source_name}
                </div>

                <div
                  style={{
                    display: "inline-block",
                    padding: "4px 10px",
                    borderRadius: 20,
                    background: "#f3f4f6",
                    marginBottom: 12,
                    fontSize: 13,
                  }}
                >
                  {signal.normalized_signal_type}
                </div>

                <p>{signal.classification_reason}</p>

                {signal.source_url && (
                  <a
                    href={signal.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Avaa alkuperäinen lähde →
                  </a>
                )}

                <SignalReviewButtons
                  signalId={signal.id}
                  initialStatus={signal.review_status}
                />
              </div>

              <div
                style={{
                  minWidth: 90,
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontSize: 34,
                    fontWeight: "bold",
                  }}
                >
                  {signal.relevance_score ?? 0}
                </div>

                <div
                  style={{
                    fontSize: 13,
                    color: "#666",
                  }}
                >
                  pistettä
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 40, color: "#666", fontSize: 14 }}>
        Näytetään {total} uusinta signaalia.
        <br />
        Hyväksytyt signaalit muodostavat myöhemmin automaattisesti uusia
        rakennushankkeita.
      </div>
    </main>
  )
}