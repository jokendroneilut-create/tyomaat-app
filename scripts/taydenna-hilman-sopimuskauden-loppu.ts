import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue; let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"'))) v = v.slice(1, -1); if (!(m[1] in process.env)) process.env[m[1]] = v }

/*
 * HILMAN SOPIMUSKAUDEN LOPPU KESTOSTA TAKAUTUVASTI (27.11.2026, D-459).
 *
 * Ilmoitukset, joissa jakso on "alku + kesto", saivat lopuksi null, joten
 * D-438:n varoitus päättyneestä kaudesta ei lauennut (Korkeasaaren
 * pääsisäänkäyntirakennus). Haetaan ilmoitus uudelleen ja päivitetään vain
 * `metadata.hilma_sopimuskausi`. Aloituspäivään ja valmistumiseen ei
 * kosketa: loppu ei syötä automaattista valmistumista (D-324).
 *
 * Kuivaharjoitus oletuksena; --apply kirjoittaa.
 */
import { createClient } from "@supabase/supabase-js"
import { fetchHilmaSopimuskausi } from "../lib/agent/hilmaSopimuskausi"
import { sopimuskausiPaattynyt, suomeksi } from "../lib/projects/sopimuskausiPaattynyt"

const APPLY = process.argv.includes("--apply")
const odota = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  let laskettu = 0, ennallaan = 0, paattyneita = 0
  for (const [t, tila] of [["potential_projects", ["new"]], ["projects", ["active", "completed"]]] as const) {
    const { data } = await s.from(t).select(t === "projects" ? "id,name,metadata" : "id,title,metadata").in("status", tila as any).not("metadata->hilma_sopimuskausi->>alku", "is", null).is("metadata->hilma_sopimuskausi->>loppu", null)
    for (const r of (data ?? []) as any[]) {
      const md = r.metadata ?? {}
      await odota(300)
      const k = await fetchHilmaSopimuskausi(md.procedure_id, md.notice_id)
      if (!k.loppu) { ennallaan++; continue }
      laskettu++
      const uusiMd = { ...md, hilma_sopimuskausi: { ...md.hilma_sopimuskausi, loppu: k.loppu, ...(k.loppuKestosta ? { loppuKestosta: true } : {}) } }
      const p = sopimuskausiPaattynyt(uusiMd)
      if (p) paattyneita++
      console.log(`${t === "projects" ? "HANKE" : "JONO "} ${r.id.slice(0, 8)} ${md.hilma_sopimuskausi.alku} → ${k.loppu}${k.loppuKestosta ? " (kesto)" : ""}${p ? `  ⚠️ päättynyt ${suomeksi(p.loppu)}${p.ennenJulkaisua ? " ennen julkaisua" : ""}` : ""} | ${String(r.name ?? r.title).slice(0, 60)}`)
      if (APPLY) {
        const { error } = await s.from(t).update({ metadata: uusiMd }).eq("id", r.id)
        if (error) console.log("  VIRHE", error.message)
      }
    }
  }
  console.log(`\nloppu saatu ${laskettu}, ilman loppua yhä ${ennallaan}, joista päättyneitä ${paattyneita}${APPLY ? "" : " (kuivaharjoitus)"}`)
}
main()
