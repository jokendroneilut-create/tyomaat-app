import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"

export const runtime = "nodejs"

function parseAdminEmails(value: string | undefined) {
  return (value || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const subject = String(body.subject || "").trim()
    const message = String(body.message || "").trim()
    const testOnly = body.testOnly === true

    if (!subject) {
      return NextResponse.json({ error: "subject missing" }, { status: 400 })
    }

    if (!message) {
      return NextResponse.json({ error: "message missing" }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const authHeader = req.headers.get("authorization")

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "missing auth token" }, { status: 401 })
    }

    const token = authHeader.replace("Bearer ", "").trim()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token)

    if (userError || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    }

    const admins = parseAdminEmails(process.env.ADMIN_EMAILS)
    const userEmail = (user.email || "").toLowerCase()

    if (!admins.includes(userEmail)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 })
    }

    let allUsers: any[] = []
    let page = 1
    const perPage = 100

    while (true) {
      const { data, error } = await supabase.auth.admin.listUsers({
        page,
        perPage,
      })

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      const usersBatch = data.users || []
      allUsers = allUsers.concat(usersBatch)

      if (usersBatch.length < perPage) {
        break
      }

      page++
    }

    const allRecipients = allUsers
      .map((u) => u.email?.trim().toLowerCase())
      .filter((email): email is string => !!email)

    const recipients = testOnly ? [userEmail] : allRecipients

    if (recipients.length === 0) {
      return NextResponse.json({ error: "no recipients found" }, { status: 400 })
    }

    const resend = new Resend(process.env.RESEND_API_KEY!)

    const fromEmail = process.env.MAIL_FROM

    if (!fromEmail) {
      return NextResponse.json(
        { error: "MAIL_FROM missing" },
        { status: 500 }
      )
    }

    // Resend sallii max 50 vastaanottajaa yhteensä.
    // Tässä käytetään to + bcc, joten bcc-erän koko saa olla max 49.
    const chunkSize = 49
    const chunks: string[][] = []

    for (let i = 0; i < recipients.length; i += chunkSize) {
      chunks.push(recipients.slice(i, i + chunkSize))
    }

    for (const chunk of chunks) {
      const sendResult = await resend.emails.send({
        from: fromEmail,
        to: fromEmail,
        bcc: chunk,
        subject,
        text: message,
        html: `<div style="font-family:Arial,sans-serif;white-space:pre-wrap;">${message}</div>`,
      })

      const sendError = (sendResult as any)?.error

      if (sendError) {
        return NextResponse.json(
          { error: sendError.message || "send failed" },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      ok: true,
      sent: recipients.length,
      testOnly,
    })
  } catch (err: any) {
    console.error("SEND BROADCAST ERROR:", err)

    return NextResponse.json(
      { error: err?.message || "unknown error" },
      { status: 500 }
    )
  }
}