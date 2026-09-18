import { readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * LÄHTEETTÖMÄT HANKKEET: MISTÄ LÄHDE LÖYTYISI ILMAN ULKOISIA PYYNTÖJÄ?
 *
 * Julkiset hankkeet ilman metadata.source_name-kenttää (helmi–maaliskuun
 * 2026 alkuaineisto). Tarkistetaan:
 *   1. onko lähde jo tallessa muussa kentässä (last_source_url, url kuvauksessa)
 *   2. onko sama hanke kannassa toisen lähteen kautta (ehdokas samalla
 *      nimellä + kunnalla, tai lähdedokumentti samalla otsikolla)
 *
 *   npx tsx scripts/measure-lahteettomat.ts
 */
const TULOS = join(tmpdir(), "lahteettomat.txt")
const norm = (s: unknown) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim()
const sanat = (s: unknown) => new Set(norm(s).split(" ").filter((w) => w.length >= 4))

async function kaikki(db: any, t: string, cols: string, f?: (q: any) => any) {
  const out: any[] = []
  for (let from = 0; ; from += 1000) { let q = db.from(t).select(cols).range(from, from + 999); if (f) q = f(q); const { data, error } = await q; if (error) throw error; out.push(...(data ?? [])); if (!data || data.length < 1000) break }
  return out
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { normalizeLegacyPhase } = await import("../lib/projects/phases")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const projektit = await kaikki(db, "projects", "id, name, city, phase, status, developer, builder, additional_info, metadata", (q) => q.eq("is_public", true))
  const lahteettomat = projektit.filter((p) => !p.metadata?.source_name && p.status !== "expired" && p.status !== "archived")
  const kelpo = (r: any) => (r.metadata?.contact_persons ?? []).some((x: any) => x && (x.email || x.phone))
  const kohde = lahteettomat.filter((p) => normalizeLegacyPhase(p.phase) === "construction" && !kelpo(p))

  const ehdokkaat = await kaikki(db, "potential_projects", "id, title, municipality, status, metadata")
  const muutProjektit = projektit.filter((p) => p.metadata?.source_name)

  const out: string[] = []
  const tilasto = { url_kentassa: 0, url_kuvauksessa: 0, ehdokas_sama: 0, projekti_sama: 0, ei_mitaan: 0 }
  for (const p of kohde) {
    const m = p.metadata ?? {}
    const urlKentta = m.last_source_url ?? m.source_url ?? null
    const urlKuvaus = String([m.description, p.additional_info].join(" ")).match(/https?:\/\/[^\s)"'<>]+/)?.[0] ?? null
    const s = sanat(p.name)
    const osuu = (nimi: unknown, kunta: unknown) => {
      if (p.city && kunta && norm(kunta) !== norm(p.city)) return false
      const t = sanat(nimi); const yht = [...s].filter((w) => t.has(w)).length
      return s.size > 0 && yht >= Math.min(2, s.size) && yht / s.size >= 0.6
    }
    const ehd = ehdokkaat.filter((e) => e.metadata?.source_name && osuu(e.title, e.municipality ?? e.metadata?.city))
    const proj = muutProjektit.filter((q) => q.id !== p.id && osuu(q.name, q.city))
    if (urlKentta) tilasto.url_kentassa++
    else if (urlKuvaus) tilasto.url_kuvauksessa++
    else if (proj.length) tilasto.projekti_sama++
    else if (ehd.length) tilasto.ehdokas_sama++
    else tilasto.ei_mitaan++
    out.push(`${String(p.name).slice(0, 60)} | ${p.city ?? "-"} | rak.tt ${p.developer ?? "-"} | rak ${p.builder ?? "-"}\n   url-kenttä: ${urlKentta ?? "-"}\n   url-kuvaus: ${urlKuvaus ?? "-"}\n   sama projekti: ${proj.slice(0, 2).map((q) => `${q.name} [${q.metadata?.source_name}]`).join(" ; ") || "-"}\n   sama ehdokas: ${ehd.slice(0, 2).map((e) => `${e.title} [${e.metadata?.source_name}/${e.status}]`).join(" ; ") || "-"}`)
  }
  writeFileSync(TULOS, out.join("\n"), "utf8")
  console.log(`lähteettömiä julkisia aktiivisia: ${lahteettomat.length}, joista rakenteilla ilman yhteystietoa: ${kohde.length}`)
  console.log(tilasto, "->", TULOS)
}
main().catch((e) => { console.error(e); process.exit(1) })
