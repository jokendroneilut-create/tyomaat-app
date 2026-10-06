import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

import { verifyAdminRequest } from "@/lib/auth/verifyAdminRequest"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/*
 * VERKOSTA HAETUN YHTEYSHENKILON HYVAKSYNTA (D-244).
 *
 * Hyvaksynta LISAA yhteyshenkilon listaan, ei korvaa: yhteystietokentasta
 * ei poisteta mitaan. Hylkays poistaa vain ehdotuksen, jolloin sama hanke
 * ei palaa seuraavassa ajossa - skripti ohittaa hankkeet joilla on jo
 * ehdotus.
 *
 * Taso on "project": ehdotus koskee TATA hanketta, toisin kuin
 * yritysrekisterin yhteyshenkilo (D-241). Lahde-URL tallennetaan mukaan,
 * jotta tieto on tarkistettavissa viela hyvaksynnan jalkeenkin.
 */
export async function POST(request: Request) {
  const auth = await verifyAdminRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => ({}))
  const projectId = String(body?.projectId ?? "")
  const hyvaksy = body?.hyvaksy === true

  if (!projectId) {
    return NextResponse.json({ ok: false, error: "Missing projectId" }, { status: 400 })
  }

  const { data: hanke, error: lukuVirhe } = await supabaseAdmin
    .from("projects")
    .select("id, metadata")
    .eq("id", projectId)
    .maybeSingle()

  if (lukuVirhe) {
    return NextResponse.json({ ok: false, error: lukuVirhe.message }, { status: 500 })
  }
  if (!hanke) {
    return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 })
  }

  const metadata = ((hanke as any).metadata ?? {}) as Record<string, any>
  const ehdotus = metadata.yhteyshenkiloehdotus

  if (!ehdotus) {
    return NextResponse.json({ ok: true, message: "Ei ehdotusta" })
  }

  const vanhat = Array.isArray(metadata.contact_persons) ? metadata.contact_persons : []

  const uusiMetadata: Record<string, any> = {
    ...metadata,
    yhteyshenkiloehdotus: null,
    ...(hyvaksy
      ? {
          contact_persons: [
            ...vanhat,
            {
              kind: "person",
              name: ehdotus.nimi,
              title: ehdotus.nimike ?? null,
              email: ehdotus.email ?? null,
              phone: ehdotus.puhelin ?? null,
              organization: ehdotus.organisaatio ?? null,
              level: "project",
              source: ehdotus.lahteet?.[0] ?? null,
            },
          ],
        }
      : {}),
    yhteyshenkiloehdotus_paatos: {
      hyvaksytty: hyvaksy,
      paatetty: new Date().toISOString(),
    },
  }

  const { error } = await supabaseAdmin
    .from("projects")
    .update({ metadata: uusiMetadata })
    .eq("id", projectId)

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, hyvaksytty: hyvaksy })
}
