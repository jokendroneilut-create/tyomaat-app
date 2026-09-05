import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

import { getRequestRole } from "@/lib/auth/getRequestRole"
import { canSeeOwnCustomers } from "@/lib/auth/roles"
import { visibleUsers } from "@/lib/users/visibleUsers"
import { paivittainenKaytto } from "@/lib/analytics/kayttoyhteenveto"

export const runtime = "nodejs"

/*
 * YHDEN KAYTTAJAN KAYTTOHISTORIA.
 *
 * Vastaa kysymykseen "kirjautui 1.9., 2.9. ja 3.9., oli 5 min, 6 min ja
 * 9 min". Data on ollut `analytics_events`-taulussa 14.7.2026 alkaen -
 * uutta kirjausta ei tarvittu, vain nakyma.
 *
 * NAKYVYYSRAJA ON SAMA KUIN KAYTTAJALISTALLA: admin nakee kaikki, myyja
 * vain hankkimansa asiakkaat. Rajaus tehdaan palvelimella samalla
 * funktiolla (`visibleUsers`), jottei se voi eriytya listasta.
 */
export async function GET(req: Request) {
  try {
    const kutsuja = await getRequestRole(req)
    if (!kutsuja.ok) {
      return NextResponse.json({ error: kutsuja.error }, { status: kutsuja.status })
    }
    if (!canSeeOwnCustomers(kutsuja.role)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 })
    }

    const userId = new URL(req.url).searchParams.get("userId")
    if (!userId) {
      return NextResponse.json({ error: "userId puuttuu" }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    /* Omistajuus ratkaisee myyjan paasyn. */
    const { data: liitokset } = await supabase
      .from("customer_owners")
      .select("user_id,seller_id")
    const ownerId =
      (liitokset ?? []).find((r: any) => r.user_id === userId)?.seller_id ?? null

    const sallitut = visibleUsers(kutsuja.role, kutsuja.userId, [{ id: userId, ownerId }])
    if (sallitut.length === 0) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 })
    }

    const tapahtumat: any[] = []
    for (let alku = 0; ; alku += 1000) {
      const { data, error } = await supabase
        .from("analytics_events")
        .select("user_id,event_type,path,duration_seconds,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .range(alku, alku + 999)
      if (error) throw error
      tapahtumat.push(...(data ?? []))
      if (!data || data.length < 1000) break
    }

    const paivat = paivittainenKaytto(tapahtumat)

    /* Yleisimmat sivut kertovat MITA asiakas kaytti, ei vain kuinka kauan. */
    const sivut = new Map<string, { kertaa: number; sekunteja: number }>()
    for (const t of tapahtumat) {
      if (t.event_type !== "pageview" || !t.path) continue
      const r = sivut.get(t.path) ?? { kertaa: 0, sekunteja: 0 }
      r.kertaa++
      r.sekunteja += Math.max(0, Number(t.duration_seconds ?? 0))
      sivut.set(t.path, r)
    }

    return NextResponse.json({
      ok: true,
      userId,
      tapahtumia: tapahtumat.length,
      paivat,
      sivut: [...sivut]
        .map(([path, r]) => ({ path, ...r }))
        .sort((a, b) => b.sekunteja - a.sekunteja)
        .slice(0, 8),
    })
  } catch (err: any) {
    console.error("USER-ACTIVITY ROUTE ERROR:", err)
    return NextResponse.json({ error: err?.message ?? "unknown error" }, { status: 500 })
  }
}
