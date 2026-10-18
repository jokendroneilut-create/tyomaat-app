import { tiedotteenAikaraja } from "@/lib/agent/tiedotteenIkkuna"
import { detectCityFromText } from "./detectCityFromText"
import { getMunicipalityByName } from "@/lib/geo/municipalities"
import { allativeToNominative } from "./companyName"
import { LEAD_LENGTH, inferBuildingType } from "./buildingType"
import { parseEstimatedCompletionDate } from "./parseFinnishCompletionDate"
import { PHASE_LABELS } from "@/lib/projects/phases"
import { mergeCompanyNames } from "@/lib/projects/projectCompanies"
import { onValmistunut, sivuurakoitsijanVaihe, tekstiksi } from "./sivuurakoitsijaRss"
import { ilmanTienNimia } from "./fetchVrjSource"
import { osoiteAnkkuri } from "./fetchHekaSource"

/*
 * OTERAN OY: AJANKOHTAISTA (D-310).
 *
 * Oteran (Lohkare Infra -konserni) on silta-, vesi- ja maarakentamisen
 * paaurakoitsija. Tilaaja on yleensa Vaylavirasto, elinvoimakeskus tai
 * kaupunki, ja se kerrotaan tekstissa ("tilaajana Rauman kaupunki",
 * "Vaylavirastolle urakoimamme").
 *
 * REITTI: WordPressin RSS (`/feed/`). REST (`/wp-json/wp/v2/posts`)
 * palauttaa 401, mutta syote on auki ja antaa koko tekstin
 * `content:encoded`-kentassa seka kategoriat. Yksi pyynto kattaa 100
 * julkaisua (noin kaksi vuotta), joten jutun sivuja ei haeta. robots.txt
 * kieltaa vain yhden wpo-lisaosan JSON-tiedoston.
 *
 * MIKSI KOKO SYOTE EIKA KATEGORIASYOTE. Kategoriat ovat epajohdonmukaisia:
 * uusin hankejuttu (Kurikan Vt 3 / Vt 19, 15.10.2026) ja Puutossalmen
 * lauttapaikat (18.11.2025) ovat vain kategoriassa "Ajankohtaista".
 * `/category/tyomaalla/feed/` olisi pudottanut molemmat. Siksi hankkeeksi
 * kelpaa kategoria Urakkavoitot/Tyomaalla TAI hankeotsikko, ja muiden
 * kategorioiden juttu suljetaan pois kategorian perusteella.
 *
 * MITATTU 18.10.2026: 12 kk ikkunassa 26 julkaisua, joista 7 kertoo
 * hankkeesta. Kaksi niista on koostejuttuja ("Urakkakuulumisia",
 * "Laskentakauden kuulumisia"), joissa on 2 ja 5 hanketta, ja viides
 * osio luettelee nelja siltaurakkaa. Eriteltyna 15 ehdokasta, 14 eri
 * hanketta (Porvoon silta kahdesti).
 */

const SYOTE = "https://oteran.fi/feed/"
const MAX_SIVUT = 3
const UA = "Mozilla/5.0 (compatible; tyomaat.fi/1.0)"
const AIKAKATKAISU_MS = 15 * 1000

export const OTERAN = "Oteran Oy"

export type OteranJulkaisu = {
  otsikko: string
  osoite: string
  pvm: Date | null
  kategoriat: string[]
  html: string
}

export function jasennaSyote(xml: string): OteranJulkaisu[] {
  const out: OteranJulkaisu[] = []
  for (const item of xml.match(/<item>[\s\S]*?<\/item>/gi) ?? []) {
    const kentta = (tagi: string) =>
      item.match(new RegExp(`<${tagi}[^>]*>([\\s\\S]*?)<\\/${tagi}>`, "i"))?.[1] ?? ""
    const otsikko = tekstiksi(kentta("title"))
    const osoite = tekstiksi(kentta("link"))
    if (!otsikko || !osoite) continue
    const kategoriat = [...item.matchAll(/<category>([\s\S]*?)<\/category>/gi)].map((m) =>
      tekstiksi(m[1])
    )
    const pvm = new Date(tekstiksi(kentta("pubDate")))
    const html = kentta("content:encoded").replace(/^\s*<!\[CDATA\[|\]\]>\s*$/g, "")
    out.push({ otsikko, osoite, pvm: isNaN(pvm.getTime()) ? null : pvm, kategoriat, html })
  }
  return out
}

