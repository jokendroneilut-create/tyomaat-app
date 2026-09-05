import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

import { parseAdminEmails } from "@/lib/auth/roles"
import { verifyAdminRequest } from "@/lib/auth/verifyAdminRequest"
import {
  jaksonLuvut,
  muutosProsentti,
  paivasarja,
} from "@/lib/analytics/kayttoyhteenveto"

export const runtime = "nodejs"

/*
 * KOKO JOUKON KAYTTO JA SEN KEHITYS.
 *
 * Google Analyticsin tapaan: nelja tunnuslukua, kunkin vieressa muutos
 * edelliseen yhta pitkaan jaksoon, ja paivakohtainen kayra alla.
 * Aikasarja on se mita nykyinen analytiikkasivu EI naytä - siina on
 * vain top-5-listoja, joista ei nae suuntaa.
 *
 * ADMIN VAIN. Myyjalle riittaa asiakaskohtainen nakyma; koko joukon
 * kehitys on liiketoimintatieto.
 */
export async function GET(req: Request) {
  try {
    /*
     * Sama tunnistautuminen kuin muualla analytiikassa (evaste), jotta
     * sivu voi kutsua tata ilman erillista tokenia.
     */
    const auth = await verifyAdminRequest(req)
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const paivia = Math.min(
      180,
      Math.max(7, Number(new URL(req.url).searchParams.get("days") ?? "30"))
    )

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    const paiva = (siirto: number) =>
      new Date(Date.now() - siirto * 86_400_000).toISOString().slice(0, 10)

    const jakso = { alku: paiva(paivia - 1), loppu: paiva(0) }
    const edellinen = { alku: paiva(paivia * 2 - 1), loppu: paiva(paivia) }

    const tapahtumat: any[] = []
    for (let alku = 0; ; alku += 1000) {
      const { data, error } = await supabase
        .from("analytics_events")
        .select("user_id,event_type,path,duration_seconds,created_at")
        .gte("created_at", `${edellinen.alku}T00:00:00Z`)
        .order("created_at", { ascending: false })
        .range(alku, alku + 999)
      if (error) throw error
      tapahtumat.push(...(data ?? []))
      if (!data || data.length < 1000) break
    }

    /*
     * Adminien oma kaytto pois: TIC-tyo on suurin yksittainen kayttaja
     * eika kerro asiakkaista mitaan. Sama rajaus kuin nykyisella
     * analytiikkasivulla.
     */
    const adminEmails = parseAdminEmails(process.env.ADMIN_EMAILS)
    const { data: roolit } = await supabase.from("user_roles").select("user_id,role")
    const adminIds = new Set(
      (roolit ?? []).filter((r: any) => r.role === "admin").map((r: any) => r.user_id)
    )
    if (adminEmails.length) {
      const { data: users } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
      for (const u of users?.users ?? []) {
        if (u.email && adminEmails.includes(u.email.toLowerCase())) adminIds.add(u.id)
      }
    }

    const asiakkaat = tapahtumat.filter((t) => t.user_id && !adminIds.has(t.user_id))

    const sarja = paivasarja(asiakkaat, jakso)
    const nyt = jaksonLuvut(sarja, asiakkaat, jakso)
    const ennen = jaksonLuvut(paivasarja(asiakkaat, edellinen), asiakkaat, edellinen)

    /* Eniten aikaa viettaneet sivut jaksolla - GA:n "Views by page". */
    const sivut = new Map<string, number>()
    for (const t of asiakkaat) {
      const p = String(t.created_at).slice(0, 10)
      if (t.event_type !== "pageview" || !t.path || p < jakso.alku) continue
      sivut.set(t.path, (sivut.get(t.path) ?? 0) + Math.max(0, Number(t.duration_seconds ?? 0)))
    }

    return NextResponse.json({
      ok: true,
      jakso,
      paivia,
      sarja,
      nyt,
      muutos: {
        kayttajia: muutosProsentti(nyt.kayttajia, ennen.kayttajia),
        istuntoja: muutosProsentti(nyt.istuntoja, ennen.istuntoja),
        sivulatauksia: muutosProsentti(nyt.sivulatauksia, ennen.sivulatauksia),
        keskiIstuntoSek: muutosProsentti(nyt.keskiIstuntoSek, ennen.keskiIstuntoSek),
      },
      ennen,
      sivut: [...sivut]
        .map(([path, sekunteja]) => ({ path, sekunteja }))
        .sort((a, b) => b.sekunteja - a.sekunteja)
        .slice(0, 8),
    })
  } catch (err: any) {
    console.error("USAGE-TREND ROUTE ERROR:", err)
    return NextResponse.json({ error: err?.message ?? "unknown error" }, { status: 500 })
  }
}
