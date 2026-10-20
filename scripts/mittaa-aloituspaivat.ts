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
 * PALJONKO ALOITUSPAIVIA SAADAAN TEKSTISTA (D-324).
 *
 * Johannes 20.10.2026: *"yritetaan hakea tuota aloituspaivaa kuukauden
 * tarkkuudella. katsotaan mita saadaan ja mietitaan sitten teemmeko
 * siita kayttajalle nakyvaa."*
 *
 * Tama ajo EI KIRJOITA MITAAN. Se lukee kuvaukset ja raportoi mita
 * jasennin loytaisi: montako uutta aloituspaivaa, mista vaiheista, ja
 * mihin lauseeseen osuma perustuu. Osumat tulostetaan luettavaksi,
 * koska poimintasaannon virheet nakyvat vain lauseista -- ei summasta.
 *
 *   npx tsx scripts/mittaa-aloituspaivat.ts
 *   npx tsx scripts/mittaa-aloituspaivat.ts --naytto 40
 */

import { parseFinnishStartDate } from "../lib/agent/parseFinnishStartDate"

const NAYTTO = Number(process.argv[process.argv.indexOf("--naytto") + 1]) || 25

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const rivit: any[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error } = await db
      .from("projects")
      .select("id, name, phase, is_public, status, created_at, construction_start, additional_info, metadata")
      .range(a, a + 999)
    if (error) {
      console.error(`VIRHE: ${error.message}`)
      process.exit(1)
    }
    rivit.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }

  const julkiset = rivit.filter((p) => p.is_public && p.status === "active")
  const ilman = julkiset.filter((p) => !p.construction_start)
  console.log(`Julkisia aktiivisia ${julkiset.length}, aloituspäivä jo ${julkiset.length - ilman.length}, ilman ${ilman.length}\n`)

  type Osuma = { id: string; nimi: string; vaihe: string; paiva: string; tarkkuus: string; lause: string }
  const osumat: Osuma[] = []
  /* Ristiriidat: teksti kertoo eri paivan kuin kannassa jo on. */
  const ristiriidat: { nimi: string; kannassa: string; teksti: string; lause: string }[] = []

  for (const p of julkiset) {
    const teksti = `${p.additional_info ?? ""} ${p.metadata?.description ?? ""}`.trim()
    const tulos = parseFinnishStartDate(teksti)
    if (!tulos) continue
    if (p.construction_start) {
      if (String(p.construction_start).slice(0, 7) !== tulos.paiva.slice(0, 7)) {
        ristiriidat.push({
          nimi: String(p.name).slice(0, 44),
          kannassa: String(p.construction_start),
          teksti: tulos.paiva,
          lause: tulos.osuma,
        })
      }
      continue
    }
    osumat.push({
      id: p.id,
      nimi: String(p.name ?? ""),
      vaihe: String(p.phase ?? "-"),
      paiva: tulos.paiva,
      tarkkuus: tulos.tarkkuus,
      lause: tulos.osuma,
    })
  }

  const kattavuus = (((julkiset.length - ilman.length + osumat.length) / julkiset.length) * 100).toFixed(1)
  console.log(`UUSIA aloituspäiviä tekstistä: ${osumat.length}`)
  console.log(`   tarkka päivä ${osumat.filter((o) => o.tarkkuus === "paiva").length}, kuukausi ${osumat.filter((o) => o.tarkkuus === "kuukausi").length}`)
  console.log(`   kattavuus nousisi ${(((julkiset.length - ilman.length) / julkiset.length) * 100).toFixed(1)} % -> ${kattavuus} %`)

  const vaiheittain = new Map<string, number>()
  for (const o of osumat) vaiheittain.set(o.vaihe, (vaiheittain.get(o.vaihe) ?? 0) + 1)
  console.log(`\nvaiheittain:`)
  for (const [v, n] of [...vaiheittain.entries()].sort((a, b) => b[1] - a[1]))
    console.log(`   ${v.padEnd(26)} ${String(n).padStart(5)}`)

  const vuodet = new Map<string, number>()
  for (const o of osumat) vuodet.set(o.paiva.slice(0, 4), (vuodet.get(o.paiva.slice(0, 4)) ?? 0) + 1)
  console.log(`\naloitusvuosi:`)
  for (const [v, n] of [...vuodet.entries()].sort()) console.log(`   ${v}  ${String(n).padStart(5)}`)

  console.log(`\n=== OTOS (${Math.min(NAYTTO, osumat.length)} osumaa tasavälein, lue lauseet) ===`)
  const askel = Math.max(1, Math.floor(osumat.length / NAYTTO))
  for (let i = 0; i < osumat.length && i / askel < NAYTTO; i += askel) {
    const o = osumat[i]
    console.log(`\n   ${o.paiva} [${o.tarkkuus}] ${o.vaihe.padEnd(24)} ${o.nimi.slice(0, 46)}`)
    console.log(`      "${o.lause}"`)
  }

  /*
   * ONKO KANNASSA OLEVA ALOITUSPAIVA OIKEASTI TUONTIPAIVA?
   *
   * Ristiriidat kasautuivat muutamaan paivaan (2026-02-18, -21, -22),
   * mika nayttaa tuontiajolta eika rakentamisen alulta. Sama virhe on
   * tunnettu valmistumispaivassa (muisti: completion-date-from-text).
   */
  const onTuontipaiva = (p: any) =>
    p.construction_start && String(p.created_at ?? "").slice(0, 10) === String(p.construction_start).slice(0, 10)
  const epailyttavat = julkiset.filter(onTuontipaiva)
  console.log(`\n=== ALOITUSPAIVA = TUONTIPAIVA: ${epailyttavat.length} / ${julkiset.length - ilman.length} ===`)
  const paivittain = new Map<string, number>()
  for (const p of julkiset.filter((x) => x.construction_start))
    paivittain.set(String(p.construction_start), (paivittain.get(String(p.construction_start)) ?? 0) + 1)
  console.log(`   yleisimmät aloituspäivät kannassa:`)
  for (const [d, n] of [...paivittain.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8))
    console.log(`      ${d}  ${String(n).padStart(4)} hanketta`)

  console.log(`\n=== RISTIRIIDAT kannassa olevan kanssa: ${ristiriidat.length} ===`)
  for (const r of ristiriidat.slice(0, 12))
    console.log(`   ${r.nimi.padEnd(46)} kannassa ${r.kannassa}  teksti ${r.teksti}\n      "${r.lause}"`)
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
