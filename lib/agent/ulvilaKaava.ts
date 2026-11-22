import {
  haeKaavanKuvaus,
  haeKaavaselostuksenTeksti,
  kuulutuksenOmaSisalto,
  valitseKaavaselostus,
  valitseOas,
  yhdistaKuvaukset,
} from "./kaavanKuvaus"
import { kaavanYhteyshenkilot } from "./kaavanYhteyshenkilo"

/*
 * ULVILAN KAAVAN KUVAUS JA YHTEYSHENKILÖ LIITTEISTÄ (22.11.2026).
 *
 * Johannes 22.11.2026 Pirunkynnen teollisuusalueesta: kuvaus ja
 * yhteyshenkilö löytyvät kuulutuksesta, mutta rivillä ei ollut kumpaakaan.
 * Keräin kirjoitti `description: null, contacts: []` kaikille Ulvilan
 * kaavoille, vaikka faktapoiminta ja resolveri osasivat lukea molemmat.
 *
 * Listaussivulla jokaisella kaavalla on liitelista: vireilletuloilmoitus
 * tai nähtävilläoloilmoitus (kuulutus), OAS ja vaiheen mukaan selostus.
 *
 *   - KUVAUS: selostus, sen puuttuessa OAS, yleisellä jäsentimellä
 *     (`haeKaavanKuvaus`). Vireilletulokuulutuksen oma kuvauskappale
 *     ("…koskee … Tavoitteena on …") lisätään eteen ilman toistoa.
 *   - YHTEYSHENKILÖ: kuulutuksen virke "Lisätietoja (asiasta) antaa
 *     kaavoitusarkkitehti Mikko Toivanen, puh. …, …@ulvila.fi". Uusin
 *     kuulutus ensin, koska vastuuhenkilö voi vaihtua vaiheiden välillä.
 */

export type UlvilanLiite = { teksti?: string | null; href?: string | null }

export type UlvilanYhteyshenkilo = {
  kind: "person"
  name: string
  title: string | null
  phone: string | null
  email: string | null
  organization: string
}

const KUULUTUS = /ilmoitus|kuulutus/i

function liitteenNimi(l: UlvilanLiite): string {
  const tiedosto = (() => {
    try {
      return decodeURIComponent(String(l.href ?? "").split("/").pop() ?? "")
    } catch {
      return String(l.href ?? "")
    }
  })()
  return `${l.teksti ?? ""} ${tiedosto}`
}

/* Kuulutukset sivun järjestyksessä; Ulvila listaa liitteet vanhimmasta uusimpaan. */
export function ulvilanKuulutukset(liitteet: UlvilanLiite[]): string[] {
  return liitteet.filter((l) => l.href && KUULUTUS.test(liitteenNimi(l))).map((l) => String(l.href))
}

/*
 * OAS ILMAN KUULUTUKSIA. Pirunkynnen kuulutuksen tiedostonimi on
 * "KUULUTUS-Pirunkynnen-asemakaava-vireille-ja-OAS-19112026-SK.pdf", joten
 * yleinen `valitseOas` valitsi sen OAS:ksi, ja oikea OAS jäi lukematta.
 */
export function valitseUlvilanAsiakirjat(liitteet: UlvilanLiite[]): { selostus: string | null; oas: string | null } {
  const eiKuulutus = liitteet.filter((l) => !KUULUTUS.test(liitteenNimi(l)))
  return { selostus: valitseKaavaselostus(eiKuulutus), oas: valitseOas(eiKuulutus) }
}

/*
 * PDF-tekstin rivinvaihtotavutus pois ("ase-\nmakaavoittamattomia") ja
 * rivit yhdeksi tekstiksi.
 */
function yhdistaRivit(raaka: string): string {
  return raaka
    .replace(/(\p{L})-\s*\n\s*(\p{Ll})/gu, "$1$2")
    /* Isoilla kirjaimilla kirjoitettu kaavan nimi: "SAHAMÄ-\nEN". */
    .replace(/(\p{Lu})-\s*\n\s*(\p{Lu}{2})/gu, "$1$2")
    .replace(/\s+/g, " ")
    .trim()
}

