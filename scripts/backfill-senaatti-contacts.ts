import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * SENAATIN YHTEYSHENKILOT TAKAUTUVASTI.
 *
 * Hankesivun `hankkeen_yhteystiedot` kertoo rakennuttajapaallikon nimen,
 * nimikkeen ja SUORAN puhelinnumeron. 33 hanketta 43:sta oli ilman
 * yhteystietoa, koska SENAATTI_MAX_DETAIL_FETCHES_PER_RUN = 10 ei ehtinyt
 * luettelon lapi - sama vika kuin Vaylavirastolla (D-103).
 *
 * Lisaksi ne kymmenen joilla kontakti oli saivat sen puutteellisena:
 * puhelinta ei luettu lainkaan ja osoite jai malliksi.
 *
 * EI YLIKIRJOITA (D-101): mergeContacts on vain-lisaava, ja se taydentaa
 * tyhjat kentat uudesta.
 *
 * Aja ensin ilman --apply-lippua.
 */

const APPLY = process.argv.includes("--apply")
const CONCURRENCY = 4
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"

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
  const { parseSenaattiContacts } = await import("../lib/agent/senaattiContacts")
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

  /* Kaikki Senaatin hankkeet: myos ne joilla on vajaa kontakti. */
  const kohteet = rivit.filter(
    (p) => /senaatti/i.test(String(p.metadata?.source_name ?? "")) && p.metadata?.source_url
  )

  console.log(APPLY ? "=== AJETTU ===" : "=== KUIVAHARJOITUS (ei kirjoiteta) ===")
  console.log(`Senaatti-hankkeita: ${kohteet.length}`)
  console.log(`  ilman yhteystietoa: ${kohteet.filter((p) => !(Array.isArray(p.metadata?.contact_persons) && p.metadata.contact_persons.length)).length}\n`)

  const tulokset = await mapWithConcurrency(kohteet, CONCURRENCY, async (p) => {
    try {
      const r = await fetch(String(p.metadata.source_url), { headers: { "User-Agent": UA } })
      if (!r.ok) return { p, contacts: [], syy: `HTTP ${r.status}` }
      const html = await r.text()
      const m = html.match(/"hankkeen_yhteystiedot"\s*:\s*"([^"]*)"/)
      if (!m) return { p, contacts: [], syy: "ei kenttaa" }
      return { p, contacts: parseSenaattiContacts(m[1]), syy: "" }
    } catch (e: any) {
      return { p, contacts: [], syy: `virhe: ${e?.message ?? e}` }
    }
  })

  let muuttuu = 0, nimella = 0, puhelimella = 0, sahkopostilla = 0, tyhjia = 0
  const naytteet: string[] = []

  for (const t of tulokset as any[]) {
    if (!t.contacts.length) { tyhjia++; continue }
    muuttuu++
    for (const c of t.contacts) {
      if (c.name) nimella++
      if (c.phone) puhelimella++
      if (c.email) sahkopostilla++
    }
    if (naytteet.length < 15) {
      const c = t.contacts[0]
      naytteet.push(`  ${String(t.p.name).slice(0, 32).padEnd(34)} ${c.name} | ${(c.title ?? "-").slice(0, 22).padEnd(24)} | ${c.phone ?? "-"} | ${c.email || "-"}`)
    }
  }

  console.log(`paivitettavia: ${muuttuu}   (ei yhteystietoa sivulla: ${tyhjia})`)
  console.log(`  nimella:      ${nimella}`)
  console.log(`  puhelimella:  ${puhelimella}`)
  console.log(`  sahkopostilla:${sahkopostilla}`)

  /* Varmistus: malliosoite ei saa paasta lapi. */
  const mallit = (tulokset as any[])
    .flatMap((t) => t.contacts)
    .filter((c: any) => c.email && /(etunimi|sukunimi)/i.test(c.email))
  console.log(`  malliosoitteita lapi: ${mallit.length}${mallit.length ? "  <-- VIRHE" : ""}`)

  if (naytteet.length) { console.log("\nnaytteita:"); for (const n of naytteet) console.log(n) }

  if (!APPLY) return

  let n = 0
  for (const t of tulokset as any[]) {
    if (!t.contacts.length) continue
    const { data: nyt } = await supabase.from("projects").select("metadata").eq("id", t.p.id).maybeSingle()
    const meta: any = nyt?.metadata ?? {}
    await supabase
      .from("projects")
      .update({ metadata: { ...meta, contact_persons: mergeContacts(meta.contact_persons ?? [], t.contacts) } })
      .eq("id", t.p.id)
    n++
  }
  console.log(`\nkirjoitettu: ${n}`)
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
