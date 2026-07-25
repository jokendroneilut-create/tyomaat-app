import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { PHASE_LABELS } from "@/lib/projects/phases"

export const runtime = "nodejs"
export const maxDuration = 60

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/*
 * Kilpailutus-vaiheen hanke perustuu tarjousilmoitukseen, joka vanhenee:
 * vuoden kuluttua julkaisusta tarjouskilpailu on lähes varmasti ratkennut
 * (tai rauennut), eikä vanha "Kilpailutus"-hanke ole enää myyntimielessä
 * relevantti. Jos voittaja on selvinnyt, jälki-ilmoitus on jo edistänyt
 * vaiheen "Sopimus myönnetty" -tilaan, jolloin hanke EI ole enää tässä
 * haarukassa (phase = Kilpailutus) — eli rikastuneita hankkeita ei vanheteta.
 *
 * Vanheneminen piilottaa hankkeen aktiivisista näkymistä asettamalla
 * status = "expired" (Today suodattaa status = "active"; projects-sivu
 * suodattaa niin ikään aktiiviset). Vaihe jätetään ennalleen historian
 * vuoksi. Referenssipäivä: ilmoituksen julkaisu (metadata.date_published),
 * toissijaisesti tarjousten määräaika tai hankkeen luontipäivä.
 */
const EXPIRY_YEARS = 1

function referenceDate(project: any): { iso: string; source: string } | null {
  const md = project.metadata ?? {}
  const published = md.date_published ?? null
  const deadline = md.deadline ?? null
  const created = project.created_at ?? null

  const raw = published ?? deadline ?? created
  if (!raw) return null

  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return null

  const source = published
    ? "date_published"
    : deadline
      ? "deadline"
      : "created_at"

  return { iso: parsed.toISOString(), source }
}

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

    const cutoff = new Date()
    cutoff.setFullYear(cutoff.getFullYear() - EXPIRY_YEARS)

    const { data: tenderProjects, error: fetchError } = await supabaseAdmin
      .from("projects")
      .select("id, phase, status, created_at, metadata")
      .eq("status", "active")
      .eq("phase", PHASE_LABELS.tender)

    if (fetchError) throw fetchError

    const results: any[] = []

    for (const project of tenderProjects ?? []) {
      const md = project.metadata ?? {}

      /*
       * Turvavyö: jos voittaja on jostain syystä rikastanut hankkeen ilman
       * että vaihe eteni, ei vanheteta.
       */
      const enriched =
        md.is_contract_award === true ||
        (Array.isArray(md.winners) && md.winners.length > 0)

      if (enriched) continue

      const ref = referenceDate(project)
      if (!ref) continue

      if (new Date(ref.iso) >= cutoff) continue

      const { error: updateError } = await supabaseAdmin
        .from("projects")
        .update({
          status: "expired",
          metadata: {
            ...md,
            expired_at: new Date().toISOString(),
            expired_reason: `Ilmoituksesta yli ${EXPIRY_YEARS} v (${ref.source} ${ref.iso.slice(0, 10)})`,
          },
        })
        .eq("id", project.id)

      if (updateError) {
        results.push({ projectId: project.id, ok: false, error: updateError.message })
        continue
      }

      results.push({ projectId: project.id, ok: true, referenceDate: ref.iso.slice(0, 10) })
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
