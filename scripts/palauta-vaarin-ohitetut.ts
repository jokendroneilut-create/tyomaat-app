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
 * VAARIN OHITETUT JONORIVIT TAKAISIN (D-359).
 *
 * `valmistunut_menneisyydessa` luki vain kuvaustekstia, joten rivi
 * saattoi olla ohitettu "valmistunut 2022" -perusteella vaikka lahteen
 * oma rakenteinen valmistumispaiva on 2028. Saanto on korjattu
 * (`resolvePotentialProject`), mutta jo kirjoitettu tila ei korjaannu
 * itsestaan -- ohitus on kannassa.
 *
 * Luettu 29.10.2026: kahdeksan rivia, joista seitseman on `ignored`
 * ja yksi jo hyvaksytty kasin. Jokainen luettiin lahteen tekstista
 * ennen palautusta, eika yksikaan ollut valmis hanke.
 *
 * Palautetut rivit saavat tunnisteen `palautettu_2026_10_29`, jotta
 * myohempi ajo nakee etta juuri tama korjaus kosketti niita
 * ([[backfill-marker]]).
 *
 *   npx tsx scripts/palauta-vaarin-ohitetut.ts
 *   npx tsx scripts/palauta-vaarin-ohitetut.ts --apply
 */
const APPLY = process.argv.includes("--apply")

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const rivit: any[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error } = await db
      .from("potential_projects")
      .select("id,title,status,metadata")
      .range(a, a + 999)
    if (error) throw error
    rivit.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }

  const tanaan = new Date().toISOString().slice(0, 10)
  const kohteet = rivit.filter((r) => {
    const syy = String(r.metadata?.auto_ignored_reason ?? "")
    if (!syy.startsWith("valmistunut_menneisyydessa")) return false
    const oma = String(r.metadata?.estimated_completion ?? "").trim()
    return Boolean(oma) && oma > tanaan
  })

  console.log(`Ristiriitaisia rivejä: ${kohteet.length}\n`)
  let muutettavia = 0
  for (const r of kohteet) {
    const tila = String(r.status)
    const palautetaan = tila === "ignored"
    if (palautetaan) muutettavia++
    console.log(`${palautetaan ? "PALAUTETAAN" : "EI KOSKETA  "} [${tila}] ${String(r.title).slice(0, 56)}`)
    console.log(`   lahde ${r.metadata?.source_name ?? "-"} | ${r.metadata?.auto_ignored_reason} | oma paiva ${r.metadata?.estimated_completion}`)
  }

  if (!APPLY) {
    console.log(`\nKuivaharjoitus: palautettaisiin ${muutettavia} rivia. Aja --apply kun rivit on luettu.`)
    return
  }

  let tehty = 0
  for (const r of kohteet) {
    if (String(r.status) !== "ignored") continue
    const md = { ...(r.metadata ?? {}) }
    md.palautettu_2026_10_29 = {
      aiempi_syy: md.auto_ignored_reason ?? null,
      peruste: "lahteen oma valmistumispaiva on tulevaisuudessa (D-359)",
    }
    delete md.auto_ignored_reason
    if (md.recommended_action === "ignore") delete md.recommended_action

    const { error } = await db
      .from("potential_projects")
      .update({ status: "new", metadata: md })
      .eq("id", r.id)
    if (error) {
      console.error(`VIRHE ${r.id}: ${error.message}`)
      continue
    }
    tehty++
  }
  console.log(`\n=== AJETTU: ${tehty} riviä palautettu jonoon ===`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
