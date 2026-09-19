import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * PERUUTUS: D-200:N PARIT, JOTKA IHMINEN OLI JO MERKINNYT ERI HANKKEIKSI (D-202).
 *
 * `fix-lahteettomat-parit.ts` kopioi vastineen yhteyshenkilöt ja
 * lähteen lähteettömälle hankkeelle. Kolme paria osoittautui eri
 * hankkeiksi: kaksi oli katselmoitu `not_duplicate`, ja rakennuttajat
 * eroavat (TA-Yhtiöt vs. Pajala; Sivakka vs. TA-Yhtymä/Lapti). Kolmas
 * (Lujatalo Hatanpää) on epävarma, koska Lujatalolla on alueella kaksi
 * kohdetta. Väärän hankkeen henkilö on pahempi kuin tyhjä.
 *
 * Poistetaan VAIN vastineelta kopioidut henkilöt (sama sähköposti tai
 * puhelin) ja vastineen osoite source_urlista.
 *
 *   npx tsx scripts/peru-vaarat-parit.ts            (kuivaharjoitus)
 *   npx tsx scripts/peru-vaarat-parit.ts --apply
 */
const APPLY = process.argv.includes("--apply")

const PARIT: [string, string][] = [
  ["Kerrostalo Hatanpäähän Boijenkatu 2", "Kerrostalo Hatanpäähän"],
  ["Kerrostalo Hiukkavaaraan", "Kerrostalo Oulun Hiukkavaaraan"],
  ["Kerrostalo Tampereen Hatanpäähän", "Lujatalo käynnistää omaperusteisen kerrostalon rakentamisen Tampereen Hatanpäähän"],
]

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const kaikki = async (t: string, cols: string) => {
    const out: any[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from(t).select(cols).range(from, from + 999)
      if (error) throw error
      out.push(...(data ?? [])); if (!data || data.length < 1000) break
    }
    return out
  }
  const projektit = await kaikki("projects", "id, name, is_public, metadata")
  const ehdokkaat = await kaikki("potential_projects", "id, title, metadata")
  const avain = (c: any) => `${String(c?.email ?? "").toLowerCase()}|${String(c?.phone ?? "").replace(/\D/g, "")}`

  let n = 0
  for (const [lahteeton, vastine] of PARIT) {
    const p = projektit.find((x) => x.is_public && !x.metadata?.source_name && String(x.name).startsWith(lahteeton))
    if (!p) { console.log(`EI LÖYDY: ${lahteeton}`); continue }
    const v = [
      ...projektit.filter((x) => x.metadata?.source_name && String(x.name).startsWith(vastine)).map((x) => x.metadata),
      ...ehdokkaat.filter((x) => x.metadata?.source_name && String(x.title).startsWith(vastine)).map((x) => x.metadata),
    ]
    const vastineenAvaimet = new Set(v.flatMap((m) => (m?.contact_persons ?? []).map(avain)))
    const vastineenUrlit = new Set(v.flatMap((m) => [m?.source_url, m?.documents_url]).filter(Boolean))
    const nyt: any[] = p.metadata?.contact_persons ?? []
    const jaa = nyt.filter((c) => !vastineenAvaimet.has(avain(c)))
    const urlPois = p.metadata?.source_url && vastineenUrlit.has(p.metadata.source_url)
    if (jaa.length === nyt.length && !urlPois) { console.log(`ei muutettavaa: ${p.name}`); continue }
    n++
    console.log(`${p.name}\n   henkilöitä ${nyt.length} -> ${jaa.length}${urlPois ? ` | source_url pois (${new URL(p.metadata.source_url).hostname})` : ""}`)
    if (!APPLY) continue
    const metadata = { ...p.metadata, contact_persons: jaa }
    if (urlPois) delete metadata.source_url
    const { error } = await db.from("projects").update({ metadata }).eq("id", p.id)
    if (error) throw error
  }
  console.log(`\n=== ${APPLY ? "AJETTU" : "KUIVAHARJOITUS"}: ${n} hanketta ===`)
}
main().catch((e) => { console.error(e); process.exit(1) })
