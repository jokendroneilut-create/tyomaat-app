/*
 * rpt-rematch.mjs — tarkistaa uudelleen, kuinka moni RPT:n puuttuvista
 * hankkeista on nyt kannassa. Vastaa kysymykseen "tuottiko kuntien
 * päätöslähteiden rakentaminen sen mitä siltä odotettiin".
 *
 * Aja projektin juuresta:  node scripts/rpt-rematch.mjs
 * Vain lukua Supabasesta; kirjoittaa tuloksen docs/rpt/-kansioon.
 *
 * MENETELMÄ on sama kaksivaiheinen kuin alkuperäisessä täsmäytyksessä
 * (docs/rpt/README.md): mekaaninen esikarsinta poimii saman kaupungin
 * lähimmät, ja LLM ratkaisee onko jokin niistä sama hanke. Sanapohjainen
 * mitta ei yksin riitä - "Lentorata välille Helsinki-Vantaa-Kerava" ja
 * "002653 Lentorata osa 2" ovat sama hanke ilman yhteistä erottuvaa sanaa.
 *
 * KAKSI EROA ALKUPERÄISEEN, molemmat tarkoituksellisia:
 *
 * 1. Haetaan myös KATSELMOINTIJONOSTA (potential_projects), ei vain
 *    hankkeista. Uudet kuntalähteet syöttävät jonoon, ja ehdokas muuttuu
 *    hankkeeksi vasta katselmoinnissa - pelkkä projects-vertailu mittaisi
 *    katselmoinnin tahtia eikä lähteiden kattavuutta.
 * 2. Malli saa vastata rakenteisella ulostulolla (output_config.format).
 *    Alkuperäinen jäsensi JSON:n tekstistä; 69 kutsun ajossa yksikin
 *    jäsennysvirhe kaataisi erän.
 *
 * Malli on sama claude-haiku-4-5 kuin alkuperäisessä ajossa. Uudempi malli
 * antaisi paremman tuloksen mutta pilaisi vertailun: emme tietäisi tuliko
 * muutos uusista lähteistä vai paremmasta täsmääjästä.
 */

import { readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { createClient } from "@supabase/supabase-js"
import Anthropic from "@anthropic-ai/sdk"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")

for (const line of readFileSync(join(ROOT, ".env.local"), "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

const MODEL = "claude-haiku-4-5"
const SHORTLIST = 8
const BATCH = 8

/*
 * Esikarsinta laskee sanapäällekkäisyyden. Kaupunkien nimet ja rakentamisen
 * yleissanasto on poistettava: ilman sitä "espoo", "peruskorjaus" ja
 * "hankesuunnitelma" hallitsevat pistelaskua ja malli saa eteensä pelkkiä
 * saman kaupungin sattumanvaraisia osumia. Tämä oli mitattu virhe
 * STT-kattavuusajossa (docs/rpt/README.md).
 */
const STOP = new Set([
  "helsinki", "helsinkiin", "helsingin", "espoo", "espooseen", "espoon",
  "turku", "turkuun", "turun", "tampere", "tampereelle", "tampereen",
  "vantaa", "vantaalle", "vantaan", "oulu", "ouluun", "oulun",
  "kuopio", "kuopioon", "kuopion", "joensuu", "joensuuhun", "joensuun",
  "lahti", "lahteen", "lahden", "vaasa", "vaasaan", "vaasan",
  "lappeenranta", "lappeenrantaan", "lappeenrannan", "kouvola", "kouvolaan", "kouvolan",
  "rovaniemi", "rovaniemelle", "rovaniemen", "pori", "poriin", "porin",
  "seinajoki", "seinajoelle", "seinajoen", "hyvinkaa", "hyvinkaalle", "hyvinkaan",
  "porvoo", "porvooseen", "porvoon", "jyvaskyla", "jyvaskylaan", "jyvaskylan",
  "rakennus", "rakentaminen", "rakentamisen", "rakennetaan", "hanke", "hankkeen",
  "peruskorjaus", "peruskorjauksen", "perusparannus", "perusparannuksen",
  "hankesuunnitelma", "hankesuunnitelman", "tarveselvitys", "tarveselvityksen",
  "uudisrakennus", "uudisrakennuksen", "urakka", "urakan", "kohde", "kohteen",
  "asemakaava", "asemakaavan", "muutos", "muutoksen", "hyvaksyminen",
])

const norm = (s) =>
  (s ?? "")
    .toLowerCase()
    .replace(/å/g, "a").replace(/ä/g, "a").replace(/ö/g, "o")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()

const words = (s) =>
  new Set(norm(s).split(" ").filter((w) => w.length >= 5 && !STOP.has(w)))

function overlap(a, b) {
  let n = 0
  for (const w of a) if (b.has(w)) n++
  return n
}

/* Supabase palauttaa enintään 1000 riviä kerrallaan. */
async function fetchAll(db, table, columns) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(columns).range(from, from + 999)
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...data)
    if (data.length < 1000) return out
  }
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})
const anthropic = new Anthropic()

console.log("Haetaan kanta...")
const projects = await fetchAll(db, "projects", "id,name,city,created_at")
const queue = await fetchAll(db, "potential_projects", "id,title,municipality,status,created_at")
console.log(`  hankkeita ${projects.length}, katselmointijonossa ${queue.length}`)

const rpt = JSON.parse(readFileSync(join(ROOT, "docs/rpt/rpt-projects.json"), "utf8"))
const baseline = JSON.parse(readFileSync(join(ROOT, "docs/rpt/rpt-match-results.json"), "utf8"))

const puuttuvat = baseline.filter((b) => !b.matchId)
console.log(`RPT-hankkeita ${rpt.length}, aiemmin puuttuvia ${puuttuvat.length}`)

