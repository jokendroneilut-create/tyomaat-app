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
 * VAARA ORGANISAATIO (D-416): Puolangan Pieni-Paljakassa Prokonin ja
 * Rambollin henkilot perivat edellisen lohkon "PUOLANGAN KUNTA".
 * Korjataan vain kun tallennettu organisaatio on kunta/kaupunki ja uusi
 * jasennys antaa yhtiomuotoisen organisaation. Tyhja organisaatio
 * taydennetaan saman dokumentin jasennyksesta.
 *
 * TOISEN HENKILON NIMIKE (D-416): samassa Pieni-Paljakassa Marko
 * Kristola (Prokon) ja Pirjo Pellikka (Ramboll) olivat kannassa
 * "Rakennustarkastaja" -- Kalevi Huovisen nimike. Korjataan vain kun
 * tallennettu nimike on dokumentissa TOISEN henkilon nimike.
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
    const oikeatOrg = new Map<string, Map<string, string>>()
    const nimikkeet = new Map<string, Map<string, string | null>>()
    for (const d of (dokut ?? []) as any[]) {
      const linkit = (Array.isArray(d.liitteet) ? d.liitteet : []).map((a: any) => ({ href: a.url, teksti: a.label }))
      const urlit = [...new Set([valitseKaavanAsiakirja(linkit), valitseOas(linkit)].filter(Boolean) as string[])]
      const kartta = new Map<string, string>()
      const orgKartta = new Map<string, string>()
      const nimikeKartta = new Map<string, string | null>()
      for (const u of urlit) {
        for (const h of oasYhteystiedot((await haeKaavanLiitteenTekstit(u))?.kaikki)) {
          if (h.phone && !kartta.has(h.name.toLowerCase())) kartta.set(h.name.toLowerCase(), h.phone)
          if (h.organization && !orgKartta.has(h.name.toLowerCase())) orgKartta.set(h.name.toLowerCase(), h.organization)
          if (!nimikeKartta.has(h.name.toLowerCase())) nimikeKartta.set(h.name.toLowerCase(), h.title)
        }
      }
      if (kartta.size) oikeat.set(d.id, kartta)
      if (orgKartta.size) oikeatOrg.set(d.id, orgKartta)
      if (nimikeKartta.size) nimikkeet.set(d.id, nimikeKartta)
    }

    for (const [taulu, nimiKentta] of [["potential_projects", "title"], ["projects", "name"]] as const) {
      const { data: rivit, error: e2 } = await db
        .from(taulu)
        .select(`id,${nimiKentta},yht:metadata->contact_persons,doku:metadata->>source_document_id`)
        .eq("metadata->>source_name", lahde)
      if (e2) throw e2

      for (const r of (rivit ?? []) as any[]) {
        const kartta = oikeat.get(r.doku) ?? new Map<string, string>()
        const orgKartta = oikeatOrg.get(r.doku) ?? new Map<string, string>()
        const nimikeKartta = nimikkeet.get(r.doku) ?? new Map<string, string | null>()
        if (!kartta.size && !orgKartta.size && !nimikeKartta.size) continue
        const yht: any[] = Array.isArray(r.yht) ? r.yht : []
        const muutokset: string[] = []
        const uusi = yht.map((c0) => {
          let c = c0
          const omaOrg = orgKartta.get(String(c.name ?? "").toLowerCase())
          if (omaOrg && /(kunta|kaupunki)$/i.test(String(c.organization ?? "")) && /\b(oy|oyj|ab|ky|ltd)\.?$/i.test(omaOrg)) {
            muutokset.push(`${c.name}: organisaatio ${c.organization} -> ${omaOrg}`)
            c = { ...c, organization: omaOrg }
          } else if (omaOrg && !c.organization) {
            muutokset.push(`${c.name}: organisaatio tyhja -> ${omaOrg}`)
            c = { ...c, organization: omaOrg }
          }
          const nimi = String(c.name ?? "").toLowerCase()
          if (c.title && nimikeKartta.has(nimi)) {
            const omaNimike = nimikeKartta.get(nimi) ?? null
            const sama = (a: unknown, b: unknown) => String(a ?? "").toLowerCase() === String(b ?? "").toLowerCase()
            const toisen = [...nimikeKartta.entries()].some(([n, t]) => n !== nimi && sama(t, c.title))
            if (toisen && !sama(omaNimike, c.title)) {
              muutokset.push(`${c.name}: nimike ${c.title} (toisen) -> ${omaNimike ?? "tyhja"}`)
              c = { ...c, title: omaNimike }
            }
          }
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
