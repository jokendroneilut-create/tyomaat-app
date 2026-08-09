/*
 * Siivoaa Dynastyn sivukalusteet jo hyväksyttyjen hankkeiden teksteistä.
 *
 * `potential_projects` korjataan backfill-decision-sources.ts --refetch
 * -ajolla, mutta hyväksytty hanke on kopioitu `projects`-tauluun eikä se
 * enää päivity lähteestä. Roska näkyy siis asiakkaalle:
 *
 *   "...allekirjoitettu. Navigointi Edellinen asia | Seuraava asia
 *    Muutoksenhakuohje Kokousasia PDF-muodossa ©"
 *
 * Teksti haetaan uudelleen samalla jäsentäjällä. Kirjoitetaan vain kun
 * `additional_info` ja `metadata.description` ovat identtiset - jos ne
 * eroavat, jompaakumpaa on muokattu käsin eikä sitä ylikirjoiteta.
 *
 * Kertaluontoinen.
 *
 *   npx tsx scripts/backfill-projects-dynasty-text.ts
 *   npx tsx scripts/backfill-projects-dynasty-text.ts --apply
 */
import { readFileSync } from "node:fs"

const APPLY = process.argv.includes("--apply")

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8")
  .replace(/\r/g, "")
  .split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1)
  }
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/* Dynasty tunnistetaan CGI-päätepisteestä, ei isännästä: kunnilla on omia. */
const DYNASTY_SOURCE = /DREQUEST\.PHP/

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { fetchDecoded, extractItemText } = await import("../lib/agent/fetchDynastySource")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const rows: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("projects")
      .select("id, name, additional_info, metadata")
      .range(from, from + 999)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  const targets = rows.filter((r) => DYNASTY_SOURCE.test(String(r.metadata?.source_url ?? "")))

  console.log(
    `${APPLY ? "KIRJOITETAAN" : "KUIVAHARJOITTELU (--apply kirjoittaa)"} — ${targets.length} Dynasty-hanketta\n`
  )

  const stats = { korjattu: 0, ennallaan: 0, ohitettu: 0, epaonnistui: 0 }

  for (const row of targets) {
    const md = row.metadata ?? {}
    const vanha = String(md.description ?? "")

    /*
     * Käsin muokattua ei ylikirjoiteta. Tuonnissa kentät ovat identtiset,
     * joten ero tarkoittaa että joku on kirjoittanut toiseen.
     */
    if (String(row.additional_info ?? "") !== vanha) {
      stats.ohitettu++
      console.log(`  OHITETTU (kentät eroavat) ${String(row.name).slice(0, 56)}`)
      continue
    }

    const html = await fetchDecoded(md.source_url)
    const uusi = html ? extractItemText(html) : null
    if (!uusi) {
      stats.epaonnistui++
      console.log(`  EPÄONNISTUI ${String(row.name).slice(0, 56)}`)
      continue
    }

    if (uusi === vanha) {
      stats.ennallaan++
      continue
    }

    stats.korjattu++
    console.log(
      `  ${String(vanha.length).padStart(6)} -> ${String(uusi.length).padStart(6)} mrk  ${String(row.name).slice(0, 52)}`
    )

    if (!APPLY) continue

    const { error } = await supabase
      .from("projects")
      .update({
        additional_info: uusi,
        metadata: { ...md, description: uusi },
      })
      .eq("id", row.id)

    if (error) {
      stats.epaonnistui++
      console.log(`     VIRHE: ${error.message}`)
    }
  }

  console.log("")
  console.log(`korjattu:     ${stats.korjattu}`)
  console.log(`ennallaan:    ${stats.ennallaan}`)
  console.log(`ohitettu:     ${stats.ohitettu}`)
  console.log(`epäonnistui:  ${stats.epaonnistui}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
