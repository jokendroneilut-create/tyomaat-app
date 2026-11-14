import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * VAIHTUNEET PUHELINNUMEROT (D-415).
 *
 * Kaksipalstainen OAS (Huittisten Kallo) antoi ensimmaisen numeron
 * viimeksi luodulle henkilolle: Anne Rämö sai Katariina Viirin numeron.
 * Jasennin korjattiin, mutta kahdeksan lahdetta oli jo ajettu
 * `backfill-kuvaus-liitteesta.ts`:lla -- ja se vain LISAA, ei korjaa.
 *
 * Tama etsii henkilot joiden tallennettu numero kuuluu uuden jasennyksen
 * mukaan TOISELLE henkilolle samassa dokumentissa, ja korvaa sen
 * henkilon omalla numerolla. Vain tama tasmallinen tapaus; muihin
 * eroihin ei kosketa, koska kasin korjattu numero voi poiketa liitteesta.
 *
 *   npx tsx scripts/korjaa-vaihtuneet-numerot.ts --lahde="..."   kuiva
 *   ... --apply
 */

const APPLY = process.argv.includes("--apply")
const LAHTEET = process.argv.filter((a) => a.startsWith("--lahde=")).map((a) => a.slice(8))
const numerot = (p: unknown) => String(p ?? "").replace(/\D/g, "").replace(/^358/, "0")

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { valitseOas, valitseKaavanAsiakirja, haeKaavanLiitteenTekstit } = await import("../lib/agent/kaavanKuvaus")
  const { oasYhteystiedot } = await import("../lib/agent/oasYhteystiedot")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  let korjattavia = 0
  for (const lahde of LAHTEET) {
    const { data: dokut, error } = await db.from("source_documents").select("id,title,document_url,liitteet:raw_payload->attachments").eq("source_name", lahde)
    if (error) throw error

    /* Uusi jasennys dokumenteittain: nimi -> numero. */
    const oikeat = new Map<string, Map<string, string>>()
    for (const d of (dokut ?? []) as any[]) {
      const linkit = (Array.isArray(d.liitteet) ? d.liitteet : []).map((a: any) => ({ href: a.url, teksti: a.label }))
      const urlit = [...new Set([valitseKaavanAsiakirja(linkit), valitseOas(linkit)].filter(Boolean) as string[])]
      const kartta = new Map<string, string>()
      for (const u of urlit) {
        for (const h of oasYhteystiedot((await haeKaavanLiitteenTekstit(u))?.kaikki)) {
          if (h.phone && !kartta.has(h.name.toLowerCase())) kartta.set(h.name.toLowerCase(), h.phone)
        }
      }
      if (kartta.size) oikeat.set(d.id, kartta)
    }

    for (const [taulu, nimiKentta] of [["potential_projects", "title"], ["projects", "name"]] as const) {
      const { data: rivit, error: e2 } = await db
        .from(taulu)
        .select(`id,${nimiKentta},yht:metadata->contact_persons,doku:metadata->>source_document_id`)
        .eq("metadata->>source_name", lahde)
      if (e2) throw e2

      for (const r of (rivit ?? []) as any[]) {
        const kartta = oikeat.get(r.doku)
        if (!kartta) continue
        const yht: any[] = Array.isArray(r.yht) ? r.yht : []
        const muutokset: string[] = []
        const uusi = yht.map((c) => {
          const oma = kartta.get(String(c.name ?? "").toLowerCase())
          if (!oma || !c.phone || numerot(c.phone) === numerot(oma)) return c
          /* Vain jos tallennettu numero kuuluu jollekulle toiselle tassa dokumentissa. */
          const kenen = [...kartta.entries()].find(([n, p]) => n !== String(c.name).toLowerCase() && numerot(p) === numerot(c.phone))
          if (!kenen) return c
          muutokset.push(`${c.name}: ${c.phone} (= ${kenen[0]}) -> ${oma}`)
          return { ...c, phone: oma }
        })
        if (!muutokset.length) continue
        korjattavia += 1
        console.log(`[${lahde.replace(/ vireillä olevat asemakaavat/, "")}] ${taulu === "projects" ? "HANKE" : "JONO "} ${String(r[nimiKentta]).slice(0, 50)}`)
        for (const m of muutokset) console.log(`    ${m}`)
        if (APPLY) {
          const { data: rivi, error: e3 } = await db.from(taulu).select("metadata").eq("id", r.id).single()
          if (e3) throw e3
          const meta = { ...(rivi?.metadata ?? {}), contact_persons: uusi }
          meta.takautuvat_ajot = [...new Set([...(meta.takautuvat_ajot ?? []), "vaihtuneet_numerot_2026_11"])]
          const { error: e4 } = await db.from(taulu).update({ metadata: meta }).eq("id", r.id)
          if (e4) throw e4
        }
      }
    }
  }
  console.log(`\n${APPLY ? "=== AJETTU ===" : "=== KUIVAHARJOITUS ==="}  rivejä ${korjattavia}`)
}
main()
