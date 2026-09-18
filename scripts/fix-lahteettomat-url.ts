import { readFileSync } from "node:fs"
import * as cheerio from "cheerio"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * LÄHTEETTÖMÄT HANKKEET, JOILLA OSOITE ON TALLESSA (D-200).
 *
 * Alkuaineiston hankkeilla ei ole source_namea, mutta osalla
 * `last_source_url` osoittaa STT-tiedotteeseen tai rakennusliikkeen
 * hankesivulle. Sivu haetaan, yhteyshenkilöt poimitaan
 * `extractContacts`illa (vain henkilöt, ei viranomaisia), ja osoite
 * kirjataan `source_url`iksi. Vain hankkeet joilla ei ole puhelinta
 * eikä sähköpostia - mitään ei korvata.
 *
 *   npx tsx scripts/fix-lahteettomat-url.ts            (kuivaharjoitus)
 *   npx tsx scripts/fix-lahteettomat-url.ts --apply
 */
const APPLY = process.argv.includes("--apply")
const VIIVE_MS = 1000
const nuku = (ms: number) => new Promise((r) => setTimeout(r, ms))
const peita = (s: unknown) => String(s ?? "").replace(/[A-Za-z0-9._%+-]+@/g, "<x>@").replace(/\+?\d[\d\s-]{6,}\d/g, "<puh>")

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  /* Säännöt ja niiden perustelut: lib/projects/sivunYhteyshenkilot.ts */
  const { sivunYhteyshenkilot } = await import("../lib/projects/sivunYhteyshenkilot")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const rivit: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("projects").select("id, name, metadata").eq("is_public", true).range(from, from + 999)
    if (error) throw error
    rivit.push(...(data ?? [])); if (!data || data.length < 1000) break
  }
  const kohde = rivit.filter((p) => {
    const m = p.metadata ?? {}
    if (m.source_name) return false
    if (!/^https?:\/\//.test(String(m.last_source_url ?? ""))) return false
    return !(m.contact_persons ?? []).some((x: any) => x && (x.email || x.phone))
  })
  console.log(`lähteettömiä, osoite tallessa, ei yhteystietoa: ${kohde.length}`)

  let n = 0
  for (const p of kohde) {
    const url = p.metadata.last_source_url
    let uudet: any[] = []
    let virhe: string | null = null
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; tyomaat.fi/1.0)" } })
      if (!res.ok) virhe = `HTTP ${res.status}`
      else {
        uudet = sivunYhteyshenkilot(cheerio.load(await res.text()))
      }
    } catch (e: any) {
      virhe = String(e?.message ?? e)
    }
    await nuku(VIIVE_MS)
    console.log(`${String(p.name).slice(0, 60)}\n   ${new URL(url).hostname} -> ${virhe ?? (uudet.length ? uudet.map((c) => `${peita(c.name)} | ${c.title ?? "-"} | ${c.organization ?? "-"} | ${c.phone ? "puh" : "-"} | ${c.email ? "email" : "-"}`).join(" ;; ") : "ei henkilöä")}`)
    if (!uudet.length) continue
    n++
    if (!APPLY) continue
    const olemassa: any[] = Array.isArray(p.metadata?.contact_persons) ? p.metadata.contact_persons : []
    const { error } = await db
      .from("projects")
      .update({ metadata: { ...p.metadata, source_url: p.metadata.source_url ?? url, contact_persons: [...olemassa, ...uudet] } })
      .eq("id", p.id)
    if (error) throw error
  }
  console.log(`\n=== ${APPLY ? "AJETTU" : "KUIVAHARJOITUS"}: ${n} / ${kohde.length} hanketta sai henkilön ===`)
}
main().catch((e) => { console.error(e); process.exit(1) })
