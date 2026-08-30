import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { PHASE_LABELS } from "@/lib/projects/phases"
import {
  TUORE_KUUKAUDET,
  evaluateStaleZoning,
} from "@/lib/projects/effectiveZoning"

export const runtime = "nodejs"
export const maxDuration = 60

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SYY_VANHA = "kaava_lainvoimainen_yli_24kk"
const SYY_KUMOTTU = "kaava_kumottu"

/*
 * VANHA LAINVOIMAINEN KAAVA POIS ASIAKKAAN NÄKYVISTÄ.
 *
 * Pari kuukautta sitten lainvoiman saanut kaava on paras liidi ja se
 * siirtyy suunnitteluvaiheeseen (`advance-effective-zoning`, D-148).
 * Vuosien takainen on päinvastainen: kohde on rakennettu tai ei toteudu.
 * Tutkittu 30.8.2026 — Oulun Tuiran monitoimitalo valmistui kesällä 2025
 * ja Kestilän Kokkonevan tuulipuisto keväällä 2022, ja molemmat näkyivät
 * asiakkaalle vaiheessa "Kaavoitus".
 *
 * Sääntö: lib/projects/effectiveZoning.ts (`evaluateStaleZoning`).
 *
 * Vanheneminen ei ole poisto: rivi ja historia säilyvät, hanke näkyy yhä
 * omissa niille jotka ovat sen tallentaneet, ja jos lähde kertoo joskus
 * muuta, tieto voidaan palauttaa.
 *
 * `?dry=1` näyttää päätökset kirjoittamatta mitään.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const querySecret = url.searchParams.get("secret")
    const authHeader = req.headers.get("authorization")
    const dryRun = url.searchParams.get("dry") === "1"

    const isManualRun = !!querySecret && querySecret === process.env.CRON_SECRET
    const isCronRun = !!authHeader && authHeader === `Bearer ${process.env.CRON_SECRET}`
    if (!isManualRun && !isCronRun) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    }

    const now = new Date()

    /* Dokumentit joilla on tila tiedossa. */
    const docs: any[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabaseAdmin
        .from("source_documents")
        .select("id,source_name,document_url,raw_payload")
        .not("raw_payload->>kaava_tila", "is", null)
        .range(from, from + 999)
      if (error) throw error
      docs.push(...(data ?? []))
      if (!data || data.length < 1000) break
    }
    const docByUrl = new Map(docs.map((d) => [String(d.document_url), d]))

    /* Kaavoitusvaiheen aktiiviset hankkeet. */
    const hankkeet: any[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabaseAdmin
        .from("projects")
        .select("id,name,city,phase,status,is_public,metadata")
        .eq("phase", PHASE_LABELS.zoning)
        .eq("status", "active")
        .range(from, from + 999)
      if (error) throw error
      hankkeet.push(...(data ?? []))
      if (!data || data.length < 1000) break
    }

    const vanhennettavat: any[] = []

    for (const h of hankkeet) {
      if (h.is_public === false) continue
      const md: any = h.metadata ?? {}
      const doc = docByUrl.get(String(md.source_url))

      const tila = doc?.raw_payload?.kaava_tila ?? md.kaava_tila ?? null
      const voimaantulo = doc?.raw_payload?.voimaantulo ?? md.kaava_voimaantulo ?? null

      const paatos = evaluateStaleZoning({ now, phase: h.phase, tila, voimaantulo })
      if (paatos !== "expire") continue

      vanhennettavat.push({ h, tila, voimaantulo })
    }

    vanhennettavat.sort((a, b) => String(a.voimaantulo).localeCompare(String(b.voimaantulo)))

    if (dryRun) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        kynnysKuukautta: TUORE_KUUKAUDET,
        kaavoitusvaiheessa: hankkeet.length,
        vanhennettavia: vanhennettavat.length,
        kumottuja: vanhennettavat.filter((v) => v.tila === "kumottu").length,
        /* Otos on rajattu, mutta `vanhennettavia` kertoo todellisen määrän. */
        otos: vanhennettavat.slice(0, 200).map((v) => ({
          id: v.h.id,
          nimi: v.h.name,
          kaupunki: v.h.city,
          tila: v.tila,
          voimaantulo: v.voimaantulo,
        })),
      })
    }

    const tulokset: any[] = []

    for (const { h, tila, voimaantulo } of vanhennettavat) {
      const md: any = h.metadata ?? {}
      const kumottu = tila === "kumottu"

      const { error } = await supabaseAdmin
        .from("projects")
        .update({
          status: "expired",
          metadata: {
            ...md,
            expired_at: now.toISOString(),
            expired_reason: kumottu ? SYY_KUMOTTU : SYY_VANHA,
            expired_detail: kumottu
              ? `Kaava on kumottu tai lopetettu${voimaantulo ? ` (${voimaantulo})` : ""}`
              : `Kaava tuli voimaan ${voimaantulo}, yli ${TUORE_KUUKAUDET} kk sitten`,
          },
        })
        .eq("id", h.id)

      tulokset.push({ id: h.id, nimi: h.name, ok: !error, error: error?.message })
    }

    return NextResponse.json({
      ok: true,
      kynnysKuukautta: TUORE_KUUKAUDET,
      kaavoitusvaiheessa: hankkeet.length,
      vanhennettu: tulokset.filter((t) => t.ok).length,
      virheet: tulokset.filter((t) => !t.ok),
    })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
