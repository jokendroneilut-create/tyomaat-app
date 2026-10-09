import { tiedotteenAikaraja } from "@/lib/agent/tiedotteenIkkuna"
import { getMunicipalityByName } from "@/lib/geo/municipalities"
import { PHASE_LABELS } from "@/lib/projects/phases"
import { mergeCompanyNames } from "@/lib/projects/projectCompanies"
import { LEAD_LENGTH, inferBuildingType } from "./buildingType"
import { detectCityFromText } from "./detectCityFromText"
import { extractStreetAddress } from "./extractStreetAddress"
import { parseEstimatedCompletionDate } from "./parseFinnishCompletionDate"
import { onValmistunut, sivuurakoitsijanVaihe, tekstiksi } from "./sivuurakoitsijaRss"

/*
 * TA-YHTIOT: TIEDOTTEET (D-254).
 *
 * TA-Yhtiot (TA-Yhtyma Oy, TA-Asumisoikeus Oy ja tytaryhtiot kuten
 * Kiinteisto Oy Oulun Tarve) rakennuttaa asumisoikeus-, vuokra- ja
 * omistusasuntoja ympari Suomea. TA on RAKENNUTTAJA; paaurakoitsija
 * luetaan tekstista.
 *
 * WP REST API eika sivun kaavinta, kuten Kastellissa (D-236): tiedotteet
 * ovat oma sisaltotyyppinsa `announcement`, ja
 * `/wp-json/wp/v2/announcement` antaa otsikon, paivan, osoitteen ja koko
 * tekstin. robots.txt kieltaa vain sivuhaun (`?s=`).
 *
 * MITATTU 9.10.2026: 120 tiedotetta (2022-2026), joista 26 viimeisen
 * 12 kuukauden sisalla. Niista 21 on hanketiedote (19 eri kohdetta:
 * Boijenkatu 1 ja Hovivaenkatu 2 A ja B kahdesti, urakka + asukashaku),
 * 2 asukasviestintaa (savuttomuus, hinnantarkistukset) ja 3 rajatapausta:
 * kaupungin aluetiedote Malminkentasta, Sepankallion neljan talon
 * aluejuttu ja valmistuneen Hehkutie 1:n esittelykutsu.
 *
 * "ASUKASHAKU ON ALKANUT" ON RAKENTEILLA, EI VALMIS. Ennakko-oletus oli,
 * etta asukashaku tarkoittaa valmistunutta kohdetta. Mittaus kumosi sen:
 * TA avaa haun rakentamisen aikana, ja juuri nama tiedotteet ovat lahteen
 * rikkaimmat — "Kohteen rakennustyot ovat kaynnissa. Paaurakoitsijana
 * toimii X ... Asuntojen arvioitu valmistumisaika on 27.11.2026."
 * Osoite, urakoitsija, arkkitehti, asuntomaara ja tarkka paiva. Siksi
 * asukashakua ei suljeta pois.
 */

export const TA_API = "https://ta.fi/wp-json/wp/v2/announcement"
export const TA = "TA-Yhtiöt"

const OTSAKKEET = { "user-agent": "Mozilla/5.0 (compatible; tyomaat.fi/1.0)" }
const AIKAKATKAISU_MS = 15 * 1000

export type TaTiedote = {
  otsikko: string
  osoite: string
  teksti: string
  pvm: Date | null
}

/* Puhdas jasennys erillaan hausta, jotta sen voi testata tallennetulla vastauksella. */
export function jasennaTaTiedotteet(posts: unknown): TaTiedote[] {
  if (!Array.isArray(posts)) return []
  const out: TaTiedote[] = []
  for (const post of posts as any[]) {
    const otsikko = tekstiksi(post?.title?.rendered)
    const osoite = String(post?.link ?? "")
    if (!otsikko || !osoite) continue
    const pvm = post?.date ? new Date(post.date) : null
    out.push({
      otsikko,
      osoite,
      teksti: tekstiksi(post?.content?.rendered),
      pvm: pvm && !isNaN(pvm.getTime()) ? pvm : null,
    })
  }
  return out
}

/*
 * POISSULKU KATSOO VAIN OTSIKKOA (sama saanto kuin Kastellissa, D-236).
 * Mitattu koko 120 tiedotteen otoksesta: asukasviestinta ja yhtiouutiset
 * kertovat luonteensa otsikossa.
 */
