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
 * PIILOTETUN RIVIN TIEDOT NAKYVIIN (D-307).
 *
 * Johannes 18.10.2026: *"haluan etta kayttajalle on nakyvissa kaikki
 * mahdollinen tieto mita meilla on."*
 *
 * Yhdistaminen piilottaa haviajan mutta ei siirra sen kenttia, joten
 * tieto jai kantaan nakymattomiin. Mitattu: **71 / 150** vahvistetusta
 * parista jatti jotain piilotetulle riville.
 *
 * TAYTETAAN VAIN TYHJA KENTTA. Olemassa olevaa arvoa ei korvata eika
 * taydenneta: se voi olla ihmisen kasin korjaama, eika lahteesta
 * puuttuva tarkoita etta kasin annettu olisi vaarin.
 *
 * OSAPUOLTEN YHDISTAMINEN KOKEILTIIN JA HYLATTIIN. Ensimmainen versio
 * yhdisti osapuolikentat `mergeCompanyNames`-apurilla. Kuivaharjoitus
 * luettuna se olisi HUONONTANUT kenttia, koska apurin tunniste ei
 * normalisoi yhtiomuotoa eika valiviivaa:
 *
 *     "Skanska Oy"           -> "Skanska Oy, Skanska"
 *     "Kreate Oy"            -> "Kreate Oy, Kreate"
 *     "Peab Oy (1509374-8)"  -> "Peab Oy (1509374-8), Peab"
 *     "Senaatti-kiinteistot" -> "Senaatti-kiinteistot, Muu"
 *     "GRK, NRC Group"       -> "GRK, NRC Group, GRK"
 *
 * Sama yritys olisi tullut toiseen kertaan eri kirjoitusasulla, ja
 * "Muu" on roska-arvo. Kirjoitusasujen yhdistaminen on oma tyonsa
 * (docs/20), eika sita ratkaista tassa.
 *
 * VALMISTUMISPAIVA JATETAAN JOS SE ON MENNYT. Mennyt paiva syottaa
 * `autoCompleteGate`:a, joka 90 vrk:n jalkeen piilottaa hankkeen
 * asiakkaalta (D-298, D-303) -- eli "lisaa tietoa" muuttuisi
 * piilotukseksi.
 *
 *   npx tsx scripts/taydenna-yhdistetyt-kentat.ts
 *   npx tsx scripts/taydenna-yhdistetyt-kentat.ts --apply
 */

const OSAPUOLIKENTAT = [
  "developer",
  "builder",
  "contractor",
  "earthworks_contractor",
  "structural_design",
  "hvac_design",
  "electrical_design",
  "architectural_design",
  "geotechnical_design",
] as const

const MUUT_KENTAT = [
  "location",
  "lat",
  "lng",
  "apartments",
  "floor_area",
  "estimated_cost",
  "start_date",
  "construction_start",
  "estimated_completion",
  "property_type",
  "additional_info",
] as const

const KAIKKI = [...OSAPUOLIKENTAT, ...MUUT_KENTAT]

const tyhja = (v: unknown) =>
  v === null ||
  v === undefined ||
  (typeof v === "string" && (!v.trim() || v.trim() === "-"))

/* Roska-arvot joita ei kannata siirtaa nakyviin (docs/20). */
const ROSKA = /^(?:muu|ei tiedossa|tuntematon|n\/a|-)$/i

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const parit: any[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error } = await db
      .from("project_duplicate_candidates")
      .select("project_id_a, project_id_b")
      .eq("status", "confirmed_duplicate")
      .range(a, a + 999)
    if (error) {
      console.error("VIRHE parit:", error.message)
      process.exit(1)
    }
    parit.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }

  const idt = [...new Set(parit.flatMap((p) => [String(p.project_id_a), String(p.project_id_b)]))]
  const hankkeet = new Map<string, any>()
  for (let i = 0; i < idt.length; i += 100) {
    const { data, error } = await db
      .from("projects")
      .select(`id, name, is_public, ${KAIKKI.join(", ")}`)
      .in("id", idt.slice(i, i + 100))
    if (error) {
      console.error("VIRHE hankkeet:", error.message)
      process.exit(1)
    }
    for (const p of data ?? []) hankkeet.set(String((p as any).id), p)
  }

  const tanaan = new Date().toISOString().slice(0, 10)
  type Muutos = { id: string; nimi: string; paivitys: Record<string, unknown>; selite: string[] }
  const muutokset: Muutos[] = []
  const ohitetutPaivat: string[] = []

  for (const pari of parit) {
    const a = hankkeet.get(String(pari.project_id_a))
    const b = hankkeet.get(String(pari.project_id_b))
    if (!a || !b) continue
    const jaava = a.is_public ? a : b.is_public ? b : null
    const piilotettu = a.is_public ? b : b.is_public ? a : null
    if (!jaava || !piilotettu || jaava.id === piilotettu.id) continue

    const paivitys: Record<string, unknown> = {}
    const selite: string[] = []

    for (const k of KAIKKI) {
      if (!tyhja(jaava[k]) || tyhja(piilotettu[k])) continue
      if (ROSKA.test(String(piilotettu[k]).trim())) continue
      if (k === "estimated_completion" && String(piilotettu[k]).slice(0, 10) < tanaan) {
        ohitetutPaivat.push(`${String(jaava.name).slice(0, 44)} (${piilotettu[k]})`)
        continue
      }
      paivitys[k] = piilotettu[k]
      selite.push(`${k}: tyhja -> ${String(piilotettu[k]).slice(0, 60)}`)
    }

    if (Object.keys(paivitys).length) {
      muutokset.push({ id: String(jaava.id), nimi: String(jaava.name), paivitys, selite })
    }
  }

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")
  console.log(`vahvistettuja pareja ${parit.length}, taydennettavia voittajia ${muutokset.length}\n`)

  const kentittain = new Map<string, number>()
  for (const m of muutokset) {
    for (const k of Object.keys(m.paivitys)) kentittain.set(k, (kentittain.get(k) ?? 0) + 1)
  }
  console.log("kentittain:")
  for (const [k, n] of [...kentittain].sort((x, y) => y[1] - x[1])) {
    console.log(`  ${k.padEnd(24)} ${n}`)
  }

  if (ohitetutPaivat.length) {
    console.log(`\nOHITETTU mennyt valmistumispaiva (${ohitetutPaivat.length}):`)
    for (const o of ohitetutPaivat) console.log(`  ${o}`)
  }

  console.log(`\n--- rivikohtaisesti ---`)
  for (const m of muutokset) {
    console.log(`\n${m.nimi.slice(0, 60)}`)
    for (const s of m.selite) console.log(`   ${s.slice(0, 150)}`)
  }

  if (!apply) {
    console.log("\nEi kirjoitettu. Aja --apply kun rivit on luettu.")
    return
  }

  let tehty = 0
  for (const m of muutokset) {
    const { error } = await db.from("projects").update(m.paivitys).eq("id", m.id)
    if (error) {
      console.error(`VIRHE ${m.id}: ${error.message}`)
      continue
    }
    tehty++
  }
  console.log(`\nTAYDENNETTY ${tehty} hanketta.`)
}
main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
