import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * SOPIMUSILMOITUS ILMAN VOITTAJAA (D-251).
 *
 * Kysyy ilmoituksen omalta rajapinnalta `tenderResultCode`:n ja korjaa
 * sen mukaan. Kolme lopputulosta:
 *
 *   clos-nw  -> ei voittajaa: vaihe takaisin kilpailutukseen,
 *               metadata.is_cancelled_procurement = true
 *   selec-w  -> voittaja oli sittenkin: nimi talteen
 *   ei tietoa -> ei kosketa riviin
 *
 *   npx tsx scripts/korjaa-voittajattomat-sopimukset.ts
 *   npx tsx scripts/korjaa-voittajattomat-sopimukset.ts --apply
 */
const APPLY = process.argv.includes("--apply")
const tyhja = (v: any) => v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0)

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { fetchHilmaTulos } = await import("../lib/agent/hilmaTulos")
  const { PHASE_LABELS } = await import("../lib/projects/phases")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const laskuri = { eiVoittajaa: 0, voittajaLoytyi: 0, eiTietoa: 0, ohitettu: 0 }

  for (const taulu of ["potential_projects", "projects"]) {
    const rivit: any[] = []
    for (let f = 0; f < 20000; f += 1000) {
      const { data } = await db.from(taulu).select("*").range(f, f + 999)
      if (!data?.length) break
      for (const r of data as any[]) {
        const md = r.metadata ?? {}
        if (!md.is_contract_award) continue
        if (!tyhja(md.winners) || !tyhja(md.winner_organisations)) continue
        if (!md.procedure_id || !md.notice_number) { laskuri.ohitettu++; continue }
        rivit.push(r)
      }
      if (data.length < 1000) break
    }

    console.log(`\n=== ${taulu}: tarkistettavia ${rivit.length}`)

    for (const r of rivit) {
      const md = r.metadata ?? {}
      const nid = String(md.notice_number).split("-").pop()
      const tulos = await fetchHilmaTulos(md.procedure_id, nid)
      const nimi = String(r.title ?? r.name ?? "").slice(0, 46)

      if (tulos.tulos === null) { laskuri.eiTietoa++; console.log(`  ?  ${nimi}`); continue }

      if (tulos.tulos === "winner") {
        laskuri.voittajaLoytyi++
        console.log(`  V  ${nimi}  -> VOITTAJA: ${tulos.voittajat.join(", ") || "(nimi puuttuu)"}`)
        if (APPLY && tulos.voittajat.length) {
          const { error } = await db.from(taulu)
            .update({ metadata: { ...md, winners: tulos.voittajat, winner_organisations: tulos.voittajat.join(", ") } })
            .eq("id", r.id)
          if (error) throw error
        }
        continue
      }

      laskuri.eiVoittajaa++
      const vaiheNyt = taulu === "projects" ? r.phase : md.phase_hint
      console.log(`  X  ${nimi}  [${vaiheNyt}] -> keskeytetty (${tulos.syy ?? "syy ei tiedossa"})`)
      if (!APPLY) continue

      const uusiMeta = { ...md, is_cancelled_procurement: true, hilma_tulos: "clos-nw", hilma_tulos_syy: tulos.syy ?? null }
      const paivitys: any = { metadata: uusiMeta }
      if (taulu === "projects") paivitys.phase = PHASE_LABELS.tender
      else uusiMeta.phase_hint = PHASE_LABELS.tender
      const { error } = await db.from(taulu).update(paivitys).eq("id", r.id)
      if (error) throw error
    }
  }

  console.log("\n=== YHTEENVETO ===")
  console.log("  ei voittajaa (clos-nw):", laskuri.eiVoittajaa)
  console.log("  voittaja loytyi silti :", laskuri.voittajaLoytyi)
  console.log("  ei tietoa             :", laskuri.eiTietoa)
  console.log("  ohitettu (ei tunnusta):", laskuri.ohitettu)
  if (!APPLY) console.log("\n=== KUIVAHARJOITUS ===")
}
main().catch(e => { console.error(e); process.exit(1) })
