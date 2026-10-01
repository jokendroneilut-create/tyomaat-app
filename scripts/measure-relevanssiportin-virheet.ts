import { readFileSync } from "node:fs"

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * RELEVANSSIPORTIN VIRHEET: MIKA OIKEASTI KAATUU?
 *
 * TIC:n AI-suodatus-sivu nayttaa "Malli ei vastannut 5" ja vihjaa
 * API-varojen loppumiseen. Varat eivat ole loppu (15,03 $ jaljella,
 * kuukauden kaytto 0,23 $), joten vihje on vaara ja syy muualla.
 *
 *   npx tsx scripts/measure-relevanssiportin-virheet.ts
 */

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const rivit: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("llm_relevance_log")
      .select("*")
      .order("created_at", { ascending: false })
      .range(from, from + 999)
    if (error) throw error
    rivit.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  console.log(`llm_relevance_log rivia yhteensa ${rivit.length}`)
  if (!rivit.length) return
  console.log(`kentat: ${Object.keys(rivit[0]).join(", ")}\n`)

  const tila = new Map<string, number>()
  for (const r of rivit) tila.set(String(r.final_status), (tila.get(String(r.final_status)) ?? 0) + 1)
  console.log("final_status:", [...tila].map(([k, v]) => `${k} ${v}`).join(", "))

  const virheet = rivit.filter((r) => String(r.final_status) === "llm_error")
  console.log(`\n=== VIRHEET: ${virheet.length} / ${rivit.length} (${((virheet.length / rivit.length) * 100).toFixed(1)} %) ===\n`)

  for (const r of virheet) {
    console.log(`${String(r.created_at).slice(0, 19).replace("T", " ")}  ${String(r.source_name ?? "-").padEnd(22)} ${String(r.llm_reason ?? "-").slice(0, 90)}`)
    console.log(`    ${String(r.title ?? "-").slice(0, 100)}`)
  }

  /* Virheet paivittain: onko kyse katkoksesta vai tasaisesta kohinasta? */
  console.log("\n=== PAIVITTAIN (vain paivat joilla kutsuja) ===")
  const paivat = new Map<string, { kaikki: number; virheet: number }>()
  for (const r of rivit) {
    const p = String(r.created_at).slice(0, 10)
    const o = paivat.get(p) ?? { kaikki: 0, virheet: 0 }
    o.kaikki++
    if (String(r.final_status) === "llm_error") o.virheet++
    paivat.set(p, o)
  }
  for (const [p, o] of [...paivat].sort().reverse().slice(0, 25)) {
    const merkki = o.virheet ? ` <-- ${o.virheet} virhetta` : ""
    console.log(`  ${p}  kutsuja ${String(o.kaikki).padStart(4)}${merkki}`)
  }

  /* Vastausajoista ei ole lokia - mitataan onko hitaus otsikon pituudessa. */
  console.log("\n=== VIRHEIDEN SYOTE vs. ONNISTUNEET ===")
  const pituus = (r: any) => String(r.title ?? "").length + String(r.description ?? "").length
  const ka = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0)
  const virhePit = virheet.map(pituus)
  const okPit = rivit.filter((r) => String(r.final_status) !== "llm_error").map(pituus)
  console.log(`  syotteen pituus: virheissa ka ${ka(virhePit)} (max ${Math.max(0, ...virhePit)}), onnistuneissa ka ${ka(okPit)} (max ${Math.max(0, ...okPit)})`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
