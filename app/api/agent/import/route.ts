import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { findProjectMatch } from "@/lib/agent/projectMatcher"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.name || body.name.trim().length < 5) {
  return NextResponse.json({ status: "invalid_name" })
}

if (/^\d+$/.test(body.name.trim())) {
  return NextResponse.json({ status: "invalid_name" })
}
if (body.name.trim().toLowerCase() === "lue lisää") {
  return NextResponse.json({ status: "invalid_name" })
}

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const candidate = {
      name: body.name || null,
      city: body.city || null,
      region: body.region || null,
      location: body.location || null,
    }

    const { data: projects } = await supabase
      .from("projects")
      .select("id,name,city,region,location,phase,completed_at,status")

    const match = findProjectMatch(projects || [], candidate)

    if (match) {
      const matchedProjectId = match.id

      await supabase
        .from("projects")
        .update({
          last_verified_at: new Date().toISOString(),
          city: body.city || match.city || null,
          region: body.region || match.region || null,
          location: body.location || match.location || null,
          phase: body.phase || match.phase || undefined,
          needs_review: body.completed ? true : false,
          source_confidence: body.confidence ?? null,
          status: body.completed ? "completed" : match.status ?? "active",
          completed_at: body.completed
            ? new Date().toISOString()
            : match.completed_at ?? null,
        })
        .eq("id", matchedProjectId)

      await supabase.from("project_import_events").insert({
        source_name: body.source_name || "agent",
        source_url: body.source_url || null,
        normalized_payload: body,
        match_status: "matched",
        matched_project_id: matchedProjectId,
        action_taken: "verified",
      })

      if (body.source_url) {
        await supabase.from("project_sources").upsert(
  {
    project_id: matchedProjectId, // tai inserted.id toisessa haarassa
    source_name: body.source_name || "agent",
    source_url: body.source_url,
    last_seen_at: new Date().toISOString(),
    confidence: body.confidence ?? null,
  },
  {
    onConflict: "project_id,source_name,source_url",
  }
)
      }

      return NextResponse.json({
        status: "matched",
        project_id: matchedProjectId,
      })
    }

    if (body.source_url) {
      const { data: existing } = await supabase
        .from("project_import_events")
        .select("id")
        .eq("source_url", body.source_url)
        .eq("action_taken", "inserted")
        .limit(1)

      if (existing && existing.length > 0) {
        await supabase.from("project_import_events").insert({
          source_name: body.source_name || "agent",
          source_url: body.source_url,
          normalized_payload: body,
          match_status: "duplicate_source",
          matched_project_id: null,
          action_taken: "skipped",
          reason: "source_url already imported",
        })

        return NextResponse.json({
          status: "duplicate_source",
          reason: "source_url already imported",
        })
      }
    }

    const { data: inserted } = await supabase
      .from("projects")
      .insert({
        name: body.name,
        city: body.city,
        region: body.region,
        location: body.location,
        phase: body.phase || "Suunnittelussa",
        is_public: true,
        source_confidence: body.confidence ?? null,
      })
      .select()
      .single()

    await supabase.from("project_import_events").insert({
      source_name: body.source_name || "agent",
      source_url: body.source_url || null,
      normalized_payload: body,
      match_status: "new",
      matched_project_id: inserted?.id,
      action_taken: "inserted",
    })

    if (inserted?.id && body.source_url) {
      await supabase.from("project_sources").upsert({
        project_id: inserted.id,
        source_name: body.source_name || "agent",
        source_url: body.source_url,
        last_seen_at: new Date().toISOString(),
        confidence: body.confidence ?? null,
      })
    }

    return NextResponse.json({
      status: "inserted",
      project_id: inserted?.id,
    })
  } catch (err: any) {
    console.error(err)

    return NextResponse.json(
      {
        error: err.message,
      },
      { status: 500 }
    )
  }
}