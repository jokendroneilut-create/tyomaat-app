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
 * OYS 2030 -PURUN TARKISTUS (D-361). Nayttaa kaikki viisi osahanketta
 * ja ohjelmasivun rivin lopputilan yhdella silmayksella.
 *
 *   npx tsx scripts/tarkista-oys-purku.ts
 */
const C = "a495c984-54d3-494c-a232-9b32f56d10a0"
const H = "2af51a02-3870-4de2-b58b-bc568f3adcf1"
const OHJELMA = "bb6d981e-9c8e-46b9-8901-a70c8dd3e247"

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const { data: hankkeet } = await db.from("projects").select("*").in("id", [C, H])
  for (const h of (hankkeet ?? []) as any[]) {
    console.log(`${h.id === C ? "C-RAKENNUS" : "H-RAKENNUS"}  ${h.id}`)
    console.log(`   ${h.name}`)
    console.log(`   ${h.city} | ${h.phase} | tyyppi ${h.property_type ?? "-"} | julkinen ${h.is_public}`)
    console.log(`   osoite ${h.location ?? "-"} | ala ${h.floor_area ?? "-"} | arvo ${h.estimated_cost ?? "-"}`)
    console.log(`   alkaa ${h.construction_start ?? "-"} | valmistuu ${h.estimated_completion ?? "-"}`)
    console.log(`   tilaaja ${h.developer ?? "-"} | rakentaja ${h.builder ?? "-"}`)
    console.log(`   ark ${h.architectural_design || "-"}`)
    console.log(`   rak ${h.structural_design || "-"} | tate ${h.hvac_design || "-"} | geo ${h.geotechnical_design || "-"}`)
    console.log()
  }

  const { data: jono } = await db
    .from("potential_projects")
    .select("id,title,status,address,metadata")
    .or(`id.eq.${OHJELMA},title.ilike.%kuuraparkki%`)
  for (const r of (jono ?? []) as any[]) {
    console.log(`JONO [${r.status}] ${r.title}`)
    console.log(`   ${r.id}`)
    if (r.address) console.log(`   ${r.address}`)
    if (r.metadata?.purettu_2026_10_30)
      console.log(`   purettu: ${JSON.stringify(r.metadata.purettu_2026_10_30.osahankkeet)}`)
    console.log()
  }

  const { data: parit } = await db
    .from("project_duplicate_candidates")
    .select("status,confidence,reasons,project_id_a,project_id_b")
    .or(`project_id_a.eq.${C},project_id_b.eq.${C}`)
  console.log(`C-RAKENNUKSEN KATSELMOINTIPARIT (${(parit ?? []).length}):`)
  for (const p of (parit ?? []) as any[]) {
    console.log(`   [${p.status}] ${p.confidence} — ${(p.reasons ?? []).join(" | ")}`)
  }
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
