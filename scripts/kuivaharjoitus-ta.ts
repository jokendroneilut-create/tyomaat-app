/*
 * TA-Yhtioiden tiedotteiden kuivaharjoitus (D-254): mika lapaisee
 * suodatuksen ja mita ehdokkaasta tulee. Ei kirjoita mitaan.
 *
 *   npx tsx scripts/kuivaharjoitus-ta.ts
 *
 * Tulos on luettava riveittain: aiemmissa kuivaharjoituksissa virhe
 * loytyi vain otosta lukemalla, ei lukumaarista.
 */
import { tiedotteenAikaraja } from "../lib/agent/tiedotteenIkkuna"
import { jasennaTaTiedotteet, lapaiseeSuodatuksen, taEhdokas, TA_API } from "../lib/agent/fetchTaSource"
import { parseFoundationRelease } from "../lib/agent/foundationRelease"

const pvm = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "??????????")

async function main() {
  const res = await fetch(`${TA_API}?per_page=100&_fields=id,date,link,title,content`, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; tyomaat.fi/1.0)" },
  })
  const posts = (await res.json()) as any[]
  const kaikki = jasennaTaTiedotteet(posts)
  const raja = tiedotteenAikaraja()
  const ikkunassa = kaikki.filter((t) => !t.pvm || t.pvm >= raja)
  console.log(
    `TA: HTTP ${res.status}, X-WP-Total ${res.headers.get("x-wp-total")}, haettu ${kaikki.length}, ` +
      `12 kk ikkunassa ${ikkunassa.length}.\n`
  )

  const lapi = ikkunassa.filter((t) => lapaiseeSuodatuksen(t.otsikko, t.teksti))
  const hylatyt = ikkunassa.filter((t) => !lapaiseeSuodatuksen(t.otsikko, t.teksti))

  console.log(`=== LAPI PAASSEET (${lapi.length}) ===`)
  for (const t of lapi) {
    const k = taEhdokas(t)
    console.log(` + ${pvm(t.pvm)} ${t.otsikko}`)
    console.log(`   kaupunki=${k.city ?? "-"}  alue=${k.region ?? "-"}  vaihe=${k.phase}  valmis=${(k as any).completed ?? false}`)
    console.log(`   rakennuttaja=${k.developer}  paaurakoitsija=${k.builder ?? "-"}  tyyppi=${k.property_type ?? "-"}`)
    console.log(
      `   osoite=${k.location ?? "-"}  valmistuu=${k.estimated_completion ?? "-"}  asuntoja=${k.metadata.apartments ?? "-"}` +
        `  liittyvat=${JSON.stringify(k.metadata.related_companies ?? [])}`
    )
    console.log(`   url=${k.source_url}`)
  }

  console.log(`\n=== HYLATYT (${hylatyt.length}) ===`)
  for (const t of hylatyt) console.log(` - ${pvm(t.pvm)} ${t.otsikko}`)

  /*
   * VERTAILU: saatioiden yhteinen poimija (foundationReleaseParser,
   * developer_release). Kertoo miksi TA ei ole vain uusi rivi sille.
   */
  console.log(`\n=== VERTAILU: foundationReleaseParser samoille ${ikkunassa.length} tiedotteelle ===`)
  const syyt = new Map<string, number>()
  let hanke = 0
  for (const p of posts.filter((p) => new Date(p.date) >= raja)) {
    const r = parseFoundationRelease(p?.title?.rendered, p?.content?.rendered, p?.date)
    if (r.isProject) hanke++
    else syyt.set(r.reason.replace(/\(\d+ vrk\)/, "(>180 vrk)"), (syyt.get(r.reason.replace(/\(\d+ vrk\)/, "(>180 vrk)")) ?? 0) + 1)
  }
  console.log(`  hankkeeksi ${hanke}; hylatty: ${[...syyt.entries()].map(([s, n]) => `${n} ${s}`).join(", ")}`)
}
main().catch((e) => { console.error(e); process.exit(1) })
