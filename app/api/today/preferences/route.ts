import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "userId missing" },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from("user_today_preferences")
      .select("settings")
      .eq("user_id", userId)
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({
      ok: true,
      settings: data?.settings ?? null,
    })
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message ?? "Unknown error" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const { userId, settings } = body

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "userId missing" },
        { status: 400 }
      )
    }

    const normalizedSettings = {
      regions: settings?.regions ?? [],
      municipalities: settings?.municipalities ?? [],
      projectStages: settings?.projectStages ?? [],
      constructionTypes: settings?.constructionTypes ?? [],
      buildingTypes: settings?.buildingTypes ?? [],
      bestSalesMoments: settings?.bestSalesMoments ?? [],
      sources: settings?.sources ?? [],
      maxProjects: settings?.maxProjects ?? 40,
      showRejected: settings?.showRejected ?? false,
      showArchived: settings?.showArchived ?? false,
      companyProfile: settings?.companyProfile ?? null,
    }

    const { data, error } = await supabaseAdmin
      .from("user_today_preferences")
      .upsert(
        {
          user_id: userId,
          regions: normalizedSettings.regions,
          municipalities: normalizedSettings.municipalities,
          project_stages: normalizedSettings.projectStages,
          construction_types: normalizedSettings.constructionTypes,
          building_types: normalizedSettings.buildingTypes,
          max_projects: normalizedSettings.maxProjects,
          settings: normalizedSettings,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      ok: true,
      preferences: data,
    })
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message ?? "Unknown error" },
      { status: 500 }
    )
  }
}