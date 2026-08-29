import { mkdirSync, writeFileSync } from "node:fs"

/*
 * KARTOITUS: kelpaavatko opiskelija-asuntosäätiöt lähteiksi?
 *
 * Heräte: HOAS tiedotti 402 uudesta opiskelija-asunnosta Helsinkiin
 * (60 M€), ja tieto tuli meille kiertotietä Rakennuslehden kautta.
 *
 * Nämä ovat RAKENNUTTAJIA, eivät urakoitsijoita. Ne tiedottavat kun
 * investointipäätös on tehty — siis ennen urakkakilpailua. Siksi
 * mitattava asia on eri kuin suunnittelutoimistoilla (D-131): ei
 * referenssiluettelo vaan TIEDOTEVIRTA, ja siitä se osuus joka koskee
 * rakentamista.
 *
 * Jäsenluettelo on haettu SOA ry:n sivulta eikä muistista, jotta
 * kartoitus on täydellinen.
 *
 * Ei kerää mitään; lukee robots.txt:n ja laskee.
 */

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) tyomaat.fi-lahdekartoitus"
const AIKAKATKO = 12_000

type Kohde = { nimi: string; domain: string; seutu: string }

/* SOA ry:n jasenluettelosta 29.8.2026. */
const SAATIOT: Kohde[] = [
  { nimi: "HOAS", domain: "www.hoas.fi", seutu: "Helsinki" },
  { nimi: "TOAS", domain: "www.toas.fi", seutu: "Tampere" },
  { nimi: "TYS", domain: "www.tys.fi", seutu: "Turku" },
  { nimi: "PSOAS", domain: "www.psoas.fi", seutu: "Oulu" },
  { nimi: "KOAS", domain: "www.koas.fi", seutu: "Jyväskylä" },
  { nimi: "Soihtu (JYY)", domain: "soihtu.fi", seutu: "Jyväskylä" },
  { nimi: "POAS", domain: "poas.fi", seutu: "Kuopio" },
  { nimi: "Kuopas", domain: "www.kuopas.fi", seutu: "Kuopio" },
  { nimi: "LOAS", domain: "www.loas.fi", seutu: "Lappeenranta" },
  { nimi: "VOAS", domain: "www.voas.fi", seutu: "Vaasa" },
  { nimi: "DAS", domain: "www.das.fi", seutu: "Rovaniemi" },
  { nimi: "Joensuun Elli", domain: "www.joensuunelli.fi", seutu: "Joensuu" },
  { nimi: "AYY Asunnot", domain: "ayyasunnot.fi", seutu: "Espoo" },
  { nimi: "Sevas", domain: "sevas.fi", seutu: "Seinäjoki" },
  { nimi: "MOAS", domain: "www.moas.fi", seutu: "Mikkeli" },
  { nimi: "HOPS", domain: "www.hops.fi", seutu: "Hämeenlinna" },
  { nimi: "Lahden Talot", domain: "www.lahdentalot.fi", seutu: "Lahti" },
  { nimi: "Kotopas", domain: "www.kotopas.fi", seutu: "?" },
  { nimi: "Marttilan Kortteeri", domain: "www.marttilankortteeri.fi", seutu: "?" },
  { nimi: "Oppilastalo", domain: "www.oppilastalo.fi", seutu: "?" },
  { nimi: "Otokylä", domain: "www.otokyla.fi", seutu: "?" },
  { nimi: "Porin YH-Asunnot", domain: "www.porinyhasunnot.fi", seutu: "Pori" },
  { nimi: "Kajaanin Pietari", domain: "www.kajaaninpietari.fi", seutu: "Kajaani" },
  { nimi: "Savonlinnan Asuntopalvelu", domain: "savonlinnanasuntopalvelu.fi", seutu: "Savonlinna" },
  { nimi: "SAO", domain: "www.sao.fi", seutu: "?" },
  { nimi: "JYY", domain: "jyy.fi", seutu: "Jyväskylä" },
  { nimi: "AYY Domo", domain: "domo.ayy.fi", seutu: "Espoo" },
]

