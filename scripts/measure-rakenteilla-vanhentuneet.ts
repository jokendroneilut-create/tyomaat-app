import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * RAKENTEILLA OLEVAT: ONKO JOKU JO VALMISTUNUT?
 *
 * Herate 1.10.2026: Hyvinkaa Areena naytti suunnitteluvaiheessa, vaikka
 * SRV:n tiedote kertoi rakentamisen alkaneen 15 kk aiemmin (D-219).
 * Sama voi tapahtua toiseen suuntaan: hanke on valmistunut eika kukaan
 * kerro sita meille.
 *
 * Automaattinen siirto (`evaluateAutoComplete`) hoitaa osan, mutta se
 * vaatii arvioidun valmistumispaivan JA ettei lahde ole nahnyt hanketta
 * sen jalkeen. Tama mittaa mita se jattaa jalkeensa.
 *
 *   npx tsx scripts/measure-rakenteilla-vanhentuneet.ts
 */

const RAKENTEILLA = /rakenteilla|rakentaminen aloitettu|sopimus myonnetty|sopimus myönnetty|valmistumassa/i
const VALMIS_SANAT =
  /valmistui|valmistunut|otettiin kayttoon|otettiin käyttöön|vihittiin|avattiin|luovutettiin|luovutus|harjannostajai/i

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { evaluateAutoComplete } = await import("../lib/projects/autoCompleteGate")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const pr: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("projects")
      .select("id, name, city, phase, status, is_public, created_at, construction_start, estimated_completion, metadata")
      .eq("status", "active")
      .order("id")
      .range(from, from + 999)
    if (error) throw error
    pr.push(...(data ?? [])); if (!data || data.length < 1000) break
  }

  const kohteet = pr.filter((p) => p.is_public && RAKENTEILLA.test(String(p.phase)))
  console.log(`julkisia aktiivisia ${pr.filter((p) => p.is_public).length}, rakenteilla-vaiheissa ${kohteet.length}\n`)

  const nyt = new Date()
  const ilmanPaivaa = kohteet.filter((p) => !p.estimated_completion)
  const mennyt = kohteet.filter(
    (p) => p.estimated_completion && String(p.estimated_completion).slice(0, 10) < nyt.toISOString().slice(0, 10)
  )

  console.log(`ilman arvioitua valmistumispaivaa: ${ilmanPaivaa.length}  (automatiikka ei voi koskaan siirtaa)`)
  console.log(`valmistumispaiva jo mennyt:        ${mennyt.length}`)

  const verdikti = new Map<string, number>()
  for (const p of mennyt) {
    const v = evaluateAutoComplete({
      estimatedCompletion: p.estimated_completion,
      createdAt: p.created_at,
      lastSeenAt: p.metadata?.last_seen_at ?? null,
      phase: p.phase,
      now: nyt,
    })
    verdikti.set(v, (verdikti.get(v) ?? 0) + 1)
  }
  console.log("  niista automatiikan verdikti:", [...verdikti].map(([k, v]) => `${k} ${v}`).join(", "))

  /* Vanhimmat: kuinka kauan paiva on ollut ohi. */
  const ika = (p: any) =>
    Math.floor((nyt.getTime() - new Date(String(p.estimated_completion).slice(0, 10)).getTime()) / 86_400_000)
  console.log("\n12 pisimpaan yliaikaista:")
  for (const p of mennyt.sort((a, b) => ika(b) - ika(a)).slice(0, 12)) {
    console.log(`  ${String(ika(p)).padStart(4)} vrk  ${String(p.city ?? "-").padEnd(13)} ${String(p.name).replace(/\u200b/g, "").slice(0, 52)}`)
  }

  /* Loytyyko kannasta dokumentti joka kertoo valmistumisesta? */
  console.log("\n=== valmistumissanat omissa dokumenteissa ===")
  const docs: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("source_documents")
      .select("title, created_at")
      .gte("created_at", "2026-01-01")
      .order("id")
      .range(from, from + 999)
    if (error) throw error
    docs.push(...(data ?? [])); if (!data || data.length < 1000) break
  }
  const valmiit = docs.filter((d) => VALMIS_SANAT.test(String(d.title)))
  console.log(`dokumentteja 2026 alkaen ${docs.length}, otsikossa valmistumissana ${valmiit.length}`)
  for (const d of valmiit.slice(0, 10)) console.log(`  ${String(d.created_at).slice(0,10)}  ${String(d.title).slice(0, 72)}`)
}
main().catch((e) => { console.error(e); process.exit(1) })
