import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * HYLATYT RAKENNUSURAKAT TAKAISIN JONOON (D-256).
 *
 * Kaksi ryhmaa, molemmat mitattuja:
 *
 * 1. VUOKRAMALLI. Johannes 10.10.2026: *"olen hylannyt nimenomaan naita
 *    vuokramalli ehdokkaita"* — tilaaja vuokraa, mutta VOITTAJA
 *    RAKENTAA. Kuvaus sanoo sen suoraan: "vuokranantaja vastaa
 *    suunnittelusta, rakennuttamisesta", "rakennushankkeeseen ryhtyva".
 *    Kaytanto on ollut epayhtenainen: samanlaisia on hyvaksytty 3 ja
 *    yksi on jonossa.
 *
 * 2. VOITTAJA RATKESI HYLKAYKSEN JALKEEN. Naita ei palauttanut mikaan
 *    ennen D-256:ta.
 *
 * RAJAUS ON HILMAN OMA, EI MINUN. Mukaan vain `procurement_type_code`
 * sisaltaa "works" eli rakennusurakka. Mikroskoopit, autoleasing ja
 * kyselytutkimukset jaavat hylatyiksi — niiden hylkays oli oikein.
 *
 *   npx tsx scripts/palauta-hylatyt-rakennusurakat.ts
 *   npx tsx scripts/palauta-hylatyt-rakennusurakat.ts --apply
 */
const APPLY = process.argv.includes("--apply")

const VUOKRAMALLI =
  /vuokramalli|vuokrahankin|vuokranantaja\s+(?:rakennut|vastaa)|rakennushankkeeseen\s+ryhtyv|vuokrap[äa]iv[äa]koti|rakennettavan\s+\w*\s*vuokra|vuokratilan\s+hankin/i

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const palautettavat: any[] = []
  for (let f = 0; f < 20000; f += 1000) {
    const { data, error } = await db.from("potential_projects").select("*").eq("status", "rejected").range(f, f + 999)
    if (error) throw error
    if (!data?.length) break
    for (const r of data as any[]) {
      const md = r.metadata ?? {}
      /* Hilman oma luokitus: vain rakennusurakat. */
      if (!String(md.procurement_type_code ?? "").includes("works")) continue

      const teksti = `${r.title ?? ""} ${md.description ?? ""}`
      const onVuokramalli = VUOKRAMALLI.test(teksti)

      const hist = Array.isArray(md.source_history) ? md.source_history : []
      const hylatty = md.rejected_at ? new Date(md.rejected_at).getTime() : null
      const myohempia = hylatty ? hist.filter((h: any) => h?.seen_at && new Date(h.seen_at).getTime() > hylatty).length : 0
      const voittaja = md.winner_organisations || (md.winners ?? []).length
      const onUuttaTietoa = Boolean(myohempia || voittaja || md.is_contract_award)

      if (!onVuokramalli && !onUuttaTietoa) continue

      palautettavat.push({
        id: r.id,
        title: r.title,
        kunta: r.municipality,
        syy: onVuokramalli ? (onUuttaTietoa ? "vuokramalli + uutta tietoa" : "vuokramalli") : "voittaja/uutta tietoa",
        voittaja: md.winner_organisations ?? (md.winners ?? []).join(", ") ?? "",
        md,
      })
    }
    if (data.length < 1000) break
  }

  const ryhmat = new Map<string, number>()
  for (const p of palautettavat) ryhmat.set(p.syy, (ryhmat.get(p.syy) ?? 0) + 1)
  console.log(`palautettavia: ${palautettavat.length}`)
  for (const [k, v] of ryhmat) console.log(`   ${String(v).padStart(3)}  ${k}`)
  console.log()
  for (const p of palautettavat) {
    console.log(`  ${String(p.kunta ?? "-").padEnd(14)} ${String(p.title).slice(0, 52).padEnd(54)} ${p.voittaja ? "-> " + String(p.voittaja).slice(0, 30) : ""}`)
  }

  if (!APPLY) { console.log("\n=== KUIVAHARJOITUS ==="); return }

  let n = 0
  for (const p of palautettavat) {
    const { error } = await db.from("potential_projects").update({
      status: "new",
      updated_at: new Date().toISOString(),
      metadata: {
        ...p.md,
        palautettu_jonoon: new Date().toISOString(),
        palautuksen_syy: p.syy,
      },
    }).eq("id", p.id)
    if (error) throw error
    n++
  }
  console.log(`\n=== PALAUTETTU ${n} ===`)
}
main().catch(e => { console.error(e); process.exit(1) })
