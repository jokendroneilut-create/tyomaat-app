import { detectCityFromText } from "./detectCityFromText"
import { getMunicipalityByName } from "@/lib/geo/municipalities"
import { getMunicipalityByAnyForm } from "@/lib/geo/municipalityFromName"
import {
  extractClientFromText,
  extractBuilderFromText,
  extractExplicitClient,
} from "./fetchSttHakuSource"
import { inferCompanyPhase } from "./companyRelease"
import { PHASE_LABELS } from "@/lib/projects/phases"
import { mergeCompanyNames } from "@/lib/projects/projectCompanies"
import { LEAD_LENGTH } from "./buildingType"
import { parseEstimatedCompletionDate } from "./parseFinnishCompletionDate"

/*
 * SIVU-URAKOITSIJAN SQUARESPACE-BLOGI (D-250).
 *
 * Torppari (betoni- ja siltarakenteet) ja Pelti-Ässät (vesikatot)
 * julkaisevat hankeuutisensa Squarespace-blogissa. Kumpikaan ei ole
 * hankkeen paaurakoitsija, mutta molemmat nimeavat tiedotteessaan
 * yleensa paaurakoitsijan ja tilaajan — sama asetelma kuin
 * talotekniikkaurakoitsijalla (D-214, `talotekniikkaUutiset.ts`).
 *
 * JULKAISIJA EI OLE PAAURAKOITSIJA. Se kirjataan `related_companies`-
 * listaan, ei `builder`-kenttaan. Vaara rooli on pahempi kuin puuttuva
 * tieto, koska urakoitsijakenttaa kaytetaan kilpailija-analyysiin.
 *
 * MIKSI RSS EIKA SIVUN KAAVINTA. Squarespace antaa jokaisesta
 * kokoelmasta RSS-syotteen (`?format=rss`), jossa on koko teksti
 * `content:encoded`-kentassa. robots.txt kieltaa `?format=json`-muodon
 * mutta ei RSS:aa. Syote antaa 20 uusinta; vanhemmat haetaan
 * `offset`-parametrilla (millisekuntiaikaleima), jota Squarespace kayttaa
 * itsekin "Older posts" -linkissa.
 */

/* Sama katto kuin muilla lahteilla: rivi ei saa jumittaa lahdeajoa. */
const AIKAKATKAISU_MS = 15 * 1000

export type RssJulkaisu = {
  otsikko: string
  osoite: string
  teksti: string
  pvm: Date | null
}

/*
 * Entiteetit puretaan ENNEN tagien poistoa ja kahdesti: `content:encoded`
 * voi sisaltaa escapattua HTML:aa, ja silloin tagit nakyvat vasta
 * purkamisen jalkeen (sama vika kuin Sarlinilla, D-215).
 *
 * Numeroentiteetit puretaan oikeiksi merkeiksi eika poisteta: Torpparin
 * otsikossa on `&#x2014;` (ajatusviiva), ja Keravan otsikossa jai
 * `&#8211;` nakyviin kun purku kasitteli vain nimetyt (D-247).
 */
const NIMETYT: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  rsquo: "'",
  lsquo: "'",
  rdquo: '"',
  ldquo: '"',
  ndash: "–",
  mdash: "—",
  hellip: "...",
}

function puraKerran(teksti: string): string {
  return teksti
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (osuma, nimi) => NIMETYT[nimi.toLowerCase()] ?? osuma)
}

