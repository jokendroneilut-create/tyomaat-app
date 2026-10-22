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
 * MITKA SANAT AVAAVAT KAAVAKUVAUKSEN YRITYKSEN ROOLIN?
 *
 * 578 kaavarivilla on yritysnimi kuvauksessa, mutta pelkka nimi ei kerro
 * roolia: samassa tekstissa voi olla hakija, maanomistaja ja
 * kaavanlaatija (konsultti). Tama laskee avainsanat, jotta naen mihin
 * ankkuriin kannattaa sitoa -- ei arvaamalla vaan jakaumasta.
 *
 *   npx tsx scripts/mittaa-kaavan-ankkurit.ts
 */

const AVAINSANAT: [string, RegExp][] = [
  ["hakija", /hakij/i],
  ["hakemus", /hakemukse/i],
  ["kaavoitusaloite", /kaavoitusaloit|kaavoitusaloitteen|aloitteen tekij/i],
  ["maanomistaja", /maanomistaj/i],
  ["kumppanuus", /kumppanuu|kumppanuussopimu/i],
  ["sopimus", /sopimukse|sopimus /i],
  ["kaavan laatija", /kaavan laatij|kaavaa laati|kaavan on laatinut|laatijana/i],
  ["hankevastaava", /hankevastaav|hankkeesta vastaa/i],
  ["suunnittelee", /suunnittele(?:e|vat)\b/i],
  ["rakentaa", /rakenta(?:a|vat)\b/i],
  ["omistaa", /omistaa|omistuksessa/i],
  ["vuokra", /vuokra/i],
  ["toimijana", /toimijana|toimii/i],
  ["tilaaja", /tilaaja/i],
]

const COMPANY_NAME =
  /\b([A-ZÅÄÖ][\wåäöÅÄÖ&.\-]*(?:\s+[A-ZÅÄÖ][\wåäöÅÄÖ&.\-]*)*\s+(?:Oy|Oyj|Ab|Ky|Ltd))\b/g

function yritysnimet(teksti: string): string[] {
  const loydetyt = new Map<string, string>()
  for (const m of String(teksti).matchAll(COMPANY_NAME)) {
    const nimi = m[1].replace(/:n$/i, "").trim()
    if (nimi.length >= 4) loydetyt.set(nimi.toLowerCase(), nimi)
  }
  return Array.from(loydetyt.values())
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const kuvaukset: { id: string; taulu: string; nimi: string; kuvaus: string }[] = []

  for (const taulu of ["potential_projects", "projects"] as const) {
    for (let a = 0; ; a += 500) {
      const { data, error } = await db
        .from(taulu)
        .select(
          taulu === "projects" ? "id, name, additional_info, metadata" : "id, title, status, metadata"
        )
        .like("metadata->>resolver", "%KaavaResolver")
        .range(a, a + 499)
      if (error) {
        console.error(`VIRHE: ${error.message}`)
        process.exit(1)
      }
      for (const p of (data ?? []) as any[]) {
        if (taulu === "potential_projects" && p.status === "ignored") continue
        const kuvaus =
          taulu === "projects"
            ? String(p.additional_info ?? p.metadata?.description ?? "")
            : String(p.metadata?.description ?? "")
        if (!kuvaus || !yritysnimet(kuvaus).length) continue
        kuvaukset.push({ id: p.id, taulu, nimi: String(p.name ?? p.title ?? ""), kuvaus })
      }
      if ((data ?? []).length < 500) break
    }
  }

  console.log(`=== ${kuvaukset.length} kuvausta, joissa yritysnimi ===\n`)
  for (const [nimi, re] of AVAINSANAT) {
    const n = kuvaukset.filter((k) => re.test(k.kuvaus)).length
    console.log(`${String(n).padStart(4)}  ${nimi}`)
  }

  /* Kuinka monessa EI ole yhtaan avainsanaa? */
  const ilman = kuvaukset.filter((k) => !AVAINSANAT.some(([, re]) => re.test(k.kuvaus)))
  console.log(`\n${ilman.length} kuvauksessa ei yhtaan avainsanaa`)
  for (const k of ilman.slice(0, 12)) {
    console.log(`\n   ${k.id}  ${k.nimi.slice(0, 55)}`)
    console.log(`   ${k.kuvaus.replace(/\s+/g, " ").slice(0, 240)}`)
  }
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
