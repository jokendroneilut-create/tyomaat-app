/*
 * Täsmäyttää RPT:n hankelistan omaa dataamme vastaan.
 *
 * RPT Smart julkaisi aiemmin kaupunkikohtaiset listat suurimmista
 * rakennushankkeista. Listalla on VAIN nimi ja kaupunki - ei kuvausta,
 * osoitetta eikä aikataulua. Vanha palvelu vastaa nykyään HTTP 526
 * (Cloudflare: invalid SSL), joten kyseessä on kertaluontoinen tilannekuva
 * eikä lähde jota voisi ajastaa.
 *
 * KAKSIVAIHEINEN TÄSMÄYTYS, sama periaate kuin AI-relevanssiportissa
 * (D-021): säännöt ensin, malli vain harmaalle alueelle.
 *
 * 1. Mekaaninen esikarsinta: saman kaupungin hankkeista poimitaan
 *    sanapäällekkäisyyden perusteella lyhyt lista.
 * 2. LLM ratkaisee: onko jokin niistä sama hanke.
 *
 * Pelkkä mekaaninen täsmäytys ei riitä, koska nimeämistavat eroavat
 * täysin. Mitattu: calculateMatch antoi 655/726 "uutta", mutta käsin
 * tarkistettuna esim. "Lentorata välille Helsinki-Vantaa-Kerava" on
 * kannassa nimellä "002653 Lentorata osa 2" - yhtään yhteistä erottuvaa
 * sanaa ei ole, joten mikään sanapohjainen mitta ei voi löytää sitä.
 *
 *   npx tsx scripts/match-rpt-list.ts --limit=20   # kokeilu
 *   npx tsx scripts/match-rpt-list.ts
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs"

const LIMIT = Number(
  process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? 0
)
const BATCH = 10
const SHORTLIST = 8
const MODEL = "claude-haiku-4-5"
const OUT = "docs/rpt/rpt-match-results.json"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8")
  .replace(/\r/g, "")
  .split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1)
  }
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

const norm = (value: unknown) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-zåäö0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

/*
 * Karsintapisteytys on tarkoituksella löysä: sen tehtävä on vain rajata
 * mallille annettava lista, ei päättää mitään. Kynnystä ei ole - jokainen
 * RPT-hanke saa parhaat SHORTLIST kappaletta oman kaupunkinsa hankkeista.
 */
function overlapScore(a: string, b: string): number {
  const wordsA = new Set(norm(a).split(" ").filter((w) => w.length >= 4))
  const wordsB = new Set(norm(b).split(" ").filter((w) => w.length >= 4))
  if (wordsA.size === 0 || wordsB.size === 0) return 0

  let shared = 0
  for (const w of wordsA) if (wordsB.has(w)) shared++

  /*
   * Osittainen osuma lasketaan mukaan puolikkaana: suomen yhdyssanat
   * eroavat usein vain päätteestä ("raitiotie" / "raitiotien").
   */
  let partial = 0
  for (const w of wordsA) {
    if (wordsB.has(w)) continue
    for (const other of wordsB) {
      if (w.length >= 6 && other.length >= 6 && (w.startsWith(other.slice(0, 6)) || other.startsWith(w.slice(0, 6)))) {
        partial += 0.5
        break
      }
    }
  }

  return (shared + partial) / Math.min(wordsA.size, wordsB.size)
}

