import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); const q = v.slice(0,1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1,-1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * MITTAUS ENNEN KAYTTOONOTTOA (D-357): mita postinumeron pudottaminen
 * osoitevertailusta tekee JO HYVAKSYTYLLE aineistolle.
 *
 * Tulostaa jokaisen parin joka muuttuu "eri osoite" -> "sama osoite",
 * jotta rivit voi lukea yksitellen. Ei kirjoita mitaan.
 */
import { normalizeAddress } from "../lib/projects/identity"
import { isSpecificLocation } from "../lib/agent/projectMatcher"

const vertailtava = (s: string) => s.replace(/\b\d{5}\b/g, " ").replace(/\s+/g, " ").trim()

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const rivit: any[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error } = await db.from("projects").select("id,name,city,phase,location,is_public,metadata").range(a, a + 999)
    if (error) throw error
    rivit.push(...(data ?? [])); if ((data ?? []).length < 1000) break
  }

  const kelpaavat = rivit.filter((r) => r.location && isSpecificLocation(r.location, r.city))
  console.log(`Hankkeita ${rivit.length}, niista katuosoitetarkkuudella ${kelpaavat.length}`)

  /* Ryhmittely uudella avaimella; vanha avain on normalizeAddressin tulos. */
  const ryhmat = new Map<string, any[]>()
  for (const r of kelpaavat) {
    const n = normalizeAddress(r.location)
    if (!n) continue
    const k = `${normalizeAddress(r.city) ?? ""}|${vertailtava(n)}`
    if (!ryhmat.has(k)) ryhmat.set(k, [])
    ryhmat.get(k)!.push({ ...r, _n: n })
  }

  let muuttuvat = 0
  const rivitUlos: string[] = []
  for (const [k, g] of ryhmat) {
    if (g.length < 2) continue
    for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) {
      if (g[i]._n === g[j]._n) continue       /* osui jo ennestaan */
      muuttuvat++
      rivitUlos.push(
        `[${k}]\n   ${String(g[i].phase).padEnd(20)} ${String(g[i].name).slice(0,58)}\n       "${g[i].location}" | ${g[i].metadata?.source_name ?? "-"} | julkinen ${g[i].is_public}\n   ${String(g[j].phase).padEnd(20)} ${String(g[j].name).slice(0,58)}\n       "${g[j].location}" | ${g[j].metadata?.source_name ?? "-"} | julkinen ${g[j].is_public}`
      )
    }
  }
  console.log(`\nPareja jotka muuttuvat "eri osoite" -> "SAMA osoite": ${muuttuvat}\n`)
  console.log(rivitUlos.join("\n\n"))
}
main().catch((e) => { console.error(e); process.exit(1) })
