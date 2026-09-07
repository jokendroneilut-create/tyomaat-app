import { readFileSync } from "node:fs"

/*
 * ARKISTOSTA TULLEET EHDOKKAAT POIS JONOSTA (D-176).
 *
 * Rakennuttajien tiedotelahteet luetaan kayttoonotossa koko arkiston
 * verran, jolloin vuosien takaiset jutut nayttavat uusilta. Uusi
 * arkistoraja (`parseFoundationRelease`) estaa taman jatkossa; tama
 * skripti soveltaa saman saannon jo syntyneisiin jonoriveihin.
 *
 * EI POISTA RIVEJA: status -> "ignored", jolloin historia sailyy eika
 * sama juttu palaa jonoon (D: jonosta poisto = ignored, ei DELETE).
 *
 *   npx tsx scripts/fix-arkistoehdokkaat.ts
 *   npx tsx scripts/fix-arkistoehdokkaat.ts --apply
 */

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

const APPLY = process.argv.includes("--apply")

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { parseFoundationRelease, ikaPaivina } = await import("../lib/agent/foundationRelease")

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const jono: any[] = []
  for (let f = 0; ; f += 1000) {
    const { data, error } = await admin
      .from("potential_projects")
      .select("id,title,status,metadata")
      .eq("status", "new")
      .range(f, f + 999)
    if (error) throw error
    jono.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  const foundation = jono.filter((r) => r.metadata?.resolver === "foundationResolver")
  const idt = foundation.map((r) => r.metadata?.source_document_id).filter(Boolean)

  const dokumentit = new Map<string, any>()
  for (let i = 0; i < idt.length; i += 90) {
    const { data, error } = await admin
      .from("source_documents")
      .select("id,raw_payload")
      .in("id", idt.slice(i, i + 90))
    if (error) throw error
    for (const d of data ?? []) dokumentit.set((d as any).id, d)
  }

  const poistettavat: { r: any; syy: string; ika: number | null }[] = []
  const jaavat: { r: any; ika: number | null }[] = []

  for (const r of foundation) {
    const d = dokumentit.get(r.metadata?.source_document_id)
    if (!d) continue

    const post = d.raw_payload?.original ?? {}
    const julkaistu = d.raw_payload?.published_at ?? post?.date ?? null
    const tulos = parseFoundationRelease(post?.title?.rendered, post?.content?.rendered, julkaistu)
    const ika = ikaPaivina(julkaistu)

    if (tulos.isProject) jaavat.push({ r, ika })
    else poistettavat.push({ r, syy: tulos.reason, ika })
  }

  console.log(`${APPLY ? "AJO" : "KUIVAHARJOITUS"}: jonossa ${foundation.length} foundation-ehdokasta\n`)

  console.log(`POISTETTAVAT (${poistettavat.length}):`)
  for (const p of poistettavat) {
    console.log(`  ${String(p.ika ?? "?").padStart(5)} vrk  ${String(p.r.title).slice(0, 42).padEnd(43)} ${p.syy}`)
  }

  console.log(`\nJAAVAT (${jaavat.length}):`)
  for (const j of jaavat) {
    console.log(`  ${String(j.ika ?? "?").padStart(5)} vrk  ${String(j.r.title).slice(0, 60)}`)
  }

  if (!APPLY) {
    console.log("\nKuivaharjoitus: mitaan ei kirjoitettu.")
    return
  }

  let ok = 0
  for (const p of poistettavat) {
    const { error } = await admin
      .from("potential_projects")
      .update({
        status: "ignored",
        metadata: { ...(p.r.metadata ?? {}), ignore_reason: `arkistosiivous: ${p.syy}` },
      })
      .eq("id", p.r.id)
    if (error) console.log(`  VIRHE ${p.r.title}: ${error.message}`)
    else ok++
  }
  console.log(`\nmerkitty ignored: ${ok} / ${poistettavat.length}`)
}

main().catch((e) => {
  console.error("VIRHE:", e?.message ?? e)
  process.exit(1)
})
export {}
