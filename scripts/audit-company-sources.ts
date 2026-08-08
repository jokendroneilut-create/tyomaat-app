/*
 * Mittaa yrityslähteiden tuotoksen laadun ajamalla ne ja katsomalla mitä
 * kenttiä ne oikeasti palauttavat.
 *
 * Taustaa: TIC-jonon kartoitus näytti että osa yrityslähteistä tuottaa
 * ehdokkaita ilman kuvausta, ja ne hylätään katselmoinnissa lähes
 * poikkeuksetta (D-027). Kannasta ei kuitenkaan näe onko syy lähteessä vai
 * tuontiketjussa - tämä ajaa lähteet suoraan ja mittaa lähtötilanteen.
 *
 * Ei kirjoita mitään. Vain lukua ja verkkohakuja.
 *
 *   npx tsx scripts/audit-company-sources.ts
 *   npx tsx scripts/audit-company-sources.ts --only=mangrove,varte
 */
const ONLY = process.argv
  .find((a) => a.startsWith("--only="))
  ?.split("=")[1]
  ?.split(",")
  .map((s) => s.trim())

/*
 * --enrich ajaa lähteen enrich-koukun muutamalle ensimmäiselle ehdokkaalle.
 * Ilman sitä taulukko mittaa tuotoksen ENNEN koukkua, jolloin kuvaus on 0 %
 * myös niillä lähteillä joilla koukku toimii.
 */
const ENRICH = process.argv.includes("--enrich")
const SAMPLE = Number(
  process.argv.find((a) => a.startsWith("--sample="))?.split("=")[1] ?? 3
)

async function main() {
  const { sources } = await import("../lib/agent/sources")

  /* Yrityslähteet: nimi on yrityksen nimi, ei kunnan tai viranomaisen. */
  const COMPANY = new Set([
    "mangrove", "marvea", "varte", "rakennusteho", "brand_toimitilat", "hausia",
    "bonava", "fira", "asura", "asuntosaatio", "ysaatio", "ncc", "aura",
    "marttilan", "kas", "lujatalo", "srv", "yit", "skanska", "hartela",
    "jatke", "tekova", "grk", "pohjola_rakennus", "peab", "meijou",
    "espoonasunnot", "rakennuslehti",
  ])

  const targets = sources.filter(
    (s: any) => COMPANY.has(s.name) && (!ONLY || ONLY.includes(s.name))
  )

  console.log(
    "lähde".padEnd(20) + "n".padStart(5) + "kuvaus".padStart(9) + "kaupunki".padStart(10) +
      "osoite".padStart(9) + "rak.tt".padStart(8) + "urak".padStart(7) +
      "tyyppi".padStart(8) + "  vaiheet"
  )

  for (const source of targets as any[]) {
    let rows: any[] = []
    try {
      rows = (await source.fetch()) ?? []
    } catch (err: any) {
      console.log(`${source.name.padEnd(20)}  VIRHE: ${err?.message ?? err}`)
      continue
    }

    if (rows.length === 0) {
      console.log(`${source.name.padEnd(20)}${String(0).padStart(5)}   (ei tuotosta)`)
      continue
    }

    if (ENRICH && typeof source.enrich === "function") {
      rows = rows.slice(0, SAMPLE)
      for (let i = 0; i < rows.length; i++) {
        try {
          rows[i] = await source.enrich(rows[i])
        } catch {
          /* Yksittäinen sivuhaku voi epäonnistua; mitataan loput silti. */
        }
      }
    } else if (ENRICH) {
      rows = rows.slice(0, SAMPLE)
    }

    const pct = (n: number) => `${Math.round((n / rows.length) * 100)}%`
    const count = (f: (r: any) => unknown) => rows.filter((r) => f(r)).length
    const phases: Record<string, number> = {}
    for (const r of rows) phases[r.phase ?? "-"] = (phases[r.phase ?? "-"] ?? 0) + 1

    console.log(
      source.name.padEnd(20) +
        String(rows.length).padStart(5) +
        pct(count((r) => r.description)).padStart(9) +
        pct(count((r) => r.city)).padStart(10) +
        pct(count((r) => r.location)).padStart(9) +
        pct(count((r) => r.developer)).padStart(8) +
        pct(count((r) => r.builder)).padStart(7) +
        pct(count((r) => r.property_type)).padStart(8) +
        "  " +
        Object.entries(phases)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([p, c]) => `${p}:${c}`)
          .join(" ")
    )
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
