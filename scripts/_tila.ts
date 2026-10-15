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
 * Onko kanta, jono ja tulevaisuus kunnossa? Korjaus koskee POIMINTAA,
 * joten se ei muuta yhtaan jo tuotua rivia. Mitataan paljonko niita on.
 */
async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  /* 1. Dynastyn poytakirjasivut ja niille talletettu kuvaus. */
  const docs: any[] = []
  for (let alku = 0; ; alku += 1000) {
    const { data, error } = await db
      .from("source_documents")
      .select("id, source_id, source_name, title, document_url, raw_payload, content_hash, created_at")
      .range(alku, alku + 999)
    if (error) {
      console.error("VIRHE dokumentit:", error.message)
      process.exit(1)
    }
    docs.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }

  const dyn = docs.filter((d) => /page=meetingitem/i.test(String(d.document_url ?? "")))
  console.log(`=== 1. LAHDEDOKUMENTIT ===`)
  console.log(`Dynastyn poytakirjasivuja: ${dyn.length}`)

  const pituudet = dyn.map((d) => String(d.raw_payload?.description ?? d.raw_payload?.text ?? "").length)
  const j = [...pituudet].sort((a, b) => a - b)
  console.log(`talletetun kuvauksen pituus: mediaani ${j[Math.floor(j.length / 2)]}, pienin ${j[0]}, suurin ${j[j.length - 1]}`)
  console.log(`alle 400 merkkia: ${j.filter((x) => x < 400).length} / ${j.length}`)

  /* 2. Jono: ehdokkaat jotka viittaavat naihin dokumentteihin. */
  const docIds = new Set(dyn.map((d) => d.id))
  const ehdokkaat: any[] = []
  for (let alku = 0; ; alku += 1000) {
    const { data, error } = await db
      .from("potential_projects")
      .select("id, title, status, metadata")
      .range(alku, alku + 999)
    if (error) {
      console.error("VIRHE ehdokkaat:", error.message)
      process.exit(1)
    }
    ehdokkaat.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }

  const omat = ehdokkaat.filter((e) => docIds.has(String((e.metadata as any)?.source_document_id ?? "")))
  console.log(`\n=== 2. JONO (potential_projects) ===`)
  console.log(`ehdokkaita yhteensa: ${ehdokkaat.length}`)
  console.log(`naista Dynasty-poytakirjasta: ${omat.length}`)

  const tilat = new Map<string, number>()
  for (const e of omat) tilat.set(String(e.status), (tilat.get(String(e.status)) ?? 0) + 1)
  console.log(`tilat: ${[...tilat].map(([k, v]) => `${k} ${v}`).join(", ")}`)

  const op = omat.map((e) => String((e.metadata as any)?.description ?? "").length).sort((a, b) => a - b)
  if (op.length) {
    console.log(`kuvauksen pituus: mediaani ${op[Math.floor(op.length / 2)]}, pienin ${op[0]}, suurin ${op[op.length - 1]}`)
    console.log(`alle 400 merkkia: ${op.filter((x) => x < 400).length} / ${op.length}`)
  }

  /* 3. Kanta: hyvaksytyt hankkeet jotka tulivat naista lahteista. */
  const lahdeNimet = new Set(dyn.map((d) => String(d.source_name)))
  const hankkeet: any[] = []
  for (let alku = 0; ; alku += 1000) {
    const { data, error } = await db
      .from("projects")
      .select("id, name, additional_info, metadata")
      .range(alku, alku + 999)
    if (error) {
      console.error("VIRHE hankkeet:", error.message)
      process.exit(1)
    }
    hankkeet.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }

  const omatHankkeet = hankkeet.filter((p) => {
    const md = (p.metadata as any) ?? {}
    const nimi = String(md.source_name ?? md.firstSourceName ?? "")
    const url = String(md.source_url ?? md.documents_url ?? "")
    return lahdeNimet.has(nimi) || /page=meetingitem/i.test(url)
  })
  console.log(`\n=== 3. KANTA (projects, hyvaksytyt) ===`)
  console.log(`hankkeita yhteensa: ${hankkeet.length}`)
  console.log(`naista Dynastyn paatoslahteista: ${omatHankkeet.length}`)

  const hp = omatHankkeet.map((p) => String(p.additional_info ?? "").length).sort((a, b) => a - b)
  if (hp.length) {
    console.log(`nakyvan kentan (additional_info) pituus: mediaani ${hp[Math.floor(hp.length / 2)]}, pienin ${hp[0]}, suurin ${hp[hp.length - 1]}`)
    console.log(`alle 400 merkkia: ${hp.filter((x) => x < 400).length} / ${hp.length}`)
    console.log("\nlyhyimmat 8:")
    for (const p of omatHankkeet
      .slice()
      .sort((a, b) => String(a.additional_info ?? "").length - String(b.additional_info ?? "").length)
      .slice(0, 8)) {
      console.log(`  [${String(p.additional_info ?? "").length} mrk] ${String(p.name).slice(0, 60)}`)
    }
  }

  /* 4. Tulevaisuus: ajetaanko sama dokumentti uudelleen? */
  console.log(`\n=== 4. TULEVAISUUS ===`)
  const vanhin = dyn.map((d) => String(d.created_at)).sort()[0]
  const uusin = dyn.map((d) => String(d.created_at)).sort().slice(-1)[0]
  console.log(`Dynasty-dokumentit tuotu valilla ${vanhin?.slice(0, 10)} - ${uusin?.slice(0, 10)}`)
  console.log(`content_hash asetettu: ${dyn.filter((d) => d.content_hash).length} / ${dyn.length}`)
}

main().catch((e) => {
  console.error(e?.message ?? e)
  process.exit(1)
})
