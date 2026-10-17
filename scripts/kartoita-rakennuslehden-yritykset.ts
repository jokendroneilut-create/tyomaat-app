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
 * ANTAISIKO RAKENNUSLEHTI VIHJEEN PUUTTUVISTA LAHTEISTA?
 *
 * Johannes 17.10.2026: *"katso nyt siis vain etta voisi sielta saada
 * jotain lahteita."*
 *
 * Sama ajatus kuin `docs/20_YRITYSLAHTEET.md`:ssa, mutta rajattuna
 * Rakennuslehdesta tulleisiin hankkeisiin. Rajaus on perusteltu: D-294
 * mittasi etta 42 / 76 Rakennuslehti-hanketta ei tasmaa mihinkaan muuhun
 * — ne ovat siis juuri niita jotka EIVAT tule meille mitaan muuta reittia.
 * Niissa esiintyva yritys on siksi vahvempi lahde-ehdokas kuin yritys
 * joka esiintyy Hilman kautta jo tulevissa hankkeissa.
 *
 * MITTARIN KAKSI TUNNETTUA ANSAA (docs/20):
 *   1. `projects.status` on `active`, ei `approved` — vaara arvo palauttaa
 *      0 rivia ILMAN virhetta.
 *   2. "onko lahteena" on tarkistettava SEKA `sources.ts` ETTA
 *      `discovery_sources` -taulusta, ja sanarajalla: alle 4 merkin
 *      nimet (grk, ncc, srv, yit) nayttivat puuttuvina.
 *
 *   npx tsx scripts/kartoita-rakennuslehden-yritykset.ts
 */

const LAHDE = "rakennuslehti"

/* Julkinen tilaaja ei ole yrityslahde-ehdokas. */
const JULKINEN =
  /kaupunki|kunta|kuntayhtym|hyvinvointialue|virasto|valtio|seurakunta|yliopisto|liikelaitos|elinvoimakeskus|senaatti|puolustuskiinteist|v[aä]yl[aä]|ely-keskus/i

const YHTIOMUOTO = /\b(oyj|oy|ab|abp|ky|ltd|plc|group|konserni|kiinteist[oö]t)\b/gi

function siistiNimi(raaka: string): string {
  return raaka
    .replace(/\(\s*\d{7}-\d\s*\)/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function avain(nimi: string): string {
  return nimi.replace(YHTIOMUOTO, " ").replace(/\s+/g, " ").trim().toLowerCase()
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { sources } = await import("../lib/agent/sources")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

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

  /* 1. Lahdelista: tiedosto JA kanta. */
  const kantaLahteet: any[] = await kaikki("discovery_sources", "id, name, parser, url")
  const lahdeSanat = new Set<string>()
  for (const s of (sources as any[]) ?? []) {
    for (const osa of String(s.name).split(/[_-]/)) if (osa.length > 1) lahdeSanat.add(osa.toLowerCase())
  }
  for (const s of kantaLahteet) {
    for (const kentta of [s.id, s.name, s.parser]) {
      for (const osa of String(kentta ?? "").split(/[_\s-]/)) if (osa.length > 1) lahdeSanat.add(osa.toLowerCase())
    }
  }
  console.log(`lahdesanoja ${lahdeSanat.size} (${(sources as any[]).length} tiedostossa, ${kantaLahteet.length} kannassa)`)

  const onkoLahteena = (nimi: string): boolean => {
    const sanat = avain(nimi).split(/\s+/).filter((s) => s.length > 1)
    /* Sanaraja: koko sanan on tasmattava, ei nimen sisalta. */
    return sanat.some((s) => lahdeSanat.has(s))
  }

  /* 2. Rakennuslehdesta tulleet hankkeet. */
  const hankkeet: any[] = await kaikki(
    "projects",
    "id, name, status, developer, builder, contractor, metadata, created_at"
  )
  const rl = hankkeet.filter((p) => p.metadata?.source_name === LAHDE)
  console.log(`hankkeita ${hankkeet.length}, niista Rakennuslehdesta ${rl.length}`)
  if (!rl.length) {
    console.error("VIRHE: 0 Rakennuslehti-hanketta — tarkista metadata.source_name")
    process.exit(1)
  }

  /* 3. Yritysnimet naista hankkeista. */
  const laskuri = new Map<string, { n: number; esimerkki: string; rooli: Set<string> }>()
  for (const p of rl) {
    for (const [rooli, kentta] of [
      ["rakennuttaja", p.developer],
      ["rakentaja", p.builder],
      ["urakoitsija", p.contractor],
    ] as const) {
      if (!kentta) continue
      for (const raaka of String(kentta).split(/[,;]|\s+ja\s+/)) {
        const nimi = siistiNimi(raaka)
        if (nimi.length < 3 || nimi.length > 45) continue
        if (JULKINEN.test(nimi)) continue
        const k = avain(nimi)
        if (!k) continue
        const g = laskuri.get(k) ?? { n: 0, esimerkki: nimi, rooli: new Set<string>() }
        g.n++
        g.rooli.add(rooli)
        laskuri.set(k, g)
      }
    }
  }

  const kaikkiNimet = [...laskuri].sort((a, b) => b[1].n - a[1].n)
  const puuttuvat = kaikkiNimet.filter(([k]) => !onkoLahteena(k))
  const onLahteena = kaikkiNimet.filter(([k]) => onkoLahteena(k))

  console.log(`\nyritysnimia ${kaikkiNimet.length}: lahteena ${onLahteena.length}, ei lahteena ${puuttuvat.length}`)

  console.log(`\n=== EI LAHTEENA, Rakennuslehti-hankkeiden mukaan ===`)
  console.log(`hankk  roolit                      nimi`)
  for (const [, g] of puuttuvat.filter((x) => x[1].n >= 2)) {
    console.log(`${String(g.n).padStart(5)}  ${[...g.rooli].join("+").padEnd(26)}  ${g.esimerkki}`)
  }
  const kerran = puuttuvat.filter((x) => x[1].n === 1)
  console.log(`\nvain 1 hanke (${kerran.length}):`)
  for (const [, g] of kerran) {
    console.log(`       ${[...g.rooli].join("+").padEnd(26)}  ${g.esimerkki}`)
  }

  console.log(`\n=== JO LAHTEENA (varmistus ettei mittari valehtele) ===`)
  for (const [, g] of onLahteena.slice(0, 12)) {
    console.log(`${String(g.n).padStart(5)}  ${g.esimerkki}`)
  }

  /*
   * RATKAISEVA LUKU: TULEEKO HANKE MEILLE JO TOISEN OSAPUOLEN KAUTTA?
   *
   * Pelkka hankemaara ei riita paatokseen. Jos yritys on rakennuttaja ja
   * sen rakentaja on jo lahteemme, hanke tulee meille ilman uutta
   * lahdetta — uusi lahde toisi vain nopeutta, ei kattavuutta. Lahde
   * kannattaa vasta kun yritys on hankkeen AINOA tunnettu osapuoli joka
   * voisi siita kertoa.
   *
   * Luku lasketaan koko kannan yli, ei vain Rakennuslehti-hankkeista:
   * Rakennuslehti paljastaa nimen, mutta nimen arvo mitataan kaikesta.
   */
  console.log(`\n=== TOISIN SANOEN: MONTAKO HANKETTA JAISI ILMAN TATA LAHDETTA? ===`)
  console.log(`nimi                        hankk  yksin  toinen osapuoli lahteena`)
  const ehdokkaat = puuttuvat.map(([, g]) => g.esimerkki)
  const rivit: any[] = []
  for (const nimi of ehdokkaat) {
    const k = avain(nimi)
    const osuvat = hankkeet.filter((p) =>
      [p.developer, p.builder, p.contractor].some((kentta) =>
        String(kentta ?? "").toLowerCase().includes(k)
      )
    )
    if (!osuvat.length) continue
    let yksin = 0
    for (const p of osuvat) {
      /* Muut osapuolet kuin tama yritys. */
      const muut: string[] = []
      for (const kentta of [p.developer, p.builder, p.contractor]) {
        for (const raaka of String(kentta ?? "").split(/[,;]|\s+ja\s+/)) {
          const nim = siistiNimi(raaka)
          if (!nim || avain(nim).includes(k)) continue
          muut.push(nim)
        }
      }
      const muuLahteena = muut.some((m) => onkoLahteena(m) || JULKINEN.test(m))
      if (!muuLahteena) yksin++
    }
    rivit.push({ nimi, kaikki: osuvat.length, yksin })
  }
  for (const r of rivit.sort((a, b) => b.yksin - a.yksin || b.kaikki - a.kaikki).slice(0, 16)) {
    console.log(
      `${r.nimi.slice(0, 26).padEnd(28)}${String(r.kaikki).padStart(5)}${String(r.yksin).padStart(7)}${String(r.kaikki - r.yksin).padStart(10)}`
    )
  }
}
main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