export function tekstiksi(html: string | null | undefined): string {
  return puraKerran(puraKerran(String(html ?? "").replace(/<!\[CDATA\[|\]\]>/g, "")))
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    /* Kappaleen ja otsikon raja valilyonniksi, jottei sanat liimaudu. */
    .replace(/<[^>]+>/g, " ")
    .replace(/[  ​]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function kentta(item: string, tagi: string): string | null {
  const osuma = item.match(new RegExp(`<${tagi}[^>]*>([\\s\\S]*?)<\\/${tagi}>`, "i"))
  return osuma ? osuma[1] : null
}

/* Puhdas jasennys erillaan hausta, jotta sen voi testata tallennetulla syotteella. */
export function jasennaRss(xml: string): RssJulkaisu[] {
  const out: RssJulkaisu[] = []

  for (const item of xml.match(/<item[\s\S]*?<\/item>/gi) ?? []) {
    const otsikko = tekstiksi(kentta(item, "title"))
    const osoite = tekstiksi(kentta(item, "link"))
    if (!otsikko || !osoite) continue

    /*
     * `description` on Squarespacessa pelkka ingressi (~200 merkkia);
     * koko teksti on `content:encoded`-kentassa.
     */
    const teksti = tekstiksi(kentta(item, "content:encoded") ?? kentta(item, "description"))

    const julkaistu = tekstiksi(kentta(item, "pubDate"))
    const pvm = julkaistu ? new Date(julkaistu) : null

    out.push({ otsikko, osoite, teksti, pvm: pvm && !isNaN(pvm.getTime()) ? pvm : null })
  }

  return out
}

async function haeTeksti(osoite: string): Promise<string | null> {
  const ohjain = new AbortController()
  const kello = setTimeout(() => ohjain.abort(), AIKAKATKAISU_MS)
  try {
    const vastaus = await fetch(osoite, {
      signal: ohjain.signal,
      cache: "no-store",
      headers: { "user-agent": "Mozilla/5.0 (compatible; tyomaat.fi/1.0)" },
    })
    if (!vastaus.ok) return null
    return await vastaus.text()
  } catch {
    return null
  } finally {
    clearTimeout(kello)
  }
}

/*
 * Hakee julkaisut aikarajaan asti. Ensimmainen sivu riittaa paivittaisessa
 * ajossa; lisasivut tarvitaan vain ensimmaisella kierroksella, kun
 * 12 kuukauden ikkuna on pidempi kuin 20 julkaisua (Pelti-Assilla 20
 * julkaisua kattaa noin kymmenen kuukautta).
 */
export async function haeSquarespaceRss(
  kokoelma: string,
  aikaraja: Date,
  maxSivut = 3
): Promise<RssJulkaisu[]> {
  const kaikki: RssJulkaisu[] = []
  let offset: number | null = null

  for (let sivu = 0; sivu < maxSivut; sivu++) {
    const osoite = `${kokoelma}?format=rss${offset ? `&offset=${offset}` : ""}`
    const xml = await haeTeksti(osoite)
    if (!xml) break

    const era = jasennaRss(xml).filter((j) => !kaikki.some((k) => k.osoite === j.osoite))
    if (era.length === 0) break
    kaikki.push(...era)

    const vanhin = era[era.length - 1].pvm
    if (!vanhin || vanhin < aikaraja) break
    offset = vanhin.getTime()
  }

  return kaikki.filter((j) => !j.pvm || j.pvm >= aikaraja)
}

/*
 * SIVU-URAKOITSIJA ON TYOMAALLA. Paaurakoitsijan saannot
 * (`inferCompanyPhase`) eivat tunne sivu-urakoitsijan tapaa kertoa
 * asiasta: kuivaharjoituksessa kaikki kuusi Torpparin hanketta jaivat
 * "Suunnittelu"-vaiheeseen, vaikka teksti sanoo "Torppari toteuttaa
 * parhaillaan", "rakentaminen kaynnistyi kevaalla 2026" ja "Torppari
 * mukana rakentamassa". Sivu-urakoitsija tiedottaa vasta kun sen oma
 * urakka on sovittu, joten "toteuttaa" otsikossa on vahintaan sopimus.
 */
const TYOMAALLA = [
  /\bparhaillaan\b/i,
  /rakentaminen\s+(?:on\s+)?käynnistyi/i,
  /* "Noin 7,7 miljoonan euron korjaushanke kaynnistyi huhtikuussa 2026" (VRJ) */
  /\p{L}*hanke\s+(?:on\s+)?käynnistyi/iu,
  /rakennustyöt\s+(?:ovat\s+)?käynnisty/i,
  /*
   * Ei \b:ta a-kirjaimen peraan: JavaScriptin \b on ASCII-pohjainen,
   * joten "kaynnissa\b" ei osu koskaan valilyonnin edella.
   */
  /\bon\s+(?:parhaillaan\s+)?käynnissä(?![\p{L}])/iu,
  /työt\s+(?:[\p{L}-]+\s+){0,5}ovat\s+(?:jo\s+)?käynnisty/iu,
  /*
   * "Kesällä 2025 käynnistynyt Hangonsillan koulu ja päiväkoti -hanke"
   * jäi sopimusvaiheeseen (13.10.2026). Vuosiluku edellä vaaditaan, jottei
   * kieltolause "rakentaminen ei ole vielä käynnistynyt" osu.
   */
  /\b\d{4}\s+käynnistynyt(?![\p{L}])/iu,
  /mukana\s+(?:rakentamassa|toteuttamassa|uudistamassa)/i,
]
const SOPIMUS_OTSIKOSSA = [/\btoteuttaa\b/i, /urakoitsijaksi\b/i, /\bvalitsi\b/i]

/*
 * VALMISTUNUT KUN SE TIEDETAAN. Johannes 8.10.2026: "merkitse sellaiset
 * hankkeet jo nyt valmistuneeksi jos ne ovat jo valmistuneet ja se
 * tiedetaan." Torpparin "Hyrylan Sarma avautuu" jai rakenteille, vaikka
 * ingressin toinen virke on "rakennushanke valmistui elokuussa 2026".
 *
 * Naytto vaaditaan silti vahvana, koska kesken oleva hanke valmiina on
 * pahempi virhe kuin valmis rakenteilla: joko otsikon avautumis- tai
 * valmistumissana (ei "avautuu": se voi olla tulevaa, "koulu avautuu 2027"),
 * tai ingressin kahdessa ensimmaisessa virkkeessa
 * "hanke/kohde/rakennus valmistui <kuukausi|vuosi>". Myohemmin tekstissa
 * oleva "valmistui" viittaa yleensa aiempaan kohteeseen.
 */
const VALMIS_OTSIKOSSA = [/\bvalmistui\b/i, /\bvalmistunut\b/i, /\bluovutettiin\b/i]
const VALMIS_INGRESSISSA =
  /\p{L}*(?:hanke|kohde|rakennus|työmaa)\s+valmistui\s+(?:\p{L}+kuussa|vuonna|\d)/iu

export function onValmistunut(otsikko: string, lead: string): boolean {
  if (VALMIS_OTSIKOSSA.some((re) => re.test(otsikko))) return true
  const kaksiVirketta = lead.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ")
  return VALMIS_INGRESSISSA.test(kaksiVirketta)
}

export function sivuurakoitsijanVaihe(otsikko: string, lead: string): string {
  if (onValmistunut(otsikko, lead)) return PHASE_LABELS.completed
  const paaurakoitsijanSaanto = inferCompanyPhase(otsikko, lead)
  if (paaurakoitsijanSaanto === PHASE_LABELS.completed) return paaurakoitsijanSaanto
  if (paaurakoitsijanSaanto === PHASE_LABELS.construction) return paaurakoitsijanSaanto

  const teksti = `${otsikko} ${lead}`
  if (TYOMAALLA.some((re) => re.test(teksti))) return PHASE_LABELS.construction
  if (SOPIMUS_OTSIKOSSA.some((re) => re.test(otsikko))) return PHASE_LABELS.contract_awarded
  return paaurakoitsijanSaanto
}

/*
 * TIETOKORTTI JUTUN LOPUSSA (D-278, Johannes 13.10.2026).
 *
 * Torpparin Danfoss-jutun lopussa on kortti "Tilaaja: Lappeenrannan
 * Yritystila Oy Pääurakoitsija: Raspal Oy Bruttopinta-ala: n. 8200 m²
 * Sijainti: Lentokentäntie 28, 53600 Lappeenranta Aikataulu: ...".
 * Ehdokkaalta puuttuivat silti tilaaja, paaurakoitsija, osoite ja ala,
 * koska osapuolet luettiin vain ingressista (700 merkkia) ja kortti on
 * merkissa ~2 000.
 *
 * Ingressirajaus on olemassa siksi, etta leipateksti mainitsee muita
 * kohteita. Kortti ei: se on jutun oma tiivistelma, nimetyin kentin,
 * joten se on vahvempi todiste kuin ingressista paatelty lause ja
 * voittaa sen.
 *
 * Kentan arvo paattyy seuraavaan nimikkeeseen. Siksi nimikelistassa on
 * myos kenttia joita ei kayteta (arkkitehti, valvoja): muuten niiden
 * arvo liimautuisi edellisen kentan peraan. Korttina pidetaan vasta
 * kahta eri nimiketta, jottei yksittainen "Tilaaja:" leipatekstissa
 * riita.
 */
const KORTIN_NIMIKKEET = [
  "Tilaaja",
  "Rakennuttaja",
  "Pääurakoitsija",
  "Urakoitsija",
  "Bruttopinta-ala",
  "Bruttoala",
  "Kerrosala",
  "Laajuus",
  "Sijainti",
  "Osoite",
  "Aikataulu",
  "Urakkamuoto",
  "Arkkitehti",
  "Arkkitehtisuunnittelu",
  "Rakennesuunnittelu",
  "Rakennesuunnittelija",
  "Valvoja",
  "Kustannusarvio",
  "Hankkeen arvo",
]

/* Ei i-lippua: nimike alkaa isolla, kuten kortissa (ks. case-insensitive-ansa). */
const NIMIKE = new RegExp(`(?:^|\\s)(${KORTIN_NIMIKKEET.join("|")})\\s*:\\s*`, "g")

export type Tietokortti = Partial<Record<string, string>>

export function lueTietokortti(teksti: string): Tietokortti | null {
  const osumat = [...teksti.matchAll(NIMIKE)]
  if (new Set(osumat.map((o) => o[1])).size < 2) return null

  const kortti: Tietokortti = {}
  osumat.forEach((osuma, i) => {
    const alku = (osuma.index ?? 0) + osuma[0].length
    const loppu = i + 1 < osumat.length ? osumat[i + 1].index ?? teksti.length : teksti.length
    const arvo = teksti
      .slice(alku, loppu)
      /* Kortin jalkeen tulee lahdelinkki tai seuraava kappale. */
      .split(/\s+https?:\/\//)[0]
      .split(/(?<!(?:^|\s)[A-ZÄÖÅ]|\bn)\.\s+/)[0]
      .trim()
      .replace(/[.,;]$/, "")
    /* Ensimmainen voittaa: sama nimike myohemmin on toisen kohteen. */
    if (arvo && arvo.length <= 120 && !kortti[osuma[1]]) kortti[osuma[1]] = arvo
  })

  return Object.keys(kortti).length >= 2 ? kortti : null
}

/* "n. 8200 m²", "noin 9 650 brm²" -> 8200 / 9650 */
export function kortinAla(arvo: string | undefined): number | null {
  const osuma = arvo?.match(/(\d[\d\s]*)(?:,\d+)?\s*(?:br)?m(?:²|2)(?![\p{L}\d])/u)
  if (!osuma) return null
  const luku = Number(osuma[1].replace(/\s/g, ""))
  return luku >= 20 && luku <= 500_000 ? luku : null
}

/*
 * TILAAJANA KAUPUNKI. "Hankkeen paaurakoitsijana toimii GRK Suomi Oy, ja
 * tilaajana Helsingin kaupunki" (Makasiinilaituri): yhteinen kuvio vaatii
 * isoa alkukirjainta, joten kaappaukseksi jai "Helsingin", ja se
 * hylataan kuntanimen taivutusmuotona. Organisaatiosana sallitaan
 * erikseen, kuten "ja X kaupunki ovat sopineet" -kuviossa.
 */
const KUNTA_TILAAJANA =
  /\b(?:tilaajana|rakennuttajana)\s+(?:toimii\s+|on\s+)?([A-ZÄÖÅ][\p{L}-]+\s+(?:kaupunki|kunta|kuntayhtymä|hyvinvointialue|seurakunta))\b/u

/*
 * Rakentaa ehdokkaan sivu-urakoitsijan julkaisusta. Osapuolet ja kaupunki
 * luetaan otsikosta ja ingressista, ei koko tekstista: tiedotteen loppu
 * mainitsee muita kohteita ja yrityksia (sama havainto kuin
 * talotekniikkaUutiset.ts:ssa ja companyRelease.ts:ssa).
 */
export type SivuUrakoitsija = {
  /* Nimi sellaisena kuin se naytetaan hankkeen yrityksissa. */
  julkaisija: string
  sourceName: string
  /*
   * Julkaisijan omat nimimuodot pienilla kirjaimilla. Pelti-Assat
   * kirjoittaa itsestaan myos "Assien Bitumikateurakointi", joka
   * muuten poimiutuisi paaurakoitsijaksi.
   */
  omatNimet: string[]
}

export function sivuurakoitsijanEhdokas(julkaisu: RssJulkaisu, yritys: SivuUrakoitsija) {
  const { julkaisija, sourceName, omatNimet } = yritys
  const otsikkoPieni = julkaisu.otsikko.toLowerCase()
  const lead = julkaisu.teksti.slice(0, LEAD_LENGTH)

  /*
   * KUMPPANIN NIMI POIS OTSIKOSTA ENNEN KAUPUNKITUNNISTUSTA. Konsernin
   * tytaryhtiot on nimetty paikkakunnan mukaan (ks. stripPublisherName):
   * "... vesikattotyot yhteistyossa Varte Lahden kanssa" sai kaupungiksi
   * Lahden, vaikka Hinthaaran sivistyskeskus on Porvoossa ja ingressi
   * sanoo sen (kuivaharjoitus 8.10.2026).
   */
  const otsikkoIlmanKumppania = otsikkoPieni.replace(/yhteistyössä\s+.+?\s+kanssa/g, " ")
  /*
   * Ensimmainen virke ennen koko ingressia: `detectCityFromText` ei katso
   * sijaintia vaan kuntaluettelon jarjestysta, joten myohemmin mainittu
   * vertailukohde voi voittaa (VRJ:n Elmo Areena -> Helsinki).
   */
  const ensimmainenVirke = lead.split(/(?<=[.!?])\s+/)[0] ?? ""
  const city =
    detectCityFromText(otsikkoIlmanKumppania) ??
    detectCityFromText(ensimmainenVirke.toLowerCase()) ??
    detectCityFromText(lead.toLowerCase())

  /*
   * Julkaisijaa ei kirjata osapuoleksi, eika paljasta kunnan
   * taivutusmuotoa: "Kokkolan" on jasennysvirhe, ei rakennuttajan nimi.
   */
  const kelpaa = (nimi: string | null) => {
    if (!nimi) return null
    const pieni = nimi.toLowerCase()
    if (omatNimet.some((oma) => pieni.includes(oma))) return null
    if (!/\s/.test(nimi) && getMunicipalityByAnyForm(nimi)) return null
    return nimi
  }

  /*
   * Vaihe samalla saannolla kuin paaurakoitsijan tiedotteessa:
   * valmistuminen VAIN otsikosta (leipatekstin "valmistui" viittaa lahes
   * aina aiempaan kohteeseen), rakentaminen ja sopimus ingressista.
   * Ingressista eika koko tekstista, koska haastattelujutussa ("GRK ja
   * Torppari betonoivat yhteistyonsa") muistellaan aiempia tyomaita.
   */
  const phase = sivuurakoitsijanVaihe(julkaisu.otsikko, lead)
  const completed = phase === PHASE_LABELS.completed

  const kortti = lueTietokortti(julkaisu.teksti) ?? {}
  const floorArea = kortinAla(kortti["Bruttopinta-ala"] ?? kortti["Bruttoala"] ?? kortti["Kerrosala"])

  return {
    name: julkaisu.otsikko,
    description: julkaisu.teksti || null,
    city,
    region: city ? getMunicipalityByName(city)?.region ?? null : null,
    location: kortti["Sijainti"] ?? kortti["Osoite"] ?? null,
    /*
     * Kortti ensin, sitten ingressi; yksiselitteinen "tilaajana toimii X"
     * kelpaa koko tekstista (sama rajaus kuin companyRelease.ts:ssa).
     */
    developer:
      kelpaa(kortti["Tilaaja"] ?? kortti["Rakennuttaja"] ?? null) ??
      kelpaa(extractClientFromText(julkaisu.otsikko, lead)) ??
      kelpaa(extractExplicitClient(julkaisu.teksti)) ??
      julkaisu.teksti.match(KUNTA_TILAAJANA)?.[1] ??
      null,
    /*
     * PAAURAKOITSIJA KOKO TEKSTISTA. Sivu-urakoitsijan juttu kertoo
     * yhdesta tyomaasta, ja paaurakoitsija nimetaan usein vasta lopussa
     * ("Hankkeen paaurakoitsijana toimii Lujatalo Oy", Hangonsilta,
     * merkki ~1 900). Kuviot vaativat preesensin ("toimii", "on") tai ei
     * verbia lainkaan, joten muistelu "paaurakoitsijana oli GRK Suomi Oy"
     * aiemmasta kohteesta ei osu (GRK-haastattelu).
     */
    builder:
      kelpaa(kortti["Pääurakoitsija"] ?? kortti["Urakoitsija"] ?? null) ??
      kelpaa(extractBuilderFromText(julkaisu.otsikko, lead)) ??
      kelpaa(extractBuilderFromText(null, julkaisu.teksti)),
    phase,
    completed,
    source_url: julkaisu.osoite,
    confidence: 0.5,
    source_name: sourceName,
    estimated_completion: parseEstimatedCompletionDate(
      julkaisu.teksti,
      julkaisu.pvm ? julkaisu.pvm.toISOString() : null
    ),
    metadata: {
      related_companies: mergeCompanyNames([], [julkaisija]),
      ...(floorArea ? { floor_area: floorArea } : {}),
    },
  }
}
