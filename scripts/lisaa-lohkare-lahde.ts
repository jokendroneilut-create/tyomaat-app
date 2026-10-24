import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * LOHKARE INFRA LAHTEEKSI (D-341).
 *
 * Pelkka keraajan committaaminen ei riita: lahde tarvitsee rivin
 * `discovery_sources`-tauluun (D-001).
 *
 * Tama lahde on erityinen siina, etta sen odotetaan tuottavan
 * DUPLIKAATTEJA: konserni tiedottaa vasta sopimuksesta, joten hanke on
 * jo kannassa Hilmasta -- ja tytaryhtio Oteran on oma lahteensa
 * (D-310). Siksi ajo tulostaa jokaisesta ehdokkaasta myos sen, loytyyko
 * vastaava rivi jo kannasta ja mita osuma kirjoittaisi
 * ([[matched-overwrites-fields]]).
 *
 *   npx tsx scripts/lisaa-lohkare-lahde.ts
 *   npx tsx scripts/lisaa-lohkare-lahde.ts --apply
 */

const APPLY = process.argv.includes("--apply")

const RIVI = {
  id: "legacy-lohkare",
  name: "Lohkare Infra uutiset",
  type: "html",
  category: "company_project",
  url: "https://lohkare.fi/uutiset/",
  priority: 10,
  enabled: true,
  refresh_minutes: 1440,
  collector: "legacyFetchCollector",
  parser: "lohkare",
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const { data: jo, error } = await db
    .from("discovery_sources")
    .select("id, name, parser, enabled")
    .or(`id.eq.${RIVI.id},parser.eq.${RIVI.parser}`)
  if (error) throw error
  if (jo?.length) {
    console.log(`Lähde on jo olemassa: ${JSON.stringify(jo)}`)
    return
  }

  const { sources } = await import("../lib/agent/sources")
  const lahde = (sources as any[]).find((s) => s.name === RIVI.parser)
  if (!lahde) {
    console.log(`EI LISÄTÄ – parseria "${RIVI.parser}" ei ole rekisterissä`)
    return
  }

  const alkoi = Date.now()
  const kandidaatit = await lahde.fetch()
  console.log(`haku ${((Date.now() - alkoi) / 1000).toFixed(1)} s, kandidaatteja ${kandidaatit.length}`)

  const hankkeet: any[] = []
  for (let a = 0; ; a += 1000) {
    const { data } = await db
      .from("projects")
      .select("id, name, developer, builder, phase, metadata")
      .range(a, a + 999)
    hankkeet.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }
  console.log(`(verrattu ${hankkeet.length} hankkeeseen)\n`)

  for (const k of kandidaatit as any[]) {
    console.log(`${k.name}`)
    console.log(`   ${k.city ?? "-"} | ${k.phase} | rakentaja ${k.builder ?? "-"} | tilaaja ${k.developer ?? "-"}`)

    const url = String(k.source_url ?? "")
    const urlOsuma = hankkeet.find(
      (p) =>
        String(p.metadata?.source_url ?? "") === url ||
        (p.metadata?.source_history ?? []).some((h: any) => String(h?.document_url ?? "") === url)
    )

    /* Tunnistesana: pisin yli 6 merkin sana, taivutus pois. */
    const sana =
      String(k.name)
        .split(/[\s,–-]+/)
        .filter((x) => x.length > 6)
        .sort((a, b) => b.length - a.length)[0] ?? ""
    const kanta = sana.slice(0, Math.max(5, sana.length - 3)).toLowerCase()
    const nimiOsuma = kanta
      ? hankkeet.find((p) => String(p.name ?? "").toLowerCase().includes(kanta))
      : undefined

    const osuma = urlOsuma ?? nimiOsuma
    if (!osuma) {
      console.log(`   => UUSI rivi`)
      continue
    }

    console.log(`   => JO KANNASSA: "${osuma.name}" (${osuma.phase})`)
    console.log(`      ${urlOsuma ? "sama lähdeosoite" : `tunnistesana "${kanta}"`}`)

    /* Mita osuma kirjoittaisi: vain erot ovat kiinnostavia. */
    const erot: string[] = []
    if (k.developer && k.developer !== osuma.developer)
      erot.push(`rakennuttaja "${osuma.developer ?? "-"}" -> "${k.developer}"`)
    if (k.builder && !osuma.builder) erot.push(`rakentaja tyhjä -> "${k.builder}"`)
    const vanhatHenkilot = (osuma.metadata?.contact_persons ?? []).length
    const uudet = ((k.metadata?.contact_persons ?? []) as any[]).filter(
      (h) =>
        !(osuma.metadata?.contact_persons ?? []).some(
          (v: any) => String(v?.email ?? "").toLowerCase() === String(h?.email ?? "").toLowerCase()
        )
    ).length
    erot.push(`yhteyshenkilöt ${vanhatHenkilot} + ${uudet} uutta`)
    for (const e of erot) console.log(`      ${e}`)
  }

  if (!APPLY) {
    console.log("\nEi kirjoitettu. Aja --apply kun rivit on luettu.")
    return
  }

  const { error: e1 } = await db.from("discovery_sources").insert(RIVI)
  if (e1) {
    console.error(`VIRHE: ${e1.message}`)
    process.exit(1)
  }
  console.log(`\nLähde lisätty: ${RIVI.name}`)
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
