import { createClient } from "@supabase/supabase-js"
import { getDiscoverySources } from "../operations/services/getDiscoverySources"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/*
 * P3 — TIC:n päätösnäkymän ("mitä sinun kannattaa tehdä tänään") luvut.
 *
 * Ehdokkaat (potential_projects, status="new"). CQE merkitsee osan
 * automaattisesti ohitettaviksi (metadata.recommended_action = "ignore");
 * ne EIVÄT vaadi päätöstäsi. "needsReview" ja sen alaerittelyt
 * (highPriority/tenders/zoning) lasketaan siksi vain EI-ohitetusta joukosta.
 */

// Ei-ohitetut: recommended_action != "ignore" tai puuttuu.
const NOT_IGNORED =
  "metadata->>recommended_action.neq.ignore,metadata->>recommended_action.is.null"

/*
 * YHTEENVETO EI SAA KAATAA KATSELMOINTIJONOA.
 *
 * Nämä luvut ovat sivun yläreunan koriste; varsinainen työ on jonossa sen
 * alla. Aiemmin jokainen laskuri teki `throw error`, ja koska /tic hakee
 * kaiken yhdellä Promise.all:lla, YKSI epäonnistunut laskuri palautti koko
 * sivulle 500:n — myös jonolle.
 *
 * Mitattu 21.8.2026: hyväksyntä lukee kaikki 5 737 hanketta läpi (9,9 s) ja
 * ajaa täsmäytyksen niitä vasten (3,3 s), ja hyväksynnän jälkeen /tic
 * ladataan uudelleen. Kuormapiikki osuu siis juuri silloin kun laskurit
 * ajetaan, joten ohimenevä virhe on odotettavissa eikä poikkeus.
 *
 * Virheen sattuessa palautetaan null, jonka käyttöliittymä näyttää
 * viivana. Puuttuva luku on haitaton, kaatunut sivu ei.
 */
async function countNewCandidates(
  build: (q: any) => any
): Promise<number | null> {
  try {
    const base = supabaseAdmin
      .from("potential_projects")
      .select("*", { count: "exact", head: true })
      .eq("status", "new")

    const { count, error } = await build(base)
    if (error) {
      console.error("TIC-yhteenvedon laskuri epäonnistui:", error.message)
      return null
    }
    return count ?? 0
  } catch (err: any) {
    console.error("TIC-yhteenvedon laskuri kaatui:", err?.message ?? err)
    return null
  }
}

export type TicDailySummaryData = {
  needsReview: number | null
  highPriority: number | null
  tenders: number | null
  zoning: number | null
  ignored: number | null
  failedSources: number | null
}

export async function getTicDailySummary(): Promise<TicDailySummaryData> {
  const [needsReview, highPriority, tenders, zoning, ignored, sources] =
    await Promise.all([
      // Päätöstä vaativat: ei-ohitetut uudet ehdokkaat.
      countNewCandidates((q) => q.or(NOT_IGNORED)),

      // Korkean arvon (CQE business_value = high), ei-ohitetut.
      countNewCandidates((q) =>
        q.or(NOT_IGNORED).eq("metadata->>business_value", "high")
      ),

      // Tarjous-/kilpailutusmahdollisuudet: Hilma tai kilpailutusvaihe.
      countNewCandidates((q) =>
        q
          .or(NOT_IGNORED)
          .or(
            "metadata->>source_name.eq.hilma,metadata->>phase_hint.eq.Kilpailutus"
          )
      ),

      // Kaavoitus / varhaiset, ei-ohitetut.
      countNewCandidates((q) =>
        q.or(NOT_IGNORED).eq("metadata->>phase_hint", "Kaavoitus")
      ),

      // Automaattisesti suodatetut VIIMEISEN 24 H aikana. Ei "new"-sidonnainen:
      // auto-ohitetut viimeistellään suoraan "ignored"-tilaan (ks.
      // resolvePotentialProject), joten näytetään tuoreena lukuna eikä kaikkien
      // aikojen kertymänä, joka ei koskaan tyhjentynyt.
      (async () => {
        try {
          const since = new Date(
            Date.now() - 24 * 60 * 60 * 1000
          ).toISOString()
          const { count, error } = await supabaseAdmin
            .from("potential_projects")
            .select("*", { count: "exact", head: true })
            .eq("metadata->>recommended_action", "ignore")
            .gte("created_at", since)
          if (error) {
            console.error("TIC-yhteenveto, ohitetut:", error.message)
            return null
          }
          return count ?? 0
        } catch (err: any) {
          console.error("TIC-yhteenveto, ohitetut:", err?.message ?? err)
          return null
        }
      })(),

      /* Lahdelista on omassa suojassaan samasta syysta. */
      (async () => {
        try {
          return await getDiscoverySources()
        } catch (err: any) {
          console.error("TIC-yhteenveto, lahteet:", err?.message ?? err)
          return null
        }
      })(),
    ])

  const failedSources = sources
    ? sources.filter(
        (s: any) =>
          s.enabled &&
          s.last_error_at &&
          (!s.last_success_at ||
            new Date(s.last_error_at) > new Date(s.last_success_at))
      ).length
    : null

  return { needsReview, highPriority, tenders, zoning, ignored, failedSources }
}
