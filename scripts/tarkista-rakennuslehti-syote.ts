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
 * ONKO RAKENNUSLEHDEN UUTISVIRRASSA HANKKEITA JOITA MEILLA EI OLE?
 *
 * D-294 mittasi vastakkaisen suunnan: jo HYVAKSYTYT Rakennuslehti-hankkeet
 * muuta kantaa vasten. Tama katsoo syotteen lapi sellaisenaan ja kysyy
 * kahta eri asiaa, jotka on pidettava erillaan:
 *
 *   A) Minka jutun suodattimemme PUDOTTAA? Pudotus voi olla oikein
 *      (yrityskauppa, suhdanneluku) tai hukka (hanke jota ei tunnistettu).
 *   B) Mika syotteen juttu EI TASMAA mihinkaan kannassamme? Se on
 *      hanke jota meilla ei ole — riippumatta siita paasiko se lapi.
 *
 * Tasmays tehdaan TUOTANNON tasmayttajalla ja oikeassa parametrijarjestyksessa
 * (vertailujoukko ensin, ehdokas toisena, pistekentta `confidence`) — vaarin
 * pain kutsuttuna se palauttaa null kaikille ja antaa uskottavan mutta
 * tasmalleen vaaran tuloksen (D-294).
 *
 * HUOM: tiedosto on kirjoitettava Write-tyokalulla. Heredocissa template-
 * literaalin `[\s\S]` latistui muotoon `[sS]`, jolloin jokainen otsikko
 * tuli tyhjana ja tulos oli "50 juttua joita meilla ei ole".
 *
 *   npx tsx scripts/tarkista-rakennuslehti-syote.ts
 */

const FEED_URL = "https://www.rakennuslehti.fi/feed/"
const OSUMAN_RAJA = 40

const OTSIKKO = /<title[^>]*>([^]*?)<\/title>/i
const LINKKI = /<link[^>]*>([^]*?)<\/link>/i
const KUVAUS = /<description[^>]*>([^]*?)<\/description>/i
const PVM = /<pubDate[^>]*>([^]*?)<\/pubDate>/i

function siisti(raaka: string | undefined): string {
  if (!raaka) return ""
  return raaka
    .replace(/<!\[CDATA\[([^]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#8211;|&#8212;/g, "-")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim()
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { findProjectMatchDetailed } = await import("../lib/agent/projectMatcher")
  const { fetchRakennuslehtiSource } = await import("../lib/agent/fetchRakennuslehtiSource")
  const { detectCityFromText } = await import("../lib/agent/detectCityFromText")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  /* 1. Syote sellaisenaan. */
  const xml = await (await fetch(FEED_URL, { cache: "no-store" })).text()
  const palat = xml.split("<item>").slice(1)
  const jutut = palat.map((pala) => {
    const it = pala.split("</item>")[0]
    return {
      otsikko: siisti(it.match(OTSIKKO)?.[1]),
      linkki: siisti(it.match(LINKKI)?.[1]),
      kuvaus: siisti(it.match(KUVAUS)?.[1]),
      pvm: siisti(it.match(PVM)?.[1]),
    }
  })
  const tyhjat = jutut.filter((j) => !j.otsikko).length
  console.log(`syotteessa ${jutut.length} juttua, otsikko puuttuu ${tyhjat}:lta`)
  if (tyhjat) {
    console.error("VIRHE: jasennys ei tuottanut otsikoita, ei jatketa")
    process.exit(1)
  }
  console.log(`  uusin  ${jutut[0].pvm}`)
  console.log(`  vanhin ${jutut[jutut.length - 1].pvm}`)

  /* 2. Mitka paasevat suodattimesta lapi? */
  const lapi: any[] = (await fetchRakennuslehtiSource()) ?? []
  const lapiLinkit = new Set<string>()
  for (const c of lapi) {
    for (const k of ["sourceUrl", "source_url", "url", "link"]) {
      const v = String((c as any)[k] ?? "").trim()
      if (v) lapiLinkit.add(v)
    }
  }
  console.log(`\nsuodattimesta lapi: ${lapi.length} / ${jutut.length}`)

  /* 3. Vertailujoukko: koko kanta seka jono. */
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
  const projektit: any[] = await kaikki(
    "projects",
    "id, name, city, region, location, status, developer, builder, contractor, metadata"
  )
  const jono: any[] = await kaikki("potential_projects", "id, title, municipality, address, status, metadata")
  console.log(`vertailujoukko: ${projektit.length} hanketta + ${jono.length} jonorivia`)

  const vertailu = [
    ...projektit,
    ...jono.map((r) => ({
      id: r.id,
      name: r.title,
      city: r.municipality,
      region: null,
      location: r.address,
      status: r.status,
      metadata: r.metadata,
    })),
  ]

  /* 4. Jokainen syotteen juttu tasmaytetaan. */
  const puuttuvat: any[] = []
  const loytyvat: any[] = []
  for (const j of jutut) {
    const kaupunki = detectCityFromText(`${j.otsikko} ${j.kuvaus}`)
    const ehdokas: any = {
      name: j.otsikko,
      sourceTitle: j.otsikko,
      city: kaupunki ?? null,
      region: null,
      location: null,
      permitNumber: null,
      propertyId: null,
      developer: null,
      buildingType: null,
    }
    const osuma = findProjectMatchDetailed(vertailu as any, ehdokas)
    const rivi = {
      ...j,
      kaupunki,
      lapaisi: lapiLinkit.has(j.linkki),
      piste: osuma?.confidence ?? 0,
      osumaNimi: osuma?.project?.name ?? null,
    }
    if ((osuma?.confidence ?? 0) >= OSUMAN_RAJA) loytyvat.push(rivi)
    else puuttuvat.push(rivi)
  }

  console.log(`\n=== TASMAYS (raja ${OSUMAN_RAJA}) ===`)
  console.log(`meilla jo: ${loytyvat.length}`)
  console.log(`ei tasmaa: ${puuttuvat.length}`)
  console.log(`  joista suodatin paastaisi lapi: ${puuttuvat.filter((r) => r.lapaisi).length}`)

  console.log(`\n--- EI TASMAA MIHINKAAN ---`)
  for (const r of puuttuvat) {
    console.log(`\n${r.lapaisi ? "[LAPI]  " : "[SUODAT]"} ${r.pvm.slice(5, 16)}  ${r.kaupunki ?? "-"}`)
    console.log(`  ${r.otsikko}`)
    console.log(`  ${r.linkki}`)
    if (r.piste > 0) console.log(`  lahin osuma ${r.piste}: ${r.osumaNimi}`)
  }

  console.log(`\n--- MEILLA JO ---`)
  for (const r of loytyvat) {
    console.log(`  ${String(r.piste).padStart(3)}  ${r.otsikko.slice(0, 46).padEnd(48)} -> ${String(r.osumaNimi ?? "").slice(0, 42)}`)
  }
}
main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