const POISSULKU = [
  "savuton",
  "savuttom",
  "tupakoin",
  "hinnantarkistu",
  "vuokrankorotu",
  "käyttövastike",
  "kiinteistönvälity",
  "laajentaa palvelujaan",
  "tarjoaa jatkossakin",
  "kysyntäjousto",
  "nimity",
  "toimitusjohtaja",
]

/* Rakentamisen teko, ei pelkka aihe ("asunto" on joka tiedotteessa). */
const HANKESIGNAALI =
  /rakennutta|rakentaa|rakenteilla|rakentami|rakentuu|rakentuva|rakennusty|urakk|urakoitsija|valmistuu|valmistuva|valmistunut|peruskivi|asunnon kohte/i

/*
 * TA ON HANKKEEN OSAPUOLI. Ingressin kahdessa ensimmaisessa virkkeessa
 * (tai otsikossa) on oltava TA itse: "TA-Asumisoikeus Oy rakennuttaa",
 * "toteuttaa TA-Yhtyma Oy:lle", "JM Suomi on myynyt TA-Yhtioille".
 *
 * Mitattu: tama hylkaa 12 kuukauden ikkunasta kaksi rajatapausta eika
 * yhtaan hanketta. "Malminkentan asuntorakentaminen alkaa" on kaupungin
 * aluetiedote (TA mainitaan vasta ~1 100 merkin kohdalla, ja sama kohde
 * on omana tiedotteenaan Tattariharjuntie 48:sta), ja Sepankallion
 * "tutustu vapaisiin torstaisin" on valmistuneen talon esittelykutsu.
 *
 * Vuonna 2024 TA kirjoitti me-muodossa ("Rakennutamme uusia
 * asumisoikeusasuntoja Keravan Kivisillan alueelle"), joten sekin on TA.
 * HINTA: ingressin alussa kohteen kuvailu ("Jyvaskylan Palokan
 * Savulahden asuinalueelle rakentuu ASO-kerrostalo") jaa pois. Koko
 * 120 tiedotteen arkistosta naita on 3, kaikki vuodelta 2024 eli
 * ikkunan ulkopuolella; nykyinen vakioingressi nimeaa TA:n aina.
 */
const TA_NIMI = /\bTA(?:-\p{L}+|:n|:lla|:lle)?(?!\p{L})|\b[Rr]akennut(?:amme|imme)\b/u

/*
 * Ingressin kaksi ensimmaista virketta. Kuvateksti alusta pois: Pajalan
 * urakkatiedote alkaa "Kuva: Arkkitehtitoimisto NOAN Pajala Etela-Suomi
 * on allekirjoittanut ...".
 */
export function kaksiVirketta(teksti: string): string {
  return teksti
    .replace(/^Kuva:\s*\S+(?:\s+\S+)?\s+/, "")
    .split(/(?<=[.!?])\s+/)
    .slice(0, 2)
    .join(" ")
}

/*
 * Rakentamisen teko otsikossa tai kahdessa ensimmaisessa virkkeessa, ei
 * koko ingressissa. Ingressin laajuudella lapi meni "Luonnonlaheista
 * arkea Espoon Sepankalliossa": neljan talon aluejuttu, josta poimittiin
 * osoitteeksi viimeinen talo (Hehkurinne 2C) ja asuntomaaraksi koko
 * korttelin 356. Hanketiedote kertoo teon heti alussa ("TA-Yhtyma Oy
 * rakennuttaa", "Pajala ... rakentaa TA-Yhtioille").
 */
export function lapaiseeSuodatuksen(otsikko: string, teksti: string): boolean {
  const pieni = otsikko.toLowerCase()
  if (POISSULKU.some((k) => pieni.includes(k))) return false
  const alku = kaksiVirketta(teksti)
  if (!HANKESIGNAALI.test(`${otsikko} ${alku}`)) return false
  return TA_NIMI.test(otsikko) || TA_NIMI.test(alku)
}

/*
 * RAKENNUTTAJA ON SE TA:N YHTIO JONKA TEKSTI NIMEAA. Kannassa on jo
 * "TA-Asumisoikeus Oy" (5), "TA-Yhtiot" (4) ja "TA-Yhtyma" (2+1).
 * Tytaryhtio ("TA-Yhtymaan kuuluva Kiinteisto Oy Oulun Tarve") kirjataan
 * emonsa nimella, koska sita kayttaja hakee.
 */
