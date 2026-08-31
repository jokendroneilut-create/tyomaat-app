import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * DUPLIKAATTISKANNAUKSEN HARMAA VYÖHYKE.
 *
 * Skanneri hyväksyy parin vain jos luottamus on >= 70 JA mukana on joko
 * vahva tunniste tai nimitodiste samassa kaupungissa
 * (`passesDuplicateQualityBar`). Kaikki muu putoaa pois hiljaa — myös
 * aidot duplikaatit joilla ei satu olemaan lupanumeroa.
 *
 * Tämä mittaa mitä sinne putoaa: montako paria, millä pisteillä ja millä
 * perusteilla. Vasta se kertoo kannattaako harmaa vyöhyke antaa mallille
 * luettavaksi ja mistä kohtaa kannattaa aloittaa.
 *
 * EI KIRJOITA MITÄÄN.
 *
 *   npx tsx scripts/measure-duplicate-grey-zone.ts
 *   npx tsx scripts/measure-duplicate-grey-zone.ts --otos=25
 */

const OTOS = Number(process.argv.find((a) => a.startsWith("--otos="))?.split("=")[1] ?? "15")

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { calculateMatch } = await import("../lib/agent/projectMatcher")
  const { buildComparisonBuckets, comparisonPartners } = await import(
    "../lib/agent/duplicates/comparisonBuckets"
  )

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const hankkeet: any[] = []
  for (let f = 0; ; f += 1000) {
    const { data, error } = await admin
      .from("projects")
      .select("id,name,city,region,location,phase,status,is_public,developer,property_type,metadata,created_at")
      .eq("is_public", true)
      .range(f, f + 999)
    if (error) throw error
    hankkeet.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  const { data: parit } = await admin
    .from("project_duplicate_candidates")
    .select("project_id_a, project_id_b, status")

  const kasitellyt = new Set((parit ?? []).map((p: any) => `${p.project_id_a}:${p.project_id_b}`))

  console.log(`julkisia hankkeita ${hankkeet.length} | jo kasiteltyja pareja ${kasitellyt.size}\n`)

  const buckets = buildComparisonBuckets(hankkeet as any)
  const nahty = new Set<string>()

  /* Luottamusluokat: mihin parit putoavat. */
  const luokat = new Map<string, number>()
  const syyt = new Map<string, number>()
  const harmaat: any[] = []
  let verrattu = 0
  let osumia = 0

  for (const a of hankkeet) {
    for (const b of comparisonPartners(a as any, buckets)) {
      const [idA, idB] = [a.id, (b as any).id].sort()
      const key = `${idA}:${idB}`
      if (nahty.has(key)) continue
      nahty.add(key)
      verrattu++

      const match = calculateMatch(b as any, {
        name: a.name,
        sourceTitle: (a.metadata?.source_title as string | null) ?? null,
        city: a.city,
        region: a.region,
        location: a.location,
        permitNumber: a.metadata?.permit_number ?? null,
        propertyId: a.metadata?.property_id ?? null,
        developer: a.developer ?? a.metadata?.developer ?? null,
        buildingType: a.property_type ?? a.metadata?.building_type ?? null,
      })

      if (!match) continue
      osumia++

      const vahva =
        match.reasons.includes("same_permit_number") ||
        match.reasons.includes("same_property_id")
      const nimi =
        match.reasons.includes("exact_title") ||
        match.reasons.includes("exact_distinctive_title") ||
        match.reasons.includes("similar_title")
      const lapi = match.confidence >= 70 && (vahva || (nimi && match.reasons.includes("same_city")))

      if (lapi) continue
      if (kasitellyt.has(key)) continue

      const luokka =
        match.confidence >= 70
          ? "70+ mutta ei tunnistetta/nimea"
          : match.confidence >= 60
            ? "60-69"
            : match.confidence >= 50
              ? "50-59"
              : match.confidence >= 40
                ? "40-49"
                : "alle 40"
      luokat.set(luokka, (luokat.get(luokka) ?? 0) + 1)
      for (const r of match.reasons) syyt.set(r, (syyt.get(r) ?? 0) + 1)

      harmaat.push({ a, b, confidence: match.confidence, reasons: match.reasons, luokka })
    }
  }

  console.log(`vertailtuja pareja ${verrattu.toLocaleString("fi")} | joilla jokin osuma ${osumia}`)
  console.log(`HARMAA VYOHYKE: ${harmaat.length} paria\n`)

  console.log("LUOTTAMUSLUOKITTAIN:")
  const jarjestys = ["70+ mutta ei tunnistetta/nimea", "60-69", "50-59", "40-49", "alle 40"]
  for (const k of jarjestys) {
    if (luokat.has(k)) console.log(`  ${k.padEnd(32)} ${luokat.get(k)}`)
  }

  console.log("\nYLEISIMMAT PERUSTEET:")
  for (const [k, v] of [...syyt].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    console.log(`  ${k.padEnd(28)} ${v}`)
  }

  /*
   * KIINNOSTAVIN KAISTA: luottamus >= 70 ja nimitodisteena
   * name_in_description. Skanneri jattaa sen tarkoituksella pois, koska
   * sen vaikutusta pareittaisessa lapikaynnissa ei ollut mitattu.
   */
  const kaista = harmaat.filter(
    (h) => h.confidence >= 70 && h.reasons.includes("name_in_description")
  )
  console.log(`
KAISTA (>=70 ja name_in_description): ${kaista.length} paria`)
  for (const h of kaista.sort((x: any, y: any) => y.confidence - x.confidence)) {
    console.log(`  [${h.confidence}] ${String(h.a.city).slice(0, 13).padEnd(14)} ${String(h.a.name).slice(0, 42).padEnd(44)} || ${String(h.b.name).slice(0, 42)}`)
  }

  console.log(`\nOTOS (${OTOS} korkeimman pisteen paria):`)
  for (const h of harmaat.sort((x, y) => y.confidence - x.confidence).slice(0, OTOS)) {
    console.log(`\n  [${h.confidence}] ${h.reasons.join(", ").slice(0, 70)}`)
    console.log(`     A: ${String(h.a.name).slice(0, 62)}  (${h.a.city}, ${h.a.phase})`)
    console.log(`     B: ${String(h.b.name).slice(0, 62)}  (${h.b.city}, ${h.b.phase})`)
  }
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
export {}
