import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); const q = v.slice(0,1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1,-1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}
/*
 * TODISTAA ETTEI KATSELMOINTIJONOSTA KATOA RIVEJA (D-358).
 *
 * Ajaa saman jarjestyksen ja range-silmukan kuin
 * `app/tic/services/getDuplicateCandidates.ts`, mutta KAIKKIEN tilojen yli
 * ja pienilla sivukooilla, jotta silmukka oikeasti kiertaa. Odottavia on
 * yleensa alle sata, joten pelkka jono ei testaisi sivutusta lainkaan.
 *
 * Lopuksi sama haku ILMAN ratkaisijaa, koska se on se mika rikkoi:
 * pelkka `confidence desc` ei maaraa jarjestysta kun kymmenilla rivilla
 * on sama luku, jolloin sama rivi tulee kahdesti ja toinen jaa pois.
 * Mitattu 29.10.2026: 44 riviä 343:sta katosi sivukoolla 25.
 *
 *   npx tsx scripts/tarkista-duplikaattijonon-sivutus.ts
 */
async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const { count } = await db.from("project_duplicate_candidates").select("id", { count: "exact", head: true })
  console.log(`Rivit kannassa (kaikki tilat): ${count}`)

  for (const SIVU of [25, 100, 1000]) {
    const idt: string[] = []
    for (let alku = 0; ; alku += SIVU) {
      const { data, error } = await db
        .from("project_duplicate_candidates")
        .select("id, confidence, created_at")
        .order("confidence", { ascending: false })
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(alku, alku + SIVU - 1)
      if (error) throw error
      const sivu = data ?? []
      idt.push(...sivu.map((r: any) => r.id))
      if (sivu.length < SIVU) break
    }
    const uniikit = new Set(idt)
    const ok = idt.length === count && uniikit.size === idt.length
    console.log(`  sivukoko ${String(SIVU).padStart(4)}: ${idt.length} rivia, uniikkeja ${uniikit.size} -> ${ok ? "OK" : "VIRHE"}`)
  }

  /* Sama ilman ratkaisijaa: nahdaan miksi tiebreak tarvitaan. */
  const idt: string[] = []
  for (let alku = 0; ; alku += 25) {
    const { data } = await db.from("project_duplicate_candidates")
      .select("id").order("confidence", { ascending: false }).range(alku, alku + 24)
    const sivu = data ?? []
    idt.push(...sivu.map((r: any) => r.id))
    if (sivu.length < 25) break
  }
  const u = new Set(idt)
  console.log(`\nIlman ratkaisijaa (vain confidence desc), sivukoko 25:`)
  console.log(`  ${idt.length} rivia, uniikkeja ${u.size} -> ${u.size === count ? "sattui osumaan" : `KATOSI ${(count ?? 0) - u.size} rivia`}`)
}
main().catch((e) => { console.error(e); process.exit(1) })