export function taRakennuttaja(otsikko: string, lead: string): string {
  const teksti = `${otsikko} ${lead}`
  if (/TA-Asumisoikeu/.test(teksti)) return "TA-Asumisoikeus Oy"
  if (/TA-Yhtym/.test(teksti)) return "TA-Yhtymä Oy"
  return TA
}

/*
 * PAAURAKOITSIJA TEKSTISTA. Nimi on isolla alkavien sanojen jono
 * ("Hartela Lansi-Suomi Oy", "Pohjola Rakennus Oy Suomi"); pienella
 * alkava sana ("ja", "on") paattaa sen. Jarjestys on luotettavimmasta
 * alkaen: asukashakutiedotteen vakiolause, sitten otsikko, sitten
 * sopimuslauseet.
 */
/*
 * Piste ei kuulu nimeen: ensimmainen versio salli sen, ja nimi jatkui
 * virkkeen yli ("Lujatalo Oy. Arkkitehtisuunnittelusta").
 */
const NIMI = "([A-ZÄÖÅ][\\p{L}\\d&-]*(?:\\s+(?:&\\s+)?[A-ZÄÖÅ][\\p{L}\\d&-]*){0,5})"
const URAKOITSIJA = [
  new RegExp(`[Pp]ääurakoitsija(?:na|ksi)?\\s+(?:toimii|toimi|on|oli)\\s+${NIMI}`, "u"),
  new RegExp(`^${NIMI}\\s+(?:on\\s+aloittanut|aloittaa|toteuttaa|rakentaa)\\b`, "u"),
  new RegExp(`[Uu]rakasta\\s+vastaa\\s+${NIMI}`, "u"),
  new RegExp(`${NIMI}\\s+on\\s+allekirjoittanut\\s+TA-\\S+\\s+kanssa\\s+urakkasopimuksen`, "u"),
  new RegExp(`${NIMI}\\s+on\\s+myynyt\\s+TA-`, "u"),
]

export function taUrakoitsija(otsikko: string, teksti: string): string | null {
  for (const re of URAKOITSIJA) {
    const lahde = re.source.startsWith("^") ? otsikko : teksti
    const m = re.exec(lahde)
    const nimi = m?.[1]?.trim().replace(/[.,]$/, "")
    if (!nimi) continue
    /* "TA-Asumisoikeus rakentaa ..." on TA itse, ei urakoitsija. */
    if (/^TA\b|^TA-/.test(nimi)) continue
    return nimi
  }
  return null
}

const ARKKITEHTI = new RegExp(
  `[Aa]rkkitehtisuunnittelusta\\s+(?:on\\s+)?(?:vastannut|vastaa)\\s+${NIMI}`,
  "u"
)

export function taArkkitehti(teksti: string): string | null {
  return ARKKITEHTI.exec(teksti)?.[1]?.trim().replace(/[.,]$/, "") ?? null
}

/*
 * "25 uutta vuokra-asuntoa", "77 ikaantyneille suunnattua vuokra-asuntoa",
 * "70 asunnon asuinkerrostalon". Kaksi sanaa saa olla valissa. Luetaan
 * ingressista: myohemmin teksti puhuu alueen asukasmaarasta ("noin 2 800
 * asukkaalle") tai koko korttelista.
 */
const ASUNNOT =
  /(?<!\d\s?)(\d{1,3})\s+(?:[\p{L}-]+\s+){0,2}?[\p{L}-]*(?:asuntoa|asunnon|asuntoja|asumisoikeuskotia|kotia)(?![\p{L}])/iu

/*
 * Ingressin ulkopuolelta vain yksiselitteinen kokonaismaara: Naantalin
 * Estellen "yhteensa 40 korkeatasoista omistusasuntoa" on 1 559 merkin
 * kohdalla.
 */
const ASUNNOT_YHTEENSA =
  /(?:yhteensä|kaikkiaan)\s+(\d{1,3})\s+(?:[\p{L}-]+\s+){0,2}?[\p{L}-]*(?:asuntoa|asuntoja)(?![\p{L}])/iu

export function taAsunnot(lead: string, teksti = ""): number | null {
  const m = ASUNNOT.exec(lead) ?? ASUNNOT_YHTEENSA.exec(teksti)
  if (!m) return null
  const n = Number(m[1])
  return n > 0 && n <= 1000 ? n : null
}

