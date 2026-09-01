import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { evaluateAutoComplete, ODOTUS_PAIVAA } from "@/lib/projects/autoCompleteGate"
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
      .select("id, phase, status, estimated_completion, created_at, metadata")
      .not("estimated_completion", "is", null)
      .lte("estimated_completion", today)
      .neq("phase", PHASE_LABELS.completed)

    if (fetchError) throw fetchError

    /*
     * Lahdedokumentin last_seen_at kertoo listaako lahde hanketta yha.
     * Haetaan kerralla niille joilla source_url on tiedossa.
     */
    const urlit = [
      ...new Set(
        (dueProjects ?? [])
          .map((p: any) => String(p.metadata?.source_url ?? "").trim())
          .filter(Boolean)
      ),
    ]
    const nahty = new Map<string, string>()
    for (let i = 0; i < urlit.length; i += 90) {
      const { data } = await supabaseAdmin
        .from("source_documents")
        .select("document_url,last_seen_at")
        .in("document_url", urlit.slice(i, i + 90))
      for (const d of data ?? []) {
        const url = String((d as any).document_url)
        const seen = String((d as any).last_seen_at ?? "")
        if (seen && seen > (nahty.get(url) ?? "")) nahty.set(url, seen)
      }
    }

    const results: any[] = []
    const odottaa: string[] = []
    const ohitettu: string[] = []

    for (const project of dueProjects ?? []) {
      /*
       * PORTTI: arvion umpeutuminen ei yksin riita piilottamiseen.
       * Ks. `lib/projects/autoCompleteGate.ts` - periaate on etta kesken
       * oleva hanke piilotettuna on pahempi kuin valmistunut hanke
       * listalla.
       */
      const paatos = evaluateAutoComplete({
        estimatedCompletion: (project as any).estimated_completion,
        createdAt: (project as any).created_at,
        lastSeenAt: nahty.get(String((project as any).metadata?.source_url ?? "")) ?? null,
        phase: project.phase,
      })

      if (paatos === "wait") {
        odottaa.push(project.id)
        continue
      }
      if (paatos === "skip") {
        ohitettu.push(project.id)
        continue
      }

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
        reason: `Arvioitu valmistumispäivä (${project.estimated_completion}) meni yli ${ODOTUS_PAIVAA} vrk sitten eikä lähde listaa hanketta enää`,
      })

      results.push({ projectId: project.id, ok: true })
    }

    return NextResponse.json({
      ok: true,
      checked: (dueProjects ?? []).length,
      transitioned: results.filter((r) => r.ok).length,
      /* Odottavat ja ohitetut nakyviin: portin vaikutus on mitattava. */
      waiting: odottaa.length,
      skipped: ohitettu.length,
      results,
    })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
