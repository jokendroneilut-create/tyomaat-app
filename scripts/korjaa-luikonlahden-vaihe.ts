import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * LUIKONLAHDEN VAIHE: SOPIMUS MYONNETTY -> RAKENTEILLA.
 *
 * Johannes 19.10.2026 rivista `a0f5499e`: *"tasta pitaisi poimia
 * valmistumisaika 9/2026 koska tama voi olla valmis. on siis
 * rakenteilla tai valmis."*
 *
 * Valmistumisaika oli jo poimittu (`estimated_completion` 2026-09-30,
 * nakyy TIC:ssa), joten poimittavaa ei ollut -- vaihe oli jaljessa.
 * Lahde (Oteranin "Laskentakauden kuulumisia", 21.4.2026) sanoo:
 * "Hanke urakoidaan ajanjaksolla 04-09/2026", ja rivi tuotiin
 * 19.10.2026 eli urakka-ajan jalkeen. "Sopimus myonnetty" on siis
 * vaara: tyot ovat vahintaan kaynnissa.
 *
 * MIKSI RAKENTEILLA EIKA VALMISTUNUT. Ainoa todiste on huhtikuussa
 * kirjoitettu SUUNNITELTU aikataulu. Oteranin syotteen 100 juttua
 * kaytiin lapi: Luikonlahti mainitaan vain tassa yhdessa jutussa,
 * eika mikaan kerro luovutuksesta. "Valmistunut" veisi hankkeen
 * piiloon 90 vrk valmistumispaivasta (29.12.2026), ja muisti
 * `hiding-threshold` sanoo: piilottamiseen vaaditaan ENEMMAN
 * todistetta kuin nayttamiseen. Infrassa aikataulu venyy usein.
 * `scripts/tarkista-rakenteilla.ts` tekee saman rajauksen (PORTTI 1):
 * loytohetkea vanhempi paiva ei ole todiste valmistumisesta.
 *
 *   npx tsx scripts/korjaa-luikonlahden-vaihe.ts
 *   npx tsx scripts/korjaa-luikonlahden-vaihe.ts --apply
 */

const RIVI = "a0f5499e-161b-477e-837a-0f7502c722a7"

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  const { data, error } = await db
    .from("potential_projects")
    .select("id, title, status, metadata")
    .eq("id", RIVI)
    .maybeSingle()
  if (error || !data) {
    console.error(`VIRHE: riviä ei loytynyt (${error?.message ?? "ei rivia"})`)
    process.exit(1)
  }
  const r: any = data
  const md: Record<string, any> = { ...(r.metadata ?? {}) }

  console.log(`\n${r.title} [${r.status}]`)
  console.log(`   phase_hint            ${md.phase_hint} -> Rakenteilla`)
  console.log(`   estimated_completion  ${md.estimated_completion} (ennallaan, lahde: "ajanjaksolla 04-09/2026")`)
  console.log(`   construction_start    ${md.construction_start ?? "-"} -> 2026-04-01 (saman lauseen alkukuukausi)`)
  console.log(`   date_published        ${md.date_published ?? "-"} -> 2026-04-21 (RSS:n pubDate)`)

  if (!apply) {
    console.log("\nEi kirjoitettu. Aja --apply kun rivit on luettu.")
    return
  }

  md.phase_hint = "Rakenteilla"
  if (!md.construction_start) md.construction_start = "2026-04-01"
  if (!md.date_published) md.date_published = "2026-04-21"

  const { error: e1 } = await db.from("potential_projects").update({ metadata: md }).eq("id", RIVI)
  if (e1) {
    console.error(`VIRHE: ${e1.message}`)
    process.exit(1)
  }
  console.log(`\n   kirjoitettu`)
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
