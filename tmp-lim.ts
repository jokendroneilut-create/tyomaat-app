import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local","utf8").replace(/\r/g,"").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'"))) v=v.slice(1,-1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}
async function main(){
  const { runReleaseBodyWorker } = await import("./lib/agent/workers/releaseBodyWorker")
  const t0=Date.now()
  const r = await runReleaseBodyWorker(100)
  console.log(`limit=100: ${((Date.now()-t0)/1000).toFixed(1)} s  (reitin maxDuration 300 s)`)
  console.log(JSON.stringify(r))
  console.log(`\nper dokumentti: ${(((Date.now()-t0)/1000)/Math.max(1,(r as any).processed)).toFixed(2)} s`)
}
main().catch(e=>{console.error(e);process.exit(1)})
