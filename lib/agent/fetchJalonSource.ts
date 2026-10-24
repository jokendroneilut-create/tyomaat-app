import { getMunicipalityByName } from "@/lib/geo/municipalities"
import { inferBuildingType } from "@/lib/agent/buildingType"
import { mergeCompanyNames } from "@/lib/projects/projectCompanies"
import { PHASE_LABELS } from "@/lib/projects/phases"

/*
 * JALONIN TYOMAAT (D-350).
 *
 * Johannes 25.10.2026: *"tarkista onko tama jo lahteena
 * https://jalon.fi/yhteystiedot/tyomaat/"* -- ei ollut, ja sivu
 * osoittautui mittauksessa poikkeuksellisen hyvaksi.
 *
 * MIKSI TAMA LAHDE ON ERILAINEN KUIN MUUT YRITYSLAHTEET. Muut
 * yrityslahteet ovat tiedotteita, joista kaivetaan kentat leipatekstista.
 * Tama on julkaisijan oma TYOMAALUETTELO, jossa jokaisella rivilla on
 * samat kentat -- ja niiden joukossa **tyomaan oma puhelinnumero**.
 * Mitattu 25.10.2026, 13 kohdetta:
 *
 *   kohteen nimi      13/13
 *   rakennuttaja      13/13   (HOK Elanto, Kesko, Helsingin kaupunki...)
 *   katuosoite        13/13
 *   tyomaan puhelin   13/13
 *   valmistumiskuukausi 13/13
 *
 * Tyomaan numero on sama tieto jota tyomaakylttien kuvista haetaan
 * ([[site-sign-as-source]]), mutta tassa valmiina listana.
 *
 * REITTI: WordPressin oma sisaltotyyppi `tyomaatiedot`,
 * `wp-json/wp/v2/tyomaatiedot?per_page=100`. Selainsivu nayttaa 10,
 * rajapinta antaa 13 -- sivun paikkakuntasuodatin piilottaa osan.
 * robots.txt on `Disallow:` (tyhja), eli haku on sallittu.
 *
 * ROOLIT MENEVAT RISTIIN muihin yrityslahteisiin nahden: Jalon on
 * RAKENTAJA ja sivun "Rakennuttaja" on TILAAJA. Monessa muussa
 * yrityslahteessa julkaisija on rakennuttaja ([[party-role-fields]]).
 *
 * RAKENTAJAKSI KONSERNI, EI ALUEYHTIOTA. Kannassa on jo rivi jonka
 * rakentaja on "Jalon Uusimaa Oy" (Malmin peruskoulu), ja sivun
 * luokitus kertoo alueen (uusimaa / jyvaskyla / mikkeli / kuopio),
 * mutta EI yhtiota. Alueyhtion nimen paatteleminen luokasta olisi
 * arvaus, joten kaytetaan julkaisijan omaa nimea "Jalon Group Oy".
 * Tama ei syo tarkempaa tietoa: `importCandidate` sailyttaa
 * olemassa olevan rakentajan (`match.builder || candidate.builder`).
 */

const RAJAPINTA = "https://jalon.fi/wp-json/wp/v2/tyomaatiedot?per_page=100"
const UA = "Mozilla/5.0 (compatible; tyomaat.fi/1.0)"
const AIKAKATKAISU_MS = 30000

export const JALON = "Jalon Group Oy"

/*
 * VANHENTUNUT RIVI POIS. Luettelo on kasin yllapidetty, joten valmistunut
 * kohde voi jaada roikkumaan. Kuusi kuukautta valmistumisen jalkeen rivi
 * ei ole enaa tyomaa; lyhyempi raja karsisi viivastyneita.
 */
export const VANHENTUNUT_KUUKAUTTA = 6

export type JalonKohde = {
  id: number
  otsikko: string
  osoite: string | null
  rakennuttaja: string | null
  puhelin: string | null
  valmistuu: string | null
  linkki: string
}

