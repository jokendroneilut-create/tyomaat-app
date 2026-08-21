import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * HILMAN YHTEYSHENKILOT TAKAUTUVASTI.
 *
 * eForms-ilmoituksen organisaatiolohkossa on tilaajan ja voittajan nimi,
 * sahkoposti ja puhelin. Sita ei ole luettu, joten 160 nakyvaa
 * Hilma-hanketta oli ilman yhteystietoa.
 *
 * EI YLIKIRJOITA. contact_persons on vain-lisaava (D-101), joten
 * olemassa olevat sailyvat ja uudet tulevat peraan.
 *
 * Aja ensin ilman --apply-lippua.
 */

const APPLY = process.argv.includes("--apply")
const LIMIT = Number(process.argv.find((a) => a.startsWith("--limit="))?.slice(8) ?? 0)
const CONCURRENCY = 4

const noticeIdFrom = (url: string): string | null =>
  url.match(/enotice\/(\d+)/)?.[1] ?? url.match(/procurement\/(\d+)/)?.[1] ?? null

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      for (;;) {
        const i = next++
        if (i >= items.length) return
        results[i] = await fn(items[i])
      }
    })
  )
  return results
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { fetchHilmaContacts } = await import("../lib/agent/hilmaContacts")
  const { mergeContacts } = await import("../lib/projects/contacts")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const rivit: any[] = []
  for (let f = 0; ; f += 1000) {
    const { data, error } = await supabase
      .from("projects")
      .select("id,name,is_public,metadata")
      .range(f, f + 999)
    if (error) throw error
    rivit.push(...(data ?? [])); if (!data || data.length < 1000) break
  }

  const kohteet = rivit.filter(
    (p) =>
      String(p.metadata?.source_name ?? "").toLowerCase() === "hilma" &&
      p.metadata?.procedure_id &&
      !(Array.isArray(p.metadata?.contact_persons) && p.metadata.contact_persons.length)
  )

  const targets = LIMIT > 0 ? kohteet.slice(0, LIMIT) : kohteet

  console.log(APPLY ? "=== AJETTU ===" : "=== KUIVAHARJOITUS (ei kirjoiteta) ===")
  console.log(`Hilma-hankkeita ilman yhteystietoa: ${kohteet.length}`)
  console.log(`haetaan nyt:                        ${targets.length}\n`)

  let haettu = 0
  const tulokset = await mapWithConcurrency(targets, CONCURRENCY, async (p) => {
    const notice = noticeIdFrom(String(p.metadata?.source_url ?? ""))
    const contacts = await fetchHilmaContacts(p.metadata.procedure_id, notice)
    if (++haettu % 50 === 0) console.log(`  ...haettu ${haettu}/${targets.length}`)
    return { p, contacts }
  })

  let muuttuu = 0, tilaajia = 0, voittajia = 0, nimella = 0, tyhjia = 0
  const rivitLoki: string[] = []

  for (const { p, contacts } of tulokset) {
    if (!contacts.length) { tyhjia++; continue }
    muuttuu++
    for (const c of contacts) {
      if (c.role === "buyer") tilaajia++
      else voittajia++
      if (c.name) nimella++
    }
    if (rivitLoki.length < 12) {
      rivitLoki.push(
        `  ${String(p.name).slice(0, 40).padEnd(42)} ${contacts
          .map((c) => `[${c.role}] ${c.name ?? c.organization ?? "-"}`)
          .slice(0, 2)
          .join("  ")}`
      )
    }
  }

  console.log(`\npaivitettavia hankkeita: ${muuttuu}`)
  console.log(`  ei yhteystietoa:       ${tyhjia}`)
  console.log(`kontakteja: tilaajia ${tilaajia}, voittajia ${voittajia}, nimella ${nimella}`)
  if (rivitLoki.length) { console.log("\nesimerkkeja:"); for (const r of rivitLoki) console.log(r) }

  if (!APPLY) return

  let n = 0
  for (const { p, contacts } of tulokset) {
    if (!contacts.length) continue
    const { data: nyt } = await supabase.from("projects").select("metadata").eq("id", p.id).maybeSingle()
    const meta: any = nyt?.metadata ?? {}
    await supabase
      .from("projects")
      .update({
        metadata: {
          ...meta,
          contact_persons: mergeContacts(meta.contact_persons ?? [], contacts as any),
        },
      })
      .eq("id", p.id)
    if (++n % 50 === 0) console.log(`  ...kirjoitettu ${n}/${muuttuu}`)
  }
  console.log(`\nkirjoitettu: ${n}`)
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
