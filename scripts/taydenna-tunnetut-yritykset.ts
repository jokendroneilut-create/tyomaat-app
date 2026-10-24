import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * TUNNETUT YRITYKSET LIITTYVIKSI YRITYKSIKSI, TAKAUTUVASTI (D-343).
 *
 * Ajaa SAMAA moduulia kuin live-polku (`lib/projects/tunnetutYritykset`),
 * jottei takautuva ja tuleva poiminta voi erkaantua.
 *
 * Kirjoittaa VAIN lisaten: olemassa olevat liittyvat yritykset
 * sailyvat, eika rakennuttajaa tai rakentajaa kosketa lainkaan --
 * "liittyva yritys" ei vaita roolia.
 *
 * Tunniste `metadata.tunnetut_yritykset_poimittu` jaa riville, jotta
 * ajon voi toistaa korjatulla saannolla ([[backfill-marker]]).
 *
 *   npx tsx scripts/taydenna-tunnetut-yritykset.ts
 *   npx tsx scripts/taydenna-tunnetut-yritykset.ts --apply
 *   npx tsx scripts/taydenna-tunnetut-yritykset.ts --rivit   (kaikki rivit)
 */

import { mergeCompanyNames } from "../lib/projects/projectCompanies"
import { awardWinnersFromMetadata } from "../lib/projects/projectCompanies"
import {
  haeTunnetutYritykset,
  etsiTunnetutYritykset,
  erotteleNimet,
} from "../lib/projects/tunnetutYritykset"

async function main() {
  const apply = process.argv.includes("--apply")
  const naytaRivit = process.argv.includes("--rivit")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  const lista = await haeTunnetutYritykset(db)
  console.log(`Lista: ${lista.length} tunnettua yritysnimeä\n`)

  const luvut = { jono: 0, hanke: 0, nimia: 0, virheita: 0 }
  const rivit: string[] = []

  for (const taulu of ["potential_projects", "projects"] as const) {
    const kohteet: any[] = []
    for (let a = 0; ; a += 500) {
      const { data, error } = await db
        .from(taulu)
        .select(
          taulu === "projects"
            ? "id,name,developer,builder,additional_info,metadata"
            : "id,title,status,metadata"
        )
        .range(a, a + 499)
      if (error) {
        console.error(`VIRHE: ${error.message}`)
        process.exit(1)
      }
      kohteet.push(...(data ?? []))
      if ((data ?? []).length < 500) break
    }

    for (const p of kohteet) {
      if (taulu === "potential_projects" && p.status === "ignored") continue

      const kuvaus =
        taulu === "projects"
          ? String(p.additional_info ?? p.metadata?.description ?? "")
          : String(p.metadata?.description ?? "")

      const joTiedossa = [
        ...erotteleNimet(taulu === "projects" ? p.developer : p.metadata?.developer),
        ...erotteleNimet(taulu === "projects" ? p.builder : p.metadata?.builder),
        ...(Array.isArray(p.metadata?.related_companies)
          ? p.metadata.related_companies.flatMap(erotteleNimet)
          : []),
        ...awardWinnersFromMetadata(p.metadata),
      ]

      const loydetyt = etsiTunnetutYritykset(`${p.name ?? p.title ?? ""} ${kuvaus}`, lista, joTiedossa)
      if (!loydetyt.length) continue

      if (taulu === "projects") luvut.hanke += 1
      else luvut.jono += 1
      luvut.nimia += loydetyt.length

      const nimi = String(p.name ?? p.title ?? "").slice(0, 44)
      rivit.push(`   ${taulu === "projects" ? "HANKE" : "JONO "} ${nimi.padEnd(46)} + ${loydetyt.join(" | ")}`)

      if (!apply) continue

      const md: Record<string, any> = { ...(p.metadata ?? {}) }
      md.related_companies = mergeCompanyNames(
        Array.isArray(md.related_companies) ? md.related_companies : [],
        loydetyt
      )
      md.tunnetut_yritykset_poimittu = new Date().toISOString().slice(0, 10)

      const { error } = await db.from(taulu).update({ metadata: md }).eq("id", p.id)
      if (error) {
        luvut.virheita += 1
        console.error(`      VIRHE: ${error.message}`)
      }
    }
  }

  for (const r of naytaRivit ? rivit : rivit.slice(0, 40)) console.log(r)
  if (!naytaRivit && rivit.length > 40) console.log(`   ... (${rivit.length - 40} riviä lisää, --rivit näyttää kaikki)`)

  console.log(`\nJono ${luvut.jono}, hankkeet ${luvut.hanke}, nimiä yhteensä ${luvut.nimia}, virheitä ${luvut.virheita}`)
  if (!apply) console.log("Ei kirjoitettu. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
