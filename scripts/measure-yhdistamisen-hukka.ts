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
 * PALJONKO TIETOA JAI PIILOTETULLE RIVILLE?
 *
 * Johannes 18.10.2026: *"haluan etta kayttajalle on nakyvissa kaikki
 * mahdollinen tieto mita meilla on."*
 *
 * Yhdistaminen piilottaa haviajan mutta EI siirra sen kenttia
 * voittajalle. Tama mittaa jokaisesta vahvistetusta parista, mita
 * voittajalta puuttuu ja mita piilotetulla on.
 *
 * Ei kirjoita mitaan.
 *
 *   npx tsx scripts/measure-yhdistamisen-hukka.ts
 */

/* Kentat jotka asiakas nakee hankekortilla. */
const KENTAT = [
  "developer",
  "builder",
  "contractor",
  "earthworks_contractor",
  "structural_design",
  "hvac_design",
  "electrical_design",
  "architectural_design",
  "geotechnical_design",
  "location",
  "lat",
  "lng",
  "apartments",
  "floor_area",
  "estimated_cost",
  "start_date",
  "construction_start",
  "estimated_completion",
  "property_type",
  "additional_info",
] as const

const tyhja = (v: unknown) =>
  v === null || v === undefined || (typeof v === "string" && !v.trim())

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const parit: any[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error } = await db
      .from("project_duplicate_candidates")
      .select("project_id_a, project_id_b, status")
      .eq("status", "confirmed_duplicate")
      .range(a, a + 999)
    if (error) {
      console.error("VIRHE parit:", error.message)
      process.exit(1)
    }
    parit.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }
  console.log(`vahvistettuja pareja: ${parit.length}`)

  const idt = [...new Set(parit.flatMap((p) => [String(p.project_id_a), String(p.project_id_b)]))]
  const hankkeet = new Map<string, any>()
  /* .in() pilkotaan ~100:n paloihin. */
  for (let i = 0; i < idt.length; i += 100) {
    const pala = idt.slice(i, i + 100)
    const { data, error } = await db
      .from("projects")
      .select(`id, name, is_public, ${KENTAT.join(", ")}`)
      .in("id", pala)
    if (error) {
      console.error("VIRHE hankkeet:", error.message)
      process.exit(1)
    }
    for (const p of data ?? []) hankkeet.set(String((p as any).id), p)
  }
  console.log(`hankkeita luettu: ${hankkeet.size}\n`)

  const puuttuuKentittain = new Map<string, number>()
  let pareja = 0
  let parejaJoissaHukkaa = 0
  const esimerkit: string[] = []

  for (const pari of parit) {
    const a = hankkeet.get(String(pari.project_id_a))
    const b = hankkeet.get(String(pari.project_id_b))
    if (!a || !b) continue
    /* Voittaja = se joka on yha julkinen. */
    const jaava = a.is_public ? a : b.is_public ? b : null
    const piilotettu = a.is_public ? b : b.is_public ? a : null
    if (!jaava || !piilotettu || jaava.id === piilotettu.id) continue
    pareja++

    const hukka: string[] = []
    for (const k of KENTAT) {
      if (tyhja((jaava as any)[k]) && !tyhja((piilotettu as any)[k])) {
        hukka.push(k)
        puuttuuKentittain.set(k, (puuttuuKentittain.get(k) ?? 0) + 1)
      }
    }
    if (hukka.length) {
      parejaJoissaHukkaa++
      if (esimerkit.length < 12) {
        esimerkit.push(
          `${String(jaava.name).slice(0, 38).padEnd(40)} puuttuu: ${hukka.join(", ")}`
        )
      }
    }
  }

  console.log(`pareja joissa molemmat loytyivat ja toinen on julkinen: ${pareja}`)
  console.log(`niista pareja joissa voittajalta puuttuu jotain: ${parejaJoissaHukkaa}\n`)
  console.log("kentta                 pareja joissa VOITTAJA tyhja mutta piilotetulla arvo")
  for (const [k, n] of [...puuttuuKentittain].sort((x, y) => y[1] - x[1])) {
    console.log(`  ${k.padEnd(22)} ${n}`)
  }
  console.log(`\nesimerkkeja:`)
  for (const e of esimerkit) console.log(`  ${e}`)
}
main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
