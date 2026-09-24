import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * TAATUT PAIKAT SINNE MISSA SISALTO LIIKKUU (D-210).
 *
 * `discovery_sources.priority > 10` varaa lahteelle kiinteän paikan
 * JOKA ajossa, eli 4 kertaa vuorokaudessa (ks. cronConfig.ts). Paikkoja
 * on 20 per ajo, joten jokainen taattu lyhentaa perustason kiertoa.
 *
 * Mitattu 24.9.2026, 30 vrk:
 *
 *   lahde                    ajoja   ehdokkaita   s/ajo
 *   Hilma                      124          417     2,6
 *   9 opiskelija-asuntosaatiota 942           32   2-19
 *   STT-tiedotteet               5           17    78,6
 *
 * Saatiot lisattiin 29.8. ja niille jai taattu paikka. D-136 arvioi koko
 * joukon tuotoksi ~10 ERI HANKETTA VUODESSA - ne julkaisevat muutaman
 * tiedotteen kuukaudessa, joten 4 ajoa vuorokaudessa on kertaluokkia
 * liikaa. Samaan aikaan STT (919 ehdokasta, 93 %:lla yhteyshenkilo) sai
 * vuoron 4-9 vrk valein ja 96 kandidaattia jai tuomatta.
 *
 * Perustason kierto: 311 lahdetta / (20-10 paikkaa x 4 ajoa) = 7,8 vrk.
 * Taman jalkeen 319 / (20-2) x 4 = 4,4 vrk - eli sama luku jonka
 * cronConfig.ts on koko ajan luvannut.
 *
 * Aikabudjetti sailyy: saatiot veivat 75,8 s per kierros (4 kierrosta =
 * 303 s/vrk), STT vie 59-90 s per ajo (4 ajoa = 236-360 s/vrk).
 *
 *   npx tsx scripts/fix-lahteiden-prioriteetit.ts            (kuivaharjoitus)
 *   npx tsx scripts/fix-lahteiden-prioriteetit.ts --apply
 */
const APPLY = process.argv.includes("--apply")

/* Taattu paikka pois: tiedotetahti on kuukausia, ei tunteja. */
const PERUSTASOLLE = [
  "AYY Asunnot tiedotteet",
  "Hoas tiedotteet",
  "KOAS tiedotteet",
  "Lahden Talot tiedotteet",
  "POAS tiedotteet",
  "PSOAS tiedotteet",
  "Savonlinnan Asuntopalvelu tiedotteet",
  "Sevas tiedotteet",
  "TYS tiedotteet",
]

/* Taattu paikka: uutislahde jonka sisalto vanhenee vuorokaudessa. */
const TAATUKSI = ["STT-tiedotteet (rakentaminen)"]

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const { data: lahteet, error } = await db
    .from("discovery_sources")
    .select("id, name, priority, enabled")
    .in("name", [...PERUSTASOLLE, ...TAATUKSI])
  if (error) throw error

  const muutokset: { id: string; name: string; vanha: number; uusi: number }[] = []
  for (const s of lahteet ?? []) {
    const uusi = TAATUKSI.includes(s.name) ? 20 : 10
    if (s.priority !== uusi) muutokset.push({ id: s.id, name: s.name, vanha: s.priority, uusi })
  }

  for (const nimi of [...PERUSTASOLLE, ...TAATUKSI]) {
    if (!(lahteet ?? []).some((s) => s.name === nimi)) console.log(`EI LOYDY: ${nimi}`)
  }

  for (const m of muutokset) console.log(`${String(m.vanha).padStart(3)} -> ${String(m.uusi).padStart(3)}  ${m.name}`)

  if (APPLY) {
    for (const m of muutokset) {
      const { error: e } = await db.from("discovery_sources").update({ priority: m.uusi }).eq("id", m.id)
      if (e) throw e
    }
  }

  const { data: taatut } = await db.from("discovery_sources").select("name, priority").gt("priority", 10).eq("enabled", true)
  console.log(`\n=== ${APPLY ? "AJETTU" : "KUIVAHARJOITUS"}: ${muutokset.length} muutosta ===`)
  console.log(`taattuja paikkoja ${APPLY ? "nyt" : "ennen muutosta"}: ${taatut?.length ?? 0}`)
  for (const t of taatut ?? []) console.log(`   ${t.priority}  ${t.name}`)
}
main().catch((e) => { console.error(e); process.exit(1) })
