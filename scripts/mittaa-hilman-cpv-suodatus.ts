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
 * SUODATTAAKO HILMAN KYSELY OIKEASTI CPV:N MUKAAN?
 *
 * Johannes 25.10.2026: *"jonossa on paljon avoterapiahankintoja?
 * Miksi?"* Riveilla on `cpv_code: 85000000` (terveys- ja
 * sosiaalipalvelut), vaikka keraaja hakee `cpvCodes:(45*)`.
 *
 * EPAILY: Azure Searchin oletus on `queryType: "simple"`, jossa
 * kenttakohtaista syntaksia `kentta:(arvo)` EI tueta -- se luetaan
 * pelkkina sanoina. Kun lisaksi `searchMode: "any"`, riittaa etta YKSI
 * sana osuu mihin tahansa kenttaan.
 *
 * Tama ajaa saman kyselyn kuin keraaja ja laskee palautuvien
 * ilmoitusten CPV-alkuosat. Ei kirjoita mitaan.
 *
 *   npx tsx scripts/mittaa-hilman-cpv-suodatus.ts
 */

const URL = "https://api.hankintailmoitukset.fi/avp/eformnotices/docs/search"

async function haeSivu(body: any, apiKey: string): Promise<any> {
  for (let yritys = 0; yritys < 4; yritys++) {
    const res = await fetch(URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Ocp-Apim-Subscription-Key": apiKey },
      body: JSON.stringify(body),
      cache: "no-store",
    })
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 2000 * (yritys + 1)))
      continue
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
    return res.json()
  }
  throw new Error("429 toistui")
}

function cpvt(notice: any): string[] {
  const raaka = notice.cpvCodes ?? notice.cpvCode ?? notice.cpv ?? null
  const lista = Array.isArray(raaka) ? raaka : raaka == null ? [] : [raaka]
  /* Kentta voi olla taulukko TAI valilyonnein eroteltu merkkijono. */
  return lista
    .flatMap((c: any) => String(c?.code ?? c).split(/[\s,;]+/))
    .map((c: string) => c.trim())
    .filter(Boolean)
}

async function main() {
  const apiKey = process.env.HILMA_API_KEY
  if (!apiKey) {
    console.error("HILMA_API_KEY puuttuu")
    process.exit(1)
  }

  const kyselyt = [
    { nimi: "NYKYINEN (simple + any)", body: { search: "cpvCodes:(45*)", searchMode: "any" } },
    { nimi: "queryType full (lucene)", body: { search: "cpvCodes:(45*)", queryType: "full" } },
    {
      nimi: "full + searchFields",
      body: { search: "45*", queryType: "full", searchFields: "cpvCodes" },
    },
  ]

  for (const k of kyselyt) {
    console.log(`\n=== ${k.nimi} ===`)
    console.log(`    ${JSON.stringify(k.body)}`)
    let json: any
    try {
      json = await haeSivu({ ...k.body, top: 100, skip: 0, count: true, orderby: "datePublished desc" }, apiKey)
    } catch (e: any) {
      console.log(`    VIRHE: ${e?.message ?? e}`)
      continue
    }
    const notices: any[] = Array.isArray(json.value) ? json.value : []
    console.log(`    osumia yhteensa: ${json["@odata.count"] ?? "?"}, sivulla ${notices.length}`)

    const jakauma = new Map<string, number>()
    let ilman45 = 0
    for (const n of notices) {
      const koodit = cpvt(n)
      const alut = [...new Set(koodit.map((c) => c.slice(0, 2)))]
      if (!alut.includes("45")) ilman45 += 1
      for (const a of alut.length ? alut : ["(ei koodia)"]) jakauma.set(a, (jakauma.get(a) ?? 0) + 1)
    }
    console.log(`    EI YHTAAN 45*-koodia: ${ilman45} / ${notices.length}`)
    const rivit = [...jakauma.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
    console.log(`    CPV-alkuosat: ${rivit.map(([a, n]) => `${a}=${n}`).join(", ")}`)

    const vieraat = notices.filter((n) => !cpvt(n).some((c) => c.startsWith("45"))).slice(0, 5)
    for (const n of vieraat) {
      const otsikko =
        n.noticeTitle ?? n.title ?? n.projectTitle ?? JSON.stringify(n).slice(0, 60)
      console.log(`      - [${cpvt(n).join(",") || "ei koodia"}] ${String(otsikko).slice(0, 72)}`)
    }
  }
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
