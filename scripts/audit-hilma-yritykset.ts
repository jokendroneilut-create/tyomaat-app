import { readFileSync } from "node:fs"
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * MITA HILMA TIETAA TUNTEMISTAMME YRITYKSISTA, JA MIKA MEILTA PUUTTUU?
 *
 * Johannes 17.10.2026: "Ylojarven kiviset loytaa 2 hanketta ja meilla on
 * vain yksi. Kokeilin myos louhintahiekka niin sekin loysi monta."
 *
 * Haku tehdaan samalla rajapinnalla jota keraaja kayttaa, mutta vapaalla
 * tekstihaulla. Se antaa enemman kuin verkkosivun haku: "Ylojarven
 * Kiviset" 6 ilmoitusta (sivu naytti 2), "Louhintahiekka" 31.
 *
 * KAKSI ERI PUUTTUMISEN LAJIA, JOTKA ON EROTETTAVA:
 *   1. ilmoitus on keruuikkunamme SISALLA mutta meilta puuttuu -> aito aukko
 *   2. ilmoitus on ikkunaa VANHEMPI -> emme ole koskaan kerannyt sita
 *
 * Mitattu: Hilma-dokumenttimme kattavat 2026-07-08 alkaen, eli noin
 * kolme kuukautta. Valtaosa "puuttuvista" on siksi lajia 2.
 *
 *   npx tsx scripts/audit-hilma-yritykset.ts
 *   npx tsx scripts/audit-hilma-yritykset.ts --kaikki     (ei ylarajaa)
 */

const HAKU_URL = "https://api.hankintailmoitukset.fi/avp/eformnotices/docs/search"
const OLETUS_YRITYKSIA = 60

/* Julkinen tilaaja osuisi satoihin ilmoituksiin ostajana, ei voittajana. */
const JULKINEN =
  /kaupunki|kunta|kuntayhtym|hyvinvointialue|virasto|valtio|seurakunta|yliopisto|liikelaitos|elinvoimakeskus|senaatti|puolustuskiinteist|vayla|väylä/i

