import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

import { getRequestRole } from "@/lib/auth/getRequestRole"
import { isAdmin } from "@/lib/auth/roles"

export const runtime = "nodejs"

/*
 * ASIAKKAAN LASKUTUSTIETO. VAIN ADMIN (D-223).
 *
 * Kirjoitetaan ASIAKKAALLE, ei tunnukselle: `tunniste` on yritysdomain
 * tai vapaan sahkopostin koko osoite. Yksi rivi kattaa kaikki saman
 * asiakkaan tunnukset — Sarlinin 12 tunnusta jakavat yhden hinnan.
 * Tunnisteen muodostaa `lib/users/asiakastunniste.ts`, ja kayttoliittyma
 * lahettaa sen sellaisenaan.
 *
 * Hinnat ovat liiketoimintatietoa: taulu on suljettu anon- ja
 * authenticated-rooleilta, ja tama reitti on ainoa kirjoitustie.
 */

const TILAT = new Set(["maksava", "testi", "ei_maksava"])

export async function POST(req: Request) {
  try {
    const kutsuja = await getRequestRole(req)

    if (!kutsuja.ok) {
      return NextResponse.json({ error: kutsuja.error }, { status: kutsuja.status })
    }

    if (!isAdmin(kutsuja.role)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const tunniste = typeof body?.tunniste === "string" ? body.tunniste.trim().toLowerCase() : ""
    const tila = typeof body?.tila === "string" ? body.tila.trim() : ""

    if (!tunniste) {
      return NextResponse.json({ error: "tunniste puuttuu" }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    /*
     * Tyhja tila poistaa rivin kokonaan. Nain asiakas palaa
     * merkitsemattomaksi eika jaa kantaan tyhjana rivina, joka
     * nayttaisi laskutuslistalla paatokselta.
     */
    if (!tila) {
      const { error } = await supabase.from("customer_billing").delete().eq("tunniste", tunniste)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, tunniste, poistettu: true })
    }

    if (!TILAT.has(tila)) {
      return NextResponse.json({ error: "tila on virheellinen" }, { status: 400 })
    }

    /*
     * Hinta hyvaksytaan myos pilkulla ("249,50"), koska se kirjoitetaan
     * kasin suomalaisella nappaimistolla.
     */
    const raaka = body?.kuukausihinta
    let kuukausihinta: number | null = null

    if (raaka !== null && raaka !== undefined && String(raaka).trim() !== "") {
      const luku = Number(String(raaka).replace(/\s/g, "").replace(",", "."))
      if (!Number.isFinite(luku) || luku < 0) {
        return NextResponse.json({ error: "kuukausihinta on virheellinen" }, { status: 400 })
      }
      kuukausihinta = Math.round(luku * 100) / 100
    }

    /*
     * Maksavalla on oltava hinta. Sama ehto on kannassa, mutta tassa
     * siita saa luettavan virheen: ilman hintaa MRR olisi hiljaa vajaa.
     */
    if (tila === "maksava" && kuukausihinta === null) {
      return NextResponse.json(
        { error: "Maksavalle asiakkaalle on annettava kuukausihinta" },
        { status: 400 }
      )
    }

    const rivi: Record<string, unknown> = {
      tunniste,
      tila,
      kuukausihinta_eur: kuukausihinta,
      updated_at: new Date().toISOString(),
    }

    if (typeof body?.alkaen === "string") rivi.alkaen = body.alkaen.trim() || null
    if (typeof body?.huomio === "string") rivi.huomio = body.huomio.trim() || null

    const { error } = await supabase.from("customer_billing").upsert(rivi, { onConflict: "tunniste" })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, tunniste, tila, kuukausihinta })
  } catch (err: any) {
    console.error("SET CUSTOMER BILLING ERROR:", err)
    return NextResponse.json({ error: err?.message || "unknown error" }, { status: 500 })
  }
}
