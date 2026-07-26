import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { PHASE_LABELS } from "@/lib/projects/phases"
import { resolveExpiry } from "@/lib/projects/tenderExpiry"

export const runtime = "nodejs"
export const maxDuration = 60

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/*
 * Kilpailutus-vaiheen hanke perustuu tarjousilmoitukseen, joka vanhenee:
 * vuoden kuluttua tarjousten määräajasta kilpailu on lähes varmasti
 * ratkennut (tai rauennut), eikä vanha "Kilpailutus"-hanke ole enää
 * myyntimielessä relevantti. Jos voittaja on selvinnyt, jälki-ilmoitus on jo
 * edistänyt vaiheen "Sopimus myönnetty" -tilaan, jolloin hanke EI ole enää
 * tässä haarukassa (phase = Kilpailutus) — rikastuneita hankkeita ei vanheteta
 * (isTenderEnriched-turvavyö varmistaa tämän myös reunatapauksissa).
 *
 * Vanheneminen piilottaa hankkeen aktiivisista näkymistä asettamalla
 * status = "expired". Vaihe jätetään ennalleen historian vuoksi.
 * Vanhenemispäivä lasketaan lib/projects/tenderExpiry.ts:ssä (sama logiikka
 * kuin hankekorteilla): määräaika ensin, sitten julkaisu, sitten luontipäivä.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const querySecret = url.searchParams.get("secret")
    const authHeader = req.headers.get("authorization")

    const isManualRun = !!querySecret && querySecret === process.env.CRON_SECRET
    const isCronRun =
      !!authHeader && authHeader === `Bearer ${process.env.CRON_SECRET}`

    if (!isManualRun && !isCronRun) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    }

    const now = new Date()

    /*
     * Ehdokkaat: Kilpailutus-vaiheen hankkeet (automaattinen vanheneminen)
     * SEKÄ mikä tahansa hanke jolle on hyväksynnässä valittu manuaalinen
     * expire_at. resolveExpiry ratkaisee kumman sääntö pätee.
     */
    const { data: candidates, error: fetchError } = await supabaseAdmin
      .from("projects")
      .select("id, phase, status, created_at, metadata")
      .eq("status", "active")
      .or(`phase.eq.${PHASE_LABELS.tender},metadata->>expire_at.not.is.null`)

    if (fetchError) throw fetchError

    const results: any[] = []

    for (const project of candidates ?? []) {
      const exp = resolveExpiry(project.metadata, project.phase, project.created_at)
      if (!exp) continue

      // Ei vielä vanhentunut.
      if (exp.date > now) continue

      const md = project.metadata ?? {}
      const { error: updateError } = await supabaseAdmin
        .from("projects")
        .update({
          status: "expired",
          metadata: {
            ...md,
            expired_at: now.toISOString(),
            expired_reason: exp.manual
              ? `Manuaalinen vanheneminen (${exp.date.toISOString().slice(0, 10)})`
              : `Kilpailutus vanheni määräajasta (${exp.date.toISOString().slice(0, 10)})`,
          },
        })
        .eq("id", project.id)

      if (updateError) {
        results.push({ projectId: project.id, ok: false, error: updateError.message })
        continue
      }

      results.push({
        projectId: project.id,
        ok: true,
        expiresOn: exp.date.toISOString().slice(0, 10),
        manual: exp.manual,
      })
    }

    return NextResponse.json({
      ok: true,
      checked: (candidates ?? []).length,
      expired: results.filter((r) => r.ok).length,
      results,
    })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
