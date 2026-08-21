import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * VOIKO PUUTTUVAN YHTEYSTIEDON OTTAA SAMAN ORGANISAATION TOISESTA
 * HANKKEESTA?
 *
 * Jokaisella 2 483 puuttuvasta tiedetaan joko osapuoli tai kunta, ja
 * jakauma on erittain keskittynyt (Helsingin kaupunki 534). Jos samasta
 * organisaatiosta on jo VARMENNETTU yhteystieto jossain toisessa
 * hankkeessa, sita voi kayttaa uudelleen ilman uutta lahdetta.
 *
 * VAIN ORGANISAATIOTASON KONTAKTI KELPAA. Nimetty henkilo on TAMAN
 * hankkeen yhteyshenkilo eika seuraavan - hanen nimensa siirtaminen
 * toiseen hankkeeseen olisi vaara tieto. Kirjaamo, rakennusvalvonta ja
 * vaihde sen sijaan palvelevat koko organisaatiota.
 *
 * Ei kirjoita mitaan.
 */

const norm = (s: any): string =>
  String(s ?? "")
    .replace(/\s+/g, " ")
    .replace(/\b(oy|oyj|ab|ltd|ky)\b\.?/gi, "")
    .replace(/[.,]/g, "")
    .trim()
    .toLowerCase()

const osapuoliFor = (p: any): string | null => {
  for (const e of [p.developer, p.builder, p.metadata?.developer, p.metadata?.builder]) {
    const n = norm(e)
    if (n.length >= 3) return n
  }
  return null
}

/* Roolilaatikko: palvelee organisaatiota, ei yksittaista henkiloa. */
const ROLE_MAILBOX =
  /^(kirjaamo|registrator|info|asiakaspalvelu|palaute|neuvonta|kaavoitus|rakennusvalvonta|tekninen|tilapalvelu|tilapalvelut|yhdyskunta|kaupunkiymparisto|kaupunkiymparistö|elinvoima|hallinto|maankaytto|maankäyttö)/i

/*
 * Onko hanke kunnan oma? Joko osapuoli on juuri tama kunta, tai
 * osapuolta ei ole ja lahde on kunnan kaava-/paatos-/lupalahde.
 */
const KUNNALLINEN_LAHDE = /(kaav|paatokset|päätökset|lupapiste|kuulutu|asemakaav)/i

function onKunnallinen(p: any, kaupunki: string): boolean {
  const o = osapuoliFor(p)
  if (o) return o.includes(kaupunki) && /(kaupunki|kunta)/.test(o)
  return KUNNALLINEN_LAHDE.test(String(p.metadata?.source_name ?? ""))
}

/*
 * Vastaako domain organisaation nimea? "tampereen kaupunki" ->
 * "tampere.fi" kelpaa, "ely-keskus.fi" ei. Verrataan nimen sanojen
 * vartaloita domainin ensimmaiseen osaan.
 */
