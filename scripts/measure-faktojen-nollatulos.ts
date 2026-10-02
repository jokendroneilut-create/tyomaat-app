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
 * DOKUMENTIT JOISTA EI SYNTYNYT EHDOKASTA.
 *
 * ENSIMMAINEN VERSIO MITTASI VAARAA ASIAA. Se laski dokumentit joilla
 * ei ole `project_facts`-rivia, ja sai 33,6 % seka kokonaisia lahteita
 * 100 %:n "vuotoon". Luku oli merkityksetön: yritystiedotteet kulkevat
 * `legacyCompanyResolver`-polkua, joka luo ehdokkaan KIRJOITTAMATTA
 * faktoja. Nollatulos oli siis normaali tila, ei vika.
 *
 * Oikea testi on: syntyiko dokumentista ehdokas tai hanke.
 *
 * Herate 2.10.2026: Asuntosaation Martensbron kohteesta oli kaksi
 * tiedotetta (SRV 13.3.2025 ja STT 30.9.2026), molemmista oli ajettu
 * faktojen poiminta, eika kumpikaan tuottanut yhtaan `project_facts`-
 * rivia — joten ehdokasta ei koskaan syntynyt. Hanke ei ole jonossa,
 * ei hylattyna eika hyvaksyttyna. Se ei ole missaan.
 *
 * `facts_extracted_at` kertoo ETTA poiminta ajettiin, ei etta se
 * onnistui. Nollatulos nayttaa siis identtiselta onnistuneen kanssa.
 * Tama mittaa kuinka suuri joukko se on ja mista lahteista.
 *
 *   npx tsx scripts/measure-faktojen-nollatulos.ts
 */

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  /* Dokumentit joille poiminta on ajettu. */
  const dox: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("source_documents")
      .select("id, title, source_name, created_at, facts_extracted_at, document_url")
      .not("facts_extracted_at", "is", null)
      .order("id")
      .range(from, from + 999)
    if (error) throw error
    dox.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  /*
   * Osoitteet joista on syntynyt ehdokas tai hanke. Molemmat luetaan,
   * koska hyvaksytty ehdokas voi olla jo siirretty projects-tauluun.
   */
  const kaytetyt = new Set<string>()
  for (const taulu of ["potential_projects", "projects"]) {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from(taulu).select("metadata").order("id").range(from, from + 999)
      if (error) throw error
      for (const r of data ?? []) {
        const u = (r as any)?.metadata?.source_url
        if (u) kaytetyt.add(String(u))
      }
      if (!data || data.length < 1000) break
    }
  }

  const nolla = dox.filter((d) => !kaytetyt.has(String(d.document_url)))

  console.log(`poiminta ajettu ${dox.length} dokumentille`)
  console.log(`ehdokas syntyi    ${dox.length - nolla.length}`)
  console.log(`EI EHDOKASTA      ${nolla.length}  (${((nolla.length / dox.length) * 100).toFixed(1)} %)\n`)

  /* Lahteittain: onko vika yhdessa lahteessa vai kaikkialla? */
  const per = new Map<string, { kaikki: number; nolla: number }>()
  for (const d of dox) {
    const k = String(d.source_name ?? "-")
    const o = per.get(k) ?? { kaikki: 0, nolla: 0 }
    o.kaikki++
    if (!kaytetyt.has(String(d.document_url))) o.nolla++
    per.set(k, o)
  }

  console.log("=== LAHTEITTAIN (yli 20 dokumenttia, nollatuloksen mukaan) ===")
  const rivit = [...per]
    .filter(([, o]) => o.kaikki >= 20)
    .sort((a, b) => b[1].nolla / b[1].kaikki - a[1].nolla / a[1].kaikki)
  for (const [nimi, o] of rivit.slice(0, 20)) {
    const osuus = ((o.nolla / o.kaikki) * 100).toFixed(0)
    console.log(`  ${String(osuus).padStart(3)} %  ${String(o.nolla).padStart(4)}/${String(o.kaikki).padEnd(5)} ${nimi.slice(0, 44)}`)
  }

  /* Ajassa: onko tama aina ollut nain vai alkanut jostain? */
  console.log("\n=== KUUKAUSITTAIN ===")
  const kk = new Map<string, { kaikki: number; nolla: number }>()
  for (const d of dox) {
    const k = String(d.created_at).slice(0, 7)
    const o = kk.get(k) ?? { kaikki: 0, nolla: 0 }
    o.kaikki++
    if (!kaytetyt.has(String(d.document_url))) o.nolla++
    kk.set(k, o)
  }
  for (const [k, o] of [...kk].sort()) {
    console.log(`  ${k}  ${String(o.nolla).padStart(4)}/${String(o.kaikki).padEnd(5)} nollatulosta (${((o.nolla / o.kaikki) * 100).toFixed(0)} %)`)
  }

  console.log("\n=== OTOS NOLLATULOKSISTA (uusimmat) ===")
  for (const d of nolla.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 15)) {
    console.log(`  ${String(d.created_at).slice(0, 10)}  ${String(d.source_name ?? "-").slice(0, 26).padEnd(26)} ${String(d.title).slice(0, 62)}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
