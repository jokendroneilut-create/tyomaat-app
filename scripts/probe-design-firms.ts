import { mkdirSync, writeFileSync } from "node:fs"

/*
 * KARTOITUS: mitkä suunnittelu-, insinööri- ja arkkitehtitoimistot
 * kelpaisivat lähteeksi?
 *
 * Granlund osoitti (D-131) että suunnittelija on hankkeessa vuosia ennen
 * urakoitsijaa ja tietää tilaajan 99 %:ssa tapauksista. Sama pätee
 * lähtökohtaisesti koko toimialaan — mutta vain jos referenssit ovat
 * konelukukelpoisia.
 *
 * Tämä ajo EI kerää mitään hankkeita. Se vain katsoo jokaisesta
 * sivustosta:
 *   1. sallliiko robots.txt lukemisen
 *   2. löytyykö WordPressin REST-rajapinta
 *   3. onko siellä hanke-/referenssityyppistä sisältötyyppiä ja montako
 *
 * Robots.txt tarkistetaan ENSIN ja sitä noudatetaan, kuten Hyvinkään ja
 * Vantaan kohdalla on luvattu.
 */

type Firma = { nimi: string; domain: string; laji: string }

const FIRMAT: Firma[] = [
  /* Talotekniikka ja rakennesuunnittelu - Granlundin verrokit */
  { nimi: "Ramboll Finland", domain: "www.ramboll.fi", laji: "monialainen" },
  { nimi: "Sitowise", domain: "www.sitowise.com", laji: "monialainen" },
  { nimi: "AFRY Finland", domain: "afry.com", laji: "monialainen" },
  { nimi: "Sweco Finland", domain: "www.sweco.fi", laji: "monialainen" },
  { nimi: "A-Insinöörit", domain: "www.ains.fi", laji: "monialainen" },
  { nimi: "WSP Finland", domain: "www.wsp.com", laji: "monialainen" },
  { nimi: "Rejlers Finland", domain: "www.rejlers.fi", laji: "monialainen" },
  { nimi: "Vahanen", domain: "www.vahanen.com", laji: "rakenne" },
  { nimi: "Wise Group Finland", domain: "www.wisegroup.fi", laji: "rakenne" },
  { nimi: "Optiplan", domain: "www.optiplan.fi", laji: "rakenne" },
  { nimi: "Ideastructura", domain: "www.ideastructura.fi", laji: "rakenne" },
  { nimi: "Sitowise Rakennesuunnittelu", domain: "www.konstru.fi", laji: "rakenne" },
  { nimi: "Hepacon", domain: "www.hepacon.fi", laji: "talotekniikka" },
  { nimi: "Projectus Team", domain: "www.projectusteam.fi", laji: "talotekniikka" },
  { nimi: "Maaskola", domain: "www.maaskola.fi", laji: "talotekniikka" },

  /* Rakennuttajakonsultit ja projektinjohto - tietavat aikataulut */
  { nimi: "Haahtela", domain: "www.haahtela.fi", laji: "rakennuttaminen" },
  { nimi: "Indepro", domain: "www.indepro.fi", laji: "rakennuttaminen" },
  { nimi: "HTJ", domain: "www.htj.fi", laji: "rakennuttaminen" },
  { nimi: "Vison", domain: "www.vison.fi", laji: "rakennuttaminen" },
  { nimi: "Prodeco", domain: "www.prodeco.fi", laji: "rakennuttaminen" },

  /* Arkkitehtitoimistot - suurimmat ja julkisiin hankkeisiin osallistuvat */
  { nimi: "ALA Arkkitehdit", domain: "ala.fi", laji: "arkkitehti" },
  { nimi: "JKMM Arkkitehdit", domain: "jkmm.fi", laji: "arkkitehti" },
  { nimi: "Anttinen Oiva Arkkitehdit", domain: "aoa.fi", laji: "arkkitehti" },
  { nimi: "Verstas Arkkitehdit", domain: "verstasarkkitehdit.fi", laji: "arkkitehti" },
  { nimi: "PES-Arkkitehdit", domain: "pesark.com", laji: "arkkitehti" },
  { nimi: "K2S Arkkitehdit", domain: "k2s.fi", laji: "arkkitehti" },
  { nimi: "Serum Arkkitehdit", domain: "www.serum.fi", laji: "arkkitehti" },
  { nimi: "SARC Arkkitehdit", domain: "sarc.fi", laji: "arkkitehti" },
  { nimi: "NRT Arkkitehdit", domain: "nrt.fi", laji: "arkkitehti" },
  { nimi: "Lahdelma & Mahlamäki", domain: "arkl.fi", laji: "arkkitehti" },
  { nimi: "Parviainen Arkkitehdit", domain: "parviainenarkkitehdit.fi", laji: "arkkitehti" },
  { nimi: "Uki Arkkitehdit", domain: "www.uki.fi", laji: "arkkitehti" },
  { nimi: "Sigge Arkkitehdit", domain: "sigge.fi", laji: "arkkitehti" },
  { nimi: "Lukkaroinen Arkkitehdit", domain: "www.lukkaroinen.fi", laji: "arkkitehti" },
  { nimi: "Arkkitehdit m3", domain: "www.m3.fi", laji: "arkkitehti" },
  { nimi: "Arkkitehtitoimisto HKP", domain: "www.hkp.fi", laji: "arkkitehti" },
  { nimi: "Playa Arkkitehdit", domain: "playa.fi", laji: "arkkitehti" },
  { nimi: "Huttunen-Lipasti", domain: "huttunen-lipasti.fi", laji: "arkkitehti" },
  { nimi: "Arkkitehtiryhmä A6", domain: "a6.fi", laji: "arkkitehti" },
  { nimi: "Ark-byroo", domain: "www.arkbyroo.fi", laji: "arkkitehti" },
]

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) tyomaat.fi-lahdekartoitus"
const AIKAKATKO = 12_000

