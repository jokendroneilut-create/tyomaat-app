/*
 * Torpparin jonorivien ja hankkeiden osapuolet uudella jasennyksella
 * (tietokortti + paaurakoitsija koko tekstista, 13.10.2026).
 *
 * Johannes: Danfoss Editronin tehtaalta puuttuivat tilaaja (Lappeenrannan
 * Yritystila Oy), paaurakoitsija (Raspal Oy), ala ja osoite, vaikka jutun
 * lopun tietokortti nimeaa ne.
 *
 * Ajaa `sivuurakoitsijanEhdokas`-funktion tallennetun kuvauksen yli ja
 * TAYTTAA VAIN TYHJAN kentan: kasin annettu tai muusta lahteesta tullut
 * arvo jaa ennalleen. Hylattyihin (ignored) ei kosketa.
 *
 *   npx tsx --env-file=.env.local scripts/fix-torppari-osapuolet.ts            (kuivaharjoitus)
 *   npx tsx --env-file=.env.local scripts/fix-torppari-osapuolet.ts --kirjoita
 */
import { createClient } from "@supabase/supabase-js"
import { sivuurakoitsijanEhdokas } from "../lib/agent/sivuurakoitsijaRss"
import { TORPPARI } from "../lib/agent/fetchTorppariSource"
import { PHASE_LABELS } from "../lib/projects/phases"

const KIRJOITA = process.argv.includes("--kirjoita")

/*
 * Danfoss: "rakennuttaa ... 18,6 miljoonalla eurolla" on merkissa ~1 000,
 * kustannuspoimijan ingressirajan ulkopuolella. Luettu tekstista kasin.
 */
const KASIN: Record<string, Record<string, unknown>> = {
  "fdb74bfc-bc45-452a-8827-8b510456add0": { estimated_cost: 18_600_000, cost_source: "text" },
}

function ehdokas(otsikko: string, teksti: string, osoite: string) {
  return sivuurakoitsijanEhdokas({ otsikko, teksti, osoite, pvm: null }, TORPPARI)
}

async function main() {
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const { data: jono, error } = await s
    .from("potential_projects")
    .select("id, status, title, address, metadata")
    .eq("metadata->>source_name", "torppari")
    .neq("status", "ignored")
  if (error) throw error

  for (const r of jono ?? []) {
    const md = r.metadata ?? {}
    const e = ehdokas(md.operation ?? r.title, md.description ?? "", md.source_url ?? "")
    const muutos: Record<string, unknown> = {}
    if (!md.developer && e.developer) muutos.developer = e.developer
    if (!md.builder && e.builder) muutos.builder = e.builder
    if (!md.floor_area && e.metadata.floor_area) muutos.floor_area = e.metadata.floor_area
    for (const [k, v] of Object.entries(KASIN[r.id] ?? {})) if (!md[k]) muutos[k] = v
    /* Vaihe vain eteenpain sopimuksesta rakenteille, ei taaksepain. */
    if (md.phase_hint === PHASE_LABELS.contract_awarded && e.phase === PHASE_LABELS.construction)
      muutos.phase_hint = e.phase
    const osoite = !r.address && e.location ? e.location : null

    if (!Object.keys(muutos).length && !osoite) continue
    console.log(`JONO ${r.status} ${r.title.slice(0, 70)}`)
    console.log(`   ${JSON.stringify(muutos)}${osoite ? `  address=${osoite}` : ""}`)
    if (KIRJOITA) {
      const { error: e2 } = await s
        .from("potential_projects")
        .update({ metadata: { ...md, ...muutos }, ...(osoite ? { address: osoite } : {}) })
        .eq("id", r.id)
      if (e2) throw e2
    }
  }

  const { data: hankkeet, error: e3 } = await s
    .from("projects")
    .select("id, name, developer, builder, location, floor_area, additional_info, metadata")
    .ilike("metadata->>source_url", "%torppariyhtiot.fi%")
  if (e3) throw e3

  for (const p of hankkeet ?? []) {
    const md = p.metadata ?? {}
    const e = ehdokas(md.operation ?? p.name, md.description ?? p.additional_info ?? "", md.source_url)
    const muutos: Record<string, unknown> = {}
    if (!p.developer && e.developer) muutos.developer = e.developer
    if (!p.builder && e.builder) muutos.builder = e.builder
    if (!p.location && e.location) muutos.location = e.location
    if (!p.floor_area && e.metadata.floor_area) muutos.floor_area = e.metadata.floor_area

    if (!Object.keys(muutos).length) continue
    console.log(`HANKE ${p.id} ${p.name.slice(0, 70)}`)
    console.log(`   ${JSON.stringify(muutos)}`)
    if (KIRJOITA) {
      const { error: e4 } = await s.from("projects").update(muutos).eq("id", p.id)
      if (e4) throw e4
    }
  }

  console.log(KIRJOITA ? "\nKirjoitettu." : "\nKuivaharjoitus. Kirjoita: --kirjoita")
}

main()