/*
 * SUODATUS (D-310). Poissulku kategoriasta ja otsikosta, kuten Kastelli
 * (D-241): ingressi ei ratkaise.
 *
 * Hankekategoria ei yksin riita: "RT:n turvallisuusviikko" ja "TET/talk"
 * ovat Tyomaalla-kategoriassa. Ensimmainen on myos Vastuullisuus, joka
 * suljetaan pois; jalkimmainen pudotetaan otsikosta.
 */
const HANKEKATEGORIAT = ["urakkavoitot", "työmaalla"]
const EI_HANKE_KATEGORIAT = ["nimitysuutiset", "oteranilaiset", "työhyvinvointi", "vastuullisuus"]

/* Hankeotsikko ilman hankekategoriaa (Kurikka, Puutossalmi). */
const HANKEOTSIKKO =
  /^(?:työmaalla|työmaakuulum|urakkavoitt?o|urakkakuulum|laskentakauden|(?:mielenkiintoiset|kiinnostavimmat)\s+ajankohtaiset\s+(?:urakat|infrahankkeet))/iu

const EI_KOSKAAN_HANKE = [
  "tet/talk",
  "turvallisuusviikko",
  "työturvallisuuspäivä",
  "haemme",
  "haussa",
  "kesätyö",
  "nimitetty",
  "aloittaa",
  "yrityskauppa",
  "on ostanut",
  "konserni",
  "mitä tehtiin",
]

export function lapaiseeSuodatuksen(j: Pick<OteranJulkaisu, "otsikko" | "kategoriat">): boolean {
  const kat = j.kategoriat.map((k) => k.toLowerCase())
  const otsikko = j.otsikko.toLowerCase()
  if (kat.some((k) => EI_HANKE_KATEGORIAT.includes(k))) return false
  if (EI_KOSKAAN_HANKE.some((k) => otsikko.includes(k))) return false
  return kat.some((k) => HANKEKATEGORIAT.includes(k)) || HANKEOTSIKKO.test(j.otsikko)
}

/*
 * KAPPALEET. Hashtag-rivit, "Lohkare Infra" -allekirjoitus ja syotteen
 * "The post ... appeared first on Oteran" pois kuvauksesta.
 *
 * LinkedInista kopioitu organisaatiotagi ("Porvoon kaupunki – Borgå stad –
 * City of Porvoo", "Väylävirasto / Trafikledsverket / ...") jaa omaksi
 * kappaleekseen: se on tilaajan nimi, ei kuvausta.
 */
type Kappale = { teksti: string; osionOtsikko: boolean }

const TAGIRIVI = /^[^.!?]{3,120}?(?:\s[–/]\s[^.!?]+){2,}$/u

