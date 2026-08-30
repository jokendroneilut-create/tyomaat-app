import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * KAKSI SAMANNIMISTÄ LOHKOA SAMALLA SIVULLA.
 *
 * Kun kerääjä muodostaa dokumentin osoitteen otsikosta
 * (`listaus#otsikon-slug`), kaksi samannimistä lohkoa kirjoittuu samaan
 * osoitteeseen ja jälkimmäinen ylikirjoittaa ensimmäisen. Pietarsaaressa
 * niin katosi kirkon korttelin kaava kokonaan (D-145) — eikä siitä
 * näkynyt jälkeä, koska `documentsFound` ja `documentsSaved` olivat
 * molemmat oikein.
 *
 * Yli 20 kaavalähdettä muodostaa osoitteen samalla tavalla. Tämä skripti
 * käy ne läpi ja kertoo missä sama vaara on.
 *
 * MITEN. Jokaiselle ankkuriosoitteelle haetaan sen listaussivu kerran,
 * luetaan lohko-otsikot samalla säännöllä kuin ankkurin haku
 * (`blockHeadings`) ja katsotaan, tuottaako kaksi eri otsikkoa saman
 * slugin. Osuma raportoidaan vain jos slug on meillä oikeasti käytössä —
 * muuten sivun leipätekstin toistuvat väliotsikot ("Suunnittelija",
 * "Yhteystiedot") täyttäisivät listan.
 *
 * EI KIRJOITA MITÄÄN. Tämä on mittari, ei korjaus.
 *
 *   npx tsx scripts/check-duplicate-blocks.ts
 */

const VIIVE_MS = 400

function odota(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function main() {
  const cheerio: any = await import("cheerio")
  const { createClient } = await import("@supabase/supabase-js")
  const { anchorSlug, blockHeadings, blockTextsForSlug, blocksLookIdentical } =
    await import("../lib/agent/htmlAnchorBlock")
  const { kiellettyOsoite } = await import("../lib/agent/kielletytLahteet")

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const docs: any[] = []
  for (let f = 0; ; f += 1000) {
    const { data, error } = await admin
      .from("source_documents")
      .select("source_id,source_name,title,document_url")
      .like("document_url", "%#%")
      .range(f, f + 999)
    if (error) throw error
    docs.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  /* Ryhmitellään listaussivun mukaan, ei lähteen url-kentän mukaan. */
  type Sivu = { lahde: string; slugit: Set<string>; dokumentteja: number }
  const sivut = new Map<string, Sivu>()

  for (const d of docs) {
    const [perus, ankkuri] = String(d.document_url).split("#")
    if (!ankkuri) continue
    const s = sivut.get(perus) ?? { lahde: String(d.source_name), slugit: new Set<string>(), dokumentteja: 0 }
    s.slugit.add(ankkuri)
    s.dokumentteja++
    sivut.set(perus, s)
  }

  console.log(`Ankkuriosoitteita kayttavia listaussivuja: ${sivut.size}\n`)

  const osumat: any[] = []
  let haettu = 0
  let virheita = 0
  let ohitettu = 0

  for (const [url, sivu] of sivut) {
    if (kiellettyOsoite(url)) {
      ohitettu++
      continue
    }

    let otsikot: string[]
    let lataus: any = null
    try {
      const res = await fetch(url, { cache: "no-store" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const $ = cheerio.load(await res.text())
      otsikot = blockHeadings($)
      lataus = $
      haettu++
    } catch (e: any) {
      virheita++
      console.log(`  VIRHE  ${sivu.lahde.slice(0, 40).padEnd(42)} ${String(e?.message).slice(0, 24)}`)
      await odota(VIIVE_MS)
      continue
    }

    /* Kuinka moni ERI otsikko tuottaa saman slugin. */
    const slugRyhmat = new Map<string, Set<string>>()
    for (const t of otsikot) {
      const slug = anchorSlug(t)
      if (!slug) continue
      const ryhma = slugRyhmat.get(slug) ?? new Set<string>()
      ryhma.add(t)
      slugRyhmat.set(slug, ryhma)
    }

    /*
     * TOISTUVA OTSIKKO EI VIELA OLE MENETYS. Osa keraajista erottaa
     * samannimiset lohkot jo nyt: Pornainen jarjestysnumerolla ja
     * Pietarsaari kuvauksen tiivisteella (D-145). Menetys on vasta se,
     * etta sivulla on N lohkoa mutta meilla vahemman kuin N dokumenttia.
     */
    const kaksoiset: { slug: string; lohkoja: number; dokumentteja: number; sama: boolean }[] = []
    for (const t of otsikot) {
      const slug = anchorSlug(t)
      if (!sivu.slugit.has(slug)) continue
      if (kaksoiset.some((k) => k.slug === slug)) continue
      const lohkoja = otsikot.filter((x) => anchorSlug(x) === slug).length
      if (lohkoja < 2) continue
      /* Erotellut tunnisteet: slug, slug-2 tai slug-a1b2c3d4. */
      const dokumentteja = [...sivu.slugit].filter(
        (x) => x === slug || new RegExp(`^${slug}-([0-9]+|[0-9a-f]{8})$`).test(x)
      ).length
      /*
       * SISALTO RATKAISEE. Toistuva otsikko on useimmiten sama kaava
       * kahdella otsikkotasolla tai otsikko ja linkkilistan rivi; vasta
       * eroavat sisallot kertovat kahdesta eri kaavasta.
       */
      const tekstit = blockTextsForSlug(lataus, slug)
      const sama = blocksLookIdentical(tekstit)
      kaksoiset.push({ slug, lohkoja, dokumentteja, sama })
    }

    const menetetyt = kaksoiset.filter((k) => !k.sama && k.dokumentteja < k.lohkoja)

    if (kaksoiset.length) {
      osumat.push({ url, lahde: sivu.lahde, kaksoiset, menetetyt, dokumentteja: sivu.dokumentteja })
      const tila = menetetyt.length ? `MENETYS ${menetetyt.length}` : "eroteltu"
      console.log(`  ${menetetyt.length ? "OSUMA " : "ok    "} ${sivu.lahde.slice(0, 40).padEnd(42)} ${kaksoiset.length} toistuvaa otsikkoa, ${tila}`)
    }

    await odota(VIIVE_MS)
  }

  console.log(`\nhaettu ${haettu} sivua | virheita ${virheita} | ohitettu ${ohitettu} (lahde kieltaa haun)`)
  const menettavat = osumat.filter((o) => o.menetetyt.length)

  console.log(`
SIVUJA JOISSA TOISTUVA OTSIKKO: ${osumat.length}`)
  console.log(`NIISTA MENETTAA KAAVAN:          ${menettavat.length}
`)

  for (const o of osumat) {
    console.log(`  ${o.menetetyt.length ? "MENETYS " : "eroteltu"} ${o.lahde}`)
    console.log(`     ${o.url}`)
    for (const k of o.kaksoiset) {
      console.log(`     ${String(k.slug).padEnd(52)} lohkoja ${k.lohkoja}, dokumentteja ${k.dokumentteja}, ${k.sama ? "sama kaava" : "ERI SISALTO"}`)
    }
  }
  if (!osumat.length) console.log("  ei yhtaan")
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
export {}
