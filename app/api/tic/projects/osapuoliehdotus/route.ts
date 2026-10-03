import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

import { verifyAdminRequest } from "@/lib/auth/verifyAdminRequest"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/*
 * TEKSTIPOIMINNAN EHDOTUKSEN SIIVOUS (D-235).
 *
 * Ehdotus elaa `metadata.osapuoliehdotus`issa eika ole asiakkaalle
 * nakyvaa dataa. Kun ihminen on paattanyt nimesta — joko hyvaksynyt sen
 * rooliin tai todennut ettei se ole osapuoli — nimi poistetaan
 * ehdotuksesta. Kentan kirjoittaa `/api/tic/projects/edit`, joka jattaa
 * muokkausjaljen; tama reitti ei kirjoita asiakkaalle nakyvaa mitaan.
 *
 * ERILLINEN REITTI TARKOITUKSELLA. Muokkausreitti on hankkeen kenttia
 * varten ja sen saannot (metadata yhdistetaan, kasin syotetty voittaa,
 * muokkaus jattaa jaljen) ovat sen omat. Ehdotuksen siivous ei ole
 * hankkeen tiedon muutos, joten se ei kuulu sinne.
 */
export async function POST(request: Request) {
  const auth = await verifyAdminRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => ({}))
  const projectId = String(body?.projectId ?? "")
  const nimi = body?.nimi === undefined || body?.nimi === null ? null : String(body.nimi)

  if (!projectId) {
    return NextResponse.json({ ok: false, error: "Missing projectId" }, { status: 400 })
  }

  const { data: project, error: loadError } = await supabaseAdmin
    .from("projects")
    .select("id, metadata")
    .eq("id", projectId)
    .maybeSingle()

  if (loadError) {
    return NextResponse.json({ ok: false, error: loadError.message }, { status: 500 })
  }
  if (!project) {
    return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 })
  }

  const metadata = ((project as any).metadata ?? {}) as Record<string, any>
  const ehdotus = metadata.osapuoliehdotus

  if (!ehdotus || !Array.isArray(ehdotus.nimet)) {
    return NextResponse.json({ ok: true, jaljella: 0, message: "Ei ehdotusta" })
  }

  /* Ilman nimea koko ehdotus kuitataan kasitellyksi. */
  const jaljella = nimi
    ? ehdotus.nimet.filter((n: any) => String(n?.nimi ?? "") !== nimi)
    : []

  const { error: updateError } = await supabaseAdmin
    .from("projects")
    .update({
      metadata: {
        ...metadata,
        /*
         * Tyhja lista poistaa ehdotuksen kokonaan: jaljelle jaava
         * `{nimet: []}` nayttaisi listalla yha odottavalta.
         */
        osapuoliehdotus: jaljella.length
          ? { ...ehdotus, nimet: jaljella }
          : null,
      },
    })
    .eq("id", projectId)

  if (updateError) {
    return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, jaljella: jaljella.length })
}
