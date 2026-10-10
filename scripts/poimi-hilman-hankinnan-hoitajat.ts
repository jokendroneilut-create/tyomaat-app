import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * HANKINNAN HOITAJA HILMAN ILMOITUKSESTA, TAKAUTUVASTI (D-259).
 *
 * eFormsin `organization.touchPoint` on tilaajan ilmoittama hankinnan
 * yhteystaho, usein ulkopuolinen konsultti. Sita ei ole poimittu
 * koskaan: koodi luki sen vain varareittina ja vaarasta polusta
 * (taulukko objektina).
 *
 * EI POISTA EIKA KORVAA MITAAN. Lisaa vain puuttuvan `agent`-roolisen
 * kontaktin; jos sama sahkoposti on jo listalla, rivi ohitetaan.
 *
 *   npx tsx scripts/poimi-hilman-hankinnan-hoitajat.ts
 *   npx tsx scripts/poimi-hilman-hankinnan-hoitajat.ts --apply
 *   npx tsx scripts/poimi-hilman-hankinnan-hoitajat.ts --raja=200 --apply
 */
const APPLY = process.argv.includes("--apply")
const RAJA = Number(process.argv.find((a) => a.startsWith("--raja="))?.split("=")[1] ?? 100000)

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { fetchHilmaEForm, parseHilmaContacts } = await import("../lib/agent/hilmaContacts")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  let tarkistettu = 0, loytyi = 0, lisatty = 0, jo = 0
  const esimerkit: string[] = []

  for (const taulu of ["projects", "potential_projects"]) {
    const rivit: any[] = []
    for (let f = 0; f < 20000; f += 1000) {
      /*
       * TAHDEN KAYTTO ON TAHALLISTA: `projects`issa ei ole saraketta
       * `title` eika `potential_projects`issa saraketta `name`.
       * Nimetty lista tuotti virheen jota en tarkistanut, ja ajo
       * palautti nolla rivia ilman mitaan ilmoitusta.
       */
      const { data, error } = await db.from(taulu).select("*").range(f, f + 999)
      if (error) throw error
      if (!data?.length) break
      for (const r of data as any[]) {
        const md = r.metadata ?? {}
        if (md.source_name !== "Hilma" || !md.procedure_id) continue
        /* Jo poimittu? */
        if ((md.contact_persons ?? []).some((c: any) => c?.role === "agent")) { jo++; continue }
        rivit.push(r)
      }
      if (data.length < 1000) break
    }

    console.log(`\n=== ${taulu}: tarkistettavia ${rivit.length}`)

    for (const r of rivit) {
      if (tarkistettu >= RAJA) break
      tarkistettu++
      const md = r.metadata ?? {}
      const nid = md.notice_id ?? String(md.notice_number ?? "").split("-").pop()
      const eForm = await fetchHilmaEForm(md.procedure_id, nid)
      if (!eForm) continue

      const agentit = parseHilmaContacts(eForm).filter((c) => c.role === "agent")
      if (!agentit.length) continue

      const nykyiset: any[] = Array.isArray(md.contact_persons) ? md.contact_persons : []
      const osoitteet = new Set(nykyiset.map((c: any) => String(c?.email ?? "").toLowerCase()).filter(Boolean))
      const uudet = agentit.filter((a) => !a.email || !osoitteet.has(a.email.toLowerCase()))
      if (!uudet.length) continue

      loytyi++
      if (esimerkit.length < 15) {
        for (const a of uudet) esimerkit.push(`${String(a.organization ?? "?").slice(0,26).padEnd(26)} | ${String(a.name ?? "-").slice(0,22).padEnd(22)} | ${a.email}  <- ${String(r.name ?? r.title).slice(0,34)}`)
      }

      if (!APPLY) continue
      const { error } = await db.from(taulu)
        .update({ metadata: { ...md, contact_persons: [...nykyiset, ...uudet] } })
        .eq("id", r.id)
      if (error) throw error
      lisatty += uudet.length
    }
  }

  console.log("\n=== YHTEENVETO ===")
  console.log("  tarkistettu ilmoitusta:", tarkistettu)
  console.log("  hankinnan hoitaja loytyi:", loytyi, `(${Math.round(loytyi / Math.max(1, tarkistettu) * 100)} %)`)
  console.log("  ohitettu, jo poimittu  :", jo)
  if (APPLY) console.log("  lisattyja kontakteja   :", lisatty)
  console.log("\nesimerkit (yritys | henkilo | sahkoposti <- hanke):")
  for (const e of esimerkit) console.log("  " + e)
  if (!APPLY) console.log("\n=== KUIVAHARJOITUS ===")
}
main().catch(e => { console.error(e); process.exit(1) })
