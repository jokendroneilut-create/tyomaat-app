import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { verifyAdminRequest } from "@/lib/auth/verifyAdminRequest"

export const runtime = "nodejs"

/*
 * IHMISEN HUOMAAMA DUPLIKAATTI KATSELMOINTILISTALLE.
 *
 * Yhdistämiskoneisto on ollut valmis (`/api/tic/duplicates/review`:
 * valitsee säilyjän, nostaa vaiheen, tarkistaa suosikit, piilottaa
 * toisen), mutta pari saattoi syntyä VAIN skannauksesta. Kun ihminen
 * näki listalla kaksi samaa hanketta, hänellä ei ollut nappia.
 *
 * Mitattu tarve 7.-8.9.2026: kaksi paria kahdessa päivässä, ja
 * molemmat jouduttiin lisäämään kantaan käsin:
 *
 *   "Vanhan paperitehtaan konehalliin..." + "Datakeskus Kajaaniin"
 *   "Kerrostalo Pohjoinen Liipolankatu 14" + "Hartela toteuttaa..."
 *
 * Kumpaakaan skannaus ei löytänyt: otsikoissa ei ole yhteistä sanaa,
 * ja jälkimmäisessä myös osoite ja rakennuttaja on kirjattu eri
 * tavalla — vaikka pisteet ovat 11 cm päässä toisistaan.
 *
 * Tämä reitti EI yhdistä mitään. Se vain kirjaa parin listalle, jossa
 * ihminen tekee saman päätöksen kuin skannauksen löytämille pareille.
 */
export async function POST(req: Request) {
  const auth = await verifyAdminRequest(req)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await req.json().catch(() => null)
  const a = typeof body?.projectIdA === "string" ? body.projectIdA : null
  const b = typeof body?.projectIdB === "string" ? body.projectIdB : null

  if (!a || !b || a === b) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  /* Pari on järjestetty, kuten skannauksessa: sama pari vain kerran. */
  const [idA, idB] = [a, b].sort()

  const { data: hankkeet, error: hankeVirhe } = await supabaseAdmin
    .from("projects")
    .select("id,name")
    .in("id", [idA, idB])

  if (hankeVirhe) {
    return NextResponse.json({ error: hankeVirhe.message }, { status: 500 })
  }
  if (!hankkeet || hankkeet.length !== 2) {
    return NextResponse.json({ error: "project_not_found" }, { status: 404 })
  }

  const { data: onJo, error: hakuVirhe } = await supabaseAdmin
    .from("project_duplicate_candidates")
    .select("id,status")
    .eq("project_id_a", idA)
    .eq("project_id_b", idB)
    .maybeSingle()

  if (hakuVirhe && hakuVirhe.code !== "PGRST116") {
    return NextResponse.json({ error: hakuVirhe.message }, { status: 500 })
  }

  if (onJo) {
    return NextResponse.json({ ok: true, alreadyExists: true, status: onJo.status })
  }

  const { error } = await supabaseAdmin.from("project_duplicate_candidates").insert({
    project_id_a: idA,
    project_id_b: idB,
    /*
     * Ihmisen havainto on vahvin todiste mitä listalla voi olla, ja
     * lista järjestetään varmuusluvun mukaan.
     */
    confidence: 100,
    reasons: ["manual"],
    status: "pending",
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, alreadyExists: false })
}
