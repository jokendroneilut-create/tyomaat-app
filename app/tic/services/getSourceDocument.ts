import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type SourceDocumentDetail = {
  id: string
  created_at: string
  source_name: string
  title: string | null
  document_url: string
  document_type: string
  status: string | null
  raw_text: string | null
  raw_payload: any
  extracted_text: string | null
}

export async function getSourceDocument(
  id: string
): Promise<SourceDocumentDetail | null> {
  const { data, error } = await supabaseAdmin
    .from("source_documents")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (error) throw error

  return data as SourceDocumentDetail | null
}