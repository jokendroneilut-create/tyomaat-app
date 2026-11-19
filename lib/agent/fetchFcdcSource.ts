import * as cheerio from "cheerio"
import { YRITYSTIEDOTTEEN_IKKUNA_KK } from "@/lib/agent/tiedotteenIkkuna"
import { getMunicipalityByName, MUNICIPALITIES } from "@/lib/geo/municipalities"
import { mergeCompanyNames } from "@/lib/projects/projectCompanies"
import { PHASE_LABELS } from "@/lib/projects/phases"
import { detectCityFromText } from "./detectCityFromText"
import { inferCompanyPhase } from "./companyRelease"

/*
 * FCDC CORP OY (D-440).
 *
 * Kotimainen datakeskusten kehittäjä: hankkii tontin ja sähköliittymän,
 * kaavoittaa ja hakee luvan, ja myy tai vuokraa kohteen operaattorille
 * (Mäntsälä 1 -> Verne, Lahti -> DayOne). Johannes 19.11.2026 Keravan
 * rakentamisluvasta: *"onko meillä tämä lähteenä tai saammeko sieltä
 * mitään uutta tietoa?"* -- ei ollut, ja tiedotteessa oli rakennuttajan
 * yhteyshenkilö, jota yhdelläkään kannan 10 FCDC-hankkeesta ei ollut.
 *
 * LÄHDE ON TIEDOTTEET. Sivusto (Framer) julkaisee sivukartassa
 * `/news/<slug>`-sivut. Framerin luokkanimet ovat satunnaisia, joten sivu
 * jäsennetään rakenteesta: h1 = otsikko, ensimmäinen <time> = päivä,
 * kappaleet siitä "Lisätietoja"-riviin asti = runko, sen jälkeen
 * yhteystiedot kunnes "lisää uutisia" -listan <time>-rivit alkavat.
 *
 * Hankesivut (`/projects/<slug>`) eivät ole ehdokkaita: niitä on neljä,
 * kaikki rakenteilla ja jo kannassa operaattorin nimellä (Verne, Nebius,
 * DayOne), ja niiden tiedot vietiin kantaan kerran käsin. Uusi hanke
 * kerrotaan ensin tiedotteessa.
 *
 * Yhtiötiedotteet ilman hanketta (yhteisövero, COP31, sähkömarkkinalaki)
 * ohitetaan: otsikossa on oltava datakeskus ja kunta.
 */

const SIVU = "https://www.fcdc.fi"
const SIVUKARTTA = `${SIVU}/sitemap.xml`
export const JULKAISIJA = "FCDC Corp Oy"
const UA = "Mozilla/5.0 (compatible; tyomaat.fi/1.0)"

const EI_HANKE = /yhteisövero|ilmastokeskustelu|COP\d|sähkömarkkinala|rekrytoi|nimitys|vahvistaa tiimi/i

export type FcdcYhteys = {
  kind: "person"
  name: string
  title: string | null
  organization: string | null
  phone: string | null
  email: string | null
  role: null
}

export type FcdcUutinen = {
  url: string
  otsikko: string
  julkaistu: string | null
  runko: string
  yhteyshenkilot: FcdcYhteys[]
}

const siisti = (s: string) => s.normalize("NFC").replace(/ /g, " ").replace(/\s+/g, " ").trim()

const ORGANISAATIO = /\b(?:Oy|Oyj|Ab|Corp|kaupunki|kunta|kuntayhtymä)\b/i

