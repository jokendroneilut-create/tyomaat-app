import { readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}
/*
 * KAAVAKUVAUSTEN YRITYKSET (D-195).
 *
 * Mittaa kaikista kaavariveista: kuinka monelle tyhjalle rakennuttajalle
 * ankkuroitu saanto loytaa nimen (luettavaksi lauseyhteydessa), ja mita
 * liittyviksi yrityksiksi tulisi (nimet yleisyysjarjestyksessa).
 * Tulos kirjoitetaan temp-hakemistoon, koska se sisaltaa
 * kuvausten tekstia - sita ei commitoida.
 *
 *   npx tsx scripts/measure-kaavan-yritykset.ts
 */
const KAAVA = /kaav|planl|detaljplan|generalplan|tuulivoimahank/i
const TULOS = join(tmpdir(), "kaava-yritykset.txt")
async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { extractYvaDeveloper, extractYvaCompanies } = await import("../lib/agent/fetchYvaSource")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const out: string[] = []
  const st = { rivit: 0, devTyhja: 0, devLoytyy: 0, relRivit: 0, relNimia: 0 }
  const nimiLkm = new Map<string, number>()
  for (const t of ["projects", "potential_projects"]) {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from(t).select(t === "projects" ? "id,name,developer,metadata" : "id,title,status,metadata").range(from, from + 999)
      if (error) throw error
      for (const r of data ?? []) {
        const m: any = (r as any).metadata ?? {}
        if (!KAAVA.test(String(m.source_name ?? ""))) continue
        st.rivit++
        const d = String(m.description ?? "")
        const dev = (r as any).developer ?? m.developer ?? null
        if (!dev) st.devTyhja++
        const ehd = dev ? null : extractYvaDeveloper(d)
        if (ehd) {
          st.devLoytyy++
          const i = d.indexOf(ehd)
          out.push(`DEV ${t} ${(r as any).status ?? ""} [${m.source_name}] ${String((r as any).name ?? (r as any).title).slice(0, 50)}\n    => ${ehd}\n    "…${d.slice(Math.max(0, i - 80), i + ehd.length + 80).replace(/\s+/g, " ")}…"`)
        }
        const olemassa = new Set((m.related_companies ?? []).map((x: string) => x.toLowerCase()))
        const uudet = extractYvaCompanies(d, dev ?? ehd).filter((y) => !olemassa.has(y.toLowerCase()))
        if (uudet.length) { st.relRivit++; st.relNimia += uudet.length; for (const y of uudet) nimiLkm.set(y, (nimiLkm.get(y) ?? 0) + 1) }
      }
      if (!data || data.length < 1000) break
    }
  }
  out.push("\n=== LIITTYVÄT: nimet yleisyysjärjestyksessä ===")
  for (const [n, c] of [...nimiLkm].sort((a, b) => b[1] - a[1])) out.push(`${c}\t${n}`)
  writeFileSync(TULOS, out.join("\n"), "utf8")
  console.log(st, "eri nimiä", nimiLkm.size, "->", TULOS)
}
main()
