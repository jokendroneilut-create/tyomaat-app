import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}
async function main() {
  const { loadProjectsForMatching } = await import("../lib/agent/importCandidate")
  const { findProjectMatchDetailed } = await import("../lib/agent/projectMatcher")
  const projects: any[] = (await loadProjectsForMatching()) as any[]
  console.log(`hankkeita ${projects.length}`)
  const ehdokas = {
    name: "Kreate voitti Ouluntien tasoristeysten poistourakan Kemissa",
    sourceTitle: null, city: "Kemi", region: "Lappi", location: null,
    permitNumber: null, propertyId: null, developer: "Kreate", buildingType: "Infrahanke",
  }
  for (let i = 0; i < 3; i++) {
    const a = Date.now()
    const t = findProjectMatchDetailed(projects as any, ehdokas as any)
    console.log(`tasmaytys ${Date.now() - a} ms  -> ${t ? `${t.confidence} ${String(t.project.name).slice(0, 40)}` : "ei osumaa"}`)
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
