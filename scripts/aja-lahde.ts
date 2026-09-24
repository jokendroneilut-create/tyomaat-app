import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * Yhden lahteen ajo kasin, samaa polkua kuin cron (sourceWorker, 90 s katko).
 *
 *   npx tsx scripts/aja-lahde.ts legacy-stt-haku
 */
async function main() {
  const id = process.argv[2]
  if (!id) throw new Error("anna lahteen id, esim. legacy-stt-haku")

  const { runSourceWorker } = await import("../lib/agent/workers/sourceWorker")
  const alkoi = Date.now()
  const tulos = await runSourceWorker(id)
  console.log(`\n=== ${id}: ${((Date.now() - alkoi) / 1000).toFixed(1)} s ===`)
  console.log(JSON.stringify(tulos, null, 1))
}
main().catch((e) => { console.error(e); process.exit(1) })
