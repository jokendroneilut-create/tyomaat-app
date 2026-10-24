import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { verifyAdminRequest } from "@/lib/auth/verifyAdminRequest"

export const runtime = "nodejs"

/*
 * LAHETETYT KOKEILUMUISTUTUKSET (D-339).
 *
 * Johannes 24.10.2026: *"Viestit osioon pitaa tehda loki tallekin jotta
 * voin seurata noita lahteneita muistutuksia."*
 *
 * Sama kuvio kuin joukkoviestien lokilla: admin-tarkistus, uusin ensin.
 * Taulun puuttuminen palauttaa tyhjan lokin eika virhetta -- nakyma ei
 * saa hajota ennen kuin DDL on ajettu kasin (sama kaytanto kuin
 * laskutusliitoksella).
 */

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  const auth = await verifyAdminRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const KENTAT = "id, sent_at, email, virstanpylvas, paivia_jaljella, tila, otsikko, viesti"

  let { data, error }: { data: any[] | null; error: { message: string } | null } =
    await supabaseAdmin
      .from("trial_reminder_log")
      .select(KENTAT)
      .order("sent_at", { ascending: false })
      .limit(200)

  /* Tekstisarakkeet lisataan kasin; ilman niita luetaan vanha muoto. */
  if (error && /otsikko|viesti/.test(error.message)) {
    ;({ data, error } = await supabaseAdmin
      .from("trial_reminder_log")
      .select("id, sent_at, email, virstanpylvas, paivia_jaljella, tila")
      .order("sent_at", { ascending: false })
      .limit(200))
  }

  if (error) {
    return NextResponse.json({ ok: true, log: [], puuttuu: error.message })
  }

  return NextResponse.json({ ok: true, log: data ?? [] })
}
