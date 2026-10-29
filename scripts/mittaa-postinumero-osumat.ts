import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); const q = v.slice(0,1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1,-1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * MITTAUS (D-357): ajaa OIKEAN tasmayttimen niiden parien yli, joiden
 * osoitevertailu muuttuu postinumeron pudotessa, ja nayttaa kummalla
 * puolella 70 pisteen yhdistamisrajaa pari on. Ei kirjoita mitaan.
 *
 * Muutosta EI otettu kayttoon (ks. D-357), joten skripti jaljittelee sita
 * pudottamalla postinumeron osoitekentista ennen tasmaytysta:
 *   --ilman  = nykytila, postinumero mukana  -> 0/21 ylitti 70 pistetta
 *   (ei lippua) = ehdotettu muutos           -> 3/21, joista 1 vaara
 *
 * Jos tasmaytin joskus muutetaan, muista etta TAMA skripti pre-poistaa
 * numeron itse: silloin --ilman ei enaa anna vanhaa vertailukohtaa.
 */
import { normalizeAddress } from "../lib/projects/identity"
import { isSpecificLocation, findProjectMatchDetailed } from "../lib/agent/projectMatcher"

const ILMAN = process.argv.includes("--ilman")
const vertailtava = (s: string) => s.replace(/\b\d{5}\b/g, " ").replace(/\s+/g, " ").trim()

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const rivit: any[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error } = await db.from("projects").select("*").range(a, a + 999)
    if (error) throw error
    rivit.push(...(data ?? [])); if ((data ?? []).length < 1000) break
  }

  const kelpaavat = rivit.filter((r) => r.location && isSpecificLocation(r.location, r.city))
  const ryhmat = new Map<string, any[]>()
  for (const r of kelpaavat) {
    const n = normalizeAddress(r.location); if (!n) continue
    const k = `${normalizeAddress(r.city) ?? ""}|${vertailtava(n)}`
    if (!ryhmat.has(k)) ryhmat.set(k, [])
    ryhmat.get(k)!.push({ ...r, _n: n })
  }

  const parit: [any, any][] = []
  for (const g of ryhmat.values()) {
    if (g.length < 2) continue
    for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) {
      if (g[i]._n === g[j]._n) continue
      parit.push([g[i], g[j]])
    }
  }

  console.log(`${ILMAN ? "VANHA (postinumero mukana)" : "UUSI (postinumero pudotettu)"}: ${parit.length} paria\n`)
  let yli = 0
  for (const [a, b] of parit) {
    /* Ehdokas = b, verrataan vain a:han: nain pisteet koskevat juuri tata paria. */
    const ehdokas: any = {
      name: b.name, city: b.city, region: b.region,
      location: ILMAN ? b.location : String(b.location).replace(/\b\d{5}\b/g, " ").replace(/\s+/g, " ").trim(),
      developer: b.developer, builder: b.builder,
      description: b.additional_info ?? null, metadata: b.metadata ?? null,
    }
    const vastaan: any = ILMAN ? a : { ...a, location: String(a.location).replace(/\b\d{5}\b/g, " ").replace(/\s+/g, " ").trim() }
    const osuma: any = findProjectMatchDetailed([vastaan] as any, ehdokas)
    const p = osuma?.confidence ?? 0
    if (p >= 70) yli++
    console.log(`${p >= 70 ? "YHDISTAISI" : "          "} ${String(p).padStart(3)}  ${String(a.name).slice(0,42).padEnd(44)} <-> ${String(b.name).slice(0,42)}`)
    if (osuma) console.log(`              ${(osuma.reasons ?? []).join(", ")}`)
  }
  console.log(`\n>= 70 pistetta: ${yli} / ${parit.length}`)
}
main().catch((e) => { console.error(e); process.exit(1) })