/* Yksi <p>: rivit <br>:n kohdalta, lihavointi merkitsee nimen. */
function yhteystiedotKappaleesta($: cheerio.CheerioAPI, p: any): FcdcYhteys[] {
  const kopio = $(p).clone()
  const nimet = new Set(kopio.find("strong").toArray().map((s) => siisti($(s).text())).filter(Boolean))
  kopio.find("br").replaceWith("\n")
  const rivit = kopio.text().split("\n").map(siisti).filter((r) => r && !/^lisätietoja:?$/i.test(r))

  const ulos: FcdcYhteys[] = []
  let org: string | null = null
  let nyk: FcdcYhteys | null = null
  for (const r of rivit) {
    if (nimet.has(r)) {
      nyk = { kind: "person", name: r, title: null, organization: org, phone: null, email: null, role: null }
      ulos.push(nyk)
      continue
    }
    const posti = r.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i)?.[0]
    if (posti) {
      if (nyk) nyk.email = posti.toLowerCase()
      continue
    }
    const puhelin = r.replace(/^p\.\s*/i, "")
    if (/^\+?[\d\s()-]{7,}$/.test(puhelin)) {
      if (nyk) nyk.phone = puhelin
      continue
    }
    if (/^p\.?$/i.test(r)) continue
    if (!nyk) {
      /* Nimeä edeltävä rivi on organisaatio ("Akaan kaupunki", "FCDC Corp Oy"). */
      org = r
      continue
    }
    if (!nyk.title) {
      /* "kunnanjohtaja, Simon kunta" / "Maanhankinta- ja kehitysjohtaja, FCDC Corp Oy" */
      const m = r.match(/^(.*?),\s*([^,]*\b(?:Oy|Oyj|Ab|Corp|kaupunki|kunta)\b[^,]*)$/i)
      nyk.title = m ? m[1].trim() : r
      if (m && !nyk.organization) nyk.organization = m[2].trim()
      continue
    }
    if (!nyk.organization && ORGANISAATIO.test(r)) nyk.organization = r
  }
  for (const h of ulos) if (h.title) h.title = h.title.charAt(0).toUpperCase() + h.title.slice(1)
  return ulos
}

export function jasennaFcdcUutinen(html: string, url: string): FcdcUutinen | null {
  const $ = cheerio.load(html)
  const otsikko = siisti($("h1").first().text())
  if (!otsikko) return null

  const kappaleet = $("p").toArray()
  const ensimmainenAika = kappaleet.findIndex((p) => $(p).find("time").length > 0)
  if (ensimmainenAika < 0) return null
  const julkaistu = $(kappaleet[ensimmainenAika]).find("time").attr("datetime")?.slice(0, 10) ?? null

  const runko: string[] = []
  const yhteyshenkilot: FcdcYhteys[] = []
  let lisatietoja = false
  for (const p of kappaleet.slice(ensimmainenAika + 1)) {
    /* "Lisää uutisia" -listan päivät: artikkeli on päättynyt. */
    if ($(p).find("time").length) break
    const teksti = siisti($(p).text())
    if (!teksti) continue
    if (/^lisätietoja:?/i.test(teksti)) {
      lisatietoja = true
      const loput = teksti.replace(/^lisätietoja:?\s*/i, "")
      if (loput) yhteyshenkilot.push(...yhteystiedotKappaleesta($, p))
      continue
    }
    if (lisatietoja) yhteyshenkilot.push(...yhteystiedotKappaleesta($, p))
    else runko.push(teksti)
  }
  return { url, otsikko, julkaistu, runko: runko.join(" "), yhteyshenkilot }
}

/*
 * Sama henkilö eri tiedotteissa: yleisin sähköposti voittaa. Karjaan
 * tiedotteessa on "jaakko.leinonen@fcd.fi", kahdessa muussa @fcdc.fi.
 */
export function yhtenaistaSahkopostit(uutiset: FcdcUutinen[]): void {
  const laskut = new Map<string, Map<string, number>>()
  for (const u of uutiset)
    for (const h of u.yhteyshenkilot) {
      /* Julkaisijan verkkotunnus kertoo organisaation, kun tiedote ei sitä sano. */
      if (!h.organization && h.email?.endsWith("@fcdc.fi")) h.organization = JULKAISIJA
      if (!h.email) continue
      const m = laskut.get(h.name) ?? new Map<string, number>()
      m.set(h.email, (m.get(h.email) ?? 0) + 1)
      laskut.set(h.name, m)
    }
  /* Tasapelissä voittaa osoite, jonka verkkotunnus vastaa julkaisijaa (fcdc.fi, ei fcd.fi). */
  const pisteet = (posti: string, n: number) => n + (posti.endsWith("@fcdc.fi") ? 0.5 : 0)
  for (const u of uutiset)
    for (const h of u.yhteyshenkilot) {
      const m = laskut.get(h.name)
      if (!m) continue
      const [paras, n] = [...m.entries()].sort((a, b) => pisteet(b[0], b[1]) - pisteet(a[0], a[1]))[0]
      /* Sama henkilö samassa organisaatiossa: puuttuva osoite täydennetään toisesta tiedotteesta. */
      if (!h.email || pisteet(paras, n) > pisteet(h.email, m.get(h.email) ?? 0)) h.email = paras
    }
}

