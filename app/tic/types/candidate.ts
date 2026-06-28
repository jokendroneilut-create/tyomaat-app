export type Candidate = {
  id: string

  title: string

  city: string | null
  location: string | null
  region: string | null

  candidate_type: string | null

  status: string
  review_status: string

  confidence: number | null
  score: number | null

  signal_count: number
  source_count: number

  builder: string | null
  developer: string | null
  architect: string | null

  summary: string | null
  reason: string | null

  created_at: string
  updated_at: string
  last_signal_at: string | null

  promoted_project_id: string | null
  promoted_at: string | null

  cancelled_at: string | null
  cancellation_reason: string | null
}