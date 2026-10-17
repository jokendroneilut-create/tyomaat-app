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
 * KUIVAHARJOITUS: mita Toivon lahde tuottaa, ja onko se meilla jo?
 *
 * Ei kirjoita mitaan. Tulostaa jokaisen ehdokkaan kokonaisuudessaan,
 * koska kuivaharjoituksen tuotos on luettava rivi riviltä — pelkka
 * lukumaara ei paljasta jasennysvirhetta.
 *
 *   npx tsx scripts/mittaa-toivo-lahde.ts
 */

async function main() {
  const { fetchToivoSource } = await import("../lib/agent/fetchToivoSource")
  const { findProjectMatchDetailed } = await import("../lib/agent/projectMatcher")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const t0 = Date.now()
  const ehdokkaat = await fetchToivoSource()
  console.log(`=== ${ehdokkaat.length} ehdokasta, ${((Date.now() - t0) / 1000).toFixed(1)} s ===\n`)

  const kuvaukset = ehdokkaat.map((e: any) => String(e.description ?? "").length).sort((a, b) => a - b)
  const mediaani = kuvaukset[Math.floor(kuvaukset.length / 2)] ?? 0
  console.log(`kuvauksen mediaani ${mediaani} merkkia (min ${kuvaukset[0]}, max ${kuvaukset[kuvaukset.length - 1]})`)
  console.log(`kaupunki tunnistettu ${ehdokkaat.filter((e: any) => e.city).length} / ${ehdokkaat.length}`)
  console.log(`osoite poimittu     ${ehdokkaat.filter((e: any) => e.location).length} / ${ehdokkaat.length}`)
  console.log(`tilaaja poimittu    ${ehdokkaat.filter((e: any) => e.developer).length} / ${ehdokkaat.length}`)
  console.log(`tyyppi paatelty     ${ehdokkaat.filter((e: any) => e.property_type).length} / ${ehdokkaat.length}`)

  /* Onko hanke meilla jo? Tuotannon tasmayttaja, oikea parametrijarjestys. */
  const kaikki = async (t: string, cols: string) => {
    const out: any[] = []
    for (let a = 0; ; a += 1000) {
      const { data, error } = await db.from(t).select(cols).range(a, a + 999)
      if (error) {
        console.error(`VIRHE ${t}: ${error.message}`)
        process.exit(1)
      }
      out.push(...(data ?? []))
      if ((data ?? []).length < 1000) break
    }
    return out
  }
  const hankkeet = await kaikki("projects", "id, name, city, region, location, status, developer, builder, contractor, metadata")
  const jono = await kaikki("potential_projects", "id, title, municipality, address, status, metadata")
  const vertailu = [
    ...hankkeet,
    ...jono.map((r: any) => ({
      id: r.id,
      name: r.title,
      city: r.municipality,
      region: null,
      location: r.address,
      status: r.status,
      metadata: r.metadata,
    })),
  ]
  console.log(`\nvertailujoukko ${hankkeet.length} hanketta + ${jono.length} jonorivia\n`)

  let uusia = 0
  for (const e of ehdokkaat as any[]) {
    const osuma = findProjectMatchDetailed(vertailu as any, {
      name: e.name,
      sourceTitle: e.name,
      city: e.city ?? null,
      region: e.region ?? null,
      location: e.location ?? null,
      permitNumber: null,
      propertyId: null,
      developer: e.developer ?? null,
      buildingType: e.property_type ?? null,
    } as any)
    const piste = osuma?.confidence ?? 0
    if (piste < 40) uusia++

    console.log("".padEnd(78, "-"))
    console.log(`${piste >= 40 ? `MEILLA JO (${piste}: ${osuma?.project?.name})` : "UUSI"}`)
    console.log(`nimi      ${e.name}`)
    console.log(`kaupunki  ${e.city ?? "-"}        tyyppi ${e.property_type ?? "-"}`)
    console.log(`osoite    ${e.location ?? "-"}`)
    console.log(`tilaaja   ${e.developer ?? "-"}        rakentaja ${e.builder}`)
    console.log(`vaihe     ${e.phase}        lahde ${e.source_url}`)
    console.log(`kuvaus    ${String(e.description ?? "").slice(0, 260)}`)
  }
  console.log("".padEnd(78, "-"))
  console.log(`\nUUSIA ${uusia} / ${ehdokkaat.length}`)
}
main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
