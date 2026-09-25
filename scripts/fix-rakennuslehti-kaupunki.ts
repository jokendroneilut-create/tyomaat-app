import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * RAKENNUSLEHDEN HANKKEILLE KAUPUNKI JA YRITYS TAKAUTUVASTI (D-214).
 *
 * Syote paatteli kaupungin vain otsikosta ja RSS-ingressista, eika
 * rikastus laskenut sita uudelleen artikkelin leipatekstista. Kaupunki on
 * myos duplikaattitunnistuksen ehto, joten ilman sita sama hanke toisesta
 * lahteesta ei loydy.
 *
 * Kaytetaan TALLENNETTUA kuvausta, ei uutta sivuhakua: teksti on jo
 * kannassa. Vain taydennetaan - olemassa olevaa kenttaa ei ylikirjoiteta.
 *
 *   npx tsx scripts/fix-rakennuslehti-kaupunki.ts            (kuivaharjoitus)
 *   npx tsx scripts/fix-rakennuslehti-kaupunki.ts --apply
 */
const APPLY = process.argv.includes("--apply")

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { poiminnatTekstista } = await import("../lib/agent/fetchRakennuslehtiSource")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const kaikki = async (t: string, cols: string) => {
    const out: any[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from(t).select(cols).eq("metadata->>source_name", "rakennuslehti").range(from, from + 999)
      if (error) throw error
      out.push(...(data ?? [])); if (!data || data.length < 1000) break
    }
    return out
  }

  const ehdokkaat: any[] = await kaikki("potential_projects", "id, title, municipality, status, metadata")
  const hankkeet: any[] = await kaikki("projects", "id, name, city, region, status, builder, contractor, metadata")
  console.log(`ehdokkaita ${ehdokkaat.length}, hankkeita ${hankkeet.length}\n`)

  let n = 0

  for (const p of ehdokkaat) {
    const md = p.metadata ?? {}
    const teksti = String(md.description ?? md.operation ?? "")
    if (!teksti) continue

    const lisat = poiminnatTekstista(
      { name: p.title, city: p.municipality, region: md.region, builder: md.builder, metadata: md },
      teksti
    )
    if (!Object.keys(lisat).length) continue

    n++
    console.log(
      `ehdokas  ${String(p.municipality ?? "-").padEnd(12)} -> ${String(lisat.city ?? p.municipality ?? "-").padEnd(12)} ` +
        `${lisat.builder ? `paa=${lisat.builder} ` : ""}` +
        `${lisat.metadata?.related_companies ? `yritys=${JSON.stringify(lisat.metadata.related_companies)} ` : ""}` +
        `${String(p.title).slice(0, 44)}`
    )
    if (!APPLY) continue

    const { error } = await db
      .from("potential_projects")
      .update({
        ...(lisat.city ? { municipality: lisat.city } : {}),
        metadata: {
          ...md,
          ...(lisat.region ? { region: lisat.region } : {}),
          ...(lisat.builder ? { builder: lisat.builder } : {}),
          ...(lisat.metadata?.related_companies
            ? { related_companies: lisat.metadata.related_companies }
            : {}),
        },
      })
      .eq("id", p.id)
    if (error) throw error
  }

  for (const p of hankkeet) {
    const md = p.metadata ?? {}
    const teksti = String(md.description ?? md.operation ?? "")
    if (!teksti) continue

    const lisat = poiminnatTekstista(
      { name: p.name, city: p.city, region: p.region, builder: p.builder ?? p.contractor ?? md.builder, metadata: md },
      teksti
    )
    if (!Object.keys(lisat).length) continue

    n++
    console.log(
      `hanke    ${String(p.city ?? "-").padEnd(12)} -> ${String(lisat.city ?? p.city ?? "-").padEnd(12)} ` +
        `${lisat.builder ? `paa=${lisat.builder} ` : ""}` +
        `${lisat.metadata?.related_companies ? `yritys=${JSON.stringify(lisat.metadata.related_companies)} ` : ""}` +
        `${String(p.name).slice(0, 44)}`
    )
    if (!APPLY) continue

    const { error } = await db
      .from("projects")
      .update({
        ...(lisat.city ? { city: lisat.city } : {}),
        ...(lisat.region ? { region: lisat.region } : {}),
        ...(lisat.builder ? { builder: lisat.builder } : {}),
        metadata: {
          ...md,
          ...(lisat.region ? { region: lisat.region } : {}),
          ...(lisat.builder ? { builder: lisat.builder } : {}),
          ...(lisat.metadata?.related_companies
            ? { related_companies: lisat.metadata.related_companies }
            : {}),
        },
      })
      .eq("id", p.id)
    if (error) throw error
  }

  console.log(`\n=== ${APPLY ? "AJETTU" : "KUIVAHARJOITUS"}: ${n} riviä ===`)
}
main().catch((e) => { console.error(e); process.exit(1) })
