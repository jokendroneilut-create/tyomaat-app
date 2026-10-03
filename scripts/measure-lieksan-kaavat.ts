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
 * LIEKSAN KAAVAT: ONKO KUVAUS JA YHTEYSHENKILO?
 *
 * Johannes 3.10.2026 huomasi etta Brahean korttelin 2027
 * asemakaavamuutoksesta puuttuu tiivistelma, joka on lahteen
 * selostus-PDF:ssa. Tama mittaa koskeeko puute kaikkia saman lahteen
 * hankkeita.
 *
 *   npx tsx scripts/measure-lieksan-kaavat.ts
 */

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const { data: dokit, error } = await db
    .from("source_documents")
    .select("id, title, document_url, raw_payload, created_at")
    .eq("source_name", "Lieksan vireillä olevat asemakaavat")
    .order("created_at", { ascending: false })
  if (error) throw error

  console.log(`=== DOKUMENTIT: ${dokit?.length ?? 0} ===\n`)
  let ilmanKuvausta = 0
  let ilmanYhteystietoa = 0

  for (const d of dokit ?? []) {
    const kuvaus = (d.raw_payload as any)?.description ?? null
    const yht = ((d.raw_payload as any)?.contacts ?? []) as unknown[]
    if (!kuvaus) ilmanKuvausta++
    if (!yht.length) ilmanYhteystietoa++
    console.log(
      `  ${String(d.created_at).slice(0, 10)}  kuvaus ${String(kuvaus ? `${String(kuvaus).length} merkkia` : "PUUTTUU").padEnd(14)} yhteys ${String(yht.length || "PUUTTUU").padEnd(8)} ${String(d.title).slice(0, 56)}`
    )
  }

  console.log(`\n  kuvaus puuttuu        ${ilmanKuvausta}/${dokit?.length ?? 0}`)
  console.log(`  yhteyshenkilo puuttuu ${ilmanYhteystietoa}/${dokit?.length ?? 0}`)

  /* Samat hankkeina ja ehdokkaina. */
  const osoitteet = (dokit ?? []).map((d) => String(d.document_url))
  const { data: ehdokkaat } = await db
    .from("potential_projects")
    .select("id, title, status, metadata")
    .in("metadata->>source_url", osoitteet)

  console.log(`\n=== EHDOKKAAT/HANKKEET: ${ehdokkaat?.length ?? 0} ===\n`)
  for (const p of ehdokkaat ?? []) {
    const md = (p.metadata ?? {}) as any
    console.log(
      `  ${String(p.status).padEnd(9)} kuvaus ${String(md.description ? `${String(md.description).length} merkkia` : "PUUTTUU").padEnd(14)} yhteys ${String((md.contact_persons ?? []).length || "PUUTTUU").padEnd(8)} ${String(p.title).slice(0, 50)}`
    )
  }

  /* Onko selostus-PDF ylipaataan saatavilla kullakin sivulla? */
  console.log(`\n=== SELOSTUS-PDF SIVUILLA ===\n`)
  for (const d of (dokit ?? []).slice(0, 12)) {
    try {
      const html = await (await fetch(String(d.document_url), { headers: { "User-Agent": "Mozilla/5.0" } })).text()
      const pdft = [...new Set([...html.matchAll(/href="([^"]+\.pdf[^"]*)"/gi)].map((m) => m[1]))]
      const selostus = pdft.find((u) => /selostus/i.test(decodeURIComponent(u)))
      console.log(
        `  ${selostus ? "ON " : "EI "} pdf-linkkeja ${String(pdft.length).padEnd(3)} ${String(d.title).slice(0, 50)}`
      )
    } catch {
      console.log(`  ???  (haku epaonnistui)  ${String(d.title).slice(0, 50)}`)
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