/*
 * YLIOPPILASKUNNAT JA NIIDEN KIINTEISTOYHTIOT.
 *
 * Eri ryhma kuin asuntosaatiot: ylioppilaskunta omistaa kiinteistoja
 * suoraan tai yhtionsa kautta, eika ole SOA ry:n jasen. HYY Yhtyma on
 * naista suurin - se omistaa mm. Kaivopihan ja Uuden ylioppilastalon
 * Helsingin ytimessa.
 */
const YLIOPPILASKUNNAT: Kohde[] = [
  { nimi: "HYY Yhtyma", domain: "hyyyhtyma.fi", seutu: "Helsinki" },
  { nimi: "HYY", domain: "hyy.fi", seutu: "Helsinki" },
  { nimi: "AYY", domain: "www.ayy.fi", seutu: "Espoo" },
  { nimi: "TYY", domain: "www.tyy.fi", seutu: "Turku" },
  { nimi: "TREY", domain: "trey.fi", seutu: "Tampere" },
  { nimi: "OYY", domain: "www.oyy.fi", seutu: "Oulu" },
  { nimi: "ISYY", domain: "www.isyy.fi", seutu: "Kuopio/Joensuu" },
  { nimi: "LTKY", domain: "www.ltky.fi", seutu: "Lappeenranta" },
  { nimi: "LYY", domain: "www.lyy.fi", seutu: "Rovaniemi" },
  { nimi: "VYY", domain: "www.vyy.fi", seutu: "Vaasa" },
  { nimi: "Abo Akademis Studentkar", domain: "studentkaren.fi", seutu: "Turku" },
  { nimi: "Teknologforeningen", domain: "www.teknologforeningen.fi", seutu: "Espoo" },
  { nimi: "Ylioppilaiden terveydenhoitosaatio", domain: "www.yths.fi", seutu: "koko maa" },
]

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

async function hae(url: string) {
  const ohjain = new AbortController()
  const t = setTimeout(() => ohjain.abort(), AIKAKATKO)
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA }, signal: ohjain.signal, redirect: "follow" })
    return { ok: r.ok, status: r.status, teksti: await r.text(), otsakkeet: r.headers }
  } catch {
    return { ok: false, status: 0, teksti: "", otsakkeet: null as any }
  } finally { clearTimeout(t) }
}

async function maara(domain: string, base: string) {
  const ohjain = new AbortController()
  const t = setTimeout(() => ohjain.abort(), AIKAKATKO)
  try {
    const r = await fetch(`https://${domain}/wp-json/wp/v2/${base}?per_page=1`, {
      headers: { "User-Agent": UA }, signal: ohjain.signal,
    })
    return Number(r.headers.get("x-wp-total") ?? 0)
  } catch { return 0 } finally { clearTimeout(t) }
}