/*
 * Palovainion ehdotusilmoituksessa fonttikoodaus on rikki ("˪˪˪ʡ˨˟˩…"):
 * puolet tekstistä on merkkejä joita ei voi lukea. Sellaisesta ei poimita
 * mitään, ettei roskaa päädy kuvaukseen eikä nimeksi.
 */
function onLuettava(teksti: string): boolean {
  if (!teksti) return false
  const luettavat = teksti.match(/[\p{Script=Latin}0-9\s.,:;()§@/+–-]/gu)?.length ?? 0
  return luettavat / teksti.length >= 0.95
}

/*
 * Kuulutuksen oma kuvauskappale: otsikon "(AkL 62 ja 63 §)" jälkeen ja
 * ennen "Lisätietoja". Menettelyvirkkeet (nähtävilläolo, mielipiteet)
 * karsitaan yhteisellä säännöllä, ja vireilletulon toteava virke pois.
 */
/*
 * YHTEISKUULUTUS (22.11.2026). Ulvila kuuluttaa saman päivän kaavat yhdellä
 * ilmoituksella: Nahkurin vireilletulokuulutuksessa on ensin Friitalan
 * kappale ("KESKUSTAN, SUURPÄÄN, NUMMELAN ja SAHAMÄEN asemakaava … koskee
 * …") ja sitten Nahkurin ("NAHKURIN asemakaavan muutos koskee …"). Kumpikin
 * kaava saisi muuten molemmat kappaleet.
 *
 * Kappale alkaa kaavan nimellä isoin kirjaimin. Kun niitä on useita,
 * valitaan se, jonka nimisanat vastaavat parhaiten kaavan otsikon
 * erisnimiä (Jaccard). Mitattu: Friitalan kappale saa Friitalalle 0,67 ja
 * Nahkurille 0,2; Nahkurin kappale Nahkurille 0,5 ja Friitalalle 0,17.
 */
const VARTALO = (s: string) => s.toLowerCase().normalize("NFC").slice(0, 6)

function isotNimet(virke: string): string[] {
  const alku = virke.match(/^((?:\p{Lu}{3,}[,]?\s+(?:ja\s+)?)+)/u)?.[1] ?? ""
  return (alku.match(/\p{Lu}{3,}/gu) ?? []).map(VARTALO)
}

function otsikonErisnimet(otsikko: string): string[] {
  return (otsikko.match(/\b\p{Lu}\p{Ll}{2,}/gu) ?? []).map(VARTALO)
}

function jaccard(a: string[], b: string[]): number {
  const A = new Set(a)
  const B = new Set(b)
  const yhteiset = [...A].filter((x) => B.has(x)).length
  const kaikki = new Set([...A, ...B]).size
  return kaikki ? yhteiset / kaikki : 0
}

function rajaaOmaanKappaleeseen(virkkeet: string[], otsikko: string | null | undefined): string[] {
  const nimelliset = virkkeet.filter((v) => isotNimet(v).length > 0)
  if (nimelliset.length < 2 || !otsikko) return virkkeet
  const erisnimet = otsikonErisnimet(otsikko)
  let paras: string | null = null
  let parasPisteet = 0.3
  for (const v of nimelliset) {
    const p = jaccard(isotNimet(v), erisnimet)
    if (p > parasPisteet) {
      paras = v
      parasPisteet = p
    }
  }
  return virkkeet.filter((v) => !nimelliset.includes(v) || v === paras)
}

