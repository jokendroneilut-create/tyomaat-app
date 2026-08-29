import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PAGE_SIZE = 50

export async function getPotentialProjectsForReview(page = 1) {
  const offset = (page - 1) * PAGE_SIZE

  const { data, error } = await supabaseAdmin
    .from("potential_projects")
    .select("*")
    .eq("status", "new")
    .or("metadata->>recommended_action.neq.ignore,metadata->>recommended_action.is.null")
    /*
     * VANHIN ENSIN.
     *
     * Jono käsitellään järjestyksessä, joten pisimpään odottaneen on
     * oltava ylimpänä. Uusin ensin tarkoitti että vanhat ehdokkaat
     * valuivat listan häntään sitä mukaa kun uusia tuli — eli juuri ne
     * jäivät käsittelemättä.
     *
     * Sama järjestys pitää sivutuksen mielekkäänä: sivu 1 on aina se
     * jota seuraavaksi käsitellään.
     */
    .order("created_at", { ascending: true })
    .range(offset, offset + PAGE_SIZE - 1)

  if (error) throw error

  return data ?? []
}