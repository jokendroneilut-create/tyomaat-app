import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import {
  UNLISTED_REASON,
  UNLISTED_THRESHOLD_DAYS,
  evaluateUnlisted,
} from "@/lib/projects/unlistedExpiry"

export const runtime = "nodejs"
export const maxDuration = 60

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/*
 * POISTAA NÄKYVISTÄ HANKKEET JOITA EI ENÄÄ OLE LÄHTEEN LISTALLA.
 *
 * Kaavoitushankkeilla ei ollut yhtään poistumistapaa: mitattu 29.8.2026,
 * 2901 kaavahanketta joista 2890 näkyi asiakkaalle, 0 vanhentunutta ja 0
 * manuaalista vanhenemispäivää. Kaupungin oma sivu kertoo milloin
 * kaavoitus on ohi — rivi katoaa "vireillä olevat" -listalta — mutta
 * emme kirjanneet sitä mihinkään.
 *
 * Sääntö ja sen perustelut: lib/projects/unlistedExpiry.ts.
 *
 * Vanheneminen EI poista riviä: hanke saa tilan "expired", jonka
 * asiakaslista suodattaa. Jos dokumentti näkyy lähteellä uudelleen,
 * hanke palautetaan.
 *
 * Ajo lukee vain kynnyksen ylittäneet dokumentit ja jo vanhennettujen
 * hankkeiden dokumentit — koko dokumenttitaulua ei käydä läpi.
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
    const kynnys = new Date(
      now.getTime() - UNLISTED_THRESHOLD_DAYS * 86400000
    ).toISOString()

    /* 1. Kynnyksen ylittäneet dokumentit. */
    const vanhat: any[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabaseAdmin
        .from("source_documents")
        .select("id,source_id,document_url,document_type,last_seen_at")
        .not("last_seen_at", "is", null)
        .lt("last_seen_at", kynnys)
        .range(from, from + 999)
      if (error) throw error
      vanhat.push(...(data ?? []))
      if (!data || data.length < 1000) break
    }

    /*
     * 2. Lähteiden terveys. Hiljainen lähdevika ei saa vanhentaa
     * hankkeita: lähteen on oltava sekä ajettu että kirjoittanut jotain.
     */
    const { data: lahteet, error: lErr } = await supabaseAdmin
      .from("discovery_sources")
      .select("id,name,last_success_at")
    if (lErr) throw lErr

    /* Tarkistetaan vain ne lähteet joilla on vanhentuneita dokumentteja. */
    const kiinnostavat = new Set(vanhat.map((d) => String(d.source_id)))
    const kirjoitus = new Map<string, string>()
    for (const s of lahteet ?? []) {
      if (!kiinnostavat.has(String((s as any).id))) continue
      const { data } = await supabaseAdmin
        .from("source_documents")
        .select("last_seen_at")
        .eq("source_id", (s as any).id)
        .not("last_seen_at", "is", null)
        .order("last_seen_at", { ascending: false })
        .limit(1)
      if (data?.[0]) kirjoitus.set(String((s as any).id), (data[0] as any).last_seen_at)
    }

    const terveys = new Map(
      (lahteet ?? []).map((s: any) => [
        String(s.id),
        {
          lastSuccessAt: s.last_success_at ?? null,
          lastWriteAt: kirjoitus.get(String(s.id)) ?? null,
        },
      ])
    )

    /* 3. Hankkeet: aktiiviset ja tästä syystä jo vanhennetut. */
    const hankkeet: any[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabaseAdmin
        .from("projects")
        .select(
          "id,name,phase,status,source_url:metadata->>source_url,source_document_id:metadata->>source_document_id,expired_reason:metadata->>expired_reason"
        )
        .or(`status.eq.active,metadata->>expired_reason.eq.${UNLISTED_REASON}`)
        .range(from, from + 999)
      if (error) throw error
      hankkeet.push(...(data ?? []))
      if (!data || data.length < 1000) break
    }

    const vanhaUrl = new Map(vanhat.map((d) => [String(d.document_url), d]))
    const vanhaId = new Map(vanhat.map((d) => [String(d.id), d]))

    const paatokset: any[] = []

    for (const h of hankkeet) {
      const palautettava =
        h.status === "expired" && h.expired_reason === UNLISTED_REASON

      let doc =
        vanhaId.get(String(h.source_document_id)) ??
        vanhaUrl.get(String(h.source_url))

      /*
       * Palautettavan hankkeen dokumentti EI ole vanhojen joukossa juuri
       * silloin kun se on nähty uudelleen — se haetaan erikseen.
       */
      if (!doc && palautettava && h.source_url) {
        const { data } = await supabaseAdmin
          .from("source_documents")
          .select("id,source_id,document_url,document_type,last_seen_at")
          .eq("document_url", h.source_url)
          .maybeSingle()
        doc = data ?? undefined
      }

      if (!doc) continue

      const paatos = evaluateUnlisted({
        now,
        status: h.status,
        phase: h.phase,
        lastSeenAt: doc.last_seen_at ?? null,
        listingOnly: doc.document_type === "listing",
        source:
          terveys.get(String(doc.source_id)) ?? {
            lastSuccessAt: null,
            lastWriteAt: null,
          },
        expiredReason: h.expired_reason ?? null,
      })

      if (paatos === "keep") continue
      paatokset.push({ hanke: h, doc, paatos })
    }

    if (dryRun) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        kynnysVrk: UNLISTED_THRESHOLD_DAYS,
        vanhojaDokumentteja: vanhat.length,
        vanhennettavia: paatokset.filter((p) => p.paatos === "expire").length,
        palautettavia: paatokset.filter((p) => p.paatos === "revive").length,
        otos: paatokset.slice(0, 20).map((p) => ({
          id: p.hanke.id,
          nimi: p.hanke.name,
          vaihe: p.hanke.phase,
          paatos: p.paatos,
          nahtyViimeksi: p.doc.last_seen_at,
        })),
      })
    }

    const tulokset: any[] = []

    for (const { hanke, doc, paatos } of paatokset) {
      const { data: rivi } = await supabaseAdmin
        .from("projects")
        .select("metadata")
        .eq("id", hanke.id)
        .maybeSingle()
      const md: any = (rivi as any)?.metadata ?? {}

      const paivitys =
        paatos === "expire"
          ? {
              status: "expired",
              metadata: {
                ...md,
                expired_at: now.toISOString(),
                expired_reason: UNLISTED_REASON,
                expired_detail: `Ei ole näkynyt lähteen listalla ${UNLISTED_THRESHOLD_DAYS} vrk (viimeksi ${String(
                  doc.last_seen_at
                ).slice(0, 10)})`,
              },
            }
          : {
              status: "active",
              metadata: {
                ...md,
                expired_at: null,
                expired_reason: null,
                expired_detail: null,
                revived_at: now.toISOString(),
              },
            }

      const { error } = await supabaseAdmin
        .from("projects")
        .update(paivitys)
        .eq("id", hanke.id)

      tulokset.push({
        id: hanke.id,
        nimi: hanke.name,
        paatos,
        ok: !error,
        error: error?.message,
      })
    }

    return NextResponse.json({
      ok: true,
      kynnysVrk: UNLISTED_THRESHOLD_DAYS,
      vanhojaDokumentteja: vanhat.length,
      vanhennettu: tulokset.filter((t) => t.paatos === "expire" && t.ok).length,
      palautettu: tulokset.filter((t) => t.paatos === "revive" && t.ok).length,
      virheet: tulokset.filter((t) => !t.ok),
    })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