export function ulvilanKuulutuksenKuvaus(
  raaka: string | null | undefined,
  otsikko?: string | null
): string | null {
  const teksti = yhdistaRivit(String(raaka ?? ""))
  if (!teksti) return null

  const otsikonLoppu = teksti.slice(0, 400).indexOf("§)")
  const alku = otsikonLoppu >= 0 ? otsikonLoppu + 2 : 0
  const loppu = teksti.search(/Lisätietoja/i)
  /*
   * Väliotsikko "(AkL 62 §, MRA 30 §)" liimautuu seuraavan kaavan
   * kappaleeseen ilman pistettä, ja menettelysääntö pudottaisi ne yhdessä.
   * Pykäläviittaus päättää siksi virkkeen.
   */
  const kappale = teksti
    .slice(alku, loppu > alku ? loppu : undefined)
    .replace(/§\)\s*/g, "§). ")
    .trim()
  if (!onLuettava(kappale)) return null

  const oma = kuulutuksenOmaSisalto(kappale)
  if (!oma) return null
  /*
   * Yhteinen menettelysääntö ei tunne Ulvilan kuulutuksen nähtävilläolon
   * osoiteriviä, ja "(www.ulvila.fi/asemakaavat)" katkaisee virkkeen
   * keskeltä, joten loppu jää omaksi "virkkeekseen".
   */
  const virkkeet = oma
    .split(/(?<=[.!?])\s+/)
    .filter((v) => !/tule(?:e|vat) vireille tällä ilmoituksella/i.test(v))
    .filter((v) => !/ilmoitustaululla|loukkurantie|internet-sivuilla|osoitteeseen|PL 77/i.test(v))
    .filter((v) => !/§\)\.?$/.test(v))
  const omat = rajaaOmaanKappaleeseen(virkkeet, otsikko)
  return omat.length ? omat.join(" ").trim() : null
}

export function ulvilanYhteyshenkilot(raaka: string | null | undefined): UlvilanYhteyshenkilo[] {
  const teksti = yhdistaRivit(String(raaka ?? ""))
  const lisatietoja = teksti.search(/Lisätietoja/i)
  if (lisatietoja < 0) return []
  const virke = teksti.slice(lisatietoja, lisatietoja + 300)
  if (!onLuettava(virke)) return []
  return kaavanYhteyshenkilot(virke).map((h) => ({
    kind: "person",
    name: h.nimi,
    title: h.rooli ? h.rooli.charAt(0).toUpperCase() + h.rooli.slice(1) : null,
    phone: h.puhelin ?? null,
    email: h.sahkoposti ?? null,
    organization: "Ulvilan kaupunki",
  }))
}

export async function haeUlvilanKaavanTiedot(
  liitteet: UlvilanLiite[],
  hae: (url: string) => Promise<string | null> = haeKaavaselostuksenTeksti,
  kuvaa: (url: string) => Promise<string | null> = haeKaavanKuvaus,
  otsikko: string | null = null
): Promise<{ description: string | null; contacts: UlvilanYhteyshenkilo[]; liitteet: string[] }> {
  const kuulutukset = ulvilanKuulutukset(liitteet)

  let contacts: UlvilanYhteyshenkilo[] = []
  let kuulutuksenKuvaus: string | null = null
  for (const url of [...kuulutukset].reverse()) {
    const teksti = await hae(url)
    if (!contacts.length) contacts = ulvilanYhteyshenkilot(teksti)
    if (!kuulutuksenKuvaus) kuulutuksenKuvaus = ulvilanKuulutuksenKuvaus(teksti, otsikko)
    if (contacts.length && kuulutuksenKuvaus) break
  }

  const { selostus, oas } = valitseUlvilanAsiakirjat(liitteet)
  let asiakirjanKuvaus: string | null = null
  if (selostus) asiakirjanKuvaus = await kuvaa(selostus)
  if (!asiakirjanKuvaus && oas) asiakirjanKuvaus = await kuvaa(oas)

  return {
    description: yhdistaKuvaukset(kuulutuksenKuvaus, asiakirjanKuvaus),
    contacts,
    liitteet: liitteet.map((l) => String(l.href ?? "")).filter(Boolean),
  }
}
