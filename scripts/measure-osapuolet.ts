import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * OSAPUOLTEN MITTAUS: KATKENNUT NIMI JA RISTIIN MENNEET ROOLIT.
 *
 * Havaittu 12.9.2026 yhdellä rivillä (Senaatti/Tulli): `developer` oli
 * "Tull" ja `builder` "Senaatti-kiinteistöt", vaikka teksti sanoo
 * "Senaatti-kiinteistöt rakennuttaa" ja "Rakentamisesta vastaa NCC".
 *
 * Tämä skripti EI KORJAA MITÄÄN. Se vain laskee kuinka moni rivi on
 * samalla tavalla väärin, ja tulostaa näytteet luettavaksi.
 *
 *   npx tsx scripts/measure-osapuolet.ts
 *   npx tsx scripts/measure-osapuolet.ts --naytteet=20
 */

const NAYTTEITA = Number(process.argv.find((a) => a.startsWith("--naytteet="))?.split("=")[1] ?? 8)

/*
 * Piste EI kuulu nimeen: ensimmäisessä mittauksessa kaappaus jatkui
 * virkkeen yli ("Mestek Oy. Avainsanat", "Consti Korjausrakentaminen Oy.
 * Pääsuunnittelijana").
 */
const ISO = "[A-ZÄÖÅ][\\wÄÖÅäöå&-]*"
const NIMI = `${ISO}(?:\\s+${ISO}){0,3}`

/* "Senaatti-kiinteistöt rakennuttaa", "NCC rakennuttaa" */
const RAKENNUTTAA = new RegExp(`(${NIMI})\\s+rakennutta`, "")

/* "Rakentamisesta vastaa NCC", "Urakoitsijana toimii YIT" */
const RAKENTAJA = [
  new RegExp(`[Rr]akentamisesta\\s+vasta\\w*\\s+(${NIMI})`, ""),
  new RegExp(`[Pp]ääurakoitsija\\w*\\s+(?:on|toimii)\\s+(${NIMI})`, ""),
  new RegExp(`[Uu]rakoitsijana\\s+(?:on\\s+|toimii\\s+)?(${NIMI})`, ""),
]

/* Yhtiömuoto ja välimerkit pois vertailua varten. */
function avain(nimi: unknown): string {
  return String(nimi ?? "")
    .toLowerCase()
    .replace(/\b(oy|oyj|ab|ltd|konserni|group)\b/g, " ")
    .replace(/[^a-zåäö0-9]+/g, "")
    .trim()
}

function osuu(a: unknown, b: unknown): boolean {
  const x = avain(a)
  const y = avain(b)
  if (!x || !y) return false
  return x === y || x.includes(y) || y.includes(x)
}

/*
 * KATKENNUT NIMI: tallennettu arvo ei esiinny tekstissä omana sanana,
 * mutta on jonkin pidemmän sanan alku ("Tull" <- "Tullin", "Tullille").
 *
 * JATKON ON OLTAVA SIJAPÄÄTE, EI MIKÄ TAHANSA. Ensimmäinen versio hyväksyi
 * minkä tahansa pidemmän sanan, ja se tuotti 150 osumaa joista luetut
 * olivat vääriä: `developer="Muu"` osui sanaan "muutos" ja
 * `developer="Kaupunki"` sanaan "Kaupunkiympäristölautakunta". Molemmat
 * ovat aitoja arvoja, eivät katkenneita nimiä.
 */
const SIJAPAATE =
  "(?:n|in|t|i|a|ä|en|jen|ien|lle|lla|llä|lta|ltä|ssa|ssä|sta|stä|ksi|na|nä|ille|illa|illä|ista|istä|issa|issä)"

function katkennut(arvo: unknown, teksti: string): string | null {
  const nimi = String(arvo ?? "").trim()
  if (nimi.length < 3 || nimi.includes(" ")) return null

  const omanaSanana = new RegExp(`(^|[^\\wÄÖÅäöå])${nimi}([^\\wÄÖÅäöå]|$)`, "i")
  if (omanaSanana.test(teksti)) return null

  const pidempi = teksti.match(
    new RegExp(`(^|[^\\wÄÖÅäöå])(${nimi}${SIJAPAATE})([^\\wÄÖÅäöå]|$)`, "i")
  )
  return pidempi ? pidempi[2] : null
}

