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
 * DATAKESKUSREKISTERIN AJON TARKISTUS (D-365).
 *
 *   npx tsx scripts/tarkista-datakeskusrekisterin-ajo.ts
 */
const KITEE_ALKU = "ca192c26"

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const jono: any[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error } = await db
      .from("potential_projects")
      .select("id,title,status,municipality,metadata,created_at")
      .eq("metadata->>source_name", "datakeskusrekisteri")
      .range(a, a + 999)
    if (error) throw error
    jono.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }
  console.log(`JONORIVIT: ${jono.length}`)
  const tilat: Record<string, number> = {}
  for (const r of jono) tilat[r.status] = (tilat[r.status] ?? 0) + 1
  console.log("  " + Object.entries(tilat).map(([k, v]) => `${k} ${v}`).join(", "))
  console.log(`  taydennetty (toimija tiedossa): ${jono.filter((r) => r.metadata?.developer).length}`)

  for (const r of jono.slice(0, 8)) {
    console.log(`\n  [${r.status}] ${r.title}`)
    console.log(`     ${r.municipality ?? "-"} | vaihe ${r.metadata?.phase_hint ?? "-"} | toimija ${r.metadata?.developer ?? "-"}`)
    console.log(`     teho ${r.metadata?.teho_mw ?? "-"} MW | ${r.metadata?.source_url ?? "-"}`)
    console.log(`     kuvaus: ${String(r.metadata?.description ?? "").replace(/\s+/g, " ").slice(0, 150)}`)
  }

  const { data: tapahtumat } = await db
    .from("project_import_events")
    .select("match_status,action_taken")
    .eq("source_name", "datakeskusrekisteri")
  const t: Record<string, number> = {}
  for (const x of (tapahtumat ?? []) as any[]) t[`${x.match_status}/${x.action_taken}`] = (t[`${x.match_status}/${x.action_taken}`] ?? 0) + 1
  console.log(`\nTUONTITAPAHTUMAT (${(tapahtumat ?? []).length}):`)
  for (const [k, v] of Object.entries(t)) console.log(`  ${k}: ${v}`)

  /* Kasin taydennetty Kiteen rivi ei saa huonontua. */
  const kaikki: any[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error } = await db
      .from("projects")
      .select("id,name,city,phase,property_type,developer,location,metadata")
      .range(a, a + 999)
    if (error) throw error
    kaikki.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }
  const kitee = kaikki.find((h) => String(h.id).startsWith(KITEE_ALKU))
  console.log(`\nKITEEN RIVI (kasin taydennetty):`)
  if (!kitee) {
    console.log("  EI LOYDY – tarkista")
  } else {
    console.log(`  ${kitee.name}`)
    console.log(`  vaihe ${kitee.phase} | tyyppi ${kitee.property_type} | tilaaja ${kitee.developer ?? "-"}`)
    console.log(`  osoite ${kitee.location ?? "-"}`)
    console.log(`  liittyvat ${JSON.stringify(kitee.metadata?.related_companies ?? [])}`)
    console.log(`  kontakteja ${(kitee.metadata?.contact_persons ?? []).length}`)
  }
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
