/*
 * Kartoittaa jäävätkö voittajat poimimatta jostain lausemuodosta jota
 * säännöt eivät tunne.
 *
 * EI KIRJOITA KANTAAN. Tarkoitus on mitata sääntöpohjan jäännös: onko
 * kymmenettä muotoa olemassa vai onko poiminta valmis. Tulos luetaan
 * silmin ja mahdollinen uusi sääntö kirjoitetaan käsin, mitattuna kuten
 * muutkin (D-039).
 *
 * Joukko: päätösrivit joilla EI ole poimittua voittajaa mutta joiden
 * tekstissä esiintyy yhtiömuoto. 314 riviä, noin 0,40 $ Sonnet 5:llä.
 *
 * Otteet yhtiömainintojen ympäriltä, ei koko tekstiä: päätösteksti on
 * mediaaniltaan 2 700 merkkiä ja voittaja mainitaan aina yritysnimen
 * kohdalla, joten koko tekstin lähettäminen olisi kolminkertainen hinta
 * ilman lisätietoa.
 *
 *   npx tsx scripts/survey-missed-winners.ts
 *   npx tsx scripts/survey-missed-winners.ts --limit=30
 */
import { readFileSync } from "node:fs"

const LIMIT = Number(
  process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "0"
)

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

const COMPANY_TOKEN = /\b(?:Oy|Oyj|Ay|Ky|Ab|Tmi)\b/g

/*
 * Ohje on tarkoituksella kieltopainotteinen: aineistossa yritysnimi
 * esiintyy paljon useammin muussa roolissa kuin voittajana (tarjoaja,
 * hylätty, vuokralainen, korvauksen saaja, konsultti, valvoja). Juuri
 * nämä roolit ovat kaataneet sääntöjä koko projektin ajan.
 */
const SYSTEM = `Luet suomalaisen kunnan hankintapäätöksen otteita.

Kerro NIMEÄÄKÖ päätös yrityksen, jolle urakka tai toimeksianto MYÖNNETTIIN.

Vastaa null jos yritys esiintyy vain:
- tarjoajana tai ehdokkaana ilman että se valittiin
- hylättynä tarjoajana
- vuokralaisena, vuokranantajana tai kiinteistön omistajana
- korvauksen saajana
- suunnittelijana, konsulttina tai valvojana (nämä eivät ole urakoitsija)
- kilpailutus on vasta edessä eikä voittajaa ole valittu

Jos voittaja on nimetty, palauta:
- winner: yrityksen nimi täsmälleen sellaisena kuin se tekstissä lukee
- clause: se lause josta valinta ilmenee, sanatarkasti

Älä arvaa. Jos et ole varma, vastaa null.`

const SCHEMA = {
  type: "object",
  properties: {
    winner: { type: ["string", "null"] },
    clause: { type: ["string", "null"] },
  },
  required: ["winner", "clause"],
  additionalProperties: false,
}

/*
 * KOKO TEKSTI, EI OTTEITA.
 *
 * Ensimmäinen versio lähetti otteet kolmen ensimmäisen yhtiömaininnan
 * ympäriltä. Verrokkiajo paljasti sen vääräksi: riveistä joilla voittaja
 * TIEDETÄÄN löytyi vain 1/12, koska ensimmäiset yhtiömaininnat ovat
 * tyypillisesti tarjoajaluettelossa ja päätöslause tulee vasta sen
 * jälkeen. Nollatulos olisi ollut otantavirhe, ei havainto.
 *
 * Mediaanipituus on 2 700 merkkiä, joten katkaisu 8 000:een koskee vain
 * pisimpiä eikä maksa juuri mitään.
 */
function excerpts(description: string, title: string): string {
  const text = description.replace(/\s+/g, " ").slice(0, 8000)
  return `Otsikko: ${title}\n\nPäätösteksti:\n${text}`
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const Anthropic = (await import("@anthropic-ai/sdk")).default

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const rows: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("potential_projects")
      .select("id, title, metadata")
      .range(from, from + 999)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  /*
   * VERROKKIAJO. Nollatulos näyttää samalta riippumatta siitä onko
   * poimittavaa oikeasti nolla vai onko putki rikki (väärä skeema, tyhjä
   * vastaus, niellyt poikkeus). --control ajaa riveillä joilla voittaja
   * TIEDETÄÄN: jos LLM ei löydä niitäkään, vika on putkessa eikä
   * aineistossa.
   */
  const CONTROL = process.argv.includes("--control")

  let targets = rows.filter((r) => {
    if (!/_paatokset$/.test(r.metadata?.source ?? "")) return false
    if (!COMPANY_TOKEN.test(String(r.metadata?.description ?? ""))) return false
    return CONTROL ? !!r.metadata?.winners?.length : !r.metadata?.winners?.length
  })
  if (LIMIT) targets = targets.slice(0, LIMIT)

  console.log(
    `${CONTROL ? "VERROKKI (voittaja tiedossa)" : "kartoitus"}: ${targets.length} riviä (ei kirjoita kantaan)\n`
  )

  const found: { title: string; winner: string; clause: string }[] = []
  let done = 0
  let index = 0

  async function worker() {
    while (index < targets.length) {
      const row = targets[index++]
      try {
        const res = await client.messages.create({
          model: "claude-sonnet-5",
          max_tokens: 400,
          system: [
            { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
          ],
          output_config: { format: { type: "json_schema", schema: SCHEMA } },
          messages: [
            {
              role: "user",
              content: excerpts(String(row.metadata.description), String(row.title)),
            },
          ],
        } as any)

        const block: any = (res as any).content?.[0]
        const parsed = JSON.parse(block?.text ?? "{}")
        if (parsed.winner) {
          found.push({
            title: String(row.title),
            winner: String(parsed.winner),
            clause: String(parsed.clause ?? ""),
          })
        }
      } catch (err: any) {
        console.log(`  virhe: ${String(err?.message ?? err).slice(0, 80)}`)
      }
      done++
      if (done % 25 === 0) process.stdout.write(`\r  ${done}/${targets.length}`)
    }
  }

  await Promise.all(Array.from({ length: 6 }, worker))

  console.log(`\n\nLLM löysi voittajan ${found.length} rivillä ${targets.length}:sta\n`)
  for (const f of found) {
    console.log(`  ${f.title.slice(0, 70)}`)
    console.log(`    -> ${f.winner}`)
    console.log(`    "${f.clause.slice(0, 170)}"`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