/*
 * OSOITE PORRASKIRJAIMINEEN. Samassa osoitteessa on TA:lla kaksi eri
 * hanketta: Kangastie 13 A (35 asumisoikeusasuntoa) ja Kangastie 13 B
 * (77 senioreiden vuokra-asuntoa) Oulussa, Hovivaenkatu 2 A ja B
 * (70 aso) ja 2C (32 vuokra) Turussa. `extractStreetAddress` ottaa vain
 * kiinni kirjoitetun kirjaimen ("2C"), joten valilyonnin jalkeinen
 * kirjain ("13 B", "2 A ja B", "4 M-O") luetaan tassa perään. Ilman sita
 * kaksi hanketta saisi saman osoitteen ja yhdistyisi.
 *
 * Ingressin ulkopuolelta kelpaa vain "osoitteeseen X" (Naantalin
 * Estelle: "rakennetaan omalle tontille osoitteeseen Tuulensuunkatu 25").
 */
export function taOsoite(otsikko: string, lead: string, teksti: string): string | null {
  for (const lahde of [otsikko, lead]) {
    const perus = extractStreetAddress(lahde)
    if (!perus) continue
    const loppu = lahde.slice(lahde.indexOf(perus) + perus.length)
    const kirjain = /^\s?([A-Z](?:\s?(?:ja|-|–)\s?[A-Z])?)(?![\p{L}])/u.exec(loppu)
    return kirjain && !/[a-zA-Z]$/.test(perus) ? `${perus} ${kirjain[1]}` : perus
  }
  const osoitteeseen = /osoitteeseen\s+(.{0,60})/i.exec(teksti)
  return osoitteeseen ? extractStreetAddress(osoitteeseen[1]) : null
}

/*
 * VALMISTUMISPAIVA. TA kirjoittaa sen tarkkana ("Asuntojen arvioitu
 * valmistumisaika on 27.5.2027", kerran ilman valilyontia "on30.3.2027"),
 * jota `parseEstimatedCompletionDate` ei lue: sen ikkuna ei salli pistetta.
 * Luetaan ensimmainen valmistumisvirke jossa on paiva, ja siita MYOHAISIN
 * paiva — "Jalsitie 3:n arvioitu valmistuminen on 30.4.2027 ja Jalsitie
 * 1:n 30.8.2027" on yksi hanke, joka valmistuu kun viimeinen talo valmistuu.
 *
 * Jos tarkkaa paivaa ei ole, karkea arvio luetaan VAIN ensimmaisesta
 * valmistumisvirkkeesta. Koko tekstista luettuna Nokian Kartanonrannan
 * kohde ("valmistuu vuodenvaihteessa 2026–2027") sai naapurikohteen
 * paivan: "Alueen ensimmainen kohde, Asunto Oy Kartanorannan Kuunlilja,
 * valmistuu syksylla 2026".
 *
 * "alkuvuodesta 2028" (Estelle) -> kesakuun loppu ja "vuodenvaihteessa
 * 2026–2027" -> tammikuun loppu: arvio myohaiseksi, kuten yhteisessa
 * jasentimessa.
 */
export function taValmistumispaiva(teksti: string, julkaistu: Date | null): string | null {
  const virkkeet = teksti
    .split(/(?<=[.!?])\s+(?=[A-ZÄÖÅ–-])/)
    .filter((v) => /valmistu(?!n|i(?![\p{L}]))/iu.test(v))

  for (const virke of virkkeet) {
    const paivat = [...virke.matchAll(/(\d{1,2})\.(\d{1,2})\.(20\d{2})/g)]
      .map(([, p, k, v]) => `${v}-${k.padStart(2, "0")}-${p.padStart(2, "0")}`)
      .sort()
    if (paivat.length) return paivat[paivat.length - 1]
  }

  const ensimmainen = virkkeet[0]
  if (!ensimmainen) return null
  const alku = /alkuvuode(?:sta|nna)\s+(20\d{2})/i.exec(ensimmainen)
  if (alku) return `${alku[1]}-06-30`
  const vaihde = /vuodenvaihteessa\s+20\d{2}\s*[–-]\s*(20\d{2})/i.exec(ensimmainen)
  if (vaihde) return `${vaihde[1]}-01-31`
  return parseEstimatedCompletionDate(ensimmainen, julkaistu ? julkaistu.toISOString() : null)
}

/*
 * NIMI. Otsikko kuten Kastellissa, mutta asukashaun vakiopaate pois ja
 * osoite peraan: "Uusia vuokra-asuntoja Riihimaelle – asukashaku on
 * alkanut" ei kerro katsojalle mista hankkeesta on kyse,
 * "Uusia vuokra-asuntoja Riihimaelle, Paloheimonkatu 40" kertoo.
 */
