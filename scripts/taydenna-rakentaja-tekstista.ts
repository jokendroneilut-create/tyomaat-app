import { readFileSync } from "node:fs"
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

import { extractBuilderFromText } from "../lib/agent/fetchSttHakuSource"

/*
 * RAJATTU SIIHEN MITA KORJAUS MAHDOLLISTAA.
 *
 * Ensimmainen versio taytti jokaisen tyhjan builder-kentan, ja
 * kuivaharjoitus antoi 34 rivia joista useat olivat vaaria:
 *
 *   "Toyrykatu 6 DEF. Asuinkerrostalon purkaminen"  -> "YSE"
 *   "OYS - TEP salien siirto G-rakennukseen"        -> "Pohjois-pohjanmaan"
 *   "Oulun Tilapalvelut - Lamsanjarven paivakoti"   -> "Oulun Tilapalvelut"
 *
 * YSE on sopimusehdot, ei yritys; kaksi jalkimmaista ovat tilaajia ja
 * katkenneita. Ne ovat POIMINNAN vanhoja vikoja, eivat taman korjauksen
 * seurausta, eika niita korjata arvaamalla taman ohessa.
 *
 * Siksi taydennetaan vain rivit joissa teksti on sita muotoa jonka
 * korjaus avasi: verbi, kaksoispiste, nimi.
 */
const KAKSOISPISTEMUOTO =
  /(?<![Aa]li)(?:[Pp]ää)?[Uu]rakoitsijana\s+toimii\s*:/

/*
 * RAKENTAJA TEKSTISTA TAKAUTUVASTI (D-296).
 *
 * Johannes 17.10.2026 valtatien 25 hankkeesta: urakoitsijaa ei oltu
 * poimittu, vaikka tiedotteessa lukee "Urakoitsijana toimii: Ylojarven
 * Kiviset Oy". Syy oli yhdessa merkissa - kuvio vaati verbin jalkeen
 * valilyonnin eika sallinut kaksoispistetta.
 *
 * Korjaus koskee poimintaa, joten jo tuodut rivit taydennetaan talla.
 *
 * A/B koko jonon yli (10 089 rivia) korjauksen jalkeen:
 *   uusi loysi, vanha ei   5
 *   uusi sanoo eri         0
 *
 * EI YLIKIRJOITA. Vain tyhja kentta taytetaan; jos rakentaja on jo
 * tiedossa tai kasin korjattu, riviin ei kosketa.
 *
 *   npx tsx scripts/taydenna-rakentaja-tekstista.ts
 *   npx tsx scripts/taydenna-rakentaja-tekstista.ts --apply
 */

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  /* 1. JONO */
  const ehdokkaat: any[] = []
  for (let alku = 0; ; alku += 1000) {
    const { data, error } = await db
      .from("potential_projects")
      .select("id, title, status, metadata")
      .range(alku, alku + 999)
    if (error) {
      console.error("VIRHE:", error.message)
      process.exit(1)
    }
    ehdokkaat.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }

  let jono = 0
  for (const e of ehdokkaat) {
    const md = (e.metadata as any) ?? {}
    if (md.builder) continue
    if (!KAKSOISPISTEMUOTO.test(String(md.description ?? ""))) continue
    const nimi = extractBuilderFromText(String(e.title ?? ""), String(md.description ?? ""))
    if (!nimi) continue

    console.log(`  [${String(e.status).padEnd(9)}] ${String(e.title).slice(0, 52).padEnd(54)} -> ${nimi}`)
    jono++
    if (!apply) continue

    const { error: uv } = await db
      .from("potential_projects")
      .update({ metadata: { ...md, builder: nimi, builder_lahde: "teksti" } })
      .eq("id", e.id)
    if (uv) console.log(`    VIRHE: ${uv.message}`)
  }
  console.log(`\nJONO: ${jono}`)

  /* 2. KANTA - nakyva kentta on projects.builder. */
  const hankkeet: any[] = []
  for (let alku = 0; ; alku += 1000) {
    const { data, error } = await db
      .from("projects")
      .select("id, name, builder, contractor, additional_info, metadata")
      .range(alku, alku + 999)
    if (error) {
      console.error("VIRHE:", error.message)
      process.exit(1)
    }
    hankkeet.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }

  let kanta = 0
  for (const p of hankkeet) {
    if (p.builder || p.contractor) continue
    const md = (p.metadata as any) ?? {}
    const teksti = String(p.additional_info ?? md.description ?? "")
    if (!KAKSOISPISTEMUOTO.test(teksti)) continue
    const nimi = extractBuilderFromText(String(p.name ?? ""), teksti)
    if (!nimi) continue

    console.log(`  [kanta] ${String(p.name).slice(0, 52).padEnd(54)} -> ${nimi}`)
    kanta++
    if (!apply) continue

    const { error: uv } = await db
      .from("projects")
      .update({ builder: nimi, metadata: { ...md, builder_lahde: "teksti" } })
      .eq("id", p.id)
    if (uv) console.log(`    VIRHE: ${uv.message}`)
  }
  console.log(`KANTA: ${kanta}`)

  if (!apply) console.log("\nEi muutettu mitaan. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
