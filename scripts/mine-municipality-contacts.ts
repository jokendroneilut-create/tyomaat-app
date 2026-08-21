import { readFileSync, writeFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * KUNNAN KIRJAAMO KUNNAN OMALTA SIVULTA.
 *
 * Kannasta louhittu rekisteri kattoi 43 kuntaa. Loput tarvitsevat
 * osoitteen, ja se on HAETTAVA - ei kirjoitettava muistista.
 *
 * "kirjaamo@<kunnan domain>" nayttaa turvalliselta saannolta mutta ei
 * ole: Helsingin kirjaamo on helsinki.kirjaamo@hel.fi, ei
 * kirjaamo@hel.fi. Yksi arvattu osoite 579 hankkeelle olisi pahin
 * mahdollinen virhe.
 *
 * TODISTE ON KAKSINKERTAINEN: osoite on loydyttava kunnan OMALTA
 * sivulta, ja sen verkkotunnuksen on vastattava kuntaa.
 *
 * Kirjoittaa vain ehdotustiedoston. Ei koske kantaan.
 */

const OUT = "scripts/out/municipality-contacts.json"
const LIMIT = Number(process.argv.find((a) => a.startsWith("--limit="))?.slice(8) ?? 0)
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}/g

/* Sivut joilta kirjaamo yleensa loytyy, yleisyysjarjestyksessa. */
const POLUT = [
  "",
  "/fi/yhteystiedot",
  "/yhteystiedot",
  "/fi/hallinto-ja-talous/kirjaamo",
  "/kirjaamo",
]

async function nouda(url: string): Promise<string | null> {
  try {
    const c = new AbortController()
    const t = setTimeout(() => c.abort(), 12000)
    const r = await fetch(url, { headers: { "User-Agent": UA }, signal: c.signal, redirect: "follow" })
    clearTimeout(t)
    if (!r.ok) return null
    return await r.text()
  } catch {
    return null
  }
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { isRoleMailbox, domainIsMunicipality, asciiName, MUNICIPALITY_DOMAIN_ALIASES } = await import(
    "../lib/projects/orgContacts"
  )
  const { getMunicipalityByAnyForm, municipalityFromBuyerName } = await import(
    "../lib/geo/municipalityFromName"
  )

  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const rivit: any[] = []
  for (let f = 0; ; f += 1000) {
    const { data } = await s.from("projects").select("is_public,city,developer,builder,metadata").range(f, f + 999)
    rivit.push(...(data ?? [])); if (!data || data.length < 1000) break
  }

  const KUNNALLINEN_LAHDE = /(kaav|paatokset|päätökset|lupapiste|kuulutu|asemakaav)/i

  const kuntaFor = (p: any): string | null => {
    for (const e of [p.developer, p.builder, p.metadata?.developer, p.metadata?.builder]) {
      const m = municipalityFromBuyerName(e)
      if (m) return m.name
    }
    if (KUNNALLINEN_LAHDE.test(String(p.metadata?.source_name ?? ""))) {
      const m = getMunicipalityByAnyForm(p.city)
      if (m) return m.name
    }
    return null
  }

  /* Kunnat joilla on puuttuvia hankkeita, suurin ensin. */
  const tarve = new Map<string, number>()
  for (const p of rivit) {
    if (!p.is_public) continue
    if (Array.isArray(p.metadata?.contact_persons) && p.metadata.contact_persons.length) continue
    const k = kuntaFor(p)
    if (k) tarve.set(k, (tarve.get(k) ?? 0) + 1)
  }

  const jarjestys = [...tarve].sort((a, b) => b[1] - a[1])
  const kohteet = LIMIT > 0 ? jarjestys.slice(0, LIMIT) : jarjestys

  console.log(`kuntia joilla puuttuvia hankkeita: ${jarjestys.length}`)
  console.log(`haetaan: ${kohteet.length}\n`)

  const tulos: Record<string, { email: string; source: string; projects: number }> = {}
  let loytyi = 0, eiLoytynyt = 0

  for (const [kunta, n] of kohteet) {
    const nimi = asciiName(kunta)
    const host = MUNICIPALITY_DOMAIN_ALIASES[nimi] ?? nimi
    const domain = `${host}.fi`

    let osuma: { email: string; source: string } | null = null

    for (const polku of POLUT) {
      const url = `https://www.${domain}${polku}`
      const html = await nouda(url)
      if (!html) continue

      const ehdokkaat = new Map<string, number>()
      for (const m of html.matchAll(EMAIL_RE)) {
        const e = m[0].toLowerCase()
        /* Kaksinkertainen todiste: roolilaatikko JA kunnan oma tunnus. */
        if (!isRoleMailbox(e)) continue
        if (!domainIsMunicipality(e.split("@")[1], kunta)) continue
        ehdokkaat.set(e, (ehdokkaat.get(e) ?? 0) + 1)
      }

      if (ehdokkaat.size) {
        /* Kirjaamo ensin: se on kunnan virallinen vastaanotto. */
        const lista = [...ehdokkaat].sort((a, b) => {
          const kirjaamoA = /kirjaamo|registrat/.test(a[0]) ? 1 : 0
          const kirjaamoB = /kirjaamo|registrat/.test(b[0]) ? 1 : 0
          return kirjaamoB - kirjaamoA || b[1] - a[1]
        })
        osuma = { email: lista[0][0], source: url }
        break
      }
    }

    if (osuma) {
      loytyi++
      tulos[kunta] = { email: osuma.email, source: osuma.source, projects: n }
      console.log(`  ${String(n).padStart(4)}  ${kunta.padEnd(18)} ${osuma.email.padEnd(38)} ${osuma.source.replace(/^https:\/\/www\./, "")}`)
    } else {
      eiLoytynyt++
      console.log(`  ${String(n).padStart(4)}  ${kunta.padEnd(18)} -`)
    }
  }

  console.log(`\nloytyi: ${loytyi}   ei loytynyt: ${eiLoytynyt}`)
  console.log(`kattaa hankkeita: ${Object.values(tulos).reduce((a, b) => a + b.projects, 0)}`)

  writeFileSync(OUT, JSON.stringify(tulos, null, 2), "utf8")
  console.log(`\nkirjoitettu: ${OUT}`)
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
