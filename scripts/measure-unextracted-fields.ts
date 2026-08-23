import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * MITTAUS: mista lahteista jaa tietoa poimimatta?
 *
 * Lupapisteessa PDF oli haettu mutta kuvaus luettiin vaarasta kentasta
 * (1 % sijaan 92 %). Sama voi olla muualla. Mittari: paljonko
 * lahdedokumentissa on tekstia verrattuna siihen mita hankkeelle paatyy.
 *
 * Iso erotus ei todista vikaa - raakateksti sisaltaa navigaatiota ja
 * lomakekielta - mutta se kertoo mista kannattaa katsoa.
 *
 * Ei kirjoita mitaan.
 */

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const docs: any[] = []
  for (let f = 0; ; f += 1000) {
    const { data, error } = await s.from("source_documents").select("document_url,source_name,raw_text,raw_payload").range(f, f + 999)
    if (error) throw error
    docs.push(...(data ?? [])); if (!data || data.length < 1000) break
  }

  const lataa = async (t: string) => {
    const r: any[] = []
    for (let f = 0; ; f += 1000) {
      const { data, error } = await s.from(t).select("*").range(f, f + 999)
      if (error) throw error
      r.push(...(data ?? [])); if (!data || data.length < 1000) break
    }
    return r
  }
  const pot = await lataa("potential_projects")
  const prj = await lataa("projects")

  /* url -> paras kuvauksen pituus hankkeella */
  const kuvausPituus = new Map<string, number>()
  for (const p of [...pot, ...prj]) {
    const u = String(p.metadata?.source_url ?? "")
    if (!u) continue
    const n = String(p.metadata?.description ?? "").length
    kuvausPituus.set(u, Math.max(kuvausPituus.get(u) ?? 0, n))
  }

  type Rivi = { docs: number; raaka: number; kuvaus: number; kontaktilla: number; osuvia: number }
  const lahteet = new Map<string, Rivi>()

  for (const d of docs) {
    const lahde = String(d.source_name ?? "?")
    if (!lahteet.has(lahde)) lahteet.set(lahde, { docs: 0, raaka: 0, kuvaus: 0, kontaktilla: 0, osuvia: 0 })
    const r = lahteet.get(lahde)!
    r.docs++

    /* Raakatekstin koko: raw_text tai payloadin tekstikentat. */
    const raaka = Math.max(
      String(d.raw_text ?? "").length,
      String(d.raw_payload?.bulletin_pdf_text ?? "").length,
      String(d.raw_payload?.page_description ?? "").length
    )
    r.raaka += raaka

    const k = kuvausPituus.get(String(d.document_url))
    if (k != null) { r.osuvia++; r.kuvaus += k }
  }

  console.log("lahde                              dok   raaka ka.   kuvaus ka.   suhde")
  const rivit = [...lahteet].filter(([, r]) => r.osuvia >= 5 && r.docs >= 5)
  for (const [nimi, r] of rivit.sort((a, b) => {
    const sa = a[1].kuvaus / Math.max(1, a[1].osuvia) / Math.max(1, a[1].raaka / a[1].docs)
    const sb = b[1].kuvaus / Math.max(1, b[1].osuvia) / Math.max(1, b[1].raaka / b[1].docs)
    return sa - sb
  }).slice(0, 22)) {
    const raakaKa = Math.round(r.raaka / r.docs)
    const kuvausKa = Math.round(r.kuvaus / Math.max(1, r.osuvia))
    const suhde = raakaKa > 0 ? (kuvausKa / raakaKa) : 0
    console.log(
      `${nimi.slice(0, 32).padEnd(34)} ${String(r.docs).padStart(4)}  ${String(raakaKa).padStart(8)}  ${String(kuvausKa).padStart(10)}   ${(suhde * 100).toFixed(1).padStart(5)} %`
    )
  }
}
main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
