import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}
const RPT = JSON.parse(readFileSync("C:/Users/johan/AppData/Local/Temp/claude/C--Users-johan-tyomaat-app-app--claude-worktrees-optimistic-mccarthy-f81fe2/85d52a28-fb2e-4408-a94a-c8d958d63f3c/scratchpad/rpt.json", "utf8"))
async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const { findProjectMatchDetailed } = await import("./lib/agent/projectMatcher")
  const projects: any[] = []
  for (let f = 0; ; f += 1000) {
    const { data } = await svc.from("projects").select("id, name, city, region, location, phase, status, developer, builder, property_type, additional_info, estimated_completion, completed_at, metadata").eq("is_public", true).range(f, f+999)
    projects.push(...(data ?? [])); if (!data || data.length < 1000) break
  }
  console.log(`RPT-hankkeita ${RPT.length}, omia julkisia ${projects.length}\n`)
  let strong = 0, weak = 0, none = 0
  const perCity = new Map<string, { t: number; s: number; w: number; n: number }>()
  const newOnes: any[] = []
  for (const r of RPT) {
    const res: any = findProjectMatchDetailed(projects, { name: r.name, city: r.city } as any)
    const c = res?.confidence ?? 0
    const key = r.city
    if (!perCity.has(key)) perCity.set(key, { t: 0, s: 0, w: 0, n: 0 })
    const pc = perCity.get(key)!; pc.t++
    if (c >= 70) { strong++; pc.s++ }
    else if (c >= 40) { weak++; pc.w++ }
    else { none++; pc.n++; newOnes.push(r) }
  }
  console.log(`=== TÄSMÄYS ===`)
  console.log(`  meillä jo (>=70):        ${strong}  (${Math.round(strong/RPT.length*100)} %)`)
  console.log(`  ehkä sama (40-69):       ${weak}`)
  console.log(`  UUSIA meille (<40):      ${none}  (${Math.round(none/RPT.length*100)} %)`)
  console.log(`\n=== KAUPUNGEITTAIN ===`)
  console.log(`  kaupunki        RPT   jo   ehkä  uusi`)
  for (const [k, v] of [...perCity.entries()].sort((a,b)=>b[1].t-a[1].t)) {
    console.log(`  ${k.padEnd(15)}${String(v.t).padStart(4)}${String(v.s).padStart(6)}${String(v.w).padStart(6)}${String(v.n).padStart(6)}`)
  }
  console.log(`\n=== NÄYTTEITÄ UUSISTA ===`)
  for (const r of newOnes.slice(0, 15)) console.log(`   [${r.city}] ${String(r.name).slice(0,66)}`)
}
main().catch(e => { console.error(e); process.exit(1) })
