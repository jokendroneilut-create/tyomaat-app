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
 * GTK MINTECIN KOETEHDAS: SENAATIN SIVUN TIEDOT SAILYVALLE RIVILLE (D-354).
 *
 * Yhdistaminen on tehty ([[rakennuslehti-is-secondary]]: alkuperaislahteen
 * rivi jai, Rakennuslehden piilotettiin). Nyt kirjoitetaan ne tiedot
 * jotka odottivat sita, ettei niita kirjoiteta kahteen riviin.
 *
 * KAIKKI ARVOT OVAT SENAATIN HANKESIVULTA, ei paateltyja:
 *   "Kustannukset Noin 23 milj. euroa"
 *   "Hankkeen aikataulu 8/2026 - 2028 Rakennustyot kaynnissa"
 *   "6/2028 Vaihe 1 kayttoonotto   1/2029 Vaihe 2 kayttoonotto"
 *   "Rakennuttajakonsultti: A-insinoorit Rakennuttaminen Oy"
 *   "Paa- ja arkkitehtisuunnittelu: Uki Arkkitehdit Oy"
 *   "Rakennesuunnittelu / LVIA / Sahko: Ramboll Finland Oy"
 *
 * VAIHE ON LUETTU, EI JOHDETTU. Sivu sanoo "Rakennustyot kaynnissa",
 * joten Rakenteilla tulee lahteesta eika aloituspaivasta
 * ([[start-date-open-items]]).
 *
 * VALMISTUMINEN 1/2029 eli vaihe 2, koska kyse on yhdesta
 * rakennuksesta joka otetaan kayttoon kahdessa erassa -- ei kahdesta
 * urakasta ([[phases-are-separate-projects]] koskee eri hankkeita).
 *
 *   npx tsx scripts/taydenna-gtk-mintec.ts
 *   npx tsx scripts/taydenna-gtk-mintec.ts --apply
 */

import { mergeCompanyNames } from "../lib/projects/projectCompanies"

const RIVI = "fe8c9611-cc80-400f-881e-cd8a75f7967a"
const SIVU = "https://www.senaatti.fi/hankkeet/gtk-mintec-geologian-tutkimuskeskus/"

const ARVOT = {
  phase: "Rakenteilla",
  construction_start: "2026-08-01",
  estimated_completion: "2029-01-31",
  estimated_cost: 23_000_000,
  architectural_design: "Uki Arkkitehdit Oy",
  structural_design: "Ramboll Finland Oy",
  hvac_design: "Ramboll Finland Oy",
  electrical_design: "Ramboll Finland Oy",
}

/*
 * VAIN SE JOLLA EI OLE ROOLISARAKETTA. Uki ja Ramboll menevat
 * suunnittelukenttiin, joten niita EI toisteta liittyvissa yrityksissa
 * ([[party-role-fields]]). Rakennuttajakonsultilla ei ole saraketta,
 * joten se on ainoa joka jaa tanne.
 */
const LIITTYVAT = ["A-insinöörit Rakennuttaminen Oy"]

/* Yhdistamisessa tullut lyhyempi kirjoitusasu pois, kun rooli on nyt kentassa. */
const ROOLIIN_SIIRTYNEET = /^(uki\s+arkkitehdit|ramboll)/i

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  const { data, error } = await db.from("projects").select("*").eq("id", RIVI).single()
  if (error) {
    console.error(`VIRHE: ${error.message}`)
    process.exit(1)
  }

  console.log(`\n${data.name} (${data.city})`)
  const muutokset: Record<string, any> = {}
  for (const [kentta, arvo] of Object.entries(ARVOT)) {
    const nyt = (data as any)[kentta]
    if (String(nyt ?? "") === String(arvo)) continue
    muutokset[kentta] = arvo
    console.log(`   ${kentta.padEnd(22)} ${String(nyt ?? "tyhjä").slice(0, 24).padEnd(26)} -> ${arvo}`)
  }

  const md: Record<string, any> = { ...(data.metadata ?? {}) }
  const vanhat = (Array.isArray(md.related_companies) ? md.related_companies : []).filter(
    (n: string) => !ROOLIIN_SIIRTYNEET.test(String(n))
  )
  const liittyvat = mergeCompanyNames(vanhat, LIITTYVAT)
  console.log(`   liittyvät yritykset: ${JSON.stringify(liittyvat)}`)
  console.log(`   yhteyshenkilöt: ${(md.contact_persons ?? []).length} (säilyvät)`)

  if (!apply) {
    console.log("\nEi kirjoitettu. Aja --apply kun rivit on luettu.")
    return
  }

  md.related_companies = liittyvat
  md.rakennuttajakonsultti = "A-insinöörit Rakennuttaminen Oy"
  md.field_sources = { ...(md.field_sources ?? {}), senaatti_hankesivu: SIVU, luettu: "2026-10-26" }

  const { error: e } = await db
    .from("projects")
    .update({ ...muutokset, metadata: md })
    .eq("id", RIVI)
  if (e) console.error(`VIRHE: ${e.message}`)
  else console.log(`\nKirjoitettu ${Object.keys(muutokset).length} kenttää.`)
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
