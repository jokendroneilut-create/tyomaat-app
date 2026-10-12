import { readFileSync } from "node:fs"

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .replace(/\r/g, "")
  .split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * NIMITORMAYS: `metadata.laajuus` TARKOITTI JO KERROSALAA (D-274).
 *
 * Kirjoitin tyon lajin kenttaan `laajuus`, mutta sama avain oli jo
 * kaytossa 26 rivilla toisessa merkityksessa: "8 400 brm²", "noin
 * 5 000 kerrosneliometria", "12 100". Sama sana ei saa tarkoittaa
 * kahta asiaa ([[name-the-denominator]]).
 *
 * Tama siirtaa tyon lajin omaan kenttaansa `tyon_laji` ja poistaa sen
 * `laajuus`-avaimesta. Kerrosalaa tarkoittavia rivejä ei kosketa:
 * tunnistus on arvon perusteella, ei rivin.
 *
 * Arvo lasketaan UUDELLEEN korjatulla luokittimella, koska kaksi
 * kuviota oli liian lavea ("korottaminen" osui enimmaishinnan
 * korottamiseen, urakkamuoto "kokonaisurakka" tilamuutoksiin).
 *
 *   npx tsx scripts/siirra-tyon-laji.ts
 *   npx tsx scripts/siirra-tyon-laji.ts --apply
 */

const LAJIT = new Set([
  "uudisrakennus",
  "laajennus",
  "korjaus",
  "osaurakka",
  "purku",
  "kaavoitus",
])

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const { hankkeenLaajuus } = await import("../lib/projects/hankkeenLaajuus")

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const rivit: any[] = []
  for (let f = 0; f < 60000; f += 500) {
    const { data, error } = await db
      .from("projects")
      .select("id, name, metadata")
      .range(f, f + 499)
    if (error) throw error
    if (!data?.length) break
    rivit.push(...data)
    if (data.length < 500) break
  }

  const omatArvot = rivit.filter((r) => LAJIT.has(String((r.metadata ?? {}).laajuus ?? "")))
  const kerrosalat = rivit.filter((r) => {
    const l = String((r.metadata ?? {}).laajuus ?? "")
    return l !== "" && !LAJIT.has(l)
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")
  console.log(`laajuus-avain kaytossa: ${omatArvot.length + kerrosalat.length} rivilla`)
  console.log(`  tyon laji (siirretaan):      ${omatArvot.length}`)
  console.log(`  kerrosala (jatetaan rauhaan): ${kerrosalat.length}`)
  for (const r of kerrosalat.slice(0, 5)) {
    console.log(`      "${(r.metadata ?? {}).laajuus}"  ${String(r.name).slice(0, 48)}`)
  }

  const muutokset = new Map<string, number>()
  let poistuu = 0
  for (const r of omatArvot) {
    const vanha = String((r.metadata ?? {}).laajuus)
    const uusi = hankkeenLaajuus(r.name)
    if (uusi !== vanha) {
      muutokset.set(`${vanha} -> ${uusi ?? "(ei luokkaa)"}`, (muutokset.get(`${vanha} -> ${uusi ?? "(ei luokkaa)"}`) ?? 0) + 1)
      if (!uusi) poistuu += 1
    }
  }
  console.log(`\nkorjatun luokittimen muutokset (${[...muutokset.values()].reduce((a, b) => a + b, 0)} rivia):`)
  for (const [k, n] of [...muutokset.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${k}`)
  }
  console.log(`  luokka poistuu kokonaan: ${poistuu}`)

  if (!apply) {
    console.log("\nEi muutettu mitaan. Aja --apply kun rivit on luettu.")
    return
  }

  let tehty = 0
  for (const r of omatArvot) {
    const md = { ...(r.metadata ?? {}) }
    delete md.laajuus
    const uusi = hankkeenLaajuus(r.name)
    if (uusi) md.tyon_laji = uusi
    else delete md.tyon_laji
    const { error } = await db.from("projects").update({ metadata: md }).eq("id", r.id)
    if (error) console.log(`  VIRHE ${r.id}: ${error.message}`)
    else tehty += 1
  }
  console.log(`\nsiirretty ${tehty} / ${omatArvot.length}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