type Ours = { id: string; name: string; city: string | null; kind: string; phase: string | null }

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const Anthropic = (await import("@anthropic-ai/sdk")).default

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const rpt: any[] = JSON.parse(readFileSync("docs/rpt/rpt-projects.json", "utf8"))

  /*
   * Vertailujoukkoon otetaan sekä hankkeet että vielä katselmoimattomat
   * ehdokkaat: jos hanke on jo jonossa, se ei ole meille "uusi" vaikka se
   * ei olekaan vielä julkaistu. Piilotetut hankkeet ovat mukana samasta
   * syystä - tieto on meillä, vaikkei se näy asiakkaalle.
   */
  const ours: Ours[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("projects")
      .select("id, name, city, phase, is_public")
      .range(from, from + 999)
    if (error) throw error
    for (const p of data ?? []) {
      ours.push({
        id: p.id,
        name: p.name,
        city: p.city,
        phase: p.phase,
        kind: p.is_public ? "hanke" : "hanke (piilossa)",
      })
    }
    if (!data || data.length < 1000) break
  }
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("potential_projects")
      .select("id, title, municipality, status, metadata")
      .eq("status", "new")
      .range(from, from + 999)
    if (error) throw error
    for (const c of data ?? []) {
      ours.push({
        id: c.id,
        name: c.title,
        city: c.municipality ?? (c.metadata as any)?.city ?? null,
        phase: (c.metadata as any)?.phase_hint ?? null,
        kind: "ehdokas",
      })
    }
    if (!data || data.length < 1000) break
  }

  const byCity = new Map<string, Ours[]>()
  for (const o of ours) {
    const key = norm(o.city)
    if (!byCity.has(key)) byCity.set(key, [])
    byCity.get(key)!.push(o)
  }

  console.log(`RPT ${rpt.length} · omia ${ours.length} (${byCity.size} kaupunkia)\n`)

  const work = LIMIT ? rpt.slice(0, LIMIT) : rpt
  const previous: any[] = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : []
  const done = new Map(previous.map((r: any) => [`${r.city}|${r.name}`, r]))

  const results: any[] = []
  const pending: any[] = []

  for (const r of work) {
    const key = `${r.city}|${r.name}`
    if (done.has(key)) {
      results.push(done.get(key))
      continue
    }
    const pool = byCity.get(norm(r.city)) ?? []
    const shortlist = pool
      .map((o) => ({ o, score: overlapScore(r.name, o.name) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, SHORTLIST)
      .map((x) => x.o)

    pending.push({ rpt: r, shortlist })
  }

  console.log(`valmiina aiemmasta ajosta: ${results.length}, käsitellään: ${pending.length}`)

  let calls = 0
  for (let i = 0; i < pending.length; i += BATCH) {
    const batch = pending.slice(i, i + BATCH)

    const payload = batch.map((b, index) => ({
      id: index,
      rptNimi: b.rpt.name,
      kaupunki: b.rpt.city,
      vaihtoehdot: b.shortlist.map((s, si) => ({
        n: si,
        nimi: s.name,
        tyyppi: s.kind,
        vaihe: s.phase,
      })),
    }))

    const prompt = `Olet suomalaisten rakennushankkeiden tuntija. Alla on RPT:n hankelistalta poimittuja hankkeen nimiä. Jokaiselle on annettu vaihtoehtoja meidän tietokannastamme SAMASTA kaupungista.

Päätä jokaisesta: viittaako jokin vaihtoehto SAMAAN rakennushankkeeseen kuin RPT:n nimi.

Säännöt:
- Sama hanke voi olla kirjoitettu täysin eri tavalla. Kaavanumero ("002653 Lentorata osa 2") ja kuvaileva nimi ("Lentorata välille Helsinki-Vantaa-Kerava") voivat tarkoittaa samaa.
- Sama alue tai sama rakennustyyppi EI riitä. "Kerrostalo Vuosaareen" ja "Vuosaaren seniorikeskus" ovat eri hankkeita.
- Saman rakennuksen eri urakat (LVI, sähkö) ovat eri hankkeita.
- Hankkeen eri vaiheet tai osat ovat sama hanke jos kyse on samasta kohteesta.
- Jos et ole varan, vastaa null. Väärä yhdistäminen on pahempi kuin puuttuva.

Vastaa PELKKÄNÄ JSON-taulukkona, ei muuta tekstiä:
[{"id":0,"osuma":null|<vaihtoehdon n>,"varmuus":0.0-1.0,"peruste":"lyhyt suomeksi"}]

Syöte:
${JSON.stringify(payload, null, 1)}`

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    })
    calls++

    const text = response.content
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("")

    let parsed: any[] = []
    try {
      parsed = JSON.parse(text.match(/\[[\s\S]*\]/)?.[0] ?? "[]")
    } catch {
      console.log(`  !! JSON-jäsennys epäonnistui erässä ${i / BATCH + 1}`)
    }

    for (const b of batch) {
      const index = batch.indexOf(b)
      const verdict = parsed.find((p: any) => p.id === index)
      const hit =
        verdict && verdict.osuma !== null && verdict.osuma !== undefined
          ? b.shortlist[verdict.osuma]
          : null

      results.push({
        city: b.rpt.city,
        rank: b.rpt.rank,
        name: b.rpt.name,
        matchId: hit?.id ?? null,
        matchName: hit?.name ?? null,
        matchKind: hit?.kind ?? null,
        matchPhase: hit?.phase ?? null,
        confidence: verdict?.varmuus ?? null,
        reason: verdict?.peruste ?? null,
        shortlistSize: b.shortlist.length,
      })
    }

    writeFileSync(OUT, JSON.stringify(results, null, 1), "utf8")
    if (calls % 10 === 0 || i + BATCH >= pending.length) {
      const matched = results.filter((r) => r.matchId).length
      console.log(`  ${results.length}/${work.length} käsitelty · osumia ${matched} · kutsuja ${calls}`)
    }
  }

  const matched = results.filter((r) => r.matchId)
  const missing = results.filter((r) => !r.matchId)
  console.log(`\n=== TULOS ===`)
  console.log(`  meillä jo:  ${matched.length}`)
  console.log(`  puuttuu:    ${missing.length}`)
  console.log(`  kutsuja:    ${calls}`)
  console.log(`\ntallennettu ${OUT}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