const NEN_KUNNAT = Object.values(MUNICIPALITIES)
  .map((m) => m.name)
  .filter((k) => k.endsWith("nen"))

/*
 * Kuntatunnistin ei tunnista illatiivia "Huittisiin" eikä genetiiviä
 * "Huittisten". -nen-päätteisille kunnille tunnistetaan s-vartalo.
 */
function kuntaTaivutuksesta(teksti: string): string | null {
  for (const k of NEN_KUNNAT) {
    const vartalo = k.slice(0, -3)
    if (new RegExp(`\\b${vartalo}s(?:iin|ten|ta|essa|esta|een)\\b`, "i").test(teksti)) return k
  }
  return null
}

/* Myönnetty lupa siirtää Rakennuslupa-vaiheeseen; haettu lupa ei. */
const LUPA_MYONNETTY =
  /(?:myönt\p{L}*|sai|saanut|saivat)\s+(?:\S+\s+){0,3}(?:rakennus|rakentamis)lu\p{L}*|(?:rakennus|rakentamis)lupa\s+(?:on\s+)?myönnet\p{L}*|(?:hankkeelle|datakeskukselle)\s+rakentamislupa$/iu

export function onHankeuutinen(u: FcdcUutinen): boolean {
  if (EI_HANKE.test(u.otsikko)) return false
  return /datakeskus/i.test(`${u.otsikko} ${u.runko.slice(0, 400)}`) && !!kuntaUutisesta(u)
}

function kuntaUutisesta(u: FcdcUutinen): string | null {
  return (
    detectCityFromText(u.otsikko) ??
    kuntaTaivutuksesta(u.otsikko) ??
    detectCityFromText(u.runko.slice(0, 600)) ??
    kuntaTaivutuksesta(u.runko.slice(0, 600))
  )
}

export function fcdcVaihe(otsikko: string, runko: string): string {
  if (LUPA_MYONNETTY.test(otsikko) || LUPA_MYONNETTY.test(runko.slice(0, 400))) return PHASE_LABELS.permit
  return inferCompanyPhase(otsikko, runko)
}

export function fcdcEhdokas(u: FcdcUutinen) {
  const city = kuntaUutisesta(u)
  const kuvaus = u.runko.length > 2200 ? `${u.runko.slice(0, 2200).replace(/\s\S*$/, "")} …` : u.runko
  return {
    name: u.otsikko,
    description: kuvaus || null,
    city,
    region: city ? (getMunicipalityByName(city)?.region ?? null) : null,
    location: null as string | null,
    developer: JULKAISIJA,
    builder: null as string | null,
    phase: fcdcVaihe(u.otsikko, u.runko),
    property_type: "Datakeskus",
    source_url: u.url,
    confidence: 0.75,
    completed: false,
    source_name: "fcdc",
    metadata: {
      related_companies: mergeCompanyNames([], [JULKAISIJA]),
      contact_persons: u.yhteyshenkilot,
      date_published: u.julkaistu,
      field_sources: { developer: "julkaisija (hankekehittäjä)", contact_persons: "tiedotteen Lisätietoja-osio" },
    },
  }
}

async function hae(url: string): Promise<string | null> {
  try {
    const v = await fetch(url, { headers: { "User-Agent": UA } })
    return v.ok ? await v.text() : null
  } catch {
    return null
  }
}

