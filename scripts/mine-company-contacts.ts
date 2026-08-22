import { readFileSync, writeFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * YRITYKSEN YLEINEN YHTEYSTIETO YRITYKSEN OMALTA SIVULTA.
 *
 * 459 kasin luotua hanketta on ilman yhteystietoa, ja MITATTU 22.8.2026:
 * niista nollassa on sahkopostia tekstissa, viidessa puhelin. Tieto ei
 * siis ole kannassa missaan muodossa - se on haettava ulkoa.
 *
 * LLM EI KELPAA TAHAN. Se tuottaisi osoitteen muististaan eika meilla
 * olisi mitaan millä tarkistaa. Sama saanto kuin kunnilla (D-104):
 * todiste on kaksinkertainen, osoite on yrityksen omalla sivulla JA sen
 * verkkotunnus vastaa yritysta.
 *
 * VERKKOTUNNUS TULEE discovery_sources-taulusta, ei nimesta johtaen:
 * yrityksen tunnusta ei voi paatella nimesta (Tampereen Tilapalvelut Oy
 * -> tilapa.fi, Espoon Asunnot -> espoonasunnot.fi eika espoo.fi).
 *
 * Kirjoittaa vain ehdotustiedoston. Ei koske kantaan.
 */

const OUT = "scripts/out/company-contacts.json"
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}/g

/*
 * Rakennusalan oikea luukku. urakkalaskenta ja hankinta ovat parhaita:
 * ne ovat juuri se osoite johon aliurakoitsija ottaa yhteytta.
 */
const ROLE = /(^|\.)(urakkalaskenta|tarjouspyynnot|tarjoukset|hankinta|hankinnat|info|asiakaspalvelu|kirjaamo|myynti|toimisto)(\.|$)/i

const POLUT = ["", "/yhteystiedot", "/fi/yhteystiedot", "/yhteystiedot/", "/ota-yhteytta"]

const riisu = (x: string) =>
  String(x ?? "")
    .toLowerCase()
    .replace(/[äå]/g, "a")
    .replace(/ö/g, "o")
    .replace(/\b(oy|oyj|ab|ltd|ky|group|yhtiot|yhtiöt)\b/g, "")
    .replace(/[^a-z0-9]/g, "")

/*
 * TIUKKA vastaavuus. Loyha prefiksisaanto tuotti mitatusti vaaria pareja:
 * "Espoon Asunnot" -> espoo.fi ja "Espoon Koulutaival Oy" -> espoo.fi.
 * Kumpikaan ei ole kaupungin sivu.
 */
function domainSopii(domain: string, nimi: string): boolean {
  const host = domain.split(".")[0].replace(/[^a-z0-9]/g, "")
  const k = riisu(nimi)
  if (host.length < 4 || k.length < 3) return false
  return host === k || k === host || host === `${k}group` || k === `${host}group`
}

async function nouda(url: string): Promise<string | null> {
  try {
    const c = new AbortController()
    const t = setTimeout(() => c.abort(), 12000)
    const r = await fetch(url, { headers: { "User-Agent": UA }, signal: c.signal, redirect: "follow" })
    clearTimeout(t)
    return r.ok ? await r.text() : null
  } catch {
    return null
  }
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const { data: lahteet } = await s.from("discovery_sources").select("name,url")
  const tunnetut = new Set<string>()
  for (const l of lahteet ?? []) {
    try { tunnetut.add(new URL(String(l.url)).hostname.replace(/^www\./, "")) } catch {}
  }

  const rivit: any[] = []
  for (let f = 0; ; f += 1000) {
    const { data } = await s.from("projects").select("is_public,developer,builder,metadata").range(f, f + 999)
    rivit.push(...(data ?? [])); if (!data || data.length < 1000) break
  }

  const puuttuu = rivit.filter(
    (p) => p.is_public && !(Array.isArray(p.metadata?.contact_persons) && p.metadata.contact_persons.length)
  )

  const osapuolet = new Map<string, number>()
  for (const p of puuttuu) {
    const o = [p.developer, p.builder, p.metadata?.developer, p.metadata?.builder].find(
      (x) => String(x ?? "").trim().length >= 3
    )
    if (o) osapuolet.set(String(o).trim(), (osapuolet.get(String(o).trim()) ?? 0) + 1)
  }

  /* Yritys -> verkkotunnus, vain TIUKALLA vastaavuudella. */
  const kohteet: { nimi: string; domain: string; n: number }[] = []
  for (const [nimi, n] of [...osapuolet].sort((a, b) => b[1] - a[1])) {
    for (const d of tunnetut) {
      if (domainSopii(d, nimi)) { kohteet.push({ nimi, domain: d, n }); break }
    }
  }

  console.log(`osapuolia ilman yhteystietoa: ${osapuolet.size}`)
  console.log(`niista verkkotunnus tiedossa: ${kohteet.length}   (${kohteet.reduce((a, b) => a + b.n, 0)} hanketta)\n`)

  const tulos: Record<string, { email: string; source: string; projects: number }> = {}
  let loytyi = 0

  for (const k of kohteet) {
    let osuma: { email: string; source: string } | null = null

    for (const polku of POLUT) {
      const html = await nouda(`https://www.${k.domain}${polku}`)
      if (!html) continue

      const ehdokkaat: string[] = []
      for (const m of html.matchAll(EMAIL_RE)) {
        const e = m[0].toLowerCase()
        const [local, domain] = e.split("@")
        if (!ROLE.test(local)) continue
        /* Kaksinkertainen todiste: roolilaatikko JA yrityksen oma tunnus. */
        if (!domainSopii(domain, k.nimi) && domain !== k.domain) continue
        ehdokkaat.push(e)
      }

      if (ehdokkaat.length) {
        /* Urakkalaskenta ja hankinta ensin - ne ovat oikea luukku. */
        const paino = (e: string) =>
          /urakkalaskenta|tarjous/.test(e) ? 3 : /hankinta/.test(e) ? 2 : /info|kirjaamo/.test(e) ? 1 : 0
        ehdokkaat.sort((a, b) => paino(b) - paino(a))
        osuma = { email: ehdokkaat[0], source: `https://www.${k.domain}${polku}` }
        break
      }
    }

    if (osuma) {
      loytyi++
      tulos[k.nimi] = { email: osuma.email, source: osuma.source, projects: k.n }
      console.log(`  ${String(k.n).padStart(3)}  ${k.nimi.slice(0, 28).padEnd(30)} ${osuma.email}`)
    } else {
      console.log(`  ${String(k.n).padStart(3)}  ${k.nimi.slice(0, 28).padEnd(30)} -`)
    }
  }

  console.log(`\nloytyi: ${loytyi} / ${kohteet.length}`)
  console.log(`kattaa hankkeita: ${Object.values(tulos).reduce((a, b) => a + b.projects, 0)}`)

  writeFileSync(OUT, JSON.stringify(tulos, null, 2), "utf8")
  console.log(`kirjoitettu: ${OUT}`)
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