function ensimmainen(teksti: string, kuviot: RegExp[]): string | null {
  for (const re of kuviot) {
    const m = teksti.match(re)
    if (m?.[1]) return m[1].trim()
  }
  return null
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const rivit: any[] = []
  for (const table of ["potential_projects", "projects"] as const) {
    const columns =
      table === "potential_projects"
        ? "id, title, metadata"
        : "id, name, developer, builder, additional_info, metadata"
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from(table).select(columns).range(from, from + 999)
      if (error) throw error
      rivit.push(...(data ?? []).map((r: any) => ({ ...r, _taulu: table })))
      if (!data || data.length < 1000) break
    }
  }

  let osapuolellisia = 0
  const katkenneet: any[] = []
  const rooliRistiin: any[] = []
  const rakentajaPuuttuu: any[] = []
  const lahteetKatkennut = new Map<string, number>()
  const lahteetRooli = new Map<string, number>()

  for (const r of rivit) {
    const teksti = String(r.additional_info ?? r.metadata?.description ?? "")
    const developer = r.developer ?? r.metadata?.developer
    const builder = r.builder ?? r.metadata?.builder
    const lahde = r.metadata?.source_name ?? "?"
    if (!developer && !builder) continue
    osapuolellisia++
    if (teksti.length < 60) continue

    for (const [kentta, arvo] of [["developer", developer], ["builder", builder]] as const) {
      const koko = katkennut(arvo, teksti)
      if (!koko) continue
      /*
       * KOKO AINEISTO RATKAISEE, EI YKSI RIVI. Rivikohtainen sääntö
       * ("nimi ei esiinny omana sanana tässä tekstissä") leimasi oikeat
       * nimet: "Väylävirasto" esiintyy tekstissä muodossa
       * "Väyläviraston", mikä on tavallista taivutusta. Aito katkennut
       * nimi ("Tull") ei esiinny omana sanana MISSÄÄN kuvauksessa.
       * Päätös tehdään siksi vasta silmukan jälkeen.
       */
      katkenneet.push({ r, kentta, arvo, koko, lahde })
    }

    const tekstinRakennuttaja = ensimmainen(teksti, [RAKENNUTTAA])
    const tekstinRakentaja = ensimmainen(teksti, RAKENTAJA)
    if (!tekstinRakennuttaja || !tekstinRakentaja) continue
    if (osuu(tekstinRakentaja, tekstinRakennuttaja)) continue

    /* Ristiin: tallennettu rakentaja on tekstin rakennuttaja. */
    if (builder && osuu(builder, tekstinRakennuttaja) && !osuu(builder, tekstinRakentaja)) {
      rooliRistiin.push({ r, builder, developer, tekstinRakentaja, tekstinRakennuttaja, lahde })
      lahteetRooli.set(lahde, (lahteetRooli.get(lahde) ?? 0) + 1)
    } else if (!builder || !osuu(builder, tekstinRakentaja)) {
      rakentajaPuuttuu.push({ r, builder, tekstinRakentaja, lahde })
    }
  }

  /* Koko aineiston sanasto: esiintyykö arvo jossain omana sananaan. */
  const sanasto = new Set<string>()
  for (const r of rivit) {
    const teksti = String(r.additional_info ?? r.metadata?.description ?? "")
    for (const sana of teksti.match(/[A-Za-zÄÖÅäöå][\wÄÖÅäöå&-]*/g) ?? []) {
      sanasto.add(sana.toLowerCase())
    }
  }

  const aidot = katkenneet.filter((k) => !sanasto.has(String(k.arvo).toLowerCase()))
  for (const k of aidot) lahteetKatkennut.set(k.lahde, (lahteetKatkennut.get(k.lahde) ?? 0) + 1)

  const top = (m: Map<string, number>) =>
    [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, n]) => `${k}:${n}`).join(", ")

  console.log(`rivejä yhteensä ${rivit.length}, joilla osapuoli ${osapuolellisia}`)
  console.log(
    `\nKATKENNUT NIMI: ${aidot.length} riviä ` +
      `(rivikohtainen sääntö antoi ${katkenneet.length}, mutta niistä ` +
      `${katkenneet.length - aidot.length} oli oikeita nimiä joiden nominatiivi ` +
      `esiintyy muualla aineistossa)   ${top(lahteetKatkennut)}`
  )
  const arvot = new Map<string, number>()
  for (const k of aidot) arvot.set(`${k.kentta}="${k.arvo}" <- "${k.koko}"`, (arvot.get(`${k.kentta}="${k.arvo}" <- "${k.koko}"`) ?? 0) + 1)
  for (const [arvo, n] of [...arvot.entries()].sort((a, b) => b[1] - a[1]).slice(0, NAYTTEITA * 2)) {
    console.log(`  ${String(n).padStart(3)} x  ${arvo}`)
  }
  console.log(`\nROOLIT RISTIIN: ${rooliRistiin.length}   ${top(lahteetRooli)}`)
  for (const k of rooliRistiin.slice(0, NAYTTEITA)) {
    console.log(
      `  ${k.r._taulu} ${String(k.r.title ?? k.r.name).slice(0, 46)}\n` +
        `      tallennettu: rakentaja="${k.builder}" rakennuttaja="${k.developer}"\n` +
        `      teksti:      rakentaja="${k.tekstinRakentaja}" rakennuttaja="${k.tekstinRakennuttaja}"`
    )
  }
  console.log(`\nRAKENTAJA PUUTTUU TAI ERI (teksti nimeää): ${rakentajaPuuttuu.length}`)
  for (const k of rakentajaPuuttuu.slice(0, Math.min(5, NAYTTEITA))) {
    console.log(`  ${String(k.r.title ?? k.r.name).slice(0, 50)}  tallennettu="${k.builder ?? "-"}" teksti="${k.tekstinRakentaja}"  [${k.lahde}]`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
