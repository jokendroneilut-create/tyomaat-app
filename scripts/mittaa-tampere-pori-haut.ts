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
 * PALOIKO TAMPEREEN JA PORIN HAKUBUDJETTI? (D-337)
 *
 * Turussa kuollut osoite poltti `MAX_DETAIL_FETCHES_PER_RUN`-budjetin
 * joka ajossa, eika yhdeksan tyopaa sivua saanut koskaan vuoroa
 * ([[failed-fetch-burns-budget]]). Sama kuvio on Tampereen ja Porin
 * keraajissa. Tama mittaa kaksi lukua ERIKSEEN, koska pelkka "n ilman
 * kuvausta" ei kerro kumpi on kyseessa:
 *
 *   - montako dokumenttia on ilman kuvausta
 *   - montako niista on aidosti saavuttamattomia (sivu poissa)
 *
 * Toinen luku on se joka korjaantuu heti kun budjetti vapautuu.
 *
 *   npx tsx scripts/mittaa-tampere-pori-haut.ts
 */

const TAUKO_MS = 300
const nukut = (ms: number) => new Promise((r) => setTimeout(r, ms))

type Lahde = { nimi: string; katto: number; onkoKuvaus: (p: any) => boolean }

const LAHTEET: Lahde[] = [
  {
    nimi: "Tampereen vireillä olevat kaavat",
    katto: 5,
    onkoKuvaus: (p) => Boolean(p?.description),
  },
  {
    nimi: "Porin vireillä olevat kaavat",
    katto: 5,
    onkoKuvaus: (p) => Boolean(p?.kaava_tunnus),
  },
]

async function sivuAukeaa(url: string): Promise<{ ok: boolean; status: number | string }> {
  try {
    const v = await fetch(url, { cache: "no-store", headers: { "User-Agent": "Mozilla/5.0" } })
    return { ok: v.ok, status: v.status }
  } catch (e: any) {
    return { ok: false, status: e?.code ?? "virhe" }
  }
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  for (const lahde of LAHTEET) {
    const { data: src } = await db.from("discovery_sources").select("id, name").eq("name", lahde.nimi).maybeSingle()
    if (!src) {
      console.log(`\n=== ${lahde.nimi}: lähdettä ei löytynyt ===`)
      continue
    }

    const rivit: any[] = []
    for (let a = 0; ; a += 500) {
      const { data, error } = await db
        .from("source_documents")
        .select("document_url, title, raw_payload")
        .eq("source_id", src.id)
        .range(a, a + 499)
      if (error) {
        console.error(`VIRHE: ${error.message}`)
        process.exit(1)
      }
      rivit.push(...(data ?? []))
      if ((data ?? []).length < 500) break
    }

    const ilmanKuvausta = rivit.filter((r) => !lahde.onkoKuvaus(r.raw_payload))
    console.log(`\n=== ${lahde.nimi} ===`)
    console.log(`Dokumentteja ${rivit.length}, ilman kuvausta ${ilmanKuvausta.length}, katto ${lahde.katto}/ajo`)

    let kuollut = 0
    let elossa = 0
    let eiSivua = 0

    for (const r of ilmanKuvausta) {
      const url = String(r.document_url ?? "")
      if (!/^https?:\/\//.test(url) || url.includes("#")) {
        eiSivua += 1
        console.log(`   EI SIVUA     ${String(r.title ?? "").slice(0, 50).padEnd(52)} ${url.slice(0, 60)}`)
        continue
      }
      const v = await sivuAukeaa(url)
      await nukut(TAUKO_MS)
      if (v.ok) {
        elossa += 1
        console.log(`   ELOSSA       ${String(r.title ?? "").slice(0, 50).padEnd(52)} ${url.slice(0, 70)}`)
      } else {
        kuollut += 1
        console.log(`   KUOLLUT ${String(v.status).padEnd(5)} ${String(r.title ?? "").slice(0, 50).padEnd(52)} ${url.slice(0, 70)}`)
      }
    }

    console.log(`\n   Elossa ${elossa}, kuollut ${kuollut}, ei omaa sivua ${eiSivua}`)
    if (kuollut >= lahde.katto)
      console.log(`   => kuolleita on vähintään katto (${lahde.katto}): elossa olevat eivät saa koskaan vuoroa`)
  }
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
