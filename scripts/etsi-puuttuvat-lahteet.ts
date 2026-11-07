import { readFileSync, writeFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * LAHDELINKIN HAKU VERKOSTA (D-376, vaihe 1 jatko).
 *
 * Johannes Kirjalansalmesta: *"en loyda lahdetta eli en voi tarkistaa
 * onko tuo oikein."* Mitattu: **285 julkista hanketta** oli ilman mitaan
 * lahdelinkkia; 33 korjattiin lukemalla osoite kannasta
 * (`yhteyshenkiloehdotus.lahteet`), ja **251 jai** verkkohaun varaan.
 *
 * VAARA LAHDE ON PAHEMPI KUIN PUUTTUVA. Nappi lupaa "Avaa alkuperainen
 * ilmoitus", joten vaara linkki rikkoo lupauksen nakyvasti. Siksi
 * portti on tassa koko tyo, ei haku.
 *
 * KOLME PORTTIA:
 *
 *   1. OSOITE. Oma sivumme, yhteystieto- ja listaussivut pois
 *      ([[listing-page-is-not-project-page]]).
 *   2. SIVUN SISALTO. Hankkeen nimen erottuvat sanat on loydyttava
 *      sivulta. Yleissanat ("rakentaminen", "hanke", "uusi") eivat
 *      erota mitaan, joten ne karsitaan ensin.
 *   3. KAUPUNKI. Jos hankkeella on kaupunki, sen on myos loydyttava --
 *      muuten "Koulun peruskorjaus" osuu minka tahansa kunnan sivulle
 *      ([[proximity-needs-same-kind]] samasta syysta: yksi todiste ei
 *      riita).
 *
 * DuckDuckGon html-paatepiste on ilmainen ja loytaa suomalaiset
 * hankkeet; `WebSearch` ei ([[web-search-route]]).
 *
 * KANTA LUETAAN KERRAN. Instanssi on NANO, ja taman session toistuvat
 * taulunluvut osuivat yhteen kannan kaatumisen kanssa 7.11.2026.
 *
 *   npx tsx scripts/etsi-puuttuvat-lahteet.ts --raja=20
 *   npx tsx scripts/etsi-puuttuvat-lahteet.ts --raja=20 --apply
 */
const APPLY = process.argv.includes("--apply")
const rajaArg = process.argv.find((a) => a.startsWith("--raja="))
const RAJA = rajaArg ? Number(rajaArg.slice("--raja=".length)) : Infinity

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
const TAUKO_MS = 1200
const TUNNISTE = "lahde_verkkohausta_2026_11"
const RAPORTTI = "C:/Users/johan/tyomaat-app/.tmp-lahdehaku.txt"

/* Sama suodatin kuin kannasta luetuille osoitteille. */
const OMA_SIVU = /(^|\.)tyomaat\.fi$/i
const EI_HANKESIVU = /\/(yhteystiedot|contact|contacts|ListItems|kaupunki-rakentaa|haku|search)\/?$/i

/*
 * KAAPIJA EI OLE LAHDE.
 *
 * Mitattu koko 251 hankkeen ajosta: haku tarjosi Hilman
 * hankintailmoituksia uudelleenjulkaisevia sivustoja --
 * `app.cobrief.com` 8 kertaa, `fi.openprocurements.com` 3,
 * `b2b.profinder.fi` 3. Ne lapaisivat sanatarkistuksen helposti, koska
 * ne kopioivat ilmoituksen otsikon sellaisenaan.
 *
 * Alkuperainen on hankintailmoitukset.fi, ja se loytyi 13:lle naista
 * suoraan kannasta ([[rakennuslehti-is-secondary]],
 * [[own-data-unread]]).
 *
 * Mukana myos asuntoilmoitus- ja yrityshakemistosivut: `etuovi.com`
 * myy asuntoja ja `profinder` listaa yhtiotietoja, kumpikaan ei kerro
 * hankkeesta. LinkedIn-julkaisu ei ole hankesivu.
 */
const KAAPIJA =
  /(^|\.)(cobrief\.com|openprocurements\.com|profinder\.fi|etuovi\.com|oikotie\.fi|linkedin\.com|finder\.fi|vainu\.io|asuntojenhinnat\.fi)$/i

/*
 * Yleissanat eivat erota hanketta mistaan. Lista on hankenimien
 * sanastoa, ei yleista suomea.
 */
const YLEISSANA = new Set([
  "rakentaminen", "rakennus", "rakennuksen", "rakentamisen", "hanke", "hankkeen",
  "uusi", "uuden", "uudet", "peruskorjaus", "peruskorjauksen", "saneeraus",
  "laajennus", "kunnostus", "muutos", "purku", "urakka", "urakan", "kohde",
  "alue", "alueen", "talo", "talon", "katu", "kadun", "tie", "tien", "silta",
  "sillan", "koulu", "koulun", "asunnot", "asuntoja", "kerrostalo", "osa",
  "vaihe", "suunnitelma", "asemakaava", "asemakaavan", "kaava", "kaavan",
])

function erottuvatSanat(nimi: string): string[] {
  return String(nimi)
    .toLowerCase()
    .replace(/[^a-zåäö0-9\s-]/g, " ")
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 5 && !YLEISSANA.has(s))
}