function puhdista(html: string): string {
  return String(html ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8211;|&#8212;/g, "-")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/[ \t]+/g, " ")
    .trim()
}

function kentta(teksti: string, nimi: string): string | null {
  const m = teksti.match(new RegExp(`${nimi}\\s*:\\s*([^\\n]+)`, "i"))
  const arvo = m?.[1]?.trim()
  return arvo ? arvo : null
}

/* "Valmistuu 9/2026" -> kuukauden viimeinen paiva, kuten muissakin. */
export function valmistumispaiva(teksti: string): string | null {
  const m = teksti.match(/valmistuu\s+(\d{1,2})\s*\/\s*(\d{4})/i)
  if (!m) return null
  const kk = Number(m[1])
  const vuosi = Number(m[2])
  if (kk < 1 || kk > 12 || vuosi < 2000 || vuosi > 2100) return null
  const viimeinen = new Date(Date.UTC(vuosi, kk, 0)).getUTCDate()
  return `${vuosi}-${String(kk).padStart(2, "0")}-${String(viimeinen).padStart(2, "0")}`
}

/*
 * KUNTA OSOITTEESTA, EI OTSIKOSTA. Otsikko on usein kauppaketjun ja
 * kaupunginosan nimi ("S-Market Vartioharju"), ja kaupunginosa on monesti
 * myos kunnan nimi muualla Suomessa. Osoitteessa kunta on postinumeron
 * jalkeen tai viimeisen pilkun jalkeen, ja se tarkistetaan kuntarekisterista
 * -- tuntematon nimi hylataan ennemmin kuin arvataan.
 */
export function kuntaOsoitteesta(osoite: string | null): string | null {
  if (!osoite) return null
  const siivottu = osoite.replace(/\s+/g, " ").trim()

  const postinumerolla = siivottu.match(/\b\d{5}\s+([A-Za-zÅÄÖåäö-]+(?:\s+[A-Za-zÅÄÖåäö-]+)?)\s*$/)
  const pilkulla = siivottu.match(/,\s*([A-Za-zÅÄÖåäö-]+(?:\s+[A-Za-zÅÄÖåäö-]+)?)\s*$/)

  for (const ehdokas of [postinumerolla?.[1], pilkulla?.[1]]) {
    if (!ehdokas) continue
    const nimi = ehdokas.trim()
    if (getMunicipalityByName(nimi)) return getMunicipalityByName(nimi)!.name
    /* "Vartioharjuntie 13/Telatie 2, 00950 Helsinki" -> viimeinen sana. */
    const viimeinen = nimi.split(/\s+/).at(-1)
    if (viimeinen && getMunicipalityByName(viimeinen)) return getMunicipalityByName(viimeinen)!.name
  }
  return null
}

export function jasennaKohteet(vastaus: unknown): JalonKohde[] {
  if (!Array.isArray(vastaus)) return []
  const kohteet: JalonKohde[] = []

  for (const rivi of vastaus as any[]) {
    if (rivi?.status && rivi.status !== "publish") continue
    const otsikko = puhdista(rivi?.title?.rendered ?? "").replace(/\n+/g, " ").trim()
    const teksti = puhdista(rivi?.content?.rendered ?? "")
    if (!otsikko || otsikko.length < 3) continue

    kohteet.push({
      id: Number(rivi?.id ?? 0),
      otsikko,
      osoite: kentta(teksti, "Osoite"),
      rakennuttaja: kentta(teksti, "Rakennuttaja"),
      puhelin: kentta(teksti, "Puhelin"),
      valmistuu: valmistumispaiva(teksti),
      linkki: String(rivi?.link ?? "https://jalon.fi/yhteystiedot/tyomaat/"),
    })
  }
  return kohteet
}

export function onAjankohtainen(k: JalonKohde, nyt: Date = new Date()): boolean {
  if (!k.valmistuu) return true
  const raja = new Date(nyt)
  raja.setMonth(raja.getMonth() - VANHENTUNUT_KUUKAUTTA)
  return k.valmistuu >= raja.toISOString().slice(0, 10)
}

export function jalonEhdokkaat(k: JalonKohde) {
  const city = kuntaOsoitteesta(k.osoite)

  /*
   * KUVAUKSEEN EI KIRJOITETA PUHELINNUMEROA. Numero menee rakenteisena
   * yhteyshenkiloksi; leipatekstissa se tuottaisi rikkinaisen merkinnan
   * kun tekstipoimija lukee sen uudelleen
   * ([[fields-into-prose-break-contacts]]).
   */
  const osat = [
    `${JALON} rakentaa kohdetta ${k.otsikko}.`,
    k.rakennuttaja ? `Rakennuttaja on ${k.rakennuttaja}.` : null,
    k.osoite ? `Kohde sijaitsee osoitteessa ${k.osoite}.` : null,
    k.valmistuu ? `Kohteen on määrä valmistua ${k.valmistuu.slice(8, 10)}.${k.valmistuu.slice(5, 7)}.${k.valmistuu.slice(0, 4)} mennessä.` : null,
    "Tiedot ovat Jalonin omalta työmaalistalta, jolla julkaisija pitää yllä käynnissä olevia kohteitaan.",
  ].filter(Boolean)

  return [
    {
      name: k.otsikko,
      description: osat.join(" "),
      city,
      region: city ? (getMunicipalityByName(city)?.region ?? null) : null,
      location: k.osoite,
      developer: k.rakennuttaja,
      builder: JALON,
      /* Julkaisijan oma luettelo kaynnissa olevista tyomaista. */
      phase: PHASE_LABELS.construction,
      phase_authoritative: true,
      completed: false,
      property_type: inferBuildingType(k.otsikko, k.osoite ?? ""),
      estimated_completion: k.valmistuu,
      source_url: k.linkki,
      confidence: 0.8,
      source_name: "jalon_tyomaat",
      metadata: {
        related_companies: mergeCompanyNames([], k.rakennuttaja ? [k.rakennuttaja] : []),
        /*
         * Tyomaan numero ilman nimea on aito organisaatiokontakti, ei
         * rikkinainen merkinta ([[nameless-contact-is-not-broken]]).
         */
        contact_persons: k.puhelin
          ? [
              {
                kind: "organization" as const,
                name: null,
                title: "työmaa",
                organization: JALON,
                email: null,
                phone: k.puhelin,
                source: k.linkki,
              },
            ]
          : [],
        field_sources: {
          developer: "kentta",
          builder: "julkaisija",
          location: k.osoite ? "kentta" : null,
          estimated_completion: k.valmistuu ? "kentta" : null,
          phase: "julkaisijan luettelo",
        },
      },
    },
  ]
}

export async function haeJalonKohteet(): Promise<JalonKohde[]> {
  const ohjain = new AbortController()
  const kello = setTimeout(() => ohjain.abort(), AIKAKATKAISU_MS)
  try {
    const res = await fetch(RAJAPINTA, {
      signal: ohjain.signal,
      cache: "no-store",
      headers: { "user-agent": UA, accept: "application/json" },
    })
    if (!res.ok) return []
    return jasennaKohteet(await res.json())
  } catch {
    return []
  } finally {
    clearTimeout(kello)
  }
}

export async function fetchJalonSource() {
  const kohteet = await haeJalonKohteet()
  return kohteet.filter((k) => onAjankohtainen(k)).flatMap((k) => jalonEhdokkaat(k))
}
