import { tiedotteenAikaraja } from "@/lib/agent/tiedotteenIkkuna"
import { detectCityFromText } from "./detectCityFromText"
import { getMunicipalityByName } from "@/lib/geo/municipalities"
import { LEAD_LENGTH, inferBuildingType } from "./buildingType"
import { parseEstimatedCompletionDate } from "./parseFinnishCompletionDate"
import { PHASE_LABELS } from "@/lib/projects/phases"
import { mergeCompanyNames } from "@/lib/projects/projectCompanies"
import { lohkareenYhteyshenkilot } from "./lohkareYhteyshenkilot"

/*
 * LOHKARE INFRA -KONSERNIN TIEDOTTEET (D-341).
 *
 * Johannes 22.10.2026 huomasi sivuston LinkedInista: *"tanne on tullut
 * eilen uutinen ja arvelen etta jatkossa alkaa tulla myos tiedotteita."*
 *
 * REITTI: WordPressin REST on auki ilman temppuja
 * (`/wp-json/wp/v2/posts?per_page=100`), ja koko teksti tulee
 * `content.rendered`-kentassa. Yksi pyynto riittaa: juttuja on 22.
 *
 * LAHTEEN ARVO ON TAYDENNYKSESSA, EI UUSISSA RIVEISSA. Lohkare
 * tiedottaa vasta kun sopimus on tehty, joten hanke on jo kannassa
 * Hilmasta -- ja Oteran on lisaksi oma lahteensa (D-310). Mitattu
 * 22.10.2026: ainoa hankejuttu (S2-laituri) oli jo rivina, mutta
 * tiedote antoi nelja nimettya yhteyshenkiloa, valmistumisvuoden,
 * urakan laajuuden ja paljasti etta rivin kuvaus kertoi hankinnan
 * keskeytyneeksi vaikka urakka oli kaynnissa
 * ([[newer-source-is-not-current-state]]).
 */

const API = "https://lohkare.fi/wp-json/wp/v2/posts"
const UA = "Mozilla/5.0 (compatible; tyomaat.fi/1.0)"
const AIKAKATKAISU_MS = 15 * 1000

export const LOHKARE = "Lohkare Infra Oy"

/*
 * KONSERNIN JASENYRITYKSET. Tiedote kertoo tekijan nimella
 * ("Lohkare Infraan kuuluva Oteran toteuttaa"), eika konsernin nimi
 * kelpaa urakoitsijaksi: tyon tekee jasenyritys. Lista on luettu
 * tiedotteista, joissa jokainen liittyminen on uutisoitu erikseen --
 * kuratoitu kentta, ei vapaata paattelya ([[curated-map-field-not-prose]]).
 */
export const JASENYRITYKSET = [
  "Oteran",
  "Maalinja",
  "EPR-Asennus",
  "Länsi-Suomen Verkkopalvelut",
  "Infra Kiri",
  "Oulun Lämpöputkitus",
  "Ylöjärven Kiviset",
  "Nordic Electro Power",
  "VM Suomalainen",
]

export type LohkareJuttu = {
  id: number
  otsikko: string
  osoite: string
  pvm: Date | null
  kappaleet: string[]
}

/*
 * KIELI LUETAAN OSOITTEESTA. Jokainen juttu julkaistaan kahdesti,
 * suomeksi ja englanniksi, erillisina postauksina samalla
 * paivamaaralla. Rajapinnassa EI ole `lang`- eika
 * `translations`-kenttaa (tarkistettu 24.10.2026), mutta
 * englanninkielinen on aina polussa `/en/` -- ja kategoria
 * (News/Stories vs. Uutiset/Tarinat) vahvistaa saman jaon.
 *
 * Englanninkielinen pudotetaan: kuvaus menee asiakkaalle suomeksi, ja
 * ilman tata jokaisesta hankkeesta syntyisi kaksi ehdokasta.
 */