export async function fetchFcdcSource() {
  const kartta = await hae(SIVUKARTTA)
  if (!kartta) return []
  const osoitteet = [...kartta.matchAll(/<loc>([^<]+\/news\/[^<]+)<\/loc>/g)].map((m) => m[1].trim())
  const raja = new Date()
  raja.setMonth(raja.getMonth() - YRITYSTIEDOTTEEN_IKKUNA_KK)

  const uutiset: FcdcUutinen[] = []
  for (const url of osoitteet) {
    const html = await hae(url)
    const u = html ? jasennaFcdcUutinen(html, url) : null
    if (u) uutiset.push(u)
    await new Promise((r) => setTimeout(r, 500))
  }
  yhtenaistaSahkopostit(uutiset)
  const ehdokkaat = uutiset
    .filter((u) => !u.julkaistu || new Date(u.julkaistu) >= raja)
    .filter(onHankeuutinen)
    .map(fcdcEhdokas)
  return kohdistaOlemassaOleviin(ehdokkaat)
}

/*
 * TIEDOTE KOHDISTETAAN KUNNAN FCDC-HANKKEESEEN (D-440).
 *
 * Kuivaharjoitus 19.11.2026: 7/7 tiedotetta jäi rajan alle (65 < 70),
 * koska otsikko on uutisotsikko ("Vaasan datakeskushankkeelle
 * rakentamislupa") eikä kannan nimi ("FCDC Vaasa, Kuriiritie"). Kunta ja
 * rakennuttaja täsmäsivät, ja FCDC:llä on käytännössä yksi hanke kuntaa
 * kohti. Kun kunnassa on TÄSMÄLLEEN YKSI julkinen FCDC-datakeskus,
 * ehdokas saa sen nimen ja sijainnin; otsikko jää metatietoon. Muuten
 * (0 tai useampi) ehdokas menee jonoon sellaisenaan.
 */
export async function kohdistaOlemassaOleviin<T extends ReturnType<typeof fcdcEhdokas>>(ehdokkaat: T[]): Promise<T[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const avain = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !avain || !ehdokkaat.length) return ehdokkaat
  try {
    const { createClient } = await import("@supabase/supabase-js")
    const db = createClient(url, avain, { auth: { persistSession: false } })
    const kunnat = Array.from(new Set(ehdokkaat.map((e) => e.city).filter(Boolean))) as string[]
    const { data } = await db
      .from("projects")
      .select("id,name,city,location")
      .eq("is_public", true)
      .ilike("property_type", "datakeskus")
      .ilike("developer", "%FCDC%")
      .in("city", kunnat)
    const kunnittain = new Map<string, { id: string; name: string; location: string | null }[]>()
    for (const p of data ?? []) kunnittain.set(p.city, [...(kunnittain.get(p.city) ?? []), p])
    return ehdokkaat.map((e) => {
      let osumat = e.city ? (kunnittain.get(e.city) ?? []) : []
      /*
       * Useampi FCDC-rivi samassa kunnassa (Huittinen: "FCDC Huittinen,
       * Raumantie" ja Hiukkamäen kaava): valitaan se, jonka nimen paikkasana
       * esiintyy tiedotteessa ("Raumantien välittömään läheisyyteen").
       */
      if (osumat.length > 1) {
        const teksti = `${e.name} ${e.description ?? ""}`.toLowerCase()
        const yleiset = new Set(["fcdc", "datakeskus", "asemakaava", "asemakaavan", "teollisuusalueen", String(e.city).toLowerCase()])
        const sanaOsuu = (nimi: string) =>
          nimi
            .split(/[\s,()–-]+/)
            .map((s) => s.toLowerCase())
            .filter((s) => s.length >= 5 && !yleiset.has(s))
            .some((s) => teksti.includes(s.slice(0, Math.max(5, s.length - 2))))
        const tarkennettu = osumat.filter((h) => sanaOsuu(h.name))
        if (tarkennettu.length === 1) osumat = tarkennettu
      }
      if (osumat.length !== 1) return e
      const h = osumat[0]
      return {
        ...e,
        name: h.name,
        location: e.location ?? h.location,
        metadata: { ...e.metadata, tiedotteen_otsikko: e.name, kohdistettu_hankkeeseen: h.id },
      }
    })
  } catch {
    return ehdokkaat
  }
}
