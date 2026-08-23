import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * KAAVASELOSTUSTEN YHTEYSTIEDOT TAKAUTUVASTI.
 *
 * 184 hankkeella on liitteena kaavaselostus, jota ei ole koskaan haettu.
 * Niissa on nimetty henkilo puhelimineen ja sahkoposteineen - juuri se
 * mita muualta ei saa.
 *
 * RAJATTU: vain 6 ensimmaista sivua, vain poiminta tallennetaan.
 * Selostukset ovat 229 000 - 884 000 merkkia, joten koko tekstia ei
 * kirjoiteta kantaan (ks. lib/agent/kaavaselostusPdf.ts).
 *
 * EI YLIKIRJOITA (D-101): mergeContacts on vain-lisaava.
 *
 * Aja ensin ilman --apply-lippua.
 */

const APPLY = process.argv.includes("--apply")
const LIMIT = Number(process.argv.find((a) => a.startsWith("--limit="))?.slice(8) ?? 0)
const DELAY_MS = 300

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { fetchKaavaselostus, isKaavaselostus } = await import("../lib/agent/kaavaselostusPdf")
  const { mergeContacts } = await import("../lib/projects/contacts")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const docs: any[] = []
  for (let f = 0; ; f += 1000) {
    const { data, error } = await supabase
      .from("source_documents")
      .select("id,document_url,source_name,title,raw_payload")
      .range(f, f + 999)
    if (error) throw error
    docs.push(...(data ?? [])); if (!data || data.length < 1000) break
  }

  const kohteet: any[] = []
  for (const d of docs) {
    const v = (d.raw_payload as any)?.attachments
    if (!Array.isArray(v)) continue
    for (const x of v) {
      const url = String(x?.url ?? "")
      if (isKaavaselostus(url, x?.label)) { kohteet.push({ d, url }); break }
    }
  }

  const targets = LIMIT > 0 ? kohteet.slice(0, LIMIT) : kohteet

  console.log(APPLY ? "=== AJETTU ===" : "=== KUIVAHARJOITUS (ei kirjoiteta) ===")
  console.log(`kaavaselostuksellisia hankkeita: ${kohteet.length}`)
  console.log(`haetaan: ${targets.length}\n`)

  const odota = (ms: number) => new Promise((r) => setTimeout(r, ms))

  /* url -> poiminta */
  const tulokset: { d: any; contacts: any[]; planner: string | null }[] = []
  let haettu = 0, eiSaatu = 0

  for (const k of targets) {
    const r = await fetchKaavaselostus(k.url)
    await odota(DELAY_MS)
    if (++haettu % 25 === 0) console.log(`  ...haettu ${haettu}/${targets.length}`)

    if (!r) { eiSaatu++; continue }
    if (!r.contacts.length && !r.planner) continue

    tulokset.push({ d: k.d, contacts: r.contacts, planner: r.planner })
  }

  const nimella = tulokset.filter((t) => t.contacts.some((c) => c.name)).length
  const laatijalla = tulokset.filter((t) => t.planner).length

  console.log(`\nhaettu: ${haettu}   ei saatu: ${eiSaatu}`)
  console.log(`  poimintoja:      ${tulokset.length}`)
  console.log(`  nimetty henkilo: ${nimella}`)
  console.log(`  kaavan laatija:  ${laatijalla}`)

  /* Liitos hankkeisiin lahdedokumentin kautta. */
  const lataa = async (t: string) => {
    const r: any[] = []
    for (let f = 0; ; f += 1000) {
      const { data, error } = await supabase.from(t).select("*").range(f, f + 999)
      if (error) throw error
      r.push(...(data ?? [])); if (!data || data.length < 1000) break
    }
    return r
  }

  const perUrl = new Map<string, { contacts: any[]; planner: string | null }>()
  for (const t of tulokset) perUrl.set(String(t.d.document_url), { contacts: t.contacts, planner: t.planner })

  for (const [taulu, nimiSarake] of [["potential_projects", "title"], ["projects", "name"]] as const) {
    const rivit = await lataa(taulu)
    let muuttuu = 0
    const naytteet: string[] = []
    const paivitykset: any[] = []

    for (const p of rivit) {
      const osuma = perUrl.get(String(p.metadata?.source_url ?? ""))
      if (!osuma) continue

      const nykyiset = Array.isArray(p.metadata?.contact_persons) ? p.metadata.contact_persons : []
      const yhdistetty = mergeContacts(nykyiset, osuma.contacts as any)

      const lisaaLaatija = osuma.planner && !p.metadata?.plan_author
      if (yhdistetty.length === nykyiset.length && !lisaaLaatija) continue

      muuttuu++
      if (naytteet.length < 12) {
        const c = osuma.contacts.find((x: any) => x.name) ?? osuma.contacts[0]
        naytteet.push(`  ${String(p[nimiSarake]).slice(0, 32).padEnd(34)} ${nykyiset.length} -> ${yhdistetty.length}   ${c ? `${c.name ?? "-"} ${c.phone ?? ""} ${c.email}`.slice(0, 50) : "-"}`)
      }

      paivitykset.push({ id: p.id, contacts: yhdistetty, planner: osuma.planner })
    }

    console.log(`\n=== ${taulu} ===`)
    console.log(`  paivitettavia: ${muuttuu}`)
    for (const n of naytteet) console.log(n)

    if (!APPLY) continue

    let n = 0
    for (const u of paivitykset) {
      const { data: nyt } = await supabase.from(taulu).select("metadata").eq("id", u.id).maybeSingle()
      const meta: any = nyt?.metadata ?? {}
      await supabase
        .from(taulu)
        .update({
          metadata: {
            ...meta,
            contact_persons: u.contacts,
            ...(u.planner && !meta.plan_author ? { plan_author: u.planner } : {}),
          },
        })
        .eq("id", u.id)
      n++
    }
    console.log(`  kirjoitettu: ${n}`)
  }
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
