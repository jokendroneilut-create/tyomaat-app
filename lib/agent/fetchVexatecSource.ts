import * as cheerio from "cheerio"

import { detectCityFromText } from "@/lib/agent/detectCityFromText"
import { getMunicipalityByName } from "@/lib/geo/municipalities"
import { inferBuildingType } from "@/lib/agent/buildingType"
import { parseEstimatedCompletionDate } from "@/lib/agent/parseFinnishCompletionDate"
import { extractContacts } from "@/lib/projects/contacts"
import { mergeCompanyNames } from "@/lib/projects/projectCompanies"

/*
 * VEXATEC OY: TIEDOTTEET (D-322).
 *
 * Johannes 19.10.2026: *"onhan taalla paljonkin hankkeita"* --
 * vastaus edelliseen mittaukseeni, joka oli vaara. Olin katsonut
 * `/tiedotteet/`-listausta (ei linkkeja ilman selainta) ja RSS-syotetta
 * (kaksi henkilostojuttua) ja paatellyt saaliin olemattomaksi.
 * `/ajankohtaista/` nayttaa tiedotteet, ja niita on 31.
 *
 * REITTI: WordPressin oma tyyppi `tiedotteet` rajapinnassa
 * `wp-json/wp/v2/tiedotteet?per_page=100`. Yksi pyynto antaa kaikki 31
 * otsikoineen, paivineen ja koko tekstina -- sivuja ei tarvitse kaivaa.
 *
 * SUODATUS ON KOKO TYO (muisti: company-source-filtering). Mitattu
 * 19.10.2026: 31 tiedotteesta 11 on yrityksen omaa asiaa (sulautuminen,
 * tilauskanta, rekrytointi, brandi, AI-pilotti, henkilokuvat) ja loput
 * kertovat kohteesta. Kahdentoista kuukauden ikkuna on pakollinen, ja
 * se jattaa noin viisi hankejuttua -- tahti on noin yksi kuukaudessa.
 *
 * TILAAJAA EI POIMITA TASSA VERSIOSSA. Vexatecin otsikot kertovat
 * tilaajan allatiivissa ("Dahlin LVI-tukulle", "Novus Family
 * Homesille", "Kiinteistotahkolalle"), ja allatiivin purkaminen
 * nimeksi on oma tyonsa, jossa on helppo tuottaa roskaa. Tilaaja jaa
 * kuvaukseen, josta katselmoija nakee sen.
 */

export const VEXATEC = "Vexatec Oy"

const RAJAPINTA = "https://vexatec.fi/wp-json/wp/v2/tiedotteet?per_page=100"
const UA = "Mozilla/5.0 (compatible; tyomaat.fi/1.0)"
const AIKAKATKAISU_MS = 20000

/* Sama ikkuna kuin muilla yrityslahteilla. */
const IKKUNA_KUUKAUSIA = 12

export type VexatecJulkaisu = {
  otsikko: string
  osoite: string
  pvm: Date | null
  teksti: string
}

/*
 * YRITYKSEN OMA ASIA, EI KOHDE. Nama osuvat otsikkoon; leipatekstissa
 * samat sanat voivat esiintya kohdejutussakin ("kasvu", "tilauskanta"),
 * joten vertailu tehdaan vain otsikosta.
 */
const EI_KOHDE =
  /sulautu|tilauskanta|rekry|hankekehitysjohtaja|aloitti tehtäv|kulttuurin|brändi|hallitustyö|pääomistaja|pilotin|diplomityö|vastuun takana|työntekijä|moniosaaj|hankekehitystä|kannattaa$/i

/*
 * KOHDEJUTUN TUNNUS: rakennustyyppi otsikossa. Pelkka kaupungin nimi
 * ei riita -- "Vexatec kovassa kasvuvauhdissa" mainitsee kaupunkeja,
 * mutta ei ole kohde.
 */
const KOHDESANA =
  /hoivakoti|hoivakodin|päiväkoti|päiväkodin|koulu|monitoimitalo|rivitalo|asunto|asuntoa|asumisyksikkö|palveluasumis|palvelutalo|toimitila|toimitilat|pelastusasema|myymälä|kauppakeskus|halli|varasto|tuotantotila|kerrostalo|koti\b/i

export function lapaiseeSuodatuksen(j: Pick<VexatecJulkaisu, "otsikko">): boolean {
  if (EI_KOHDE.test(j.otsikko)) return false
  return KOHDESANA.test(j.otsikko)
}

export function tiedotteenAikaraja(nyt: Date = new Date()): Date {
  const raja = new Date(nyt)
  raja.setMonth(raja.getMonth() - IKKUNA_KUUKAUSIA)
  return raja
}

export function jasennaJulkaisut(data: unknown): VexatecJulkaisu[] {
  if (!Array.isArray(data)) return []
  return data.map((j: any) => {
    const otsikko = cheerio.load(String(j?.title?.rendered ?? "")).text().replace(/\s+/g, " ").trim()
    const teksti = cheerio
      .load(String(j?.content?.rendered ?? ""))
      .text()
      .replace(/\s+/g, " ")
      .trim()
    const pvm = j?.date ? new Date(String(j.date)) : null
    return {
      otsikko,
      osoite: String(j?.link ?? ""),
      pvm: pvm && !isNaN(pvm.getTime()) ? pvm : null,
      teksti,
    }
  })
}

