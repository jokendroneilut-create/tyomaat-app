import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type SourceDocumentRow = {
  id: string
  created_at: string
  source_id: string
  source_name: string
  title: string | null
  document_url: string
  document_type: string
  status: string | null
  processed_at: string | null
  error_message: string | null
}

export async function getSourceDocuments(
  limit = 50
): Promise<SourceDocumentRow[]> {
  const { data, error } = await supabaseAdmin
    .from("source_documents")
    .select(`
      id,
      created_at,
      source_id,
      source_name,
      title,
      document_url,
      document_type,
      status,
      processed_at,
      error_message
    `)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) throw error

  return (data ?? []) as SourceDocumentRow[]
}