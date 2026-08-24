import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"
import {
  roleStageWeight,
  ROLE_DATIVE_LABEL,
} from "@/lib/opportunity/roleStageMatrix"
import {
  PHASE_LABELS,
  normalizeLegacyPhase,
  type PhaseKey,
} from "@/lib/projects/phases"
import { resolveWindow } from "@/lib/alerts/window"
import { matchesRegions } from "../../today/services/todayFilters"
import { defaultTodaySettings } from "../../today/services/getTodaySettings"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0
export const maxDuration = 60

/*
 * P2 — Elinkaari-laukaistut hälytykset ("oikea aika").
 *
 * Kun hanke etenee vaiheeseen joka on käyttäjän roolin HUIPPUVAIHE
 * (roleStageWeight === 1.0), lähetetään sähköpostihälytys. Opt-out:
 * oletuksena päällä käyttäjille joilla on rooli valittuna
 * (settings.opportunityAlerts !== false). Kerran/vrk (Vercel-cron).
 *
 * Lähde: project_phase_history (vaihemuutokset). Dedup: opportunity_alerts
 * (unique user_id+project_id+phase_key) estää saman hälytyksen kahdesti.
 *
 * ?dry=1  — laske ja raportoi, älä lähetä äläkä kirjaa (esikatselu).
 * ?hours=N — ohittaa vesirajan ja pakottaa kiinteän ikkunan (korjausajo).
 *
 * IKKUNA ON VESIRAJA, ei kiinteä 30 h. Ks. lib/alerts/window.ts — kiinteä
 * ikkuna tuotti 24.8.2026 pysyvän 18 tunnin katveen kun yksi ajo jäi
 * väliin, ja 71 hankeilmoitusta 8 asiakkaalle piti lähettää käsin.
 */

// PostgREST hylkää liian pitkän URL:n (satojen id:iden .in() -lista ->
// 400 Bad Request), joten haetaan id-listat paloissa.
const ID_CHUNK = 100

/* Vesirajan avain alert_watermarks-taulussa. */
const WATERMARK_KEY = "opportunity_alerts"

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function escapeHtml(s: string) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

type Match = {
  projectId: string
  phaseKey: PhaseKey
  name: string
  city: string | null
  region: string | null
  reason: string
}

function resolvePhaseKey(raw: unknown): PhaseKey | null {
  if (typeof raw !== "string" || !raw) return null
  if ((PHASE_LABELS as Record<string, string>)[raw]) return raw as PhaseKey
  const normalized = normalizeLegacyPhase(raw)
  return normalized && (PHASE_LABELS as Record<string, string>)[normalized]
    ? (normalized as PhaseKey)
    : null
}