/* Indeksoi kaupungeittain, jotta esikarsinta ei käy koko kantaa läpi. */
function indexBy(rows, cityField, titleField) {
  const map = new Map()
  for (const r of rows) {
    const city = norm(r[cityField])
    if (!city) continue
    if (!map.has(city)) map.set(city, [])
    map.get(city).push({ id: r.id, title: r[titleField], w: words(r[titleField]), row: r })
  }
  return map
}

const byCityProjects = indexBy(projects, "city", "name")
const byCityQueue = indexBy(queue, "municipality", "title")

function shortlist(index, rptName, city) {
  const pool = index.get(norm(city)) ?? []
  const w = words(rptName)
  return pool
    .map((c) => ({ ...c, score: overlap(w, c.w) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, SHORTLIST)
}

const SCHEMA = {
  type: "object",
  properties: {
    tulokset: {
      type: "array",
      items: {
        type: "object",
        properties: {
          rpt: { type: "integer" },
          osuma: { type: ["string", "null"] },
          varmuus: { type: "number" },
          perustelu: { type: "string" },
        },
        required: ["rpt", "osuma", "varmuus", "perustelu"],
        additionalProperties: false,
      },
    },
  },
  required: ["tulokset"],
  additionalProperties: false,
}

const OHJE = `Saat listan rakennushankkeiden nimiä (RPT) ja jokaiselle joukon ehdokkaita omasta kannastamme.
Ratkaise jokaisesta RPT-hankkeesta, tarkoittaako jokin ehdokas SAMAA hanketta.

Sama hanke voi olla nimetty täysin eri tavalla: "Lentorata välille Helsinki-Vantaa-Kerava" ja
"002653 Lentorata osa 2" ovat sama hanke. Toisaalta saman kaupunginosan eri rakennukset EIVÄT ole
sama hanke, vaikka nimet muistuttaisivat toisiaan.

Vastaa jokaiseen numeroon:
  osuma     = ehdokkaan tunnus (esim "H3" tai "K7"), tai null jos mikään ei ole sama hanke
  varmuus   = 0.0-1.0
  perustelu = yksi lause suomeksi

Ole tiukka. Väärä osuma on pahempi kuin puuttuva.`

function buildBlock(item, i) {
  const hs = shortlist(byCityProjects, item.name, item.city)
  const ks = shortlist(byCityQueue, item.name, item.city)
  const lines = [`### ${i}. "${item.name}" (${item.city})`]
  if (hs.length === 0 && ks.length === 0) lines.push("  (ei ehdokkaita)")
  hs.forEach((c, n) => lines.push(`  H${n + 1}: ${c.title}`))
  ks.forEach((c, n) => lines.push(`  K${n + 1}: ${c.title}`))
  return { text: lines.join("\n"), hs, ks }
}

const results = []
let calls = 0

for (let start = 0; start < puuttuvat.length; start += BATCH) {
  const slice = puuttuvat.slice(start, start + BATCH)
  const blocks = slice.map((item, n) => buildBlock(item, start + n))

  if (blocks.every((b) => b.hs.length === 0 && b.ks.length === 0)) {
    slice.forEach((item) =>
      results.push({ ...item, osuma: null, varmuus: 0, perustelu: "ei ehdokkaita kaupungista" })
    )
    continue
  }

  calls++
  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: OHJE,
    messages: [{ role: "user", content: blocks.map((b) => b.text).join("\n\n") }],
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
  })

  const text = res.content.find((b) => b.type === "text")?.text ?? "{}"
  const parsed = JSON.parse(text)

  for (const r of parsed.tulokset ?? []) {
    const idx = r.rpt - start
    const item = slice[idx]
    const block = blocks[idx]
    if (!item || !block) continue

    let match = null
    const m = String(r.osuma ?? "").match(/^([HK])(\d+)$/)
    if (m) {
      const pool = m[1] === "H" ? block.hs : block.ks
      const c = pool[Number(m[2]) - 1]
      if (c) match = { kind: m[1] === "H" ? "hanke" : "jono", id: c.id, title: c.title, row: c.row }
    }

    results.push({
      city: item.city,
      rank: item.rank,
      name: item.name,
      osuma: match ? { kind: match.kind, id: match.id, title: match.title } : null,
      luotu: match?.row?.created_at ?? null,
      lahde: match?.row?.metadata?.source ?? null,
      varmuus: r.varmuus,
      perustelu: r.perustelu,
    })
  }

  process.stdout.write(`\r  LLM-kutsuja ${calls}, käsitelty ${results.length}/${puuttuvat.length}`)
}

console.log("")

const osumat = results.filter((r) => r.osuma && r.varmuus >= 0.7)
const hankkeissa = osumat.filter((r) => r.osuma.kind === "hanke")
const jonossa = osumat.filter((r) => r.osuma.kind === "jono")

console.log(`\n=== TULOS (varmuus >= 0.7) ===`)
console.log(`Aiemmin puuttuvia:      ${puuttuvat.length}`)
console.log(`Löytyy nyt:             ${osumat.length}  (${((osumat.length / puuttuvat.length) * 100).toFixed(1)} %)`)
console.log(`  hankkeissa:           ${hankkeissa.length}`)
console.log(`  katselmointijonossa:  ${jonossa.length}`)
console.log(`LLM-kutsuja:            ${calls}`)

const byCity = {}
for (const r of osumat) byCity[r.city] = (byCity[r.city] ?? 0) + 1
console.log("\nKaupungeittain:")
for (const [c, n] of Object.entries(byCity).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${c.padEnd(14)} ${n}`)
}

const out = join(ROOT, "docs/rpt/rpt-rematch-results.json")
writeFileSync(out, JSON.stringify(results, null, 1), "utf8")
console.log(`\nKirjoitettu ${out}`)
