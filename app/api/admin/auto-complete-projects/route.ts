import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { PHASE_LABELS } from "@/lib/projects/phases"
import { recordPhaseChange } from "@/lib/projects/recordPhaseChange"

export const runtime = "nodejs"
export const maxDuration = 60

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/*
 * Siirtää automaattisesti "valmistunut"-vaiheeseen hankkeet joiden
 * arvioitu valmistumispäivä (estimated_completion, poimittu vapaasta
 * tekstistä esim. "hanke valmistuu lokakuussa 2026") on jo mennyt eikä
 * vaihe vielä ole "Valmistunut" — muuten hankkeet jäisivät pysyvästi
 * vanhaan vaiheeseensa vaikka data tietäisi paremmin.
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

    const today = new Date().toISOString().slice(0, 10)

    const { data: dueProjects, error: fetchError } = await supabaseAdmin
      .from("projects")
      .select("id, phase, status, estimated_completion")
      .not("estimated_completion", "is", null)
      .lte("estimated_completion", today)
      .neq("phase", PHASE_LABELS.completed)

    if (fetchError) throw fetchError

    const results: any[] = []

    for (const project of dueProjects ?? []) {
      const { error: updateError } = await supabaseAdmin
        .from("projects")
        .update({
          phase: PHASE_LABELS.completed,
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", project.id)

      if (updateError) {
        results.push({ projectId: project.id, ok: false, error: updateError.message })
        continue
      }

      await recordPhaseChange({
        supabase: supabaseAdmin,
        projectId: project.id,
        newPhase: PHASE_LABELS.completed,
        previousPhase: project.phase,
        source: "auto_sync",
        sourceName: "estimated-completion-cron",
        reason: `Arvioitu valmistumispäivä (${project.estimated_completion}) on mennyt`,
      })

      results.push({ projectId: project.id, ok: true })
    }

    return NextResponse.json({
      ok: true,
      checked: (dueProjects ?? []).length,
      transitioned: results.filter((r) => r.ok).length,
      results,
    })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