function buildEmail(matches: Match[], appBaseUrl: string) {
  const rows = matches
    .slice(0, 30)
    .map((m) => {
      const meta = [m.city, m.region ?? "-", PHASE_LABELS[m.phaseKey]]
        .filter(Boolean)
        .join(" • ")
      const url = `${appBaseUrl}/projects?open=${encodeURIComponent(m.projectId)}`
      return `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;">
            <div style="font-weight:700;color:#111827;">
              <a href="${url}" style="color:#111827;text-decoration:none;">${escapeHtml(m.name)}</a>
            </div>
            <div style="font-size:13px;color:#6b7280;margin-top:2px;">${escapeHtml(meta)}</div>
            <div style="font-size:12px;color:#047857;margin-top:6px;font-weight:700;">${escapeHtml(m.reason)}</div>
            <div style="margin-top:8px;">
              <a href="${url}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:8px 10px;border-radius:8px;font-size:12px;font-weight:700;">Avaa hanke</a>
            </div>
          </td>
        </tr>`
    })
    .join("")

  const html = `
    <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;background:#f9fafb;padding:24px;">
      <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
        <div style="padding:18px 20px;border-bottom:1px solid #e5e7eb;">
          <div style="font-size:18px;font-weight:800;color:#111827;">Tyomaat.fi</div>
          <div style="margin-top:6px;color:#374151;font-weight:700;">
            ${matches.length} hanketta eteni sinulle otolliseen vaiheeseen
          </div>
        </div>
        <div style="padding:6px 20px 0 20px;">
          <table style="width:100%;border-collapse:collapse;">${rows}</table>
          <div style="margin:18px 0;">
            <a href="${appBaseUrl}/today" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:12px 14px;border-radius:10px;font-weight:800;">Avaa Tänään-näkymä</a>
          </div>
          <div style="margin:10px 0 18px;font-size:13px;color:#6b7280;">
            Voit kytkeä nämä hälytykset pois /today-asetuksista.
          </div>
        </div>
      </div>
    </div>`

  const text =
    `Hei!\n\n${matches.length} hanketta eteni sinulle otolliseen vaiheeseen:\n\n` +
    matches
      .slice(0, 30)
      .map(
        (m) =>
          `• ${m.name} – ${m.city ?? ""} – ${m.region ?? "-"} (${PHASE_LABELS[m.phaseKey]})\n  ${m.reason}\n  ${appBaseUrl}/projects?open=${encodeURIComponent(m.projectId)}`
      )
      .join("\n") +
    `\n\nAvaa Tänään: ${appBaseUrl}/today\n`

  return { html, text }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const secret = url.searchParams.get("secret")
    const authHeader = req.headers.get("authorization")
    const dry = url.searchParams.get("dry") === "1"
    const overrideHours = url.searchParams.has("hours")
      ? Number(url.searchParams.get("hours"))
      : null

    const isManual = !!secret && secret === process.env.CRON_SECRET
    const isCron =
      !!authHeader && authHeader === `Bearer ${process.env.CRON_SECRET}`
    if (!isManual && !isCron) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:3000"
    const fromEmail = process.env.MAIL_FROM || "onboarding@resend.dev"

    /*
     * VESIRAJA. Taulun puuttuminen ei saa kaataa hälytystä — silloin
     * palataan kiinteään ikkunaan, eli vanhaan käytökseen. Hiljainen
     * paluu on tässä oikein: hälytys on parempi myöhässä kuin ei
     * lainkaan, ja puuttuva taulu näkyy vastauksen windowSource-kentässä.
     */
    const ajoAlkoi = new Date()
    const { data: wmRow } = await supabase
      .from("alert_watermarks")
      .select("last_processed_at")
      .eq("key", WATERMARK_KEY)
      .maybeSingle()

    const ikkuna = resolveWindow({
      now: ajoAlkoi.getTime(),
      overrideHours,
      watermark: (wmRow as any)?.last_processed_at ?? null,
    })
    const since = ikkuna.since

    /*
     * Vesiraja siirtyy ajon ALKUHETKEEN, ei loppuun: ajon aikana syntyneet
     * vaihemuutokset jäävät seuraavalle kierrokselle. Päällekkäisyys on
     * vaaratonta, koska opportunity_alerts on uniikki
     * (user_id, project_id, phase_key).
     *
     * Siirtyy myös kun mitään ei lähetetty — vesiraja tarkoittaa
     * "käsitelty tähän asti", ei "lähetetty tähän asti". Muuten ikkuna
     * kasvaisi loputtomiin hiljaisina päivinä.
     */
    const siirraVesiraja = async () => {
      if (dry || overrideHours != null) return
      const { error } = await supabase
        .from("alert_watermarks")
        .upsert(
          { key: WATERMARK_KEY, last_processed_at: ajoAlkoi.toISOString(), updated_at: new Date().toISOString() },
          { onConflict: "key" }
        )
      if (error) console.error("VESIRAJAN SIIRTO EPAONNISTUI:", error.message)
    }

    // 1. Vaihemuutokset ikkunassa; pidä uusin vaihe per hanke.
    const { data: history, error: hErr } = await supabase
      .from("project_phase_history")
      .select("project_id, phase, created_at")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: true })
    if (hErr) throw hErr

    const latestPhaseByProject = new Map<string, PhaseKey>()
    for (const row of history ?? []) {
      const phaseKey = resolvePhaseKey((row as any).phase)
      if (phaseKey) latestPhaseByProject.set((row as any).project_id, phaseKey)
    }

    const projectIds = [...latestPhaseByProject.keys()]
    if (!projectIds.length) {
      await siirraVesiraja()
      return NextResponse.json({
        ok: true,
        windowHours: ikkuna.hours,
        windowSource: ikkuna.source,
        since: since.toISOString(),
        changedProjects: 0,
        sent: 0,
      })
    }

    // 2. Hankkeiden tiedot (id-lista paloissa, ks. ID_CHUNK).
    const projectById = new Map<string, any>()
    for (const ids of chunk(projectIds, ID_CHUNK)) {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, city, region, metadata, is_public")
        .in("id", ids)
      if (error) throw error
      for (const p of data ?? []) {
        if ((p as any).is_public !== false) projectById.set((p as any).id, p)
      }
    }

    // 3. Käyttäjäasetukset.
    const { data: prefsRows, error: prefErr } = await supabase
      .from("user_today_preferences")
      .select("user_id, settings")
    if (prefErr) throw prefErr

    // 4. Jo lähetetyt (dedup) — id-lista paloissa.
    const alreadySent = new Set<string>()
    let alertsTableError: string | null = null
    for (const ids of chunk(projectIds, ID_CHUNK)) {
      const { data, error } = await supabase
        .from("opportunity_alerts")
        .select("user_id, project_id, phase_key")
        .in("project_id", ids)
      if (error) {
        alertsTableError = error.message
        break
      }
      for (const e of data ?? []) {
        alreadySent.add(`${e.user_id}:${e.project_id}:${e.phase_key}`)
      }
    }
    if (alertsTableError && !dry) {
      return NextResponse.json(
        {
          error:
            "opportunity_alerts-taulua ei löydy — aja docs/sql/2026-07-28_opportunity_alerts.sql",
          detail: alertsTableError,
        },
        { status: 500 }
      )
    }

    // 5. Muodosta osumat per käyttäjä (vain roolin huippuvaihe, paino 1.0).
    const perUser = new Map<string, Match[]>()
    for (const pref of prefsRows ?? []) {
      const userId = (pref as any).user_id
      const settings = { ...defaultTodaySettings, ...((pref as any).settings ?? {}) }
      const role = settings.companyProfile
      if (!role) continue
      if (settings.opportunityAlerts === false) continue

      for (const [projectId, phaseKey] of latestPhaseByProject) {
        const project = projectById.get(projectId)
        if (!project) continue
        if (roleStageWeight(role, phaseKey) < 1) continue
        if (!matchesRegions(project, settings.regions)) continue
        if (alreadySent.has(`${userId}:${projectId}:${phaseKey}`)) continue

        const dative = ROLE_DATIVE_LABEL[role] ?? "sinulle"
        const list = perUser.get(userId) ?? []
        list.push({
          projectId,
          phaseKey,
          name: String(project.name ?? "(nimetön)"),
          city: project.city ?? null,
          region: project.region ?? null,
          reason: `${PHASE_LABELS[phaseKey]} — sopii ${dative}`,
        })
        perUser.set(userId, list)
      }
    }

    // 6. Lähetä (tai esikatsele dry-tilassa).
    const resendKey = process.env.RESEND_API_KEY
    const resend = resendKey ? new Resend(resendKey) : null

    let sent = 0
    const preview: any[] = []

    for (const [userId, matches] of perUser) {
      if (!matches.length) continue

      const { data: userData } = await supabase.auth.admin.getUserById(userId)
      const email = userData?.user?.email ?? null

      if (dry) {
        preview.push({
          userId,
          email,
          count: matches.length,
          sample: matches.slice(0, 5).map((m) => `${m.name} (${PHASE_LABELS[m.phaseKey]})`),
        })
        continue
      }

      if (!email || !resend) continue

      const { subject } = {
        subject: `${matches.length} hanketta eteni sinulle otolliseen vaiheeseen`,
      }
      const { html, text } = buildEmail(matches, appBaseUrl)

      const sendRes = await resend.emails.send({
        from: fromEmail,
        to: email,
        subject,
        text,
        html,
      })
      if ((sendRes as any)?.error) {
        console.error("OPPORTUNITY ALERT SEND ERROR:", (sendRes as any).error)
        continue
      }

      const { error: insErr } = await supabase.from("opportunity_alerts").insert(
        matches.map((m) => ({
          user_id: userId,
          project_id: m.projectId,
          phase_key: m.phaseKey,
        }))
      )
      if (insErr) console.error("OPPORTUNITY ALERT INSERT ERROR:", insErr.message)

      sent++
    }

    await siirraVesiraja()

    return NextResponse.json({
      ok: true,
      dry,
      windowHours: ikkuna.hours,
      windowSource: ikkuna.source,
      since: since.toISOString(),
      changedProjects: projectIds.length,
      usersMatched: perUser.size,
      sent,
      ...(dry ? { preview } : {}),
    })
  } catch (err: any) {
    console.error("OPPORTUNITY ALERTS ERROR:", err)
    return NextResponse.json(
      { error: err?.message || String(err) },
      { status: 500 }
    )
  }
}
