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
 * MONTAKO YRITYSTA KAAVAKUVAUKSISSA ON, JA KETA NE OVAT?
 *
 * Johannes 23.10.2026 Samppalinnan koulutontista: *"tasta ei ole poimittu
 * hankkeeseen liittyvaa yritysta TKU-Rakennus Oy joka on kuvauksessa."*
 *
 * Kaavaresolverit (n. 230 kuntaa) EIVAT lue yritysnimia kuvauksesta
 * lainkaan -- vain STT-lahde tekee sen. Ennen kuin lisaan poiminnan,
 * mittaan mita se loytaisi: STT:n koodissa on nimenomainen varoitus
 * etta *"YVA- ja kaavatekstien yleisimmat yhtiot ovat suunnittelu- ja
 * ymparistokonsultteja"*. Jos niin on, naiivi "mika tahansa Oy" tayttaisi
 * rakennuttajakentan konsulteilla.
 *
 * Tulostaa nimijakauman, jotta naen mitka ovat aitoja osapuolia ja mitka
 * konsultteja tai kaavanlaatijoita ([[name-the-denominator]]).
 *
 *   npx tsx scripts/mittaa-kaavojen-yritykset.ts
 *   npx tsx scripts/mittaa-kaavojen-yritykset.ts --rivit   (nayta rivit)
 */

/* Sama kuvio kuin lib/agent/fetchSttHakuSource.ts:ssa. */
const COMPANY_NAME =
  /\b([A-ZÅÄÖ][\wåäöÅÄÖ&.\-]*(?:\s+[A-ZÅÄÖ][\wåäöÅÄÖ&.\-]*)*\s+(?:Oy|Oyj|Ab|Ky|Ltd))\b/g

function yritysnimet(teksti: string | null | undefined): string[] {
  const loydetyt = new Map<string, string>()
  for (const m of String(teksti ?? "").matchAll(COMPANY_NAME)) {
    const nimi = m[1].replace(/:n$/i, "").trim()
    if (nimi.length >= 4) loydetyt.set(nimi.toLowerCase(), nimi)
  }
  return Array.from(loydetyt.values())
}

const KONSULTTI =
  /(?:^|\s)(?:Sitowise|Ramboll|AFRY|Sweco|WSP|FCG|Pöyry|A-Insinöörit|Granlund|Ains|Envineer|Plandea|Projoplan|Karttaako|Suomen Luontotieto|Etha Wind)\b|konsultti\b/i

async function main() {
  const naytaRivit = process.argv.includes("--rivit")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const nimienMaarat = new Map<string, number>()
  const osumat: { taulu: string; id: string; nimi: string; yritykset: string[]; kuvaus: string; dev: string | null }[] = []
  const luvut = { rivit: 0, kuvauksella: 0, yrityksella: 0, devJoAsetettu: 0 }

  for (const taulu of ["potential_projects", "projects"] as const) {
    for (let a = 0; ; a += 500) {
      const { data, error } = await db
        .from(taulu)
        .select(
          taulu === "projects"
            ? "id, name, developer, additional_info, metadata"
            : "id, title, status, metadata"
        )
        .like("metadata->>resolver", "%KaavaResolver")
        .range(a, a + 499)
      if (error) {
        console.error(`VIRHE ${taulu}: ${error.message}`)
        process.exit(1)
      }
      for (const p of (data ?? []) as any[]) {
        if (taulu === "potential_projects" && p.status === "ignored") continue
        luvut.rivit += 1
        const kuvaus =
          taulu === "projects"
            ? String(p.additional_info ?? p.metadata?.description ?? "")
            : String(p.metadata?.description ?? "")
        if (!kuvaus) continue
        luvut.kuvauksella += 1
        const yritykset = yritysnimet(kuvaus)
        if (!yritykset.length) continue
        luvut.yrityksella += 1
        const dev = taulu === "projects" ? (p.developer ?? null) : (p.metadata?.developer ?? null)
        if (dev) luvut.devJoAsetettu += 1
        for (const y of yritykset) nimienMaarat.set(y, (nimienMaarat.get(y) ?? 0) + 1)
        osumat.push({
          taulu,
          id: p.id,
          nimi: String(p.name ?? p.title ?? ""),
          yritykset,
          kuvaus,
          dev,
        })
      }
      if ((data ?? []).length < 500) break
    }
  }

  console.log("=== KAAVARIVIT ===")
  console.log(`Rivejä ${luvut.rivit}, kuvauksella ${luvut.kuvauksella}, yritysnimi kuvauksessa ${luvut.yrityksella}`)
  console.log(`Niistä rakennuttaja jo asetettu: ${luvut.devJoAsetettu}`)

  console.log(`\n=== NIMET (${nimienMaarat.size} eri nimeä) ===`)
  const jarjestetty = Array.from(nimienMaarat.entries()).sort((a, b) => b[1] - a[1])
  for (const [nimi, n] of jarjestetty) {
    const lippu = KONSULTTI.test(nimi) ? " [KONSULTTI]" : ""
    console.log(`${String(n).padStart(4)}  ${nimi}${lippu}`)
  }

  if (naytaRivit) {
    console.log(`\n=== RIVIT (${osumat.length}) ===`)
    for (const o of osumat) {
      console.log(`\n${o.taulu === "projects" ? "HANKE" : "JONO "} ${o.id}  ${o.nimi.slice(0, 60)}`)
      console.log(`   yritykset: ${o.yritykset.join(" | ")}${o.dev ? `   (rakennuttaja: ${o.dev})` : ""}`)
      console.log(`   ${o.kuvaus.replace(/\s+/g, " ").slice(0, 300)}`)
    }
  }
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
