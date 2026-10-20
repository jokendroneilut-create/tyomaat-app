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
 * HILMAN SOPIMUSKAUDEN ALKU: MITTAUS ENNEN POIMINTAA (D-325).
 *
 * Johannes 21.10.2026: *"otetaan hilman sopimuskausi, ei vielä tässäkään
 * vaiheessa tehdä mitään asiakkaalle näkyvää vaan katsotaan miten tämä
 * edistyy."*
 *
 * Tämä ajo EI KIRJOITA MITÄÄN. Se kertoo kattavuuden ja jakaumat, joiden
 * perusteella päätetään poimitaanko. Karsinta tulee samasta moduulista
 * jota poiminta käyttäisi, jotta mitattu luku on sama kuin toteutuva.
 *
 *   npx tsx scripts/mittaa-hilman-sopimuskausi.ts
 *   npx tsx scripts/mittaa-hilman-sopimuskausi.ts --otos 60
 */

import { fetchHilmaSopimuskausi, kelpaaAloitukseksi } from "../lib/agent/hilmaSopimuskausi"

const RAKENTAMISVAIHEET = new Set([
  "Kilpailutus",
  "Sopimus myönnetty",
  "Rakenteilla",
  "Rakentaminen aloitettu",
  "Valmistumassa",
])

async function main() {
  const otosKoko = Number(process.argv[process.argv.indexOf("--otos") + 1]) || 25
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const rivit: any[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error } = await db
      .from("projects")
      .select("id, name, phase, is_public, status, construction_start, metadata")
      .range(a, a + 999)
    if (error) {
      console.error(`VIRHE: ${error.message}`)
      process.exit(1)
    }
    rivit.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }

  const kohteet = rivit.filter(
    (p) =>
      p.is_public &&
      p.status === "active" &&
      RAKENTAMISVAIHEET.has(String(p.phase ?? "")) &&
      String(p.metadata?.source_name ?? "") === "Hilma"
  )
  const tunnisteilla = kohteet.filter((p) => p.metadata?.procedure_id && p.metadata?.notice_id)
  const ilmanPaivaa = tunnisteilla.filter((p) => !p.construction_start)

  console.log(`Hilma-lähtöisiä rakentamisvaiheissa     ${kohteet.length}`)
  console.log(`  joilla procedure_id + notice_id       ${tunnisteilla.length}`)
  console.log(`  joilta aloituspäivä puuttuu           ${ilmanPaivaa.length}`)
  console.log(`  joilla tunnisteet puuttuvat           ${kohteet.length - tunnisteilla.length}\n`)

  /* Tasavälinen otos, ei taulun alkupää ([[sample-must-be-representative]]). */
  const askel = Math.max(1, Math.floor(ilmanPaivaa.length / otosKoko))
  const otos = ilmanPaivaa.filter((_, i) => i % askel === 0).slice(0, otosKoko)
  console.log(`Otos ${otos.length} tasavälein (joka ${askel}. rivi):\n`)

  const nyt = new Date().toISOString().slice(0, 10)
  let kelpaavia = 0
  let mennyt = 0
  let tuleva = 0
  const hylkysyyt = new Map<string, number>()
  const kestot: number[] = []

  for (const p of otos) {
    const k = await fetchHilmaSopimuskausi(p.metadata.procedure_id, p.metadata.notice_id)
    const v = kelpaaAloitukseksi(k, p.name)
    if (!v.kelpaa) hylkysyyt.set(v.syy, (hylkysyyt.get(v.syy) ?? 0) + 1)
    else {
      kelpaavia += 1
      if (k.alku! <= nyt) mennyt += 1
      else tuleva += 1
      if (k.loppu) {
        const d = Math.round(
          (new Date(`${k.loppu}T00:00:00Z`).getTime() - new Date(`${k.alku}T00:00:00Z`).getTime()) / 86400000
        )
        if (Number.isFinite(d)) kestot.push(d)
      }
    }

    const lippu = k.puitesopimus ? " PUITE" : ""
    console.log(
      `   ${v.kelpaa ? "+" : "-"} ${String(p.name).slice(0, 50).padEnd(52)} ${(k.alku ?? "-").padEnd(11)}-> ${(k.loppu ?? "?").padEnd(11)} cpv ${(k.cpv ?? "--").padEnd(3)} ${v.syy}${lippu}`
    )
  }

  console.log(
    `\nKelpaa aloituspäiväksi ${kelpaavia}/${otos.length} (${((kelpaavia / Math.max(1, otos.length)) * 100).toFixed(0)} %)`
  )
  console.log(`  niistä menneitä ${mennyt}, tulevia ${tuleva}`)
  if (kestot.length) {
    const j = [...kestot].sort((a, b) => a - b)
    console.log(`  sopimuskauden kesto vrk: min ${j[0]}, mediaani ${j[Math.floor(j.length / 2)]}, max ${j[j.length - 1]}`)
  }
  console.log(`  hylkäyssyyt: ${[...hylkysyyt.entries()].map(([k2, v2]) => `${k2} ${v2}`).join(", ") || "-"}`)
  console.log(
    `\nJos osuus pätee koko joukkoon: ${Math.round((kelpaavia / Math.max(1, otos.length)) * ilmanPaivaa.length)} uutta aloituspäivää.`
  )
  console.log("Ei kirjoitettu mitään.")
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
