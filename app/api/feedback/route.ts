import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

/*
 * Sovelluksen sisäinen palauteluukku. Korvaa aiemman mailto:info@tyomaat.fi
 * -linkin: palaute tallennetaan feedback_messages-tauluun JA lähetetään
 * Resendillä osoitteeseen info@tyomaat.fi.
 *
 * Body: { userId?, context?, message, projectId?, projectName? }
 * Taulu: docs/sql/2026-07-28_feedback_messages.sql
 */

const FEEDBACK_TO = "info@tyomaat.fi"

function escapeHtml(s: string) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))

    const message = String(body?.message ?? "").trim()
    if (!message) {
      return NextResponse.json(
        { ok: false, error: "message missing" },
        { status: 400 }
      )
    }

    const userId =
      typeof body?.userId === "string" && body.userId ? body.userId : null
    const context =
      typeof body?.context === "string" ? body.context.trim() : ""
    const projectId =
      typeof body?.projectId === "string" && body.projectId
        ? body.projectId
        : null
    const projectName =
      typeof body?.projectName === "string" && body.projectName
        ? body.projectName
        : null

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Käyttäjän sähköposti mukaan (jos kirjautunut), jotta palautteeseen voi vastata.
    let userEmail: string | null = null
    if (userId) {
      try {
        const { data } = await supabase.auth.admin.getUserById(userId)
        userEmail = data?.user?.email ?? null
      } catch {
        userEmail = null
      }
    }

    const metadata = {
      projectId,
      projectName,
      userEmail,
    }

    // 1. Tallenna kantaan.
    const { error: insErr } = await supabase.from("feedback_messages").insert({
      user_id: userId,
      context: context || null,
      message,
      metadata,
    })
    if (insErr) {
      // Yleisin syy: taulua ei ole vielä luotu.
      return NextResponse.json(
        {
          ok: false,
          error:
            "feedback_messages-taulua ei löydy — aja docs/sql/2026-07-28_feedback_messages.sql",
          detail: insErr.message,
        },
        { status: 500 }
      )
    }

    // 2. Lähetä sähköpostina info@tyomaat.fi (best-effort).
    const resendKey = process.env.RESEND_API_KEY
    const fromEmail = process.env.MAIL_FROM || "onboarding@resend.dev"
    let emailed = false

    if (resendKey) {
      const resend = new Resend(resendKey)

      const metaLines = [
        context ? `Konteksti: ${context}` : null,
        projectName ? `Hanke: ${projectName}` : null,
        projectId ? `Hanke-ID: ${projectId}` : null,
        userEmail ? `Käyttäjä: ${userEmail}` : null,
        userId ? `User-ID: ${userId}` : null,
      ].filter(Boolean) as string[]

      const subject = context
        ? `Palaute: ${context}`
        : "Palaute (Työmaat)"

      const text =
        `Uusi palaute Työmaat-sovelluksesta:\n\n` +
        (metaLines.length ? `${metaLines.join("\n")}\n\n` : "") +
        `Viesti:\n${message}\n`

      const html = `
        <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:#111827;">
          <div style="font-size:16px;font-weight:800;margin-bottom:10px;">Uusi palaute Työmaat-sovelluksesta</div>
          ${
            metaLines.length
              ? `<div style="font-size:13px;color:#6b7280;margin-bottom:12px;">${metaLines
                  .map((l) => escapeHtml(l))
                  .join("<br/>")}</div>`
              : ""
          }
          <div style="white-space:pre-wrap;font-size:14px;line-height:1.5;border-top:1px solid #e5e7eb;padding-top:12px;">${escapeHtml(
            message
          )}</div>
        </div>`

      const sendRes = await resend.emails.send({
        from: fromEmail,
        to: FEEDBACK_TO,
        subject,
        text,
        html,
        ...(userEmail ? { replyTo: userEmail } : {}),
      })

      if ((sendRes as any)?.error) {
        console.error("FEEDBACK SEND ERROR:", (sendRes as any).error)
      } else {
        emailed = true
      }
    }

    return NextResponse.json({ ok: true, emailed })
  } catch (error: any) {
    console.error("FEEDBACK ERROR:", error)
    return NextResponse.json(
      { ok: false, error: error?.message ?? "Unknown error" },
      { status: 500 }
    )
  }
}
