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

/*
 * Normalisointi täyttää PUUTTUVAT kentät oletuksilla, joten osittainen
 * settings-olio pyyhkisi loput. Siksi POST vaatii koko olion ja osittaiseen
 * muutokseen on erillinen PATCH, joka lukee nykyiset asetukset ensin.
 */
function normalizeSettings(settings: any) {
  return {
    regions: settings?.regions ?? [],
    municipalities: settings?.municipalities ?? [],
    projectStages: settings?.projectStages ?? [],
    constructionTypes: settings?.constructionTypes ?? [],
    buildingTypes: settings?.buildingTypes ?? [],
    bestSalesMoments: settings?.bestSalesMoments ?? [],
    keywords: Array.isArray(settings?.keywords)
      ? settings.keywords
          .map((k: unknown) => String(k ?? "").trim())
          .filter((k: string) => k.length > 0)
          .slice(0, 30)
      : [],
    maxProjects: settings?.maxProjects ?? 40,
    showRejected: settings?.showRejected ?? false,
    showArchived: settings?.showArchived ?? false,
    companyProfile: settings?.companyProfile ?? null,
    opportunityAlerts: settings?.opportunityAlerts ?? true,
    teamModeInToday: settings?.teamModeInToday === true,
    hideTeammateOwned: settings?.hideTeammateOwned !== false,
  }
}

async function saveSettings(userId: string, settings: any) {
  const normalizedSettings = normalizeSettings(settings)

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

  return data
}

export async function POST(request: Request) {
  try {
    const { userId, settings } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "userId missing" },
        { status: 400 }
      )
    }

    return NextResponse.json({
      ok: true,
      preferences: await saveSettings(userId, settings),
    })
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message ?? "Unknown error" },
      { status: 500 }
    )
  }
}

/*
 * Osittainen päivitys: yhden asetuksen muuttaminen ilman että kutsuja joutuu
 * tuntemaan ja lähettämään kaikki muut. Asetussivun "Ilmoitukset" käyttää
 * tätä - ilman merge-lukua se pyyhkisi alueet, avainsanat ja yritysprofiilin.
 */
export async function PATCH(request: Request) {
  try {
    const { userId, settings: patch } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "userId missing" },
        { status: 400 }
      )
    }

    if (!patch || typeof patch !== "object") {
      return NextResponse.json(
        { ok: false, error: "settings missing" },
        { status: 400 }
      )
    }

    const { data: existing, error: readError } = await supabaseAdmin
      .from("user_today_preferences")
      .select("settings")
      .eq("user_id", userId)
      .maybeSingle()

    if (readError) throw readError

    return NextResponse.json({
      ok: true,
      preferences: await saveSettings(userId, {
        ...(existing?.settings ?? {}),
        ...patch,
      }),
    })
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message ?? "Unknown error" },
      { status: 500 }
    )
  }
}
