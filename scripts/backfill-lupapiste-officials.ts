import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * LUPAPISTEEN VIRANOMAISET TAKAUTUVASTI.
 *
 * Kuulutuksen paatoksen tehnyt rakennustarkastaja on nimetty PDF:ssa.
 * Mitattu 23.8.2026: 211 dokumenttia 309:sta (68 %), 91 eri henkiloa.
 *
 * NAMA EIVAT OLE MYYNTIKONTAKTEJA. Ne merkitaan role: "authority",
 * jotta kayttaja nakee eron ennen kuin soittaa - viranomainen tuntee
 * hankkeen muttei osta mitaan.
 *
 * EI YLIKIRJOITA (D-101): mergeContacts on vain-lisaava.
 *
 * Aja ensin ilman --apply-lippua.
 */

const APPLY = process.argv.includes("--apply")

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { extractBulletinOfficials } = await import("../lib/agent/lupapisteBulletinPdf")
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
      .select("id,document_url,raw_payload")
      .eq("source_name", "Lupapiste kuulutukset")
      .range(f, f + 999)
    if (error) throw error
    docs.push(...(data ?? [])); if (!data || data.length < 1000) break
  }

  /* url -> viranomaiskontaktit */
  const perUrl = new Map<string, any[]>()
  let dokumentteja = 0

  for (const d of docs) {
    const teksti = String(d.raw_payload?.bulletin_pdf_text ?? "")
    if (!teksti) continue

    const officials = extractBulletinOfficials(teksti)
    if (!officials.length) continue

    dokumentteja++
    perUrl.set(
      String(d.document_url),
      officials.map((o) => ({
        name: o.name,
        title: o.title,
        organization: o.organization,
        email: "",
        phone: null,
        kind: "person" as const,
        role: "authority" as const,
      }))
    )
  }

  console.log(APPLY ? "=== AJETTU ===" : "=== KUIVAHARJOITUS (ei kirjoiteta) ===")
  console.log(`dokumentteja joista viranomainen saadaan: ${dokumentteja}\n`)

  const lataa = async (t: string) => {
    const r: any[] = []
    for (let f = 0; ; f += 1000) {
      const { data, error } = await supabase.from(t).select("*").range(f, f + 999)
      if (error) throw error
      r.push(...(data ?? [])); if (!data || data.length < 1000) break
    }
    return r
  }

  for (const [taulu, nimiSarake] of [["potential_projects", "title"], ["projects", "name"]] as const) {
    const rivit = (await lataa(taulu)).filter((p: any) =>
      /lupapiste/i.test(String(p.metadata?.source_name ?? ""))
    )

    let muuttuu = 0, jo = 0
    const naytteet: string[] = []
    const paivitykset: { id: string; contacts: any[] }[] = []

    for (const p of rivit) {
      const uudet = perUrl.get(String(p.metadata?.source_url ?? ""))
      if (!uudet?.length) continue

      const nykyiset = Array.isArray(p.metadata?.contact_persons) ? p.metadata.contact_persons : []
      const nimetJo = new Set(nykyiset.map((c: any) => String(c?.name ?? "").toLowerCase()))

      if (uudet.every((c) => nimetJo.has(c.name.toLowerCase()))) { jo++; continue }

      const yhdistetty = mergeContacts(nykyiset, uudet as any)
      muuttuu++

      if (naytteet.length < 10) {
        naytteet.push(`  ${String(p[nimiSarake]).slice(0, 32).padEnd(34)} ${nykyiset.length} -> ${yhdistetty.length}   ${uudet.map((c) => `${c.name} (${c.title ?? "-"})`).join(", ").slice(0, 56)}`)
      }

      paivitykset.push({ id: p.id, contacts: yhdistetty })
    }

    console.log(`=== ${taulu} ===`)
    console.log(`  lupapiste-rivja: ${rivit.length}`)
    console.log(`  paivitettavia:   ${muuttuu}`)
    console.log(`  jo mukana:       ${jo}`)
    for (const n of naytteet) console.log(n)
    console.log()

    if (!APPLY) continue

    let n = 0
    for (const u of paivitykset) {
      const { data: nyt } = await supabase.from(taulu).select("metadata").eq("id", u.id).maybeSingle()
      const meta: any = nyt?.metadata ?? {}
      await supabase
        .from(taulu)
        .update({ metadata: { ...meta, contact_persons: u.contacts } })
        .eq("id", u.id)
      n++
    }
    console.log(`  kirjoitettu: ${n}\n`)
  }
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