async function tutki(s: (typeof SAATIOT)[number]) {
  const tulos: any = { ...s, robots: "?", wordpress: false, tyypit: [], tuoreus: null, huomio: "" }

  const robots = await hae(`https://${s.domain}/robots.txt`)
  if (robots.status === 0) { tulos.robots = "-"; tulos.huomio = "ei vastannut"; return tulos }
  const rt = robots.ok ? robots.teksti : ""
  if (robotsKieltaa(rt, "/wp-json/")) {
    tulos.robots = "KIELTAA"
    tulos.huomio = "robots kieltaa - ei tutkittu"
    return tulos
  }
  tulos.robots = rt ? "sallii" : "ei robots"

  const tyypit = await hae(`https://${s.domain}/wp-json/wp/v2/types`)
  if (!tyypit.ok) { tulos.huomio = `ei WP-rajapintaa (${tyypit.status})`; return tulos }

  let data: any
  try { data = JSON.parse(tyypit.teksti) } catch { tulos.huomio = "ei JSONia"; return tulos }
  tulos.wordpress = true

  const kiinnostavat = Object.entries(data as Record<string, any>)
    .filter(([, v]: any) => v?.rest_base)
    .filter(([k, v]: any) =>
      /^(posts?|post)$/.test(String(v.rest_base)) ||
      /(uutis|tiedot|ajankoht|news|hanke|projekt|kohde|rakenn)/i.test(k + " " + String(v?.name ?? ""))
    )

  for (const [avain, v] of kiinnostavat as any) {
    const n = await maara(s.domain, v.rest_base)
    if (n > 0) tulos.tyypit.push({ avain, rest_base: v.rest_base, maara: n })
  }

  if (!tulos.tyypit.length) { tulos.huomio = "WP loytyi, ei tiedotetyyppia"; return tulos }

  /* Tuorein julkaisu kertoo onko virta elossa. */
  const paras = tulos.tyypit.sort((a: any, b: any) => b.maara - a.maara)[0]
  const otos = await hae(`https://${s.domain}/wp-json/wp/v2/${paras.rest_base}?per_page=20&orderby=date&order=desc`)
  try {
    const items = JSON.parse(otos.teksti)
    if (Array.isArray(items) && items.length) {
      tulos.tuoreus = String(items[0]?.date ?? "").slice(0, 10)
      const teksti = (it: any) =>
        `${it?.title?.rendered ?? ""} ${it?.excerpt?.rendered ?? ""} ${it?.content?.rendered ?? ""}`
      /* Rakentamista koskevat tiedotteet ovat se osuus jolla on arvoa. */
      tulos.rakennusosumat = items.filter((it: any) =>
        /(rakenta|rakennut|uudisrakenn|peruskorja|purku|hanke|urakka|harjannosta|valmistu|investoin|tontti|kaava)/i.test(teksti(it))
      ).length
      tulos.otos = items.length
      tulos.esimerkit = items
        .filter((it: any) => /(rakenta|rakennut|uudisrakenn|peruskorja|hanke|urakka|investoin)/i.test(teksti(it)))
        .slice(0, 2)
        .map((it: any) => String(it?.title?.rendered ?? "").replace(/&#8211;/g, "-").slice(0, 70))
    }
  } catch { /* ohitetaan */ }

  return tulos
}

async function main() {
  /*
   * Ryhma valitaan argumentilla, jotta sama seula palvelee molempia:
   * --ryhma=yo tutkii ylioppilaskunnat, muuten asuntosaatiot.
   */
  const yo = process.argv.includes("--ryhma=yo")
  const KOHTEET = yo ? YLIOPPILASKUNNAT : SAATIOT
  console.log(`KOHDERYHMA: ${yo ? "ylioppilaskunnat ja kiinteistoyhtiot" : "opiskelija-asuntosaatiot"} (${KOHTEET.length})
`)

  const tulokset: any[] = []
  const RINNAKKAIN = 4

  for (let i = 0; i < KOHTEET.length; i += RINNAKKAIN) {
    const era = KOHTEET.slice(i, i + RINNAKKAIN)
    const t = await Promise.all(era.map(tutki))
    tulokset.push(...t)
    for (const r of t) {
      const tyypit = r.tyypit.map((x: any) => `${x.rest_base}(${x.maara})`).join(",")
      const rak = r.rakennusosumat != null ? `${r.rakennusosumat}/${r.otos} rak.` : ""
      console.log(
        `${r.nimi.padEnd(26)} ${r.seutu.padEnd(13)} ${String(r.robots).padEnd(9)} ${(tyypit || r.huomio).padEnd(30)} ${String(r.tuoreus ?? "").padEnd(11)} ${rak}`
      )
    }
  }

  mkdirSync("C:/Users/johan/tyomaat-app/scripts/out", { recursive: true })
  writeFileSync("C:/Users/johan/tyomaat-app/scripts/out/foundation-sources.json", JSON.stringify(tulokset, null, 2), "utf8")

  const kaypa = tulokset.filter((t) => (t.rakennusosumat ?? 0) > 0)
  console.log(`\n  RAKENTAMISTA TIEDOTTAVIA: ${kaypa.length} / ${SAATIOT.length}`)
  for (const k of kaypa.sort((a, b) => (b.rakennusosumat ?? 0) - (a.rakennusosumat ?? 0))) {
    console.log(`\n  ${k.nimi} (${k.seutu}) — ${k.rakennusosumat}/${k.otos}, tuorein ${k.tuoreus}`)
    for (const e of k.esimerkit ?? []) console.log(`      ${e}`)
  }
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
export {}