const HAKUPAATE = /\s*[–-]\s*(?:asukashaku|haku asukkaaksi|haku)\s+on\s+alkanut\s*$/i

export function taNimi(otsikko: string, osoite: string | null): string {
  const lyhyt = otsikko.replace(HAKUPAATE, "").trim()
  if (lyhyt === otsikko || !osoite) return otsikko
  return lyhyt.includes(osoite) ? lyhyt : `${lyhyt}, ${osoite}`
}

/*
 * VALMIS VAIN VAHVASTA NAYTOSTA ([[hiding-threshold]]).
 *
 * Sama saanto kuin sivu-urakoitsijoilla (`onValmistunut`), ja lisaksi
 * TA:n oma muoto "osoitteeseen Hehkutie 1 on valmistunut 141 uutta
 * asumisoikeusasuntoa" kahdessa ensimmaisessa virkkeessa. Menneesta
 * arviopaivasta EI paatella valmistumista: viidella 12 kk:n
 * tiedotteella arvio on jo ohi (esim. Peippolantie 2b 27.3.2026), mutta
 * arvio voi venya.
 */
const ON_VALMISTUNUT_MAARA = /\bon\s+valmistunut\s+\d/i

export function taValmistunut(otsikko: string, teksti: string): boolean {
  return onValmistunut(otsikko, teksti.slice(0, LEAD_LENGTH)) || ON_VALMISTUNUT_MAARA.test(kaksiVirketta(teksti))
}

/*
 * "Rakennusurakasta on allekirjoitettu sopimus Pohjola Rakennus Oy Suomen
 * kanssa" (Naantalin Estelle) ei osu yleisiin sopimuskuvioihin, ja
 * "rakennustyot kaynnistyvat syksylla 2026" on tulevaa. Ilman tata hanke
 * jaisi suunnitteluvaiheeseen, vaikka urakka on sovittu.
 */
const URAKKA_SOVITTU = /urakasta\s+(?:on\s+)?(?:allekirjoitettu|tehty|solmittu)\s+sopimus/i

/*
 * Rakennuttajan tapa kertoa etta tyomaa on auki. Yleiset kuviot eivat
 * tunne naita: kuivaharjoituksessa "Aura Rakennus ... on aloittanut uuden
 * asuinkerrostalon rakentamisen" jai sopimusvaiheeseen, "JM Suomi ja
 * TA-Yhtiot aloittavat uuden vuokratalon rakentamisen" suunnitteluun.
 */
const TYOMAA_AUKI =
  /\b(?:on\s+aloittanut|aloittavat|aloitti)\s+(?:[\p{L}-]+\s+){0,4}rakentamisen|\bon\s+aloitettu\s+(?:[\p{L}-]+\s+){0,3}rakentaminen/iu

/*
 * TULEVA EI OLE TYOMAALLA. Yhteinen kuvio "rakennustyot kaynnisty-"
 * osuu myos futuuriin "rakennustyot kaynnistyvat syksylla 2026"
 * (Estelle, julkaistu 8.9.2026). Jos teksti ei muuten kerro toiden
 * olevan kaynnissa, vaihe on sopimus — urakka on allekirjoitettu.
 */
const VAIN_TULEVA = /(?:rakennustyöt|rakentaminen)\s+(?:käynnistyvät|käynnistyy|alkaa|alkavat)/i
const NYT_KAYNNISSA = /käynnissä|on\s+alkanut|aloittanut|aloitettu|aloittavat|käynnistyi(?![\p{L}])|käynnistyneet/iu

export function taVaihe(otsikko: string, teksti: string): string {
  if (taValmistunut(otsikko, teksti)) return PHASE_LABELS.completed
  const lead = teksti.slice(0, LEAD_LENGTH)
  const alku = `${otsikko} ${lead}`
  if (TYOMAA_AUKI.test(alku)) return PHASE_LABELS.construction

  const vaihe = sivuurakoitsijanVaihe(otsikko, lead)
  const sovittu = URAKKA_SOVITTU.test(teksti)
  if (vaihe === PHASE_LABELS.construction && VAIN_TULEVA.test(alku) && !NYT_KAYNNISSA.test(alku)) {
    return sovittu ? PHASE_LABELS.contract_awarded : PHASE_LABELS.planning
  }
  if (vaihe === PHASE_LABELS.planning && sovittu) return PHASE_LABELS.contract_awarded
  return vaihe
}