export function onSuomeksi(osoite: string): boolean {
  return !/\/en\//i.test(osoite)
}

/*
 * HANKESUODATUS OTSIKOSTA (mitattu 24.10.2026).
 *
 * 22 jutusta 12 on suomeksi, ja niista TASAN YKSI kertoo hankkeesta.
 * Loput ovat yritysostoja ("X liittyy osaksi Lohkare Infraa") ja
 * nimityksia ("Y toimitusjohtajaksi"). Siksi sallitaan vain
 * nimenomainen hankesana otsikossa, eika leipatekstia katsota:
 * yritysostotiedotteet puhuvat hankkeista yleisesti
 * ("toteuttaa vaativia infrarakentamisen hankkeita").
 *
 * Tarkistettu kaikkia 12:ta otsikkoa vasten: yksi osuma, nolla vaaraa.
 */
const HANKEOTSIKKO = /urakk|urakoi|toteuttaa|rakentaa|rakentamaan|sopimukse|sopimus\b|voitti|työmaa/iu

/*
 * Poissulku varmistaa sen minka otsikkosaanto jo tekee. Jos tuleva
 * tiedote yhdistaa molemmat ("X liittyy Lohkareeseen ja toteuttaa
 * urakan"), yritysosto painaa enemman: hanketta ei siina kerrota.
 */
const EI_HANKE =
  /liitty(?:y|vät|vat)\s+(?:osaksi\s+)?lohkare|joins\s+lohkare|toimitusjohtaja(?:ksi|na)\b|on\s+nimitetty|vahvistaa\s+johtamistaan|syntyy\s+uusi/iu

export function onHankejuttu(otsikko: string): boolean {
  if (EI_HANKE.test(otsikko)) return false
  return HANKEOTSIKKO.test(otsikko)
}

/*
 * NIMETYT ENTITEETIT ENNEN YLEISTA SIIVOUSTA.
 *
 * Yleinen `&[a-z]+;` -> valilyonti soi aakkoset: `&auml;` muuttui
 * valilyonniksi ja "Lisatiedot" otsikosta tuli "Lis tiedot", jolloin
 * koko yhteystietolohko jai lukematta. Rajapinta palauttaa nykyaan
 * UTF-8:aa, mutta WordPress voi lahettaa entiteetteja milloin tahansa
 * -- ja oire oli hiljainen: kenttia vain puuttui.
 *
 * Kirjainkoko merkitsee, joten kartta ajetaan ennen kuin
 * kirjainkokoriippumaton yleissaanto saa vuoron.
 */
const ENTITEETIT: Record<string, string> = {
  "&auml;": "ä",
  "&Auml;": "Ä",
  "&ouml;": "ö",
  "&Ouml;": "Ö",
  "&aring;": "å",
  "&Aring;": "Å",
  "&uuml;": "ü",
  "&Uuml;": "Ü",
  "&eacute;": "é",
  "&ndash;": "–",
  "&mdash;": "—",
  "&hellip;": "…",
  "&lsquo;": "’",
  "&rsquo;": "’",
  "&ldquo;": "”",
  "&rdquo;": "”",
  "&shy;": "",
  "&nbsp;": " ",
  "&quot;": '"',
}

