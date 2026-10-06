import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { haeYritysrekisteri, yrityksenYhteyshenkilot } from "@/lib/metrics/yritysrekisteri"

/*
 * YRITYKSEN YHTEYSHENKILOT YHDELLE HANKKEELLE (D-242).
 *
 * Rekisteri on suojattu service-rolelle, joten selain ei voi lukea sita
 * suoraan. Reitti palauttaa vain YHDEN hankkeen yrityksen henkilot, ei
 * koko rekisteria: asiakkaan ei tarvitse saada kaikkien yritysten
 * yhteystietoja yhdella kutsulla.
 *
 * TAYDENNYS, EI KORVAUS. Jos hankkeella on oma yhteyshenkilo,
 * palautetaan tyhja — yrityksen yleista ei nayteta sen rinnalla.
 */

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ ok: false, error: "Ei istuntoa" }, { status: 401 })
  }

  const projectId = new URL(request.url).searchParams.get("projectId")
  if (!projectId) {
    return NextResponse.json({ ok: false, error: "projectId puuttuu" }, { status: 400 })
  }

  const { data: hanke } = await supabaseAdmin
    .from("projects")
    .select("developer, builder, metadata")
    .eq("id", projectId)
    .maybeSingle()

  if (!hanke) {
    return NextResponse.json({ ok: true, yhteyshenkilot: [] })
  }

  const omat = (hanke.metadata as { contact_persons?: unknown } | null)?.contact_persons
  if (Array.isArray(omat) && omat.length > 0) {
    return NextResponse.json({ ok: true, yhteyshenkilot: [] })
  }

  const rekisteri = await haeYritysrekisteri()
  return NextResponse.json({
    ok: true,
    yhteyshenkilot: yrityksenYhteyshenkilot(hanke, rekisteri),
  })
}
