import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { verifyAdminRequest } from "@/lib/auth/verifyAdminRequest"
import { chooseDuplicateSurvivor, moreAdvancedPhase } from "@/lib/projects/duplicateSurvivor"
import { phaseOrder } from "@/lib/projects/phases"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const auth = await verifyAdminRequest(req)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await req.json()
  const { id, status } = body as { id?: string; status?: string }

  if (!id || (status !== "confirmed_duplicate" && status !== "not_duplicate")) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: pari, error: pariVirhe } = await supabaseAdmin
    .from("project_duplicate_candidates")
    .update({ status, reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .select("project_id_a,project_id_b")
    .maybeSingle()

  if (pariVirhe) {
    return NextResponse.json({ error: pariVirhe.message }, { status: 500 })
  }

  if (status !== "confirmed_duplicate" || !pari) {
    return NextResponse.json({ ok: true })
  }

  /*
   * VAHVISTUS PIILOTTAA TOISEN.
   *
   * Aiemmin vahvistus kirjasi vain paatoksen, ja piilotus oli erillinen
   * nappi joka piti muistaa painaa. Mitattu 29.8.2026: 47 vahvistetusta
   * parista neljalla molemmat olivat yha julkisia - mm. Klaukkalan
   * vesitorni, joka nakyi asiakkaalle kahdesti.
   *
   * Erillinen askel jai vaistamatta valilla valiin, joten se tehdaan
   * nyt samassa.
   */
  const { data: hankkeet, error: hankeVirhe } = await supabaseAdmin
    .from("projects")
    .select(
      "id,name,phase,created_at,developer,builder,location,lat,lng,apartments,floor_area,estimated_cost,construction_start,property_type,metadata,is_public"
    )
    .in("id", [pari.project_id_a, pari.project_id_b])

  if (hankeVirhe || !hankkeet || hankkeet.length !== 2) {
    return NextResponse.json({
      ok: true,
      hidden: null,
      warning: "Hankkeita ei löytynyt, piilotus jäi tekemättä",
    })
  }

  const [a, b] = hankkeet as any[]
  const valinta = chooseDuplicateSurvivor(a, b)
  const piilotettava = hankkeet.find((h: any) => h.id === valinta.hideId) as any
  const jaava = hankkeet.find((h: any) => h.id === valinta.keepId) as any

  if (piilotettava?.is_public === false) {
    return NextResponse.json({
      ok: true,
      hidden: null,
      keepName: jaava?.name ?? null,
      warning: "Toinen oli jo piilotettu",
    })
  }

  /*
   * ASIAKKAAN OMAT MENEVAT EDELLE.
   *
   * Piilotettu hanke katoaa kartalta ja hauista - ja jos joku on
   * lisannyt sen omiin, se katoaa hanen listaltaan ilman selitysta.
   * Silloin piilotus jaa tekematta ja asia jaa ihmiselle.
   */
  const { data: suosikit, error: suosikkiVirhe } = await supabaseAdmin
    .from("user_project_favorites")
    .select("user_id")
    .eq("project_id", valinta.hideId)

  if (suosikkiVirhe) {
    return NextResponse.json({
      ok: true,
      hidden: null,
      warning: "Suosikkien tarkistus epäonnistui, piilotus jäi tekemättä",
    })
  }

  if ((suosikit?.length ?? 0) > 0) {
    return NextResponse.json({
      ok: true,
      hidden: null,
      keepName: jaava?.name ?? null,
      hideName: piilotettava?.name ?? null,
      warning: `Piilotettava hanke on ${suosikit!.length} käyttäjän omissa — piilota käsin jos se on oikein`,
    })
  }

  /*
   * Vaihetieto siirretaan ennen piilotusta: piilotettu voi tietaa
   * hankkeen edenneen pidemmalle, ja muuten se tieto katoaisi.
   */
  const nostettuVaihe = moreAdvancedPhase(jaava?.phase, piilotettava?.phase, phaseOrder)

  if (nostettuVaihe) {
    await supabaseAdmin.from("projects").update({ phase: nostettuVaihe }).eq("id", valinta.keepId)
  }

  const { error: piilotusVirhe } = await supabaseAdmin
    .from("projects")
    .update({ is_public: false })
    .eq("id", valinta.hideId)

  if (piilotusVirhe) {
    return NextResponse.json({ ok: true, hidden: null, warning: piilotusVirhe.message })
  }

  return NextResponse.json({
    ok: true,
    hidden: valinta.hideId,
    hideName: piilotettava?.name ?? null,
    keepName: jaava?.name ?? null,
    reason: valinta.reason,
    phaseLifted: nostettuVaihe,
  })
}
