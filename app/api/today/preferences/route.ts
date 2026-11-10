import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/*
 * KUTSUJA LUETAAN ISTUNNOSTA, EI PYYNNON PARAMETRISTA (D-400).
 *
 * Taulu `user_today_preferences` on RLS:n takana ILMAN policya
 * (docs/sql/2026-07-30_enable_rls_exposed_tables.sql, luokka C), eli
 * siihen paasee vain `service_role`. Kun paasy suljettiin selaimelta,
 * TAMA REITTI jai ainoaksi lukoksi -- ja lukko puuttui: `userId` tuli
 * kyselysta ja kirjoituksen rungosta sellaisenaan, joten kenen tahansa
 * tunnuksen asetukset olisi voinut lukea ja ylikirjoittaa pelkalla
 * UUID:lla.
 *
 * Sama periaate on kirjoitettu naapurireittiin `analytics/track`
 * heinakuussa: *"user_id luetaan aina palvelimella session-evasteesta,
 * ei koskaan clientin lahettamasta arvosta"*. Nyt se patee myos tassa.
 *
 * Evastepohjainen istunto on valittu Bearer-tokenin sijaan, koska
 * kaikki nelja kutsupaikkaa ovat selaimesta samalta originilta eivatka
 * ne lahetä tokenia -- naita ei siis tarvitse muuttaa.
 */
async function kirjautunutKayttaja(): Promise<string | null> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll() {},
      },
    }
  )
  const { data, error } = await supabase.auth.getUser()
  return error ? null : (data.user?.id ?? null)
}

/*
 * Palauttaa kayttajatunnuksen jota pyynto saa kasitella, tai
 * virhevastauksen. Clientin lahettama `userId` sailyy rajapinnassa,
 * mutta sita EI kayteta valintaan: jos se on eri kuin istunnon
 * kayttaja, pyynto hylataan. Nain vanha kutsutapa toimii eika
 * hiljaista kayttajan vaihtoa voi tapahtua.
 */
function tarkistaKayttaja(
  istunnonId: string | null,
  pyynnonId: unknown
): { ok: true; userId: string } | { ok: false; vastaus: NextResponse } {
  if (!istunnonId) {
    return {
      ok: false,
      vastaus: NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }),
    }
  }
  if (typeof pyynnonId === "string" && pyynnonId && pyynnonId !== istunnonId) {
    return {
      ok: false,
      vastaus: NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 }),
    }
  }
  return { ok: true, userId: istunnonId }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const tarkistus = tarkistaKayttaja(
      await kirjautunutKayttaja(),
      searchParams.get("userId")
    )
    if (!tarkistus.ok) return tarkistus.vastaus
    const userId = tarkistus.userId

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
    /*
     * Opt-in-suodatin: `=== true` eikä `!== false`, koska oletus on POIS.
     * Vanhoilla riveillä kenttää ei ole, ja silloin näkymä ei saa kaventua
     * itsestään.
     */
    keywordsOnly: settings?.keywordsOnly === true,
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
    const { userId: pyydetty, settings } = await request.json()
    const tarkistus = tarkistaKayttaja(await kirjautunutKayttaja(), pyydetty)
    if (!tarkistus.ok) return tarkistus.vastaus
    const userId = tarkistus.userId

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
    const { userId: pyydetty, settings: patch } = await request.json()
    const tarkistus = tarkistaKayttaja(await kirjautunutKayttaja(), pyydetty)
    if (!tarkistus.ok) return tarkistus.vastaus
    const userId = tarkistus.userId

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