async function hae(url: string, aikaraja = 20_000): Promise<string | null> {
  try {
    const ohjain = new AbortController()
    const kello = setTimeout(() => ohjain.abort(), aikaraja)
    const r = await fetch(url, { cache: "no-store", headers: { "user-agent": UA }, signal: ohjain.signal })
    clearTimeout(kello)
    return r.ok ? await r.text() : null
  } catch {
    return null
  }
}

function tulokset(html: string): string[] {
  const ulos: string[] = []
  for (const m of html.matchAll(/uddg=([^&"]+)/g)) {
    try {
      const u = decodeURIComponent(m[1])
      if (!/^https?:\/\//.test(u)) continue
      const osoite = new URL(u)
      if (OMA_SIVU.test(osoite.hostname)) continue
      if (KAAPIJA.test(osoite.hostname)) continue
      if (EI_HANKESIVU.test(osoite.pathname)) continue
      if (!ulos.includes(u)) ulos.push(u)
    } catch {
      /* viallinen osoite ohitetaan */
    }
  }
  return ulos.slice(0, 5)
}

const riisu = (s: string) =>
  s.toLowerCase().replace(/[^a-zåäö0-9\s]/g, " ").replace(/\s+/g, " ")

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  /* YKSI luku, ei erillista mittauskyselya. */
  const hankkeet: any[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error } = await db
      .from("projects")
      .select("id,name,city,is_public,status,developer,builder,metadata")
      .range(a, a + 999)
    if (error) throw error
    hankkeet.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }

  const onLahde = (h: any) =>
    Boolean(
      h.metadata?.source_url ||
        h.metadata?.documents_url ||
        (Array.isArray(h.metadata?.source_history) ? h.metadata.source_history.length : 0)
    )

  const kaikki = hankkeet.filter((h) => h.is_public && h.status === "active" && !onLahde(h))
  /* Tasavali, ei ensimmaiset N ([[sample-must-be-representative]]). */
  const vali = RAJA === Infinity ? 1 : Math.max(1, Math.floor(kaikki.length / RAJA))
  const jono = RAJA === Infinity ? kaikki : kaikki.filter((_, i) => i % vali === 0).slice(0, RAJA)

  console.log(`ilman lahdetta ${kaikki.length}, kasitellaan ${jono.length}\n`)

  const rivit: string[] = []
  const luokat: Record<string, number> = {}
  let loytyi = 0

  for (const h of jono) {
    const sanat = erottuvatSanat(h.name)
    if (!sanat.length) {
      luokat.ei_erottuvia_sanoja = (luokat.ei_erottuvia_sanoja ?? 0) + 1
      console.log(`  OHITA (nimi)   ${String(h.name).slice(0, 48)}`)
      continue
    }

    const kysely = [h.name, h.city, h.developer].filter(Boolean).join(" ")
    await new Promise((r) => setTimeout(r, TAUKO_MS))
    const haku = await hae(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(kysely)}`)
    if (!haku) {
      luokat.haku_epaonnistui = (luokat.haku_epaonnistui ?? 0) + 1
      continue
    }

    let osuma: { url: string; osui: string[] } | null = null
    for (const url of tulokset(haku)) {
      const sivu = await hae(url, 15_000)
      if (!sivu) continue
      const teksti = riisu(sivu)
      const osui = sanat.filter((s) => teksti.includes(s))
      /*
       * KAKSI EROTTUVAA SANAA, AINA.
       *
       * Ensimmainen versio hyvaksyi yhden sanan silloin kun nimessa oli
       * vain yksi erottuva. Otos 20 hankkeesta paljasti etta juuri ne
       * olivat vaaria: "Uimahallin laajennus" osui Kotkan **uimahalli-
       * sivulle** ja "Marttilan asemakaavan muutos" Taivassalon
       * **kaavoitussivulle** -- kumpikaan ei ole se hanke, vaan kunnan
       * osastosivu ([[listing-page-is-not-project-page]]).
       *
       * Yksi sana riittaa loytoon muttei paatokseen
       * ([[finding-signal-not-deciding-signal]]). Tama pudottaa
       * osumatarkkuuden 85 %:sta 70 %:iin ja poistaa molemmat vaarat --
       * oikea vaihtokauppa, koska nappi lupaa "Avaa alkuperainen
       * ilmoitus".
       */
      if (osui.length < 2) continue
      /* Kaupunki on toinen riippumaton todiste. */
      if (h.city && !teksti.includes(riisu(String(h.city)).trim())) continue
      osuma = { url, osui }
      break
    }

    if (!osuma) {
      luokat.ei_osumaa = (luokat.ei_osumaa ?? 0) + 1
      console.log(`  EI OSUMAA      ${String(h.name).slice(0, 48).padEnd(48)} (${sanat.slice(0, 3).join(", ")})`)
      continue
    }

    loytyi++
    luokat.loytyi = (luokat.loytyi ?? 0) + 1
    console.log(
      `${APPLY ? "KIRJOITA" : "(kuiva) "} ${String(h.name).slice(0, 42).padEnd(42)} | ${String(h.city ?? "-").slice(0, 12).padEnd(12)} | ${osuma.url.slice(0, 72)}`
    )
    console.log(`           osuvat sanat: ${osuma.osui.join(", ")}`)
    rivit.push(`${h.id}\t${h.name}\t${h.city ?? ""}\t${osuma.url}\t${osuma.osui.join(" ")}`)

    if (!APPLY) continue
    const md = {
      ...(h.metadata ?? {}),
      source_url: osuma.url,
      field_sources: {
        ...(h.metadata?.field_sources ?? {}),
        source_url: `verkkohaku, vahvistettu sivulta sanoilla: ${osuma.osui.join(", ")}`,
      },
      takautuvat_ajot: [
        ...new Set([
          ...(Array.isArray(h.metadata?.takautuvat_ajot) ? h.metadata.takautuvat_ajot : []),
          TUNNISTE,
        ]),
      ],
    }
    const { error } = await db.from("projects").update({ metadata: md }).eq("id", h.id)
    if (error) console.log(`   VIRHE: ${error.message}`)
  }

  writeFileSync(RAPORTTI, rivit.join("\n"), "utf8")
  console.log(`\n=== ${APPLY ? "AJETTU" : "KUIVAHARJOITUS"} ===`)
  console.log(`  kasitelty ${jono.length}, lahde loytyi ${loytyi} (${((loytyi / jono.length) * 100).toFixed(0)} %)`)
  for (const [k, v] of Object.entries(luokat).sort((a, b) => b[1] - a[1])) {
    console.log(`     ${String(v).padStart(3)}  ${k}`)
  }
  console.log(`  tuotos ${RAPORTTI}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
