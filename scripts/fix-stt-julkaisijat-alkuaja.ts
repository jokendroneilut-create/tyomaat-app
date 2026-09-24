import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * UUDEN LAHTEEN ENSIMMAINEN TAYSI AJO (D-211).
 *
 * `stt_julkaisijat` palauttaa 12 kuukauden ikkunasta 243 tiedotetta.
 * Lahdeajolla on 90 sekunnin katkaisu ja tuonti ehtii noin viisi
 * ehdokasta kerrallaan (mitattu: yksi tuonti 11,8 s, eika rinnakkaisuus
 * nosta lapimenoa - se vain pidentaa yksittaisen kestoa), joten
 * cron-ajoilla ensimmainen kierros veisi lahes kaksi viikkoa.
 *
 * MIKSI KOKO 243 EIKA VAIN UUDET. Nahty-ikkuna on 7 vrk ja perustason
 * kierto 4,4 vrk, joten kerran tuotu osoite karsiutuu jatkossa jo ennen
 * tuontia. Ilman taysi kierrosta jokainen ajo aloittaisi alusta.
 *
 * Tama ei ohita yhtaan tarkistusta: sama `importCandidate` kuin
 * lahdeajossa, sama rikastus. Ainoa ero on ettei ajolla ole 90 sekunnin
 * kattoa.
 *
 *   npx tsx scripts/fix-stt-julkaisijat-alkuaja.ts            (kuivaharjoitus)
 *   npx tsx scripts/fix-stt-julkaisijat-alkuaja.ts --apply
 */
const APPLY = process.argv.includes("--apply")

/* Sama kuin lahdeajossa; rinnakkaisuus ei nosta lapimenoa mutta ei myoskaan haittaa. */
const RINNAKKAISUUS = 6

async function main() {
  const { fetchSttJulkaisijatSource } = await import("../lib/agent/fetchSttJulkaisijatSource")
  const { enrichSttCandidate } = await import("../lib/agent/fetchSttHakuSource")
  const { importCandidate, loadProjectsForMatching, findRecentlySeenSourceUrls } = await import(
    "../lib/agent/importCandidate"
  )

  const luvassa = loadProjectsForMatching()
  luvassa.catch(() => {})

  const kandidaatit: any[] = await fetchSttJulkaisijatSource()
  const projects: any[] = (await luvassa) as any[]
  const nahdyt = await findRecentlySeenSourceUrls(kandidaatit.map((k) => k?.source_url))
  const tehtavat = kandidaatit.filter((k) => k?.source_url && !nahdyt.has(k.source_url))

  console.log(`kandidaatteja ${kandidaatit.length}, jo nahtyja ${nahdyt.size}, tuotavia ${tehtavat.length}`)

  if (!APPLY) {
    console.log("\n25 ensimmaista:")
    for (const k of tehtavat.slice(0, 25)) {
      console.log(`  ${String(k.city ?? "-").padEnd(12)} ${String(k.name).slice(0, 70)}`)
    }
    console.log(`\n=== KUIVAHARJOITUS: ${tehtavat.length} ehdokasta ===`)
    return
  }

  const tilastot = new Map<string, number>()
  let valmiita = 0
  const alkoi = Date.now()
  let kursori = 0

  await Promise.all(
    Array.from({ length: RINNAKKAISUUS }, async () => {
      while (kursori < tehtavat.length) {
        const k = tehtavat[kursori++]
        try {
          const rikas = await enrichSttCandidate(k)
          const tulos = await importCandidate(
            { ...rikas, source_name: "stt_julkaisijat" },
            { projects }
          )
          tilastot.set(tulos.status, (tilastot.get(tulos.status) ?? 0) + 1)
        } catch (e: any) {
          tilastot.set("virhe", (tilastot.get("virhe") ?? 0) + 1)
          console.error(`  virhe: ${String(k.name).slice(0, 50)} - ${e?.message ?? e}`)
        }
        valmiita++
        if (valmiita % 20 === 0) {
          const kesto = (Date.now() - alkoi) / 1000
          console.log(`  ${valmiita}/${tehtavat.length}  ${kesto.toFixed(0)} s  (${(kesto / valmiita).toFixed(1)} s/ehdokas)`)
        }
      }
    })
  )

  console.log(`\n=== AJETTU: ${valmiita} ehdokasta, ${((Date.now() - alkoi) / 1000 / 60).toFixed(1)} min ===`)
  for (const [k, v] of [...tilastot].sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(4)}  ${k}`)
}
main().catch((e) => { console.error(e); process.exit(1) })