function onRoskaa(teksti: string): boolean {
  if (!teksti) return true
  if (/^the post .+ appeared first on/i.test(teksti)) return true
  if (/^lohkare infra$/i.test(teksti)) return true
  if (/^#/.test(teksti) || (teksti.match(/#/g)?.length ?? 0) >= 3) return true
  return false
}

/*
 * KAPPALEET RIVEINA, EI ELEMENTTEINA. LinkedInista kopioitu HTML on
 * rikki: Porvoon jutussa sulkematon `<div>` kaarii seuraavat `<p>`:t
 * sisaansa, ja elementtipohjainen luku pudotti avausvirkkeet ("Urakan
 * ensimmainen paiva, ja tyomaa on lahtenyt liikkeelle...", kuivaharjoitus
 * 18.10.2026). Lohkotagit ja `<br>` vaihdetaan rivinvaihdoiksi ennen
 * tagien poistoa, jolloin rakenteella ei ole valia.
 *
 * Lahteen omat rivinvaihdot ensin valilyonneiksi: tagin attribuutit
 * voivat jakautua riveille, ja silloin `<span class=...>` jai tekstiin.
 *
 * OSION OTSIKKO: koostejutussa jokainen hanke alkaa ⚒-emojilla
 * LIHAVOIDUSSA kappaleessa. WordPress muuntaa emojin kuvaksi, joten kuva
 * vaihdetaan takaisin merkiksi. Lihavointi vaaditaan, koska Kurikan
 * jutun "Tyomaan ajankohtaiset" -luettelo kayttaa samaa emojia
 * luettelomerkkina — ja ilman sita jokainen luettelon rivi tuli omaksi
 * hankkeekseen (kuivaharjoitus).
 */
const LOHKOTAGI = /<\/?(?:p|div|h[1-6]|li|ul|ol|blockquote|figure)\b[^>]*>|<br\s*\/?>/gi
const OSION_MERKKI = /<img\b[^>]*alt="⚒"[^>]*>/gi

export function jasennaKappaleet(html: string): Kappale[] {
  const out: Kappale[] = []
  const rivit = html
    .replace(/\s+/g, " ")
    .replace(OSION_MERKKI, "⚒")
    .replace(LOHKOTAGI, "\n")
    .split("\n")
  for (const rivi of rivit) {
    const raaka = tekstiksi(rivi)
    const osionOtsikko = /^⚒/.test(raaka) && raaka.length <= 250 && /<(?:strong|b)\b/i.test(rivi)
    const teksti = raaka.replace(/^⚒\s*/, "").trim()
    if (onRoskaa(teksti)) continue
    out.push({ teksti, osionOtsikko })
  }
  return out
}

export type OteranOsio = {
  nimi: string
  /* Otsikon "tilaajana X" -osa, jos on. */
  tilaaja: string | null
  kappaleet: string[]
  /* Osa koostejuttua: dedupointiavain tarvitsee oman fragmentin. */
  fragmentti: string | null
  /* Yksi puolipisteluettelon sopimuksista: kaupunki vain nimesta. */
  luettelosta: boolean
}

/*
 * KOOSTEJUTTU ERITELLAAN (ks. multi-project-rows). Yhtena rivina
 * "Laskentakauden kuulumisia" ei loydy haulla eika osu hakuvahtiin;
 * Luikonlahden puuterminaalia etsiva ei hae otsikolla "kuulumisia".
 *
 * Osion otsikko on muotoa "<hanke>, tilaajana <tilaaja>". Siltaurakoiden
 * osio luettelee nelja sopimusta puolipistein ("...sillankorjausurakat:
 * LOU Siltaurakka 3/2026; ITA ...; Siltaurakka UUD1 2026-2027; EPO
 * Melsorkanavan silta V-64, 2026, KU"), joten sekin jaetaan. Kappale
 * kuuluu sille sopimukselle jonka tunnus siina viimeksi mainittiin;
 * johdanto ennen ensimmaista mainintaa kuuluu kaikille.
 */
export function jaaOsioihin(otsikko: string, kappaleet: Kappale[]): OteranOsio[] {
  const otsikot = kappaleet.filter((k) => k.osionOtsikko)
  if (otsikot.length === 0) {
    return [{ nimi: otsikko, tilaaja: null, kappaleet: kappaleet.map((k) => k.teksti), fragmentti: null, luettelosta: false }]
  }

  const osiot: OteranOsio[] = []
  let nykyinen: { otsikko: string; kappaleet: string[] } | null = null
  const raaka: { otsikko: string; kappaleet: string[] }[] = []
  for (const k of kappaleet) {
    if (k.osionOtsikko) {
      nykyinen = { otsikko: k.teksti, kappaleet: [] }
      raaka.push(nykyinen)
    } else if (nykyinen) {
      nykyinen.kappaleet.push(k.teksti)
    }
  }

  for (const r of raaka) {
    const [nimiOsa, tilaajaOsa] = r.otsikko.split(/,\s*tilaajana\s+/)
    const luettelo = nimiOsa.match(/^[^:]{5,80}urakat:\s*(.+)$/u)
    if (luettelo) {
      const nimet = luettelo[1].split(/\s*;\s*/).map((n) => n.trim()).filter(Boolean)
      const avaimet = nimet.map(sopimuksenTunnus)
      const omat: string[][] = nimet.map(() => [])
      const yhteiset: string[] = []
      let viimeisin = -1
      for (const kappale of r.kappaleet) {
        const osuma = avaimet.findIndex((a) => a && kappale.includes(a))
        if (osuma >= 0) viimeisin = osuma
        if (viimeisin < 0) yhteiset.push(kappale)
        else omat[viimeisin].push(kappale)
      }
      nimet.forEach((nimi, i) => {
        osiot.push({
          nimi,
          tilaaja: elinvoimakeskusTunnuksesta(nimi),
          kappaleet: [...omat[i], ...yhteiset],
          fragmentti: osoiteAnkkuri(nimi),
          luettelosta: true,
        })
      })
      continue
    }
    const nimi = nimiOsa.trim()
    osiot.push({
      nimi,
      tilaaja: tilaajaOsa?.trim() || null,
      kappaleet: r.kappaleet,
      fragmentti: osoiteAnkkuri(nimi),
      luettelosta: false,
    })
  }
  return osiot
}

/* "Siltaurakka UUD1 2026-2027" -> "UUD1", "EPO Melsorkanavan silta" -> "Melsorkanavan". */
function sopimuksenTunnus(nimi: string): string | null {
  const koodi = nimi.match(/\b(?:LOU|ITA|UUD|EPO)\d*\b/)?.[0]
  if (koodi && koodi.length > 3) return koodi
  const sana = nimi.split(/\s+/).find((s) => s.length >= 8 && /^[A-ZÄÖÅ]/.test(s) && !/urakka/i.test(s))
  return sana ?? koodi ?? null
}

/*
 * ELINVOIMAKESKUKSEN TUNNUS -> TILAAJA. Vain mitatut neljä tunnusta;
 * tuntematon jaa tyhjaksi eika arvata (kuratoitu kartta kelpaa kenttaan, ei proosaan,
 * ks. curated-map-field-not-prose).
 */
const ELINVOIMAKESKUKSET: Record<string, string> = {
  LOU: "Lounais-Suomen elinvoimakeskus",
  ITA: "Itä-Suomen elinvoimakeskus",
  UUD: "Uudenmaan elinvoimakeskus",
  EPO: "Etelä-Pohjanmaan elinvoimakeskus",
}

function elinvoimakeskusTunnuksesta(nimi: string): string | null {
  const koodi = nimi.match(/\b(LOU|ITA|UUD|EPO)(?=\d|\s|$)/)?.[1]
  return koodi ? ELINVOIMAKESKUKSET[koodi] : null
}

/*
 * TILAAJA OTERANIN SANAMUODOSTA. "Varsinais-Suomen ELY-keskukselle
 * urakoimamme", "Väylävirastollelle urakoimamme" (kirjoitusvirhe
 * lähteessä). Allatiivi muunnetaan yhteisellä apufunktiolla, ja
 * "kaupungille" jää tyhjäksi kuten siellä (astevaihtelu).
 */
const ALLATIIVI_URAKOIMA =
  /((?:[A-ZÄÖÅ][\p{L}-]*n\s+)?[A-ZÄÖÅ][\p{L}-]*?(?:lle)+)\s+urakoima/u

export function oteraninTilaaja(teksti: string): string | null {
  const osuma = teksti.match(ALLATIIVI_URAKOIMA)?.[1]
  if (!osuma) return null
  const sanat = osuma.replace(/(?:lle){2,}$/u, "lle").split(/\s+/)
  /*
   * "-kselle" -> "-s": "ELY-keskukselle" -> "ELY-keskus". Yhteinen
   * funktio tekee taman vain kun perusmuoto loytyy tekstista, ja
   * kuivaharjoituksessa tilaajaksi jai "Varsinais-Suomen ELY-keskukse".
   */
  const vika = sanat[sanat.length - 1]
  const viimeinen = /kselle$/u.test(vika) ? vika.replace(/kselle$/u, "s") : allativeToNominative(vika)
  if (!viimeinen) return null
  return [...sanat.slice(0, -1), viimeinen].join(" ")
}

/* "Porvoon kaupunki – Borgå stad – City of Porvoo" -> "Porvoon kaupunki" */
export function tilaajaTagista(kappaleet: string[]): string | null {
  for (const k of kappaleet) {
    if (!TAGIRIVI.test(k)) continue
    const eka = k.split(/\s[–/]\s/)[0].trim()
    if (/(?:kaupunki|kunta|virasto|keskus|satama|vesi)\b/iu.test(eka)) return eka
  }
  return null
}

/*
 * TILAAJA ON RAKENNUSLIIKE -> OTERAN ON ALIURAKOITSIJA. "Snackön louhinta
 * ja ruoppausurakka, tilaajana Erikkson Bygg Ab": Erikkson rakentaa
 * laiturin, Oteran louhii. Rakennusliike kirjataan paaurakoitsijaksi ja
 * Oteran liittyvaksi, kuten sivu-urakoitsijoilla (D-250).
 */
const RAKENNUSLIIKE = /\b(?:bygg|rakennus|rakentaja|urakointi|construction)\b/iu

const TYOYHTEENLIITTYMA = /työyhteenliittymänä\s+(.+?)\s+kanssa/iu

/*
 * URAKKA-AIKA. "Hanke urakoidaan ajanjaksolla 09/2026-12/2027" ja
 * "04-09/2026": loppukuukausi on valmistuminen. Yhteinen jasennin ei tunne
 * muotoa.
 */
const URAKKA_AIKA = /ajanjaksolla\s+(?:\d{1,2}(?:\/\d{4})?\s*[-–]\s*)?(\d{1,2})\/(\d{4})/u

export function urakkaAjanLoppu(teksti: string): string | null {
  const m = teksti.match(URAKKA_AIKA)
  if (!m) return null
  const kk = Number(m[1])
  const vuosi = Number(m[2])
  if (kk < 1 || kk > 12) return null
  const paiva = new Date(Date.UTC(vuosi, kk, 0)).getUTCDate()
  return `${vuosi}-${String(kk).padStart(2, "0")}-${String(paiva).padStart(2, "0")}`
}

/*
 * VAIHE. Oteran tiedottaa vasta voitetusta urakasta, joten vahimmillaan
 * sopimus. "Työmaalla:" -otsikko on raportti kaynnissa olevalta
 * tyomaalta. Valmistunut vain vahvasta naytosta (`onValmistunut`).
 *
 * "Parhaillaan käynnistymässä" ei ole rakenteilla: Aspön laiturin
 * "rakennustyöt paikan päällä käynnistyvät keväällä". Yleinen saanto
 * (`TYOMAALLA`) osuisi sanaan "parhaillaan".
 */
const TYOMAARAPORTTI = /^(?:työmaalla|työmaakuulum)/iu
/* "Puutossalmen lauttapaikkojen projekti alkaa olla loppusuoralla" */
const TYOT_KAYNNISSA = /loppusuoralla/iu
const ALKAA_MYOHEMMIN =
  /parhaillaan\s+käynnistymässä|käynnisty(?:vät|y)\s+(?:keväällä|kesällä|syksyllä|talvella|\p{L}+kuussa)/iu

export function oteraninVaihe(julkaisunOtsikko: string, nimi: string, lead: string): string {
  if (onValmistunut(nimi, lead)) return PHASE_LABELS.completed
  if (TYOMAARAPORTTI.test(julkaisunOtsikko)) return PHASE_LABELS.construction
  if (TYOT_KAYNNISSA.test(lead)) return PHASE_LABELS.construction
  if (ALKAA_MYOHEMMIN.test(lead)) return PHASE_LABELS.contract_awarded
  const vaihe = sivuurakoitsijanVaihe(nimi, lead)
  return vaihe === PHASE_LABELS.planning ? PHASE_LABELS.contract_awarded : vaihe
}

/* Otsikon "Työmaalla: X" / "Mielenkiintoiset ajankohtaiset urakat: X" -> X */
function hankkeenNimi(otsikko: string): string {
  const m = otsikko.match(/^(?:työmaalla|työmaakuulumiset|(?:mielenkiintoiset|kiinnostavimmat)\s+ajankohtaiset\s+\p{L}+)\s*:\s*(.+)$/iu)
  return (m?.[1] ?? otsikko).trim()
}

export function oteranEhdokkaat(j: OteranJulkaisu) {
  const kappaleet = jasennaKappaleet(j.html)
  const osiot = jaaOsioihin(j.otsikko, kappaleet)
  const koosteessa = osiot[0]?.fragmentti != null

  return osiot.map((osio) => {
    const nimi = koosteessa ? osio.nimi : hankkeenNimi(j.otsikko)
    /*
     * Tagirivi pois, samoin otsikon toisto ensimmaisena kappaleena
     * (Puutossalmen kuvaus alkoi hankkeen nimella).
     */
    const vertailu = (t: string) => t.toLowerCase().replace(/\s+/g, " ").trim()
    const kuvausKappaleet = osio.kappaleet.filter(
      (k, i) => !TAGIRIVI.test(k) && !(i === 0 && vertailu(k) === vertailu(nimi))
    )
    const teksti = kuvausKappaleet.join(" ")
    const lead = teksti.slice(0, LEAD_LENGTH)

    /*
     * Kaupunki nimesta (tilaajan nimi mukaan: "tilaajana Turun kaupunki"),
     * sitten ensimmaisesta virkkeesta, sitten ingressista. Tienimet pois
     * kuten VRJ:lla (D-250). Luettelon siltasopimukselle vain nimesta:
     * yhteinen johdanto mainitsee Porin, Huittisten ja Vaasan.
     */
    const nimiJaTilaaja = `${nimi} ${osio.tilaaja ?? ""}`.toLowerCase()
    const ensimmainenVirke = lead.split(/(?<=[.!?])\s+/)[0] ?? ""
    const city = osio.luettelosta
      ? detectCityFromText(ilmanTienNimia(nimi.toLowerCase()))
      : detectCityFromText(ilmanTienNimia(nimiJaTilaaja)) ??
        detectCityFromText(ilmanTienNimia(ensimmainenVirke.toLowerCase())) ??
        detectCityFromText(ilmanTienNimia(lead.toLowerCase()))

    const tilaaja =
      osio.tilaaja ?? oteraninTilaaja(teksti) ?? tilaajaTagista(osio.kappaleet)
    const aliurakka = tilaaja != null && RAKENNUSLIIKE.test(tilaaja)
    const builder = aliurakka ? tilaaja : OTERAN
    const developer = aliurakka ? null : tilaaja

    const kumppani = teksti.match(TYOYHTEENLIITTYMA)?.[1]?.trim() ?? null
    const related = mergeCompanyNames([], [OTERAN, builder, ...(kumppani ? [kumppani] : [])])

    const phase = oteraninVaihe(j.otsikko, nimi, lead)
    const pvm = j.pvm ? j.pvm.toISOString() : null

    return {
      name: nimi,
      description: teksti || null,
      city,
      region: city ? getMunicipalityByName(city)?.region ?? null : null,
      location: null,
      developer,
      builder,
      phase,
      completed: phase === PHASE_LABELS.completed,
      /*
       * TYYPPI VAIN NIMESTA. Infran leipateksti mainitsee ymparistoa:
       * Rauman pysakointialue sai tyypin Koulu sanasta "lähikoulun" ja
       * Aspön laituri tyypin Logistiikka (kuivaharjoitus 18.10.2026).
       */
      property_type: inferBuildingType(nimi, null),
      estimated_completion: urakkaAjanLoppu(teksti) ?? parseEstimatedCompletionDate(teksti, pvm),
      source_url: osio.fragmentti ? `${j.osoite}#${osio.fragmentti}` : j.osoite,
      confidence: 0.6,
      source_name: "oteran",
      metadata: {
        related_companies: related,
        ...(koosteessa ? { eroteltu_julkaisusta: j.otsikko } : {}),
      },
    }
  })
}

async function haeTeksti(url: string): Promise<string | null> {
  const ohjain = new AbortController()
  const kello = setTimeout(() => ohjain.abort(), AIKAKATKAISU_MS)
  try {
    const res = await fetch(url, { signal: ohjain.signal, cache: "no-store", headers: { "user-agent": UA } })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  } finally {
    clearTimeout(kello)
  }
}

/* Kaikki julkaisut aikarajaan asti, suodattamatta. */
export async function haeOteraninJulkaisut(aikaraja: Date = tiedotteenAikaraja()): Promise<OteranJulkaisu[]> {
  const out: OteranJulkaisu[] = []
  for (let sivu = 1; sivu <= MAX_SIVUT; sivu++) {
    const xml = await haeTeksti(sivu === 1 ? SYOTE : `${SYOTE}?paged=${sivu}`)
    if (!xml) break
    const era = jasennaSyote(xml).filter((j) => !out.some((o) => o.osoite === j.osoite))
    if (era.length === 0) break
    out.push(...era)
    const vanhin = era[era.length - 1].pvm
    if (!vanhin || vanhin < aikaraja) break
  }
  return out.filter((j) => !j.pvm || j.pvm >= aikaraja)
}

export async function fetchOteranSource() {
  const julkaisut = await haeOteraninJulkaisut()
  return julkaisut.filter(lapaiseeSuodatuksen).flatMap(oteranEhdokkaat)
}