export function tekstiksi(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[A-Za-z]+;/g, (e) => (e in ENTITEETIT ? ENTITEETIT[e] : e))
    .replace(/&amp;/g, "&")
    .replace(/&#8217;|&#039;|&#8216;/g, "’")
    .replace(/&#8211;|&#8212;/g, "–")
    .replace(/&#8221;|&#8220;/g, "”")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/* Kappalejako sailytetaan, koska yhteystietolohko luetaan riveittain. */
export function jasennaKappaleet(html: string): string[] {
  return html
    .split(/<\/p>|<br\s*\/?>|<\/h[1-6]>|<\/li>/i)
    .map(tekstiksi)
    .filter(Boolean)
}

/* Konsernin prefiksi pois otsikosta: se kertoo omistajan, ei hanketta. */
export function hankkeenNimi(otsikko: string): string {
  return otsikko
    .replace(/^lohkare\s+infra(?:an|aan|n)?\s*(?:-konserniin)?\s*kuuluva\s+/iu, "")
    .replace(/^lohkare\s+infra(?:n|an|aan)?\s+/iu, "")
    .trim()
}

/*
 * TEKIJA ON JASENYRITYS, EI KONSERNI. Urakoitsijaksi kirjataan se
 * jasenyritys joka tiedotteessa mainitaan; konserni menee liittyviin
 * yrityksiin, jottei "Lohkare Infra Oy" nay rakentajana hankkeessa
 * jonka tekee Oteran.
 */
export function tekijaYritys(teksti: string): string | null {
  for (const nimi of JASENYRITYKSET) {
    if (new RegExp(`\\b${nimi.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "iu").test(teksti)) {
      return nimi.endsWith(" Oy") ? nimi : `${nimi} Oy`
    }
  }
  return null
}

/*
 * TILAAJA SOPIMUSLAUSEESTA. "Oteran Oy ja Turun Satama ovat
 * allekirjoittaneet sopimuksen" -- osapuolista toinen on jasenyritys,
 * toinen tilaaja. Muuten "tilaajana X".
 */
const SOPIMUSOSAPUOLET =
  /([A-ZÅÄÖ][\wÅÄÖåäö&.\-]*(?:\s+[A-ZÅÄÖ][\wÅÄÖåäö&.\-]*){0,4})\s+ja\s+([A-ZÅÄÖ][\wÅÄÖåäö&.\-]*(?:\s+[A-ZÅÄÖ][\wÅÄÖåäö&.\-]*){0,4})\s+ovat\s+allekirjoittaneet/u
const TILAAJANA = /tilaajana\s+(?:toimii\s+|on\s+)?([A-ZÅÄÖ][\wÅÄÖåäö&.\-]*(?:\s+[A-ZÅÄÖ][\wÅÄÖåäö&.\-]*){0,3})/u

export function tilaaja(teksti: string, tekija: string | null): string | null {
  const osapuolet = teksti.match(SOPIMUSOSAPUOLET)
  if (osapuolet) {
    const puhdista = (s: string) =>
      s.replace(/^lohkare\s+infra\s*-?\s*konserniin\s+kuuluva\s+/iu, "").trim()
    const a = puhdista(osapuolet[1])
    const b = puhdista(osapuolet[2])
    const onTekija = (n: string) =>
      tekija != null && n.toLowerCase().startsWith(tekija.replace(/\s+Oy$/i, "").toLowerCase())
    if (onTekija(a) && !onTekija(b)) return b
    if (onTekija(b) && !onTekija(a)) return a
  }
  return teksti.match(TILAAJANA)?.[1]?.trim() ?? null
}

/*
 * VAIHE. Lohkare tiedottaa vasta sopimuksesta, joten vahimmillaan
 * sopimus on myonnetty. Kaynnistynyt urakka on rakenteilla.
 */
const KAYNNISSA = /käynnistynyt|käynnissä|työt\s+(?:ovat\s+)?alkaneet|aloitettu/iu

export function lohkareenVaihe(teksti: string): string {
  return KAYNNISSA.test(teksti) ? PHASE_LABELS.construction : PHASE_LABELS.contract_awarded
}

export function lohkareEhdokas(j: LohkareJuttu) {
  /* Yhteystietolohko ei kuulu asiakkaan lukemaan kuvaukseen. */
  const lisatiedot = j.kappaleet.findIndex((k) => /^lis[äa]tiedot\s*:?\s*$/i.test(k.trim()))
  const kuvausKappaleet = lisatiedot === -1 ? j.kappaleet : j.kappaleet.slice(0, lisatiedot)
  const teksti = kuvausKappaleet.join(" ")
  const lead = teksti.slice(0, LEAD_LENGTH)

  const nimi = hankkeenNimi(j.otsikko)
  const tekija = tekijaYritys(`${j.otsikko} ${teksti}`)
  const yhteyshenkilot = lohkareenYhteyshenkilot(j.kappaleet)

  /*
   * TILAAJAN NIMI TAYDENNETAAN YHTEYSTIETOLOHKOSTA. Leipateksti sanoo
   * "Turun Satama", yhteystiedoissa lukee "Turun Satama Oy" -- sama
   * yritys, ja kannassa se on yhtiomuodon kanssa. Ilman taydennysta
   * osuma kirjoittaisi lyhyemman nimen kannassa olevan paalle.
   * Taydennys tehdaan vain kun lohkon organisaatio ALKAA samalla
   * nimella, eli todiste on samassa tiedotteessa.
   */
  const asiakasRaaka = tilaaja(teksti, tekija)
  const asiakas = asiakasRaaka
    ? yhteyshenkilot
        .map((h) => h.organization)
        .find(
          (o): o is string =>
            Boolean(o) &&
            o!.toLowerCase().startsWith(asiakasRaaka.toLowerCase()) &&
            o!.length > asiakasRaaka.length
        ) ?? asiakasRaaka
    : null

  const city =
    detectCityFromText(nimi.toLowerCase()) ??
    detectCityFromText((asiakas ?? "").toLowerCase()) ??
    detectCityFromText(lead.toLowerCase())

  const phase = lohkareenVaihe(teksti)
  const pvm = j.pvm ? j.pvm.toISOString() : null

  return {
    name: nimi,
    description: teksti || null,
    city,
    region: city ? getMunicipalityByName(city)?.region ?? null : null,
    location: null,
    developer: asiakas,
    builder: tekija,
    phase,
    completed: false,
    property_type: inferBuildingType(nimi, null),
    estimated_completion: parseEstimatedCompletionDate(teksti, pvm),
    source_url: j.osoite,
    confidence: 0.6,
    source_name: "lohkare",
    metadata: {
      related_companies: mergeCompanyNames([], [LOHKARE, ...(tekija ? [tekija] : [])]),
      ...(yhteyshenkilot.length ? { contact_persons: yhteyshenkilot } : {}),
    },
  }
}

async function haeJson(url: string): Promise<any[] | null> {
  const ohjain = new AbortController()
  const kello = setTimeout(() => ohjain.abort(), AIKAKATKAISU_MS)
  try {
    const res = await fetch(url, {
      signal: ohjain.signal,
      cache: "no-store",
      headers: { "user-agent": UA },
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  } finally {
    clearTimeout(kello)
  }
}

export async function haeLohkareenJutut(
  aikaraja: Date = tiedotteenAikaraja()
): Promise<LohkareJuttu[]> {
  const raaka = await haeJson(`${API}?per_page=100&orderby=date&order=desc`)
  if (!raaka) return []

  return raaka
    .map((r: any) => {
      const pvm = new Date(r?.date_gmt ? `${r.date_gmt}Z` : r?.date)
      return {
        id: Number(r?.id ?? 0),
        otsikko: tekstiksi(String(r?.title?.rendered ?? "")),
        osoite: String(r?.link ?? ""),
        pvm: isNaN(pvm.getTime()) ? null : pvm,
        kappaleet: jasennaKappaleet(String(r?.content?.rendered ?? "")),
      }
    })
    .filter((j) => j.otsikko && j.osoite)
    .filter((j) => !j.pvm || j.pvm >= aikaraja)
}

export async function fetchLohkareSource() {
  const jutut = await haeLohkareenJutut()
  return jutut
    .filter((j) => onSuomeksi(j.osoite))
    .filter((j) => onHankejuttu(j.otsikko))
    .map(lohkareEhdokas)
}
