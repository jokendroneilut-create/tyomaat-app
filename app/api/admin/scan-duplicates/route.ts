import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { scanForDuplicates } from "@/lib/agent/duplicates/scanForDuplicates"

export const runtime = "nodejs"
export const maxDuration = 60

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

    const mode = url.searchParams.get("mode") === "full" ? "full" : "incremental"

    if (mode === "full") {
      const result = await scanForDuplicates()
      return NextResponse.json({ ok: true, ...result })
    }

    /*
     * Viikoittainen ajo: verrataan vain viimeisen 7 päivän aikana luotuja
     * tai päivitettyjä (last_verified_at) julkisia hankkeita KOKO
     * julkiseen hankejoukkoon — ei täyttä pareittaista läpikäyntiä joka
     * kerta, koska kertaskannaus (mode=full) on jo käyty läpi kerran.
     */
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const sevenDaysAgo = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000
    ).toISOString()

    const { data: recentProjects, error } = await supabaseAdmin
      .from("projects")
      .select("id")
      .eq("is_public", true)
      .or(`created_at.gte.${sevenDaysAgo},last_verified_at.gte.${sevenDaysAgo}`)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const result = await scanForDuplicates({
      projectIds: (recentProjects ?? []).map((p) => p.id),
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
