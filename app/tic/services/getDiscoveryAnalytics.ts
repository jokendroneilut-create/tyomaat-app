import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type DiscoveryAnalytics = {
  totals: {
    runs: number
    documentsFound: number
    documentsSaved: number
    pdfFound: number
    pdfSaved: number
    signalsFound: number
    candidatesCreated: number
  }
  byPeriod: {
    today: number
    last7Days: number
    last30Days: number
    last365Days: number
  }
  recentRuns: {
    id: string
    created_at: string
    source_name: string | null
    agent_type: string
    status: string
    documents_found: number | null
    documents_saved: number | null
    pdf_found: number | null
    pdf_saved: number | null
    signals_found: number | null
    candidates_created: number | null
    duration_ms: number | null
  }[]
}

function daysAgo(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString()
}

export async function getDiscoveryAnalytics(): Promise<DiscoveryAnalytics> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  /*
   * agent_runs on kasvanut yli 500 rivin (tuhansia), ja aiempi .limit(500)
   * rajasi sekä "Ajot yhteensä" -kokonaismäärän että kaikki aikaväli-
   * suodattimet (tänään/7pv/30pv/365pv) samaan 500 viimeisimpään riviin.
   * Kun yhtenä päivänä syntyy paljon ajoja (esim. uuden lähteen
   * taustatäyttö), tuo 500 rivin ikkuna täyttyy kokonaan sen yhden päivän
   * riveistä, jolloin "Tänään" näytti virheellisesti saman luvun kuin
   * "Ajot yhteensä" — molemmat olivat vain saman katkaistun otoksen koko.
   * Haetaan siis KAIKKI rivit sivutettuna, jotta summat ja aikavälit
   * lasketaan oikeasta kokonaismäärästä.
   */
  const PAGE_SIZE = 1000
  const rows: any[] = []

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from("agent_runs")
      .select(`
        id,
        created_at,
        source_name,
        agent_type,
        status,
        documents_found,
        documents_saved,
        pdf_found,
        pdf_saved,
        signals_found,
        candidates_created,
        duration_ms
      `)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw error

    rows.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) break
  }

  const sum = (key: keyof (typeof rows)[number]) =>
    rows.reduce((total, row) => total + Number(row[key] ?? 0), 0)

  /*
   * Lähteiden keräys (runSourceWorker) kirjoittaa document-tilastonsa
   * discovery_runs-tauluun, ei agent_runs-tauluun, joten se on laskettava
   * erikseen — muuten "Dokumentteja"-luku näyttäisi aina nollaa vaikka
   * keräys toimisi (ks. Source Monitor -sivun "Ajot"-sarake).
   */
  const { data: discoveryRuns, error: discoveryRunsError } = await supabaseAdmin
    .from("discovery_runs")
    .select("documents_found, documents_saved")
    .limit(5000)

  if (discoveryRunsError) throw discoveryRunsError

  const discoveryTotals = (discoveryRuns ?? []).reduce(
    (acc, row) => {
      acc.found += Number(row.documents_found ?? 0)
      acc.saved += Number(row.documents_saved ?? 0)
      return acc
    },
    { found: 0, saved: 0 }
  )

  return {
    totals: {
      runs: rows.length,
      documentsFound: sum("documents_found") + discoveryTotals.found,
      documentsSaved: sum("documents_saved") + discoveryTotals.saved,
      pdfFound: sum("pdf_found"),
      pdfSaved: sum("pdf_saved"),
      signalsFound: sum("signals_found"),
      candidatesCreated: sum("candidates_created"),
    },
    byPeriod: {
      today: rows.filter((row) => row.created_at >= today.toISOString()).length,
      last7Days: rows.filter((row) => row.created_at >= daysAgo(7)).length,
      last30Days: rows.filter((row) => row.created_at >= daysAgo(30)).length,
      last365Days: rows.filter((row) => row.created_at >= daysAgo(365)).length,
    },
    recentRuns: rows.slice(0, 30) as DiscoveryAnalytics["recentRuns"],
  }
}