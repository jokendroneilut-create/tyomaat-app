import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * KUULUTUKSEN LOMAKEKENTAT HANKKEISIIN.
 *
 * PDF:ssa on kenttia joita ei nayttanyt missaan: kaavan kayttotarkoitus
 * ("T-6; teollisuus- ja varastorakennusten korttelialue"), tontin
 * pinta-ala, kerrosala, rakennusoikeus ja tilavuus. Mitattu 23.8.2026
 * 309 PDF-tekstista:
 *
 *   pinta-ala 67 %, kaavatilanne 66 %, kayttotarkoitus 34 %,
 *   tilavuus 29 %, kerrosala 25 %, rakennusoikeus 8 %
 *
 * EI YLIKIRJOITA: olemassa olevaa arvoa ei korvata.
 *
 * Aja ensin ilman --apply-lippua.
 */

const APPLY = process.argv.includes("--apply")

const KENTAT: [string, string][] = [
  ["kaavanKayttotarkoitus", "plan_use_purpose"],
  ["kaavatilanne", "plan_status"],
  ["pintaAla", "site_area_text"],
  ["kerrosala", "floor_area_text"],
  ["rakennusoikeus", "building_right_text"],
  ["tilavuus", "volume_text"],
]

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { extractBulletinFields } = await import("../lib/agent/lupapisteBulletinPdf")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const docs: any[] = []
  for (let f = 0; ; f += 1000) {
    const { data, error } = await supabase
      .from("source_documents")
      .select("id,document_url,raw_payload")
      .eq("source_name", "Lupapiste kuulutukset")
      .range(f, f + 999)
    if (error) throw error
    docs.push(...(data ?? [])); if (!data || data.length < 1000) break
  }

  /* 1. Kentat lahdedokumenttiin, jotta putki loytaa ne jatkossa. */
  const perUrl = new Map<string, any>()
  let dokumentteja = 0

  for (const d of docs) {
    const teksti = String(d.raw_payload?.bulletin_pdf_text ?? "")
    if (!teksti) continue

    const kentat = extractBulletinFields(teksti)
    if (!Object.values(kentat).some(Boolean)) continue

    dokumentteja++
    perUrl.set(String(d.document_url), kentat)

    if (APPLY) {
      await supabase
        .from("source_documents")
        .update({ raw_payload: { ...d.raw_payload, bulletin_fields: kentat } })
        .eq("id", d.id)
    }
  }

  console.log(APPLY ? "=== AJETTU ===" : "=== KUIVAHARJOITUS (ei kirjoiteta) ===")
  console.log(`lahdedokumentteja joista kenttia: ${dokumentteja}\n`)

  /* 2. Kentat hankkeisiin. */
  const lataa = async (t: string) => {
    const r: any[] = []
    for (let f = 0; ; f += 1000) {
      const { data, error } = await supabase.from(t).select("*").range(f, f + 999)
      if (error) throw error
      r.push(...(data ?? [])); if (!data || data.length < 1000) break
    }
    return r
  }

  for (const [taulu, nimiSarake] of [["potential_projects", "title"], ["projects", "name"]] as const) {
    const rivit = (await lataa(taulu)).filter((p: any) =>
      /lupapiste/i.test(String(p.metadata?.source_name ?? ""))
    )

    let muuttuu = 0
    const naytteet: string[] = []
    const paivitykset: { id: string; lisays: Record<string, string> }[] = []

    for (const p of rivit) {
      const kentat = perUrl.get(String(p.metadata?.source_url ?? ""))
      if (!kentat) continue

      const lisays: Record<string, string> = {}
      for (const [lahde, kohde] of KENTAT) {
        const arvo = kentat[lahde]
        if (arvo && !p.metadata?.[kohde]) lisays[kohde] = arvo
      }
      if (!Object.keys(lisays).length) continue

      muuttuu++
      if (naytteet.length < 12) {
        naytteet.push(
          `  ${String(p[nimiSarake]).slice(0, 30).padEnd(32)} ${Object.entries(lisays).map(([k, v]) => `${k}=${String(v).slice(0, 22)}`).join("  ").slice(0, 92)}`
        )
      }
      paivitykset.push({ id: p.id, lisays })
    }

    console.log(`=== ${taulu} ===`)
    console.log(`  paivitettavia: ${muuttuu}`)
    for (const n of naytteet) console.log(n)
    console.log()

    if (!APPLY) continue

    let n = 0
    for (const u of paivitykset) {
      const { data: nyt } = await supabase.from(taulu).select("metadata").eq("id", u.id).maybeSingle()
      const meta: any = nyt?.metadata ?? {}
      await supabase.from(taulu).update({ metadata: { ...meta, ...u.lisays } }).eq("id", u.id)
      n++
    }
    console.log(`  kirjoitettu: ${n}\n`)
  }
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
