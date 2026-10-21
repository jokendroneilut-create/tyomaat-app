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
 * ALOITUSPAIVA LEIPATEKSTISTA OLEMASSA OLEVILLE RIVEILLE (D-326).
 *
 * `parseFinnishStartDate` valmistui 20.10.2026 (D-324) mutta sitä kutsui
 * vain mittaus- ja siivousskripti -- yksikään kerääjä ei lukenut sitä,
 * eikä mitattuja päiviä ollut kirjoitettu kantaan. Kerääjäpuoli on nyt
 * kytketty (`importCandidate`), ja tämä ajo hoitaa olemassa olevat.
 *
 * VAIN TYHJAT TAYTETAAN. Kannassa oleva päivä voittaa aina, kaksi
 * mitattua syytä:
 *
 *   1. Käsin annettu päivä on tarkempi. 117 riviä on Johanneksen omia
 *      merkintöjä ajalta jolloin hankkeet lisättiin käsin.
 *   2. Sama virke voi koskea kahta hanketta. "rakentaminen alkaa
 *      huhtikuussa ja As Oy Nihdin Horizonin elokuussa 2026" antaa
 *      jäsentimeltä huhtikuun molemmille, kun kannassa Horizonilla on
 *      oikea elokuu.
 *
 * Kuudesta ristiriidasta raportoidaan, mutta niitä ei kirjoiteta.
 *
 * ALKUPERA JAA TALTEEN. `metadata.construction_start_lahde` kertoo että
 * päivä on johdettu tekstistä ja mihin lauseeseen se perustuu, jotta
 * myöhempi tarkempi tieto voi korvata sen perustellusti.
 *
 *   npx tsx scripts/taydenna-aloituspaivat-tekstista.ts
 *   npx tsx scripts/taydenna-aloituspaivat-tekstista.ts --apply
 */

import { parseFinnishStartDate } from "../lib/agent/parseFinnishStartDate"

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  const rivit: any[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error } = await db
      .from("projects")
      .select("id, name, phase, is_public, status, construction_start, additional_info, metadata")
      .range(a, a + 999)
    if (error) {
      console.error(`VIRHE: ${error.message}`)
      process.exit(1)
    }
    rivit.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }

  const julkiset = rivit.filter((p) => p.is_public && p.status === "active")

  type Osuma = { rivi: any; paiva: string; tarkkuus: string; lause: string }
  const kohteet: Osuma[] = []
  const ristiriidat: { nimi: string; kannassa: string; teksti: string; lause: string }[] = []

  for (const p of julkiset) {
    const teksti = `${p.additional_info ?? ""} ${p.metadata?.description ?? ""}`.trim()
    const tulos = parseFinnishStartDate(teksti)
    if (!tulos) continue
    if (p.construction_start) {
      if (String(p.construction_start).slice(0, 7) !== tulos.paiva.slice(0, 7)) {
        ristiriidat.push({
          nimi: String(p.name).slice(0, 44),
          kannassa: String(p.construction_start).slice(0, 10),
          teksti: tulos.paiva,
          lause: tulos.osuma,
        })
      }
      continue
    }
    kohteet.push({ rivi: p, paiva: tulos.paiva, tarkkuus: tulos.tarkkuus, lause: tulos.osuma })
  }

  kohteet.sort((a, b) => a.paiva.localeCompare(b.paiva))
  console.log(`\nJulkisia aktiivisia ${julkiset.length}, tyhjään kenttään kirjoitetaan ${kohteet.length}\n`)

  let kirjoitettu = 0
  let virheita = 0

  for (const o of kohteet) {
    console.log(
      `   ${o.paiva} [${o.tarkkuus.padEnd(9)}] ${String(o.rivi.phase ?? "-").slice(0, 22).padEnd(23)} ${String(o.rivi.name).slice(0, 48)}`
    )
    console.log(`      "${o.lause}"`)

    if (!apply) continue

    const md: Record<string, any> = { ...(o.rivi.metadata ?? {}) }
    md.construction_start_lahde = {
      paiva: o.paiva,
      tarkkuus: o.tarkkuus,
      lause: o.lause,
      jasennin: "parseFinnishStartDate",
      milloin: new Date().toISOString().slice(0, 10),
    }
    const { error } = await db
      .from("projects")
      .update({ construction_start: o.paiva, metadata: md })
      .eq("id", o.rivi.id)
    if (error) {
      virheita += 1
      console.error(`      VIRHE: ${error.message}`)
      continue
    }
    kirjoitettu += 1
  }

  const vaiheittain = new Map<string, number>()
  for (const o of kohteet) {
    const v = String(o.rivi.phase ?? "-")
    vaiheittain.set(v, (vaiheittain.get(v) ?? 0) + 1)
  }
  console.log(`\nvaiheittain: ${[...vaiheittain.entries()].sort((a, b) => b[1] - a[1]).map(([a, b]) => `${a} ${b}`).join(", ")}`)

  console.log(`\n=== RISTIRIIDAT: ${ristiriidat.length} (EI kirjoiteta, kannassa oleva voittaa) ===`)
  for (const r of ristiriidat)
    console.log(`   ${r.nimi.padEnd(46)} kannassa ${r.kannassa}  teksti ${r.teksti}\n      "${r.lause}"`)

  if (apply) console.log(`\nKirjoitettu ${kirjoitettu}, virheitä ${virheita}`)
  else console.log("\nEi kirjoitettu. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