function siistiNimi(raaka: string): string {
  return raaka
    .replace(/\(\s*\d{7}-\d\s*\)/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

/* Hakusanaksi riittaa erotteleva osa; yhtiomuoto vain kaventaa turhaan. */
function hakusana(nimi: string): string {
  return nimi
    .replace(/\b(oyj|oy|ab|abp|ky|ltd|group|konserni)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
}

const odota = (ms: number) => new Promise((r) => setTimeout(r, ms))

/* Rajapinta alkoi palauttaa 429 noin 30 pyynnon jalkeen. */
async function haeHilmasta(kysely: string, apiKey: string, yritys = 0): Promise<{ virhe: string | null; rivit: any[] }> {
  try {
    const vastaus = await fetch(HAKU_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Ocp-Apim-Subscription-Key": apiKey },
      body: JSON.stringify({
        search: `"${kysely}"`,
        top: 60,
        skip: 0,
        count: true,
        searchMode: "all",
        orderby: "datePublished desc",
      }),
      cache: "no-store",
    })
    if (vastaus.status === 429 && yritys < 4) {
      await odota(2000 * (yritys + 1))
      return haeHilmasta(kysely, apiKey, yritys + 1)
    }
    if (!vastaus.ok) return { virhe: `HTTP ${vastaus.status}`, rivit: [] as any[] }
    const j: any = await vastaus.json()
    return { virhe: null, rivit: (j?.value ?? []) as any[] }
  } catch (e: any) {
    return { virhe: String(e?.message ?? e), rivit: [] as any[] }
  }
}

async function main() {
  const apiKey = process.env.HILMA_API_KEY
  if (!apiKey) {
    console.error("HILMA_API_KEY puuttuu")
    process.exit(1)
  }
  const kaikki = process.argv.includes("--kaikki")

  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const lue = async (taulu: string, sarakkeet: string) => {
    const out: any[] = []
    for (let a = 0; ; a += 1000) {
      const { data, error } = await db.from(taulu).select(sarakkeet).range(a, a + 999)
      if (error) {
        console.error(`VIRHE ${taulu}: ${error.message}`)
        process.exit(1)
      }
      out.push(...(data ?? []))
      if ((data ?? []).length < 1000) break
    }
    return out
  }

  /* 1. Mitka Hilma-ilmoitukset meilla jo on? */
  const docs = await lue("source_documents", "source_id, raw_payload")
  const omatIdt = new Set<string>()
  const paivat: string[] = []
  for (const d of docs) {
    if (d.source_id !== "hilma") continue
    const id = (d.raw_payload as any)?.noticeId
    if (id != null) omatIdt.add(String(id))
    const p = String((d.raw_payload as any)?.datePublished ?? "").slice(0, 10)
    if (p) paivat.push(p)
  }
  paivat.sort()
  const ikkunaAlku = paivat[0] ?? "9999-99-99"
  console.log(`Hilma-ilmoituksia meilla: ${omatIdt.size}`)
  console.log(`keruuikkuna: ${ikkunaAlku} - ${paivat[paivat.length - 1]}\n`)

  /* 2. Yrityslista: rakentajat ja voittajat omista hankkeista. */
  const hankkeet = await lue("projects", "builder, contractor, developer, metadata")
  const laskuri = new Map<string, number>()
  for (const p of hankkeet) {
    const ehdokkaat: string[] = []
    for (const k of [p.builder, p.contractor]) {
      if (k) ehdokkaat.push(...String(k).split(/[,;]|\bja\b/))
    }
    const voittajat = (p.metadata as any)?.winners
    if (Array.isArray(voittajat)) ehdokkaat.push(...voittajat.map(String))
    for (const raaka of ehdokkaat) {
      const nimi = siistiNimi(raaka)
      if (nimi.length < 5 || nimi.length > 45) continue
      if (JULKINEN.test(nimi)) continue
      laskuri.set(nimi, (laskuri.get(nimi) ?? 0) + 1)
    }
  }

  const yritykset = [...laskuri].sort((a, b) => b[1] - a[1])
  const otos = kaikki ? yritykset : yritykset.slice(0, OLETUS_YRITYKSIA)
  console.log(`yrityksia tunnistettu ${yritykset.length}, tarkistetaan ${otos.length}\n`)

  console.log("yritys                              hankk  Hilma45  meilla  PUUTTUU  (ikkunassa)")
  const aukot: { nimi: string; rivit: any[] }[] = []

  for (const [nimi, hankkeita] of otos) {
    const t = await haeHilmasta(hakusana(nimi), apiKey)
    if (t.virhe) {
      console.log(`${nimi.slice(0, 34).padEnd(36)} ${String(hankkeita).padStart(5)}  ${t.virhe}`)
      continue
    }
    /*
     * KAKSI RAJAUSTA, MOLEMMAT MITATTU TARPEELLISIKSI.
     *
     * 1. CPV 45* = rakennustyot. Ensimmainen ajo raportoi "aukoiksi"
     *    lumenaurausta (90620000), yllapitourakoita (50232100) ja
     *    infrasuunnittelua (71000000) - ne ovat keraimen tarkoituksellisia
     *    rajauksia, eivat aukkoja.
     *
     * 2. Nimen on esiinnyttava ilmoituksessa. Vapaa haku osui sanoihin:
     *    "Jatke" on suomen sana ja antoi 50 "aukkoa" ikkunassa.
     */
    const RAKENNUSTYO = /^45/
    const avain = hakusana(nimi).toLowerCase()
    const osuuNimeen = (r: any) =>
      JSON.stringify(r).toLowerCase().includes(avain)

    const osuvat = t.rivit.filter((r) => RAKENNUSTYO.test(String(r.cpvCodes ?? "")) && osuuNimeen(r))
    const meilla = osuvat.filter((r) => omatIdt.has(String(r.noticeId ?? r.id ?? "")))
    const puuttuu = osuvat.filter((r) => !omatIdt.has(String(r.noticeId ?? r.id ?? "")))
    const ikkunassa = puuttuu.filter((r) => String(r.datePublished ?? "").slice(0, 10) >= ikkunaAlku)

    await odota(400)
    console.log(
      `${nimi.slice(0, 34).padEnd(36)} ${String(hankkeita).padStart(5)}  ${String(osuvat.length).padStart(5)}  ` +
        `${String(meilla.length).padStart(6)}  ${String(puuttuu.length).padStart(7)}  ${String(ikkunassa.length).padStart(10)}`
    )
    if (ikkunassa.length) aukot.push({ nimi, rivit: ikkunassa })
  }

  console.log(`\n\n=== AIDOT AUKOT: ilmoitus keruuikkunassa mutta meilta puuttuu ===`)
  if (!aukot.length) {
    console.log("  (ei yhtaan)")
  }
  for (const a of aukot) {
    console.log(`\n${a.nimi}  (${a.rivit.length})`)
    for (const r of a.rivit.slice(0, 10)) {
      console.log(
        `   ${String(r.datePublished ?? "").slice(0, 10)}  ${String(r.noticeId ?? "").padEnd(7)} ` +
          `${String(r.cpvCodes ?? "").slice(0, 8).padEnd(9)} ${String(r.mainType ?? "").slice(0, 20).padEnd(22)}` +
          `${String(r.titleFi ?? r.title ?? "").slice(0, 46)}`
      )
    }
  }
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