/*
 * KAUPUNKI: otsikko, sitten TA:n alueellinen toimisto, sitten ingressi.
 *
 * Otsikko ei aina nimea kuntaa vaan kaupunginosan: "Haukiputaalle",
 * "Vaajakoskelle", "Hatanpaalle", "Taskilaan", "Malmille".
 * Ingressin ensimmainen virke valitsi Hatanpaan kohteelle Pyhajarven
 * kunnan (Pohjois-Pohjanmaa), koska "Pyhajarven ja Hatanpaan arboretumin
 * laheisyyteen" tarkoittaa Tampereen jarvea. Tiedotteen vakiolause "TA:n
 * Tampereen toimistolta kerrotaan" antaa oikean kunnan; mitattuna se oli
 * oikein kaikissa 12 kk:n tiedotteissa, joiden otsikossa ei ole kuntaa.
 *
 * Toimisto on alueellinen eika aina hankkeen kunta (Porvoon kohteesta
 * kertoo Helsingin toimisto, Riihimaen kohteesta Hameenlinnan), joten
 * otsikon kunta voittaa sen aina.
 */
function kaupunki(otsikko: string, lead: string, teksti: string): string | null {
  const ilmanTaNimia = (s: string) => s.replace(/TA-\p{L}+/gu, " ").toLowerCase()
  const toimisto = /TA:n\s+(\p{Lu}\p{L}+)\s+toimisto/u.exec(teksti)?.[1] ?? ""
  return (
    detectCityFromText(ilmanTaNimia(otsikko)) ??
    (toimisto ? detectCityFromText(toimisto.toLowerCase()) : null) ??
    detectCityFromText(ilmanTaNimia(lead.split(/(?<=[.!?])\s+/)[0] ?? "")) ??
    detectCityFromText(ilmanTaNimia(lead))
  )
}

export function taEhdokas(tiedote: TaTiedote) {
  const { otsikko, teksti } = tiedote
  const lead = teksti.slice(0, LEAD_LENGTH)
  const city = kaupunki(otsikko, lead, teksti)
  const location = taOsoite(otsikko, lead, teksti)
  const phase = taVaihe(otsikko, teksti)
  const completed = phase === PHASE_LABELS.completed
  const apartments = taAsunnot(`${otsikko}. ${lead}`, teksti)
  const arkkitehti = taArkkitehti(teksti)

  return {
    name: taNimi(otsikko, location),
    description: teksti || null,
    city,
    region: city ? getMunicipalityByName(city)?.region ?? null : null,
    location,
    developer: taRakennuttaja(otsikko, lead),
    builder: taUrakoitsija(otsikko, teksti),
    phase,
    ...(completed ? { completed: true } : {}),
    property_type: inferBuildingType(otsikko, teksti),
    estimated_completion: taValmistumispaiva(teksti, tiedote.pvm),
    source_url: tiedote.osoite,
    confidence: 0.6,
    source_name: "ta_yhtiot",
    metadata: {
      ...(apartments ? { apartments } : {}),
      ...(arkkitehti ? { related_companies: mergeCompanyNames([], [arkkitehti]) } : {}),
      published_at: tiedote.pvm ? tiedote.pvm.toISOString() : null,
    },
  }
}

export async function haeTaTiedotteet(): Promise<TaTiedote[]> {
  const ohjain = new AbortController()
  const kello = setTimeout(() => ohjain.abort(), AIKAKATKAISU_MS)
  try {
    /*
     * Yksi sivu (100 uusinta) riittaa: 12 kuukauden ikkunaan mahtuu
     * mitattuna 26 tiedotetta.
     */
    const res = await fetch(`${TA_API}?per_page=100&_fields=id,date,link,title,content`, {
      headers: OTSAKKEET,
      cache: "no-store",
      signal: ohjain.signal,
    })
    if (!res.ok) return []
    const aikaraja = tiedotteenAikaraja()
    return jasennaTaTiedotteet(await res.json()).filter((t) => !t.pvm || t.pvm >= aikaraja)
  } catch {
    return []
  } finally {
    clearTimeout(kello)
  }
}

export async function fetchTaSource() {
  const tiedotteet = await haeTaTiedotteet()
  return tiedotteet.filter((t) => lapaiseeSuodatuksen(t.otsikko, t.teksti)).map(taEhdokas)
}
