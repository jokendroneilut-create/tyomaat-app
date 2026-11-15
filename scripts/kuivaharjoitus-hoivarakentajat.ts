import { readFileSync } from "node:fs"
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); const q = v.slice(0, 1); if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * HOIVARAKENTAJIEN LÄHTEET KUIVAHARJOITUKSENA (D-427).
 *
 * Hakee molemmat lähteet ja täsmää ehdokkaat kantaan samalla
 * `findProjectMatchDetailed`-funktiolla kuin tuonti. Ei kirjoita mitään.
 *
 *   npx tsx scripts/kuivaharjoitus-hoivarakentajat.ts
 */
async function main() {
  const { fetchHoivarakentajatSource } = await import("../lib/agent/fetchHoivarakentajatSource")
  const { findProjectMatchDetailed } = await import("../lib/agent/projectMatcher")
  const { loadProjectsForMatching } = await import("../lib/agent/importCandidate")
  const hankkeet = await loadProjectsForMatching()
  const ehdokkaat = await fetchHoivarakentajatSource()
  console.log(`ehdokkaita ${ehdokkaat.length}, verrattu ${hankkeet.length} hankkeeseen\n`)
  let uusia = 0
  for (const e of ehdokkaat as any[]) {
    const osuma = findProjectMatchDetailed(hankkeet, {
      name: e.name,
      city: e.city,
      location: e.location,
      developer: e.developer,
      builder: e.builder,
    } as any)
    const tulos = osuma && osuma.confidence >= 70
      ? `TÄSMÄÄ ${osuma.confidence} -> ${String(osuma.project.name).slice(0, 70)} (${osuma.project.phase})`
      : `UUSI${osuma ? ` (paras ${osuma.confidence}: ${String(osuma.project.name).slice(0, 50)})` : ""}`
    if (!(osuma && osuma.confidence >= 70)) uusia++
    const pp = e.metadata?.contact_persons?.[0]
    console.log(`${e.source_name.padEnd(24)} ${e.phase}${e.phase_authoritative ? "*" : ""} | ${e.name.slice(0, 80)}\n   ${tulos}${pp ? `\n   pp: ${pp.name} ${pp.phone ?? ""}` : ""}`)
  }
  console.log(`\nuusia ${uusia}/${ehdokkaat.length}  (* = julkaisijan varma vaihe)`)
}
main().catch((e) => { console.error(e); process.exit(1) })
