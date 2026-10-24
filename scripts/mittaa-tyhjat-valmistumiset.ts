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
 * TYHJA VALMISTUMISKENTTA, MUTTA TEKSTISSA OSUMA (D-348).
 *
 * Johannes 25.10.2026: *"katso nuo 121 lapi voisiko sielta poimia
 * jotain"* -- rivit joilla `estimated_completion` on tyhja, mutta
 * `parseEstimatedCompletionDate` loytaa tekstista paivan. Otos
 * D-347:ssa naytti seka oikeita etta torkean vaaria (1982-08-31,
 * "asemakaavan muutoksen on tavoitteena valmistua").
 *
 * Tama EI KIRJOITA MITAAN. Se luokittelee rivit, jotta nahdaan mika
 * osa on poimittavissa ilman riskia. Luokat on valittu sen mukaan mika
 * tekee osumasta vaarallisen, ei sen mukaan mika on helppo mitata:
 *
 *   MENNYT      paiva on jo mennyt -> autoCompleteGate piilottaa
 *               hankkeen 90 vrk:n kuluttua (D-298). Vaarallisin luokka.
 *   EI_HANKE    virkkeen aihe on kaava, suunnitelma, selvitys tai lupa.
 *   VANHA_RAK   virke kertoo vanhasta rakennuksesta ("valmistui 1962").
 *   TULEVA      paiva on tulevaisuudessa eika yllaolevia merkkeja.
 *
 *   npx tsx scripts/mittaa-tyhjat-valmistumiset.ts
 *   npx tsx scripts/mittaa-tyhjat-valmistumiset.ts --luokka=TULEVA
 */

import { parseEstimatedCompletionDate } from "../lib/agent/parseFinnishCompletionDate"

const EI_HANKE =
  /selvity|\bYVA\b|arviointiselostu|arviointiohjelma|suunnitelma|suunnittelu|yleiskaava|asemakaava|kaavoitu|raportti|hakemus|lupak[äa]sittely|lupaprosessi|tarjouskilpailu|kilpailutus/i

const VALMISTUMISSANA =
  /(valmistu|k[äa]ytt[öo][öo]n|luovute|k[äa]ynnisty|p[äa][äa]st[äa][äa]n muuttamaan)/i

/* Virke jossa on seka valmistumissana etta vuosiluku tai vuodenaika. */
function todisteet(teksti: string): string[] {
  return teksti
    .replace(/\s+/g, " ")
    .split(/(?<!(?:^|\s)[A-ZÄÖÅ])\.\s+/)
    .filter((v) => VALMISTUMISSANA.test(v) && /\b(19|20)\d{2}\b|kev[äa][äa]ll|kes[äa]ll|syksyll|talvell/i.test(v))
}

function luokka(paiva: string, virkkeet: string[], nyt: string): string {
  if (paiva < nyt) return "MENNYT"
  if (virkkeet.every((v) => EI_HANKE.test(v))) return "EI_HANKE"
  if (virkkeet.some((v) => /valmistui|valmistunut|rakennettu vuonna|peräisin vuodelta/i.test(v))) {
    return "VANHA_RAK"
  }
  return "TULEVA"
}

async function main() {
  const vain = process.argv.find((a) => a.startsWith("--luokka="))?.split("=")[1]
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const nyt = new Date().toISOString().slice(0, 10)
  const rivit: any[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error } = await db
      .from("projects")
      .select("id,name,city,phase,status,is_public,additional_info,estimated_completion,metadata")
      .range(a, a + 999)
    if (error) {
      console.error(`VIRHE: ${error.message}`)
      process.exit(1)
    }
    rivit.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }

  const kohteet = rivit.filter((p) => p.is_public && p.status === "active" && !p.estimated_completion)
  console.log(`Julkisia aktiivisia ilman valmistumispäivää: ${kohteet.length}\n`)

  const osumat: { p: any; paiva: string; luokka: string; virkkeet: string[] }[] = []
  for (const p of kohteet) {
    const teksti = `${p.name ?? ""} ${p.additional_info ?? ""} ${p.metadata?.description ?? ""}`.trim()
    if (teksti.length < 40) continue
    const paiva = parseEstimatedCompletionDate(teksti)
    if (!paiva) continue
    const virkkeet = todisteet(teksti)
    osumat.push({ p, paiva, luokka: luokka(paiva, virkkeet.length ? virkkeet : [teksti], nyt), virkkeet })
  }

  const jakauma = new Map<string, number>()
  for (const o of osumat) jakauma.set(o.luokka, (jakauma.get(o.luokka) ?? 0) + 1)
  console.log(`Osumia yhteensä: ${osumat.length}`)
  for (const [k, n] of [...jakauma.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`   ${k.padEnd(10)} ${n}`)
  }

  for (const o of osumat
    .filter((o) => !vain || o.luokka === vain)
    .sort((a, b) => a.paiva.localeCompare(b.paiva))) {
    console.log(`\n[${o.luokka}] ${o.paiva}  ${String(o.p.phase ?? "-").slice(0, 16).padEnd(17)} ${String(o.p.name).slice(0, 52)}`)
    console.log(`   ${o.p.id}`)
    for (const v of o.virkkeet.slice(0, 2)) console.log(`   > ${v.slice(0, 190)}`)
    if (!o.virkkeet.length) console.log(`   > (ei virkettä jossa sekä sana että vuosi)`)
  }
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
