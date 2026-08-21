import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * KUNNAN YLEINEN YHTEYSTIETO PUUTTUVILLE HANKKEILLE.
 *
 *   1. LOUHINTA. Koko kannan tekstista poimitaan roolilaatikot ja
 *      indeksoidaan verkkotunnuksen mukaan. Verkkotunnus on todiste:
 *      kirjaamo@tampere.fi on Tampereen kirjaamo riippumatta siita
 *      missa se esiintyi.
 *
 *   2. LIITOS. Kunnalliselle hankkeelle liitetaan SEN OMAN kunnan
 *      laatikko. Ehdot lib/projects/orgContacts.ts:ssa.
 *
 * Ehdot ovat tiukat kolmen mitatun epaonnistumisen jalkeen - ks. moduulin
 * kommentti. Talla ajolla ei ole varalle-polkua: jos kunnan omaa
 * laatikkoa ei ole, hanke jaa ilman.
 *
 * EI YLIKIRJOITA (D-101): mergeContacts on vain-lisaava.
 *
 * Aja ensin ilman --apply-lippua.
 */

const APPLY = process.argv.includes("--apply")

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g

/* Kunnallinen hanke: kaava, paatos, lupa tai kuulutus. */
const KUNNALLINEN_LAHDE = /(kaav|paatokset|päätökset|lupapiste|kuulutu|asemakaav)/i

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { isRoleMailbox, domainIsMunicipality, orgContact, asciiName } = await import(
    "../lib/projects/orgContacts"
  )
  const { mergeContacts, deobfuscateEmails } = await import("../lib/projects/contacts")
  const { getMunicipalityByAnyForm, municipalityFromBuyerName } = await import(
    "../lib/geo/municipalityFromName"
  )
  const { municipalityContact } = await import("../lib/projects/municipalityContacts")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const rivit: any[] = []
  for (let f = 0; ; f += 1000) {
    const { data, error } = await supabase
      .from("projects")
      .select("id,name,is_public,city,developer,builder,additional_info,metadata")
      .range(f, f + 999)
    if (error) throw error
    rivit.push(...(data ?? [])); if (!data || data.length < 1000) break
  }

  /* ---------- 1. LOUHINTA ---------- */

  const domainit = new Map<string, Map<string, number>>()

  const talleta = (email: string) => {
    const osoite = email.trim().toLowerCase()
    if (!isRoleMailbox(osoite)) return
    const domain = osoite.split("@")[1]
    if (!domain) return
    if (!domainit.has(domain)) domainit.set(domain, new Map())
    const m = domainit.get(domain)!
    m.set(osoite, (m.get(osoite) ?? 0) + 1)
  }

  for (const p of rivit) {
    const teksti = deobfuscateEmails(
      [p.additional_info, p.metadata?.description].filter(Boolean).join("\n")
    )
    for (const m of teksti.matchAll(EMAIL_RE)) talleta(m[0])
    for (const c of Array.isArray(p.metadata?.contact_persons) ? p.metadata.contact_persons : []) {
      if (c?.email) talleta(String(c.email))
    }
  }

  console.log(APPLY ? "=== AJETTU ===" : "=== KUIVAHARJOITUS (ei kirjoiteta) ===")
  console.log(
    `louhittu: ${domainit.size} verkkotunnusta, ${[...domainit.values()].reduce((a, m) => a + m.size, 0)} roolilaatikkoa\n`
  )

  /* ---------- 2. LIITOS ---------- */

  /* Hankkeen kunta: ensin osapuolen nimesta, sitten kaupunkikentasta. */
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

  const muisti = new Map<string, string | null>()

  const laatikkoKunnalle = (kunta: string): string | null => {
    const avain = asciiName(kunta)
    if (muisti.has(avain)) return muisti.get(avain)!

    let paras: string | null = null
    let osumat = -1

    for (const [domain, laatikot] of domainit) {
      if (!domainIsMunicipality(domain, kunta)) continue
      for (const [osoite, n] of laatikot) {
        if (n > osumat) { osumat = n; paras = osoite }
      }
    }

    /*
     * Kannasta louhittu voittaa: se on esiintynyt oikeassa
     * hankeasiakirjassa ja on siksi aiheeseen osuvampi (kaavoitus@ eika
     * kirjaamo@). Rekisteri on varalla niille kunnille joilta ei
     * loytynyt mitaan.
     */
    if (!paras) paras = municipalityContact(kunta)

    muisti.set(avain, paras)
    return paras
  }

  const puuttuu = rivit.filter(
    (p) => p.is_public && !(Array.isArray(p.metadata?.contact_persons) && p.metadata.contact_persons.length)
  )

  console.log(`ilman yhteystietoa: ${puuttuu.length}`)

  let eiKuntaa = 0, eiLaatikkoa = 0
  const paivitykset: { id: string; contact: any; kunta: string }[] = []
  const naytteet: string[] = []
  const kunnatIlmanLaatikkoa = new Map<string, number>()
  const kaytetyt = new Map<string, number>()

  for (const p of puuttuu) {
    const kunta = kuntaFor(p)
    if (!kunta) { eiKuntaa++; continue }

    const osoite = laatikkoKunnalle(kunta)
    if (!osoite) {
      eiLaatikkoa++
      kunnatIlmanLaatikkoa.set(kunta, (kunnatIlmanLaatikkoa.get(kunta) ?? 0) + 1)
      continue
    }

    paivitykset.push({ id: p.id, contact: orgContact(osoite, kunta), kunta })
    kaytetyt.set(osoite, (kaytetyt.get(osoite) ?? 0) + 1)

    if (naytteet.length < 20) {
      naytteet.push(`  ${String(p.name).slice(0, 34).padEnd(36)} ${kunta.slice(0, 16).padEnd(18)} -> ${osoite}`)
    }
  }

  console.log(`  ei kuntaa tunnistettu:  ${eiKuntaa}`)
  console.log(`  kunnalla ei laatikkoa:  ${eiLaatikkoa}`)
  console.log(`\nlisattavia: ${paivitykset.length}   (${Math.round(paivitykset.length / puuttuu.length * 100)} % puutteesta, ${new Set(paivitykset.map((u) => u.kunta)).size} kuntaa)`)

  if (naytteet.length) { console.log("\nnaytteita:"); for (const n of naytteet) console.log(n) }

  console.log("\nkaytetyimmat laatikot:")
  for (const [k, v] of [...kaytetyt].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
    console.log(`  ${String(v).padStart(4)}  ${k}`)
  }

  console.log("\nsuurimmat kunnat joilla EI laatikkoa (naille tarvitaan osoite kasin):")
  for (const [k, v] of [...kunnatIlmanLaatikkoa].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
    console.log(`  ${String(v).padStart(4)}  ${k}`)
  }

  if (!APPLY) return

  let n = 0
  for (const u of paivitykset) {
    const { data: nyt } = await supabase.from("projects").select("metadata").eq("id", u.id).maybeSingle()
    const meta: any = nyt?.metadata ?? {}
    await supabase
      .from("projects")
      .update({ metadata: { ...meta, contact_persons: mergeContacts(meta.contact_persons ?? [], [u.contact]) } })
      .eq("id", u.id)
    if (++n % 100 === 0) console.log(`  ...kirjoitettu ${n}/${paivitykset.length}`)
  }
  console.log(`\nkirjoitettu: ${n}`)
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