/* Yksi hakusana per tyyppi: hanke-/referenssisisallon tunnistus. */
const HANKETYYPPI = /(projekt|referens|hanke|kohde|work|case|tyot|toteutu)/i

async function haeTeksti(url: string): Promise<{ ok: boolean; status: number; teksti: string }> {
  const ohjain = new AbortController()
  const t = setTimeout(() => ohjain.abort(), AIKAKATKO)
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA }, signal: ohjain.signal, redirect: "follow" })
    const teksti = await r.text()
    return { ok: r.ok, status: r.status, teksti }
  } catch {
    return { ok: false, status: 0, teksti: "" }
  } finally {
    clearTimeout(t)
  }
}

/*
 * Kevyt robots-tulkinta: riittaa kertomaan onko koko sivusto kielletty
 * kaikilta agenteilta. Epaselvassa tapauksessa tulkitaan kielloksi.
 */
function robotsKieltaa(robots: string, polku: string): boolean {
  const rivit = robots.replace(/\r/g, "").split("\n").map((r) => r.replace(/#.*/, "").trim())
  let osuu = false
  let kiellot: string[] = []
  let sallitut: string[] = []
  for (const rivi of rivit) {
    const m = rivi.match(/^([A-Za-z-]+)\s*:\s*(.*)$/)
    if (!m) continue
    const avain = m[1].toLowerCase()
    const arvo = m[2].trim()
    if (avain === "user-agent") {
      if (osuu && (kiellot.length || sallitut.length)) break
      osuu = arvo === "*"
      if (osuu) { kiellot = []; sallitut = [] }
      continue
    }
    if (!osuu) continue
    if (avain === "disallow" && arvo) kiellot.push(arvo)
    if (avain === "allow" && arvo) sallitut.push(arvo)
  }
  const sopii = (s: string) => polku.startsWith(s)
  if (sallitut.some(sopii)) return false
  return kiellot.some(sopii)
}

async function tutki(f: Firma) {
  const tulos: any = {
    nimi: f.nimi, laji: f.laji, domain: f.domain,
    robots: "?", wordpress: false, tyypit: [] as any[], huomio: "",
  }

  const robots = await haeTeksti(`https://${f.domain}/robots.txt`)
  const rt = robots.ok ? robots.teksti : ""
  if (robots.status === 0) { tulos.robots = "ei vastausta"; tulos.huomio = "sivusto ei vastannut"; return tulos }
  if (robotsKieltaa(rt, "/wp-json/")) {
    tulos.robots = "kieltaa /wp-json/"
    tulos.huomio = "robots kieltaa - ei tutkittu pidemmalle"
    return tulos
  }
  tulos.robots = rt ? "sallii" : "ei robots.txt"

  const tyypit = await haeTeksti(`https://${f.domain}/wp-json/wp/v2/types`)
  if (!tyypit.ok) { tulos.huomio = `ei WP-rajapintaa (HTTP ${tyypit.status})`; return tulos }

  let data: any
  try { data = JSON.parse(tyypit.teksti) } catch { tulos.huomio = "rajapinta ei palauttanut JSONia"; return tulos }
  tulos.wordpress = true

  const ehdokkaat = Object.entries(data as Record<string, any>)
    .filter(([avain, v]: any) => HANKETYYPPI.test(avain) || HANKETYYPPI.test(String(v?.name ?? "")))
    .filter(([, v]: any) => v?.rest_base)

  if (!ehdokkaat.length) {
    tulos.huomio = `WP loytyi, ei hanketyyppia (${Object.keys(data).length} tyyppia)`
    return tulos
  }

  for (const [avain, v] of ehdokkaat as any) {
    const r = await haeTeksti(`https://${f.domain}/wp-json/wp/v2/${v.rest_base}?per_page=1`)
    let maara = 0
    try { maara = Number(new URL(`https://${f.domain}`) && 0) } catch { /* ohitetaan */ }
    /* Kokonaismaara tulee otsakkeesta, joten haetaan se erikseen. */
    const ohjain = new AbortController()
    const t = setTimeout(() => ohjain.abort(), AIKAKATKO)
    try {
      const vast = await fetch(`https://${f.domain}/wp-json/wp/v2/${v.rest_base}?per_page=1`, {
        headers: { "User-Agent": UA }, signal: ohjain.signal,
      })
      maara = Number(vast.headers.get("x-wp-total") ?? 0)
    } catch { /* jaa nollaksi */ } finally { clearTimeout(t) }

    tulos.tyypit.push({
      avain, rest_base: v.rest_base, nimi: v?.name ?? "", maara,
      julkinen: r.ok,
    })
  }
  return tulos
}

async function main() {
  const tulokset: any[] = []
  const RINNAKKAIN = 4
  for (let i = 0; i < FIRMAT.length; i += RINNAKKAIN) {
    const era = FIRMAT.slice(i, i + RINNAKKAIN)
    const t = await Promise.all(era.map(tutki))
    tulokset.push(...t)
    for (const r of t) {
      const tyypit = r.tyypit.map((x: any) => `${x.rest_base}(${x.maara})`).join(", ")
      console.log(
        `${r.nimi.padEnd(28)} ${r.laji.padEnd(16)} ${String(r.robots).padEnd(16)} ${tyypit || r.huomio}`
      )
    }
  }

  mkdirSync("C:/Users/johan/tyomaat-app/scripts/out", { recursive: true })
  writeFileSync(
    "C:/Users/johan/tyomaat-app/scripts/out/design-firms.json",
    JSON.stringify(tulokset, null, 2), "utf8"
  )

  const lupaavat = tulokset.filter((t) => t.tyypit.some((x: any) => x.maara >= 20))
  console.log(`\n  LUPAAVIA (>= 20 hanketta rajapinnassa): ${lupaavat.length} / ${FIRMAT.length}`)
  for (const l of lupaavat) {
    const paras = l.tyypit.sort((a: any, b: any) => b.maara - a.maara)[0]
    console.log(`    ${l.nimi.padEnd(28)} ${paras.rest_base} ${paras.maara}`)
  }
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
export {}