function vastaakoDomain(domain: string, nimi: string): boolean {
  if (!domain || !nimi) return false

  const isanta = domain.split(".")[0].replace(/[^a-z0-9]/g, "")
  if (isanta.length < 3) return false

  const riisu = (x: string) =>
    x.toLowerCase().replace(/[äå]/g, "a").replace(/ö/g, "o").replace(/[^a-z]/g, "")

  for (const sana of nimi.split(/\s+/)) {
    const s = riisu(sana)
    if (s.length < 4) continue
    /* "tampereen" -> vartalo "tampere": riittaa etta toinen sisaltaa toisen. */
    const vartalo = s.replace(/(n|en|in|on|un|ien)$/, "")
    if (vartalo.length >= 4 && (isanta.includes(vartalo) || vartalo.includes(isanta))) return true
  }

  return false
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const rivit: any[] = []
  for (let f = 0; ; f += 1000) {
    const { data, error } = await s
      .from("projects")
      .select("id,name,is_public,city,developer,builder,metadata")
      .range(f, f + 999)
    if (error) throw error
    rivit.push(...(data ?? [])); if (!data || data.length < 1000) break
  }

  const onKontakti = (p: any) =>
    Array.isArray(p.metadata?.contact_persons) && p.metadata.contact_persons.length

  /*
   * REKISTERI: organisaatio -> organisaatiotason kontaktit joita on jo
   * kannassa. Avaimena seka osapuolen nimi etta kunta, koska puuttuvista
   * 42 %:lla on vain kunta.
   */
  const rekisteri = new Map<string, Map<string, any>>()

  const lisaa = (avain: string, c: any) => {
    if (!avain) return
    const tunniste = String(c.email ?? "").toLowerCase() || String(c.phone ?? "").replace(/\D/g, "")
    if (!tunniste) return
    if (!rekisteri.has(avain)) rekisteri.set(avain, new Map())
    rekisteri.get(avain)!.set(tunniste, c)
  }

  for (const p of rivit) {
    if (!onKontakti(p)) continue
    for (const c of p.metadata.contact_persons) {
      /*
       * KIND EI RIITA. Ensimmainen mittaus luotti kentaan kind ===
       * "organization", ja se levitti osoitetta jarmo.turunen@evl.fi
       * (henkilo) kymmeniin hankkeisiin. Vaaditaan ROOLILAATIKKO:
       * osoitteen paikallisosa on kirjaamo, kaavoitus, rakennusvalvonta
       * tms. - se palvelee koko organisaatiota eika ketaan yksittaista.
       */
      if (!c?.email || !ROLE_MAILBOX.test(String(c.email).split("@")[0])) continue

      /*
       * DOMAININ ON VASTATTAVA ORGANISAATIOTA. Ilman tata Tampereen
       * kaupungin hanke sai osoitteen kirjaamo.pirkanmaa@ely-keskus.fi
       * ja Vaylaviraston hanke kirjaamo@lvv.fi - hankkeelle tallennettu
       * yhteystieto ei ole osapuolen yhteystieto vaan sen viranomaisen
       * tai konsultin, joka sattui olemaan tekstissa.
       */
      const domain = String(c.email).split("@")[1]?.toLowerCase() ?? ""

      const o = osapuoliFor(p)
      if (o && vastaakoDomain(domain, o)) lisaa(`o:${o}`, c)

      /*
       * Kunta-avain vain KUNNAN OMISTA hankkeista. Muuten yksityisen
       * hankkeen roolilaatikko paatyisi kunnan avaimen alle.
       */
      const kaupunki = norm(p.city)
      if (kaupunki && onKunnallinen(p, kaupunki) && vastaakoDomain(domain, kaupunki)) lisaa(`k:${kaupunki}`, c)
    }
  }

  console.log(`rekisterin avaimia: ${rekisteri.size}`)

  const puuttuu = rivit.filter((p) => p.is_public && !onKontakti(p))
  console.log(`ilman yhteystietoa: ${puuttuu.length}\n`)

  let osapuolesta = 0, kunnasta = 0, eiLoydy = 0
  const naytteet: string[] = []
  const eiLoydyOrgs = new Map<string, number>()

  for (const p of puuttuu) {
    const o = osapuoliFor(p)
    const kaupunki = norm(p.city)

    /*
     * KUNTA-OSUMA VAIN KUNNALLISEEN HANKKEESEEN. Ensimmainen versio
     * putosi kunnan rekisteriin aina kun osapuolelle ei loytynyt
     * osumaa - jolloin Atrian valmisruokalaitos sai osoitteekseen
     * kaavoitus@seinajoki.fi. Se ei ole Atrian yhteystieto.
     */
    const osuma =
      (o ? rekisteri.get(`o:${o}`) : null) ??
      (kaupunki && onKunnallinen(p, kaupunki) ? rekisteri.get(`k:${kaupunki}`) : null)

    if (!osuma) {
      eiLoydy++
      const avain = o ?? kaupunki ?? "?"
      eiLoydyOrgs.set(avain, (eiLoydyOrgs.get(avain) ?? 0) + 1)
      continue
    }

    if (o && rekisteri.has(`o:${o}`)) osapuolesta++
    else kunnasta++

    if (naytteet.length < 15) {
      const c = [...osuma.values()][0]
      naytteet.push(
        `  ${String(p.name).slice(0, 30).padEnd(32)} ${(o ?? kaupunki).slice(0, 22).padEnd(24)} -> ${c.email || c.phone}`
      )
    }
  }

  console.log("=== UUDELLEENKAYTON KATTAVUUS ===")
  console.log(`  osapuolen kautta: ${osapuolesta}   ${Math.round(osapuolesta / puuttuu.length * 100)} %`)
  console.log(`  kunnan kautta:    ${kunnasta}   ${Math.round(kunnasta / puuttuu.length * 100)} %`)
  console.log(`  ei osumaa:        ${eiLoydy}   ${Math.round(eiLoydy / puuttuu.length * 100)} %`)

  if (naytteet.length) { console.log("\nnaytteita:"); for (const n of naytteet) console.log(n) }

  console.log("\nsuurimmat ilman osumaa (nailla rekisteri pitaisi taydentaa kasin):")
  for (const [k, v] of [...eiLoydyOrgs].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
    console.log(`  ${String(v).padStart(4)}  ${k.slice(0, 50)}`)
  }
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
