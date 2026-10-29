import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); const q = v.slice(0,1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1,-1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}
/*
 * NAYTTAA KATSELMOINTIJONON NIIN KUIN SIVU SEN NAYTTAA.
 *
 * Kayttaa sivun omaa palvelua, joten rajaus (status=pending) ja jarjestys
 * ovat samat. Kattoa ei enaa ole (D-358), ja skripti todistaa sen:
 * se vertaa listan pituutta jonon lukumaaraan ja huutaa jos ne eroavat.
 *
 *   npx tsx scripts/nayta-duplikaattijono.ts
 */
async function main() {
  const { getDuplicateCandidates, getPendingDuplicateCount } = await import(
    "../app/tic/services/getDuplicateCandidates"
  )
  const [rivit, odottaa] = await Promise.all([
    getDuplicateCandidates(),
    getPendingDuplicateCount(),
  ])
  console.log(`Sivu nayttaisi ${rivit.length} paria; jonossa odottaa ${odottaa}`)
  console.log(
    rivit.length === odottaa
      ? "TASMAA: mitaan ei putoa listalta\n"
      : `EROAA: ${odottaa - rivit.length} paria ei nay!\n`
  )
  for (const c of rivit) {
    console.log(`Varmuus: ${c.confidence}%   [${c.reasons.join("] [")}]`)
    console.log(`   A: ${c.projectA?.name ?? "(puuttuu)"} — ${c.projectA?.city ?? "-"} / ${c.projectA?.phase ?? "-"}`)
    console.log(`   B: ${c.projectB?.name ?? "(puuttuu)"} — ${c.projectB?.city ?? "-"} / ${c.projectB?.phase ?? "-"}`)
  }
  const puuttuvia = rivit.filter((c) => !c.projectA || !c.projectB).length
  console.log(`\nRiveja joilta puuttuu hanke: ${puuttuvia}`)
}
main().catch((e) => { console.error(e); process.exit(1) })
