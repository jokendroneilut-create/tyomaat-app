import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { PHASE_LABELS } from "@/lib/projects/phases"
import { recordPhaseChange } from "@/lib/projects/recordPhaseChange"
import {
  TUORE_KUUKAUDET,
  evaluateEffectiveZoning,
} from "@/lib/projects/effectiveZoning"

export const runtime = "nodejs"
export const maxDuration = 60

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/*
 * LAINVOIMAINEN KAAVA SIIRTYY SUUNNITTELUVAIHEESEEN.
 *
 * Kun kaava on tullut voimaan, kaavoitus on ohi ja rakentaminen on
 * mahdollista. Hanke jäi silti vaiheeseen "Kaavoitus" samaan kasaan
 * juuri vireille tulleiden kanssa, joten alkavia työmaita etsivä ei
 * löytänyt sitä (mitattu 29.8.2026: 127 hanketta).
 *
 * Sääntö ja kynnyksen perustelu: lib/projects/effectiveZoning.ts.
 *
 * Kerääjä poimii voimaantulopäivän dokumentin `raw_payload`-kenttään,
 * mutta voimaan tullut dokumentti merkitään valmiiksi käsitellyksi jo
 * kirjoitushetkellä — tieto ei siis koskaan etene putken kautta
 * hankkeeseen. Tämä ajo lukee sen suoraan dokumenteista.
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

    /* 1. Dokumentit joilla on poimittu voimaantulopäivä. */
    const docs: any[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabaseAdmin
        .from("source_documents")
        .select("id,source_name,document_url,raw_payload")
        .not("raw_payload->>voimaantulo", "is", null)
        .range(from, from + 999)
      if (error) throw error
      docs.push(...(data ?? []))
      if (!data || data.length < 1000) break
    }

    const docByUrl = new Map(docs.map((d) => [String(d.document_url), d]))

    /* 2. Kaavoitusvaiheen hankkeet. */
    const hankkeet: any[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabaseAdmin
        .from("projects")
        .select("id,name,city,phase,status,metadata")
        .eq("phase", PHASE_LABELS.zoning)
        .range(from, from + 999)
      if (error) throw error
      hankkeet.push(...(data ?? []))
      if (!data || data.length < 1000) break
    }

    const siirrettavat: any[] = []

    for (const h of hankkeet) {
      const md: any = h.metadata ?? {}
      const doc = docByUrl.get(String(md.source_url))

      /*
       * Tieto luetaan ensisijaisesti dokumentista (se on tuorein) ja
       * varalta hankkeen omasta metadatasta, johon takautuva ajo
       * kirjoitti sen.
       */
      const tila = doc?.raw_payload?.kaava_tila ?? md.kaava_tila ?? null
      const voimaantulo = doc?.raw_payload?.voimaantulo ?? md.kaava_voimaantulo ?? null

      const paatos = evaluateEffectiveZoning({
        now,
        phase: h.phase,
        tila,
        voimaantulo,
      })

      if (paatos !== "advance") continue
      siirrettavat.push({ h, tila, voimaantulo, lahde: doc?.source_name ?? md.source_name ?? null })
    }

    if (dryRun) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        kynnysKuukautta: TUORE_KUUKAUDET,
        kaavoitusvaiheessa: hankkeet.length,
        siirrettavia: siirrettavat.length,
        /*
         * Otos on rajattu, mutta `siirrettavia` kertoo todellisen määrän,
         * joten katkaisu ei voi näyttää "kaikki käyty läpi".
         */
        otos: siirrettavat.slice(0, 200).map((s) => ({
          id: s.h.id,
          nimi: s.h.name,
          kaupunki: s.h.city,
          voimaantulo: s.voimaantulo,
        })),
      })
    }

    const tulokset: any[] = []

    for (const { h, voimaantulo, lahde } of siirrettavat) {
      const md: any = h.metadata ?? {}

      const { error } = await supabaseAdmin
        .from("projects")
        .update({
          phase: PHASE_LABELS.planning,
          metadata: {
            ...md,
            kaava_voimaantulo: voimaantulo,
            phase_source: "kaavan_lainvoima",
          },
        })
        .eq("id", h.id)

      if (error) {
        tulokset.push({ id: h.id, ok: false, error: error.message })
        continue
      }

      await recordPhaseChange({
        supabase: supabaseAdmin,
        projectId: h.id,
        newPhase: PHASE_LABELS.planning,
        previousPhase: h.phase,
        source: "auto_sync",
        sourceName: lahde ?? "kaavan-lainvoima",
        reason: `Kaava tuli voimaan ${voimaantulo}`,
      })

      tulokset.push({ id: h.id, nimi: h.name, voimaantulo, ok: true })
    }

    return NextResponse.json({
      ok: true,
      kynnysKuukautta: TUORE_KUUKAUDET,
      kaavoitusvaiheessa: hankkeet.length,
      siirretty: tulokset.filter((t) => t.ok).length,
      virheet: tulokset.filter((t) => !t.ok),
    })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
