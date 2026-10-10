import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * MITKA LAHTEET EIVAT EHDI TUODA KAIKKEA (D-253).
 *
 * legacyFetchCollector pysahtyy 60 sekunnin tuontibudjettiin ja siirtaa
 * loput seuraavaan ajoon. Jos sama lahde siirtaa joka ajossa, sen hanta
 * ei tule koskaan sisaan — ja ilman tata skriptia se ei nay missaan:
 * lahde raportoi onnistumisen.
 *
 * Nayttaa myos ajovalin suhteessa 14 vrk:n ohitusikkunaan
 * (IMPORT_SEEN_WINDOW_MS). Jos lahde saa vuoron harvemmin kuin ikkuna,
 * jo tuodut nayttavat taas uusilta ja kasautuminen muuttuu pysyvaksi.
 *
 *   npx tsx scripts/diag-siirretyt.ts
 */
const IKKUNA_VRK = 14

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const { data: ajot, error } = await db
    .from("discovery_runs")
    .select("source_id, source_name, documents_found, documents_saved, documents_deferred, started_at")
    .order("started_at", { ascending: false })
    .limit(2000)

  if (error) {
    if (/documents_deferred/.test(error.message)) {
      console.log("Sarake documents_deferred puuttuu.")
      console.log("Aja ensin: docs/sql/2026-10-10_discovery_runs_deferred.sql")
      return
    }
    throw error
  }

  const ryhma = new Map<string, { nimi: string; ajoja: number; siirretty: number; suurin: number }>()
  for (const r of (ajot ?? []) as any[]) {
    const d = r.documents_deferred
    if (d === null || d === undefined) continue
    const g = ryhma.get(r.source_id) ?? { nimi: r.source_name, ajoja: 0, siirretty: 0, suurin: 0 }
    g.ajoja++
    g.siirretty += d
    g.suurin = Math.max(g.suurin, d)
    ryhma.set(r.source_id, g)
  }

  const kasaantuvat = [...ryhma.entries()].filter(([, g]) => g.siirretty > 0).sort((a, b) => b[1].siirretty - a[1].siirretty)

  if (!ryhma.size) {
    console.log("Yhdessakaan ajossa ei ole viela documents_deferred-arvoa.")
    console.log("Joko SQL on ajamatta tai yksikaan ajo ei ole osunut budjettiin sen jalkeen.")
  } else {
    console.log(`ajoja joissa luku kirjattu: ${[...ryhma.values()].reduce((s, g) => s + g.ajoja, 0)}`)
    console.log(`lahteita jotka siirtavat:   ${kasaantuvat.length}\n`)
    console.log("siirretty  ajoja  suurin  lahde")
    for (const [, g] of kasaantuvat.slice(0, 20)) {
      console.log(`${String(g.siirretty).padStart(9)}  ${String(g.ajoja).padStart(5)}  ${String(g.suurin).padStart(6)}  ${g.nimi}`)
    }
  }

  /*
   * Ajovali vs. ikkuna. Tama on se raja jonka ylittyessa kasautuminen
   * muuttuu tilapaisesta pysyvaksi.
   */
  const { data: lahteet } = await db.from("discovery_sources").select("name,created_at,run_count").eq("enabled", true).limit(500)
  const nyt = Date.now()
  const valit = (lahteet ?? [])
    .filter((r: any) => r.run_count > 0 && r.created_at)
    .map((r: any) => ({ nimi: r.name, vali: (nyt - new Date(r.created_at).getTime()) / 864e5 / r.run_count }))
    .sort((a, b) => b.vali - a.vali)

  const yli = valit.filter((v) => v.vali > IKKUNA_VRK)
  const mediaani = valit[Math.floor(valit.length / 2)]?.vali ?? 0
  console.log(`\najovali: mediaani ${mediaani.toFixed(1)} vrk, ikkuna ${IKKUNA_VRK} vrk`)
  console.log(`  ikkunan YLITTAVIA lahteita: ${yli.length}${yli.length ? "  <- naiden hanta ei tule koskaan sisaan" : ""}`)
  for (const v of yli.slice(0, 10)) console.log(`     ${v.vali.toFixed(1)} vrk  ${v.nimi}`)
  console.log(`  hitain alle ikkunan: ${valit.find((v) => v.vali <= IKKUNA_VRK)?.vali.toFixed(1)} vrk`)
}
main().catch(e => { console.error(e); process.exit(1) })