/*
 * Otsikko on uutisotsikko ("Kouvolaan koti 58 ikäihmiselle"), ei
 * hankkeen nimi. Nimea ei keksita: otsikko kelpaa sellaisenaan, ja
 * katselmoija korjaa sen hyvaksynnassa. Vain yrityksen nimi poistetaan
 * alusta, koska se toistuu joka rivilla ("Vexatec urakoi hoivakodin
 * Kokkolaan" -> "Hoivakoti Kokkolaan" olisi keksimista, joten jatetaan
 * otsikko ja poistetaan vain roikkuva kaksoispiste).
 */
export function hankkeenNimi(otsikko: string): string {
  return otsikko.replace(/^tiedote:\s*/i, "").trim()
}

export function vexatecinVaihe(otsikko: string, teksti: string): string {
  const kaikki = `${otsikko} ${teksti.slice(0, 400)}`
  if (/valmistui|luovutettiin|otettiin käyttöön|valmis kalustettavaksi/i.test(kaikki)) return "Valmistunut"
  if (/työmaa on käynnissä|rakennustyöt ovat käynniss|rakentaminen on käynniss|jo pitkällä|harjakorkeu/i.test(kaikki))
    return "Rakenteilla"
  if (/sai rakennusluvan|rakennuslupa myönnet/i.test(kaikki)) return "Rakennuslupa"
  return "Sopimus myönnetty"
}

export function vexatecEhdokkaat(j: VexatecJulkaisu) {
  const nimi = hankkeenNimi(j.otsikko)
  const ensimmainenVirke = j.teksti.split(/(?<=[.!?])\s+/)[0] ?? ""
  /*
   * Kunta otsikosta, sitten ensimmaisesta virkkeesta, sitten
   * ingressista -- sama jarjestys kuin Oteranilla. Kuivaharjoitus
   * 19.10.2026: "Palveluasumisyksikko Joensuuhun" ja
   * "Kiintestotahkolan toimitilat" jaivat ilman kuntaa otsikosta,
   * vaikka teksti kertoo sen heti alussa. Ingressi on rajattu, jottei
   * jutun lopussa ohimennen mainittu kaupunki paady kunnaksi.
   */
  const lead = j.teksti.slice(0, 400)
  const city =
    detectCityFromText(nimi.toLowerCase()) ??
    detectCityFromText(ensimmainenVirke.toLowerCase()) ??
    detectCityFromText(lead.toLowerCase())
  const pvm = j.pvm ? j.pvm.toISOString() : null

  return [
    {
      name: nimi,
      description: j.teksti || null,
      city,
      region: city ? getMunicipalityByName(city)?.region ?? null : null,
      location: null,
      developer: null,
      builder: VEXATEC,
      phase: vexatecinVaihe(j.otsikko, j.teksti),
      completed: /valmistui|luovutettiin/i.test(`${j.otsikko} ${j.teksti.slice(0, 300)}`),
      property_type: inferBuildingType(nimi, null),
      estimated_completion: parseEstimatedCompletionDate(j.teksti, pvm),
      source_url: j.osoite,
      confidence: 0.6,
      source_name: "vexatec",
      metadata: {
        related_companies: mergeCompanyNames([], [VEXATEC]),
        /*
         * Tiedotteen lopussa on nimetty yhteyshenkilo puhelimineen
         * ("Lisatietoja: Pekka Ervasti Liiketoimintajohtaja 050 383
         * 8630 pekka.ervasti@vexatec.fi") -- juuri se tieto jota
         * muualta ei saa. Vain henkilot: sama lohko sisaltaa myos
         * yrityksen vaihteen ja info-osoitteen, jotka tulisivat
         * mukaan organisaationa nimella "Oulu Espoo".
         */
        contact_persons: extractContacts(j.teksti).filter((c) => c.kind === "person"),
      },
    },
  ]
}

export async function haeVexatecinJulkaisut(
  aikaraja: Date = tiedotteenAikaraja()
): Promise<VexatecJulkaisu[]> {
  const ohjain = new AbortController()
  const kello = setTimeout(() => ohjain.abort(), AIKAKATKAISU_MS)
  try {
    const res = await fetch(RAJAPINTA, {
      signal: ohjain.signal,
      cache: "no-store",
      headers: { "user-agent": UA },
    })
    if (!res.ok) return []
    const julkaisut = jasennaJulkaisut(await res.json())
    return julkaisut.filter((j) => !j.pvm || j.pvm >= aikaraja)
  } catch {
    return []
  } finally {
    clearTimeout(kello)
  }
}

export async function fetchVexatecSource() {
  const julkaisut = await haeVexatecinJulkaisut()
  return julkaisut.filter(lapaiseeSuodatuksen).flatMap(vexatecEhdokkaat)
}
