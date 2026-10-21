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
 * VIALLISET YHTEYSTIEDOT KOKONAISINA, LUOKITTAIN (D-330).
 *
 * Johannes 22.10.2026: *"en ihan ymmartanyt mika niissa oli vikana.
 * annatko esimerkin."*
 *
 * `mittaa-rikki-yhteyshenkilot.ts` antoi vain luvut. Tama tulostaa
 * merkinnat kokonaisina, koska luokittelun oikeellisuus nakyy vain
 * riveista -- ja samassa aineistossa luokitteluni oli jo kertaalleen
 * vaarin: "nimeton" osoittautui aidoksi organisaatiokontaktiksi
 * ([[nameless-contact-is-not-broken]]).
 *
 *   npx tsx scripts/nayta-rikki-yhteyshenkilot.ts
 *   npx tsx scripts/nayta-rikki-yhteyshenkilot.ts --luokka duplikaatti --nayta 40
 */

const YRITYS = /\b(?:Oy|Oyj|Ab|Abp|Ky|Ltd|Group|GmbH|AS|A\/S|S\.?A\.?)\b/i
const LIIMAUTUNUT = /[a-zåäö][A-ZÅÄÖ]|:\s*[A-ZÅÄÖ][a-zåäö]+\s*[A-ZÅÄÖ]/

type Vika = { luokka: string; rivi: string; taulu: string; lahde: string; merkinta: any; kaksoset?: any[] }

function luokittele(lista: any[]): { indeksi: number; luokka: string; kaksoset?: any[] }[] {
  const ulos: { indeksi: number; luokka: string; kaksoset?: any[] }[] = []
  const nimella = new Map<string, number[]>()

  lista.forEach((c, i) => {
    const nimi = String(c?.name ?? "").trim()
    if (!nimi) {
      /* Organisaatiokontakti ilman nimea on oikein, person ei. */
      if (String(c?.kind ?? "") === "person") ulos.push({ indeksi: i, luokka: "nimeton person" })
      return
    }
    /*
     * LAJI RATKAISEE, EI NIMI (D-330). Ensimmainen versio luokitteli
     * yritysnimisen merkinnan aina viaksi, joten se raportoi 110 vikaa
     * VIELA SEN JALKEEN kun laji oli korjattu. Mittari joka nayttaa
     * korjatun datan rikkinaisena on pahempi kuin ei mittaria.
     */
    if (YRITYS.test(nimi) && String(c?.kind ?? "") !== "organization") {
      ulos.push({ indeksi: i, luokka: "yritys henkilona" })
      return
    }
    const avain = nimi.toLowerCase()
    nimella.set(avain, [...(nimella.get(avain) ?? []), i])
  })

  for (const [, indeksit] of nimella) {
    if (indeksit.length < 2) continue
    for (const i of indeksit.slice(1))
      ulos.push({ indeksi: i, luokka: "duplikaatti", kaksoset: indeksit.map((j) => lista[j]) })
  }

  lista.forEach((c, i) => {
    const nimike = String(c?.title ?? "").trim()
    if (nimike && LIIMAUTUNUT.test(nimike) && !ulos.some((u) => u.indeksi === i))
      ulos.push({ indeksi: i, luokka: "liimautunut nimike" })
  })

  return ulos
}

async function main() {
  const lArg = process.argv.indexOf("--luokka")
  const vainLuokka = lArg > -1 ? process.argv[lArg + 1] : null
  const nArg = process.argv.indexOf("--nayta")
  const nayta = nArg > -1 ? Number(process.argv[nArg + 1]) : 8

  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const viat: Vika[] = []

  for (const taulu of ["projects", "potential_projects"] as const) {
    const rivit: any[] = []
    for (let a = 0; ; a += 1000) {
      const { data, error } = await db
        .from(taulu)
        .select(taulu === "projects" ? "id, name, metadata" : "id, title, metadata")
        .range(a, a + 999)
      if (error) {
        console.error(`VIRHE ${taulu}: ${error.message}`)
        process.exit(1)
      }
      rivit.push(...(data ?? []))
      if ((data ?? []).length < 1000) break
    }

    for (const p of rivit) {
      const lista = Array.isArray(p.metadata?.contact_persons) ? (p.metadata.contact_persons as any[]) : []
      if (!lista.length) continue
      for (const v of luokittele(lista)) {
        viat.push({
          luokka: v.luokka,
          rivi: String(p.name ?? p.title ?? ""),
          taulu,
          lahde: String(p.metadata?.source_name ?? "-"),
          merkinta: lista[v.indeksi],
          kaksoset: v.kaksoset,
        })
      }
    }
  }

  const luokat = new Map<string, Vika[]>()
  for (const v of viat) luokat.set(v.luokka, [...(luokat.get(v.luokka) ?? []), v])

  console.log(`Viallisia merkintoja yhteensa ${viat.length}\n`)
  for (const [luokka, lista] of [...luokat.entries()].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n=== ${luokka.toUpperCase()}: ${lista.length} ===`)
    const lahteittain = new Map<string, number>()
    for (const v of lista) lahteittain.set(v.lahde, (lahteittain.get(v.lahde) ?? 0) + 1)
    console.log(
      `   lahteittain: ${[...lahteittain.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, n]) => `${k} ${n}`).join(", ")}`
    )
    if (vainLuokka && luokka !== vainLuokka) continue

    /* Tasavalein, ei alkupaata ([[sample-must-be-representative]]). */
    const askel = Math.max(1, Math.floor(lista.length / nayta))
    for (let i = 0; i < lista.length && i / askel < nayta; i += askel) {
      const v = lista[i]
      console.log(`\n   ${v.rivi.slice(0, 54)}   [${v.taulu}, ${v.lahde}]`)
      console.log(`      ${JSON.stringify(v.merkinta)}`)
      if (v.kaksoset) for (const k of v.kaksoset) console.log(`         kaksonen: ${JSON.stringify(k)}`)
    }
  }
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
