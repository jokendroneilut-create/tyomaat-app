import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { PHASE_LABELS } from "@/lib/projects/phases"
import {
  tenderExpiry,
  isTenderEnriched,
  TENDER_EXPIRY_YEARS,
} from "@/lib/projects/tenderExpiry"

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

    const { data: tenderProjects, error: fetchError } = await supabaseAdmin
      .from("projects")
      .select("id, phase, status, created_at, metadata")
      .eq("status", "active")
      .eq("phase", PHASE_LABELS.tender)

    if (fetchError) throw fetchError

    const results: any[] = []

    for (const project of tenderProjects ?? []) {
      const md = project.metadata ?? {}

      if (isTenderEnriched(md)) continue

      const exp = tenderExpiry(md, project.created_at)
      if (!exp) continue

      // Ei vielä vanhentunut.
      if (exp.date > now) continue

      const { error: updateError } = await supabaseAdmin
        .from("projects")
        .update({
          status: "expired",
          metadata: {
            ...md,
            expired_at: now.toISOString(),
            expired_reason: `Määräajasta yli ${TENDER_EXPIRY_YEARS} v (${exp.source}, vanheni ${exp.date
              .toISOString()
              .slice(0, 10)})`,
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
        source: exp.source,
      })
    }

    return NextResponse.json({
      ok: true,
      checked: (tenderProjects ?? []).length,
      expired: results.filter((r) => r.ok).length,
      results,
    })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
