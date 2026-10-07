/*
 * Keravan uutislahteen kuivaharjoitus: mika lapaisee suodatuksen ja mika ei.
 *   npx tsx scripts/kuivaharjoitus-kerava-uutiset.ts
 */
import { haeKeravanUutiset, lapaiseeSuodatuksen } from "../lib/agent/fetchKeravaUutisetSource"

async function main() {
  const uutiset = await haeKeravanUutiset()
  const lapi = uutiset.filter(lapaiseeSuodatuksen)
  const hylatyt = uutiset.filter((u) => !lapaiseeSuodatuksen(u))

  console.log(`Haettu ${uutiset.length} juttua. Lapi ${lapi.length}, hylatty ${hylatyt.length}.\n`)
  console.log("=== LAPI PAASSEET ===")
  for (const u of lapi) console.log(" +", u.date.slice(0, 10), u.title)
  console.log("\n=== HYLATYT ===")
  for (const u of hylatyt) console.log(" -", u.date.slice(0, 10), u.title)
}
main()
