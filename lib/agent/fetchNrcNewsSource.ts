import { YRITYSTIEDOTTEEN_IKKUNA_KK } from "@/lib/agent/tiedotteenIkkuna"
import { detectCityFromText } from "./detectCityFromText"
import {
  createCompanyEnricher,
  inferBuildingType,
  inferCompanyPhase,
} from "./companyRelease"

/*
 * NRC GROUPIN UUTISOSIO (D-367).
 *
 * NRC on jo lahteena, mutta kerain katsoo osoitetta
 * `nrcgroup.fi/projektit` -- referenssisivuja. Urakkavoitot julkaistaan
 * `/uutiset`-osiossa, jota mikaan ei lukenut.
 *
 * Vika nakyi konkreettisesti 31.10.2026: Johannes toi jonosta rivin
 * "NRC Group sai ylikulkusiltojen rakennusurakan", joka oli tullut
 * meille RAKENNUSLEHDEN kautta. Rakennuslehti on jalleenjulkaisija ja
 * sen juttu on maksumuurin takana, joten siita sai vain "Siilinjarvella
 * ja Kuopiossa". NRC:n oma tiedote nimesi molemmat sillat ja kertoi
 * toteutustavan ([[rakennuslehti-is-secondary]]). Tiedotetta ei ollut
 * lahdedokumenteissamme lainkaan.
 *
 * RAKENNE ON SAMA KUIN PROJEKTISIVUILLA: Next.js, ja uutiset ovat
 * valmiina upotetussa `__NEXT_DATA__`-JSONissa. Mitattu 31.10.2026:
 * yksi haku antaa 171 uutista otsikoineen, osoitteineen ja
 * julkaisupaivineen -- ei sivutusta, ei HTML:n raapimista, ja paiva on
 * rakenteisessa kentassa eika tekstista paateltyä
 * ([[declared-date-beats-text-date]]).
 *
 * VAIN SUOMEKSI. Sivu palauttaa pelkan `siteId: 8` -rivistön, joten
 * kieliparin pudotusta ei tarvita toisin kuin Lohkareella.
 */

const LISTAUS_URL = "https://www.nrcgroup.fi/uutiset"

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

/* Suomenkielisen sivuston tunnus NRC:n Craft CMS:ssa. */
const SUOMI_SITE_ID = 8

/*
 * SUODATUS ON KOKO TYO ([[company-source-filtering]]).
 *
 * Sanastot on LASKETTU 12 kuukauden otsikoista (41 kpl), ei arvattu.
 * Jakauma lukemalla: ~19 urakka- tai hankeuutista, 6 edistymistiedotetta
 * tunnetuista hankkeista ja 16 kohinaa.
 */
const HANKESANAT = [
  "rakenn", "toteut", "urakka", "urakan", "urakoita", "urakoissa", "urakat",
  "sopimu", "lisätilau", "uusimme", "uusii", "uusiminen", "uudistuu",
  "uudistamme", "uudelleenrakennus", "silta", "sillan", "siltoj", "siltat",
  "rata", "radan", "rataa", "ratapiha", "raitiotie", "raitioteiden",
  "sähköasema", "sähköasemat", "tuulipuisto", "aurinkopuisto", "datakesku",
  "seisake", "seisakkee", "voitot", "käynnistyy", "aloitamme", "asetinlaite",
  "kaksoisraide", "alikulkusil", "ylikulkusil", "kunnossapido",
]

/*
 * KOHINA, joka lipuu hankesanojen lapi. "Jyrki Riekki ...
 * kehityspaallikoksi" sisaltaa sanan "kehity", ja
 * "vastuullisuustyolle ... BREEAM-sertifikaatti" sanan "rakentamisen".
 */
const KOHINA = [
  "sertifi", "nimity", "-ohjelma", "uratarina", "harjoittelija",
  "rekrytoi", "ostamme", "yrityskaup", "liiketoiminnan osto",
  "henkilöstö", "ammattilaisen joukko", "tulosjulkistus", "osavuosi",
  "johtajanimity", "päälliköksi", "johtajaksi", "palkitt",
]

const VALMIS_OTSIKOSSA = ["valmistui", "valmistunut", "luovutettu", "otettu käyttöön"]

export type NrcUutinen = {
  otsikko: string
  url: string
  julkaistu: string | null
}

export function jasennaNrcUutiset(html: string): NrcUutinen[] {
  const osuma = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/
  )
  if (!osuma) return []

  let apollo: Record<string, any> = {}
  try {
    apollo = JSON.parse(osuma[1])?.props?.pageProps?.apolloState ?? {}
  } catch {
    return []
  }

  const ulos: NrcUutinen[] = []
  for (const arvo of Object.values(apollo)) {
    const v = arvo as any
    if (v?.__typename !== "newsItems_default_Entry") continue
    if (v.siteId !== SUOMI_SITE_ID) continue
    if (!v.title || !v.url) continue
    ulos.push({
      otsikko: String(v.title).trim(),
      url: String(v.url),
      julkaistu: v.postDate ? String(v.postDate).slice(0, 10) : null,
    })
  }
  return ulos
}

export function kelpaakoNrcUutinen(
  uutinen: NrcUutinen,
  aikaraja: Date
): boolean {
  const otsikko = uutinen.otsikko.toLowerCase()
  if (KOHINA.some((k) => otsikko.includes(k))) return false
  if (!HANKESANAT.some((k) => otsikko.includes(k))) return false

  /*
   * Paivaton uutinen paastetaan lapi: sen ika ei ole tiedossa, eika
   * tuntematonta suodateta ([[never-hide-on-missing-data]]).
   */
  if (!uutinen.julkaistu) return true
  return new Date(uutinen.julkaistu) >= aikaraja
}

export function nrcUutisEhdokas(uutinen: NrcUutinen) {
  const otsikko = uutinen.otsikko
  const matala = otsikko.toLowerCase()

  return {
    name: otsikko,
    description: null,
    city: detectCityFromText(otsikko),
    /* Maakunta johdetaan kunnasta tuonnissa. */
    region: null,
    location: null,
    /*
     * Otsikosta paateltu arvaus; `enrich` korvaa taman leipatekstista.
     * Jaa voimaan vain jos sivuhaku epaonnistuu tai budjetti loppuu.
     */
    phase: inferCompanyPhase(otsikko, null),
    property_type: inferBuildingType(otsikko, null),
    builder: "NRC Group Finland Oy",
    source_url: uutinen.url,
    date_published: uutinen.julkaistu,
    confidence: 0.6,
    completed: VALMIS_OTSIKOSSA.some((k) => matala.includes(k)),
    source_name: "nrc_uutiset",
  }
}

export const enrichNrcNewsCandidate = createCompanyEnricher({
  publisher: "NRC Group",
})

export async function fetchNrcNewsSource() {
  const vastaus = await fetch(LISTAUS_URL, { headers: { "User-Agent": UA } })
  if (!vastaus.ok) throw new Error(`nrc_uutiset: listaus ${vastaus.status}`)

  const aikaraja = new Date()
  aikaraja.setMonth(aikaraja.getMonth() - YRITYSTIEDOTTEEN_IKKUNA_KK)

  return jasennaNrcUutiset(await vastaus.text())
    .filter((u) => kelpaakoNrcUutinen(u, aikaraja))
    .map(nrcUutisEhdokas)
}
