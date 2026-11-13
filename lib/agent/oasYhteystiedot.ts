import { onMalliosoite } from "@/lib/projects/contacts"

/*
 * OAS:N "YHTEYSTIEDOT"-LUKU HENKILOIKSI (D-413).
 *
 * Johannes 14.11.2026 Huittisten Hiukkamaen teollisuusalueesta:
 * *"myos yhteystiedot ovat pdf liitteessa, ne pitaa poimia."*
 *
 * OAS-pohjassa yhteystiedot ovat VIIMEISENA lukuna, rivi kerrallaan:
 *
 *   6. YHTEYSTIEDOT
 *   Kaavaa laativa asiantuntija                       <- rooli
 *   Arkkitehti Markus Makkonen, NOAR Oy               <- nimike, nimi, yritys
 *   Olympiastadion, Paavo Nurmen tie 1, 00250 Helsinki <- osoite
 *   p. +358 40 582 41 34
 *   markus.makkonen@noar.fi
 *   Hanketoimija                                      <- rooli
 *   Juha Pontinen, FCDC Corp Oy                       <- nimi ilman nimiketta
 *   ...
 *   Huittisten kaupunki                               <- organisaatio
 *   Kaavoitusarkkitehti Annamaria Puumala
 *
 * MIKSI OMA JASENNIN. `kaavanYhteyshenkilot` (D-230) poimii nimen vain
 * nimikkeen perasta, joten "Juha Pontinen, FCDC Corp Oy" jaisi pois --
 * ja juuri han on hanketoimija eli rakennuttaja. Taalla nimike tulee
 * usein EDELTAVALTA rivilta. `parseYhteystietolohko` taas lukee
 * kappaletta eika riveja, ja osoiterivit valuivat nimikkeeseen.
 *
 * RAJAUS: vain otsikon "YHTEYSTIEDOT" alta, ei muualta tekstista.
 * Sisallysluettelon rivi ("6. YHTEYSTIEDOT ........ 18") ei kelpaa
 * otsikoksi, koska rivilla on pisteita ja sivunumero.
 *
 * Kaupungin yleinen postilaatikko ("kaupunki@huittinen.fi") ennen
 * ensimmaista henkiloa ei kuulu kenellekaan, joten se ohitetaan.
 */

export type OasYhteystieto = {
  name: string
  title: string | null
  phone: string | null
  email: string | null
  organization: string | null
}

const OTSIKKO = /^\s*(?:\d+\.?\s+)?(YHTEYSTIEDOT|YHTEYSHENKIL[ÖO]T)\s*$/i

/* Seuraava numeroitu luku paattaa luvun. */
const SEURAAVA_LUKU = /^\s*\d+(?:\.\d+)*\.?\s+[A-ZÄÖÅ]{3}/

/* "Puh. vaihde 0207 911 888" (Lintukangas): vaihde merkitaan numeron perään. */
const PUHELIN = /^(?:p|puh|puhelin|tel|gsm)\.?\s*:?\s*(vaihde\s+)?(\+?\d[\d\s()-]{5,}\d)/i

/* Tutkintolyhenteet, jotka aloittavat nimikkeen pilkun jalkeen. */
const TUTKINTO = /^(FM|DI|KTM|MMM|FT|FL|TkT|TkL|YTM|HTM|ETM|LuK|KTK|insinööri|ins\.|rkm)(?![A-Za-zÅÄÖåäö])/

/* Merkityksettomat valiotsikot, jotka eivat ole rooli eika organisaatio. */
const TYHJA_OTSIKKO = /^(muut\s+)?yhteystiedot$|^lis[äa]tietoja$|^tai(\s+postitse)?$/i
const OSOITE = /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i
const VERKKOSIVU = /^(?:www\.|https?:\/\/)/i

/* Postinumero tai katuosoite: "00250 Helsinki", "Mikonkatu 9". */
const KATUOSOITE = /\b\d{5}\b|\b\S*(?:katu|tie|kuja|polku|väylä|vayla|tori|kaari|rinne)\s+\d/i

/* Organisaatiota tarkoittava rivi, ei henkiloa eika roolia. */
const ORGANISAATIO = /(kaupunki|kunta|\boy\b|\boyj\b|\bab\b|\bky\b|\bry\b|yhtym[äa]|liitto|virasto|keskus)/i

/*
 * Nimen sana: iso alkukirjain ja sen perassa pienia, valissa sallittu
 * yksi yhdysmerkki ("Anna-Liisa"). Lintukankaan OAS:ssa yrityksen nimi
 * "A-  Insinöörit" tulkittiin ensin henkiloksi, koska "A-" alkaa isolla.
 */
const NIMISANA = /^[A-ZÄÖÅ][a-zåäö]+(?:-[A-ZÄÖÅ][a-zåäö]+)?$/

function onNimisana(sana: string): boolean {
  return NIMISANA.test(sana)
}

/* "kaavaa laativa konsultti" -> "Kaavaa..." ; "YVA-konsultti" sailyy. */
function isoAlku(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1)
}
function pieniAlku(t: string): string {
  return /^[A-ZÄÖÅ][a-zåäö]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t
}

/* "A-  Insinöörit" -> "A-Insinöörit" */
function siistiOrganisaatio(t: string): string {
  return t.replace(/-\s+(?=[A-ZÄÖÅ])/g, "-").replace(/,.*$/, "").replace(/\s+/g, " ").trim()
}

/*
 * "Arkkitehti Markus Makkonen, NOAR Oy" -> nimi, nimike, yritys.
 * Nimi on pilkkua edeltavan osan KAKSI VIIMEISTA sanaa, ja niiden on
 * molempien alettava isolla: "Huittisten kaupunki" ei ole nimi.
 */
function nimirivi(rivi: string): { name: string; title: string | null; organization: string | null } | null {
  const [vasen, ...oikea] = rivi.split(",")
  const sanat = vasen.trim().split(/\s+/).filter(Boolean)
  if (sanat.length < 2 || sanat.length > 6) return null

  const sukunimi = sanat[sanat.length - 1]
  const etunimi = sanat[sanat.length - 2]
  if (!onNimisana(sukunimi) || !onNimisana(etunimi)) return null

  /* Organisaatioriville ("Myrsky Energia Oy") ei synny henkiloa. */
  if (ORGANISAATIO.test(vasen)) return null

  /*
   * PILKUN JALKEEN JOKO YRITYS TAI NIMIKE. Hiukkamaessa "Juha Pontinen,
   * FCDC Corp Oy" (yritys), Lintukankaassa "Seija Holmi, tekninen
   * johtaja" (nimike). Pieni alkukirjain erottaa ne: yrityksen nimi
   * alkaa isolla, nimike pienella.
   */
  const etuNimike = sanat.slice(0, -2).join(" ").trim()
  const perassa = oikea.join(",").trim()
  /*
   * Tutkinto alkaa isolla mutta on nimike: Hattulan Niinimaen OAS:ssa
   * "Masi Mailammi, FM, johtava konsultti". Tarkka lista, koska
   * yrityksen nimi voi olla lyhenne ("NOAR Oy").
   */
  const perassaNimike =
    perassa && !ORGANISAATIO.test(perassa) && (/^[a-zåäö]/.test(perassa) || TUTKINTO.test(perassa))

  const nimike = [etuNimike, perassaNimike ? perassa : ""].filter(Boolean).join(", ") || null
  const organisaatio = perassa && !perassaNimike ? perassa : null

  return { name: `${etunimi} ${sukunimi}`, title: nimike, organization: organisaatio }
}

function luvunRivit(teksti: string): string[] {
  const rivit = teksti.split("\n")
  /* Viimeinen osuma: sisallysluettelo on alussa, luku itse lopussa. */
  let alku = -1
  rivit.forEach((r, i) => {
    if (OTSIKKO.test(r)) alku = i
  })
  if (alku < 0) return []

  const tulos: string[] = []
  for (const rivi of rivit.slice(alku + 1, alku + 80)) {
    if (SEURAAVA_LUKU.test(rivi)) break
    tulos.push(rivi.trim())
  }
  return tulos
}

export function oasYhteystiedot(teksti: string | null | undefined): OasYhteystieto[] {
  const tulos: OasYhteystieto[] = []
  let nykyinen: OasYhteystieto | null = null
  let rooli: string | null = null
  let organisaatio: string | null = null

  for (const rivi of luvunRivit(String(teksti ?? ""))) {
    if (!rivi) continue

    const puhelin = rivi.match(PUHELIN)
    if (puhelin) {
      if (nykyinen && !nykyinen.phone) {
        const numero = puhelin[2].replace(/\s+/g, " ").trim()
        nykyinen.phone = puhelin[1] ? `${numero} (vaihde)` : numero
      }
      continue
    }

    if (TYHJA_OTSIKKO.test(rivi)) continue

    const osoite = rivi.match(OSOITE)
    if (osoite) {
      if (nykyinen && !nykyinen.email && !onMalliosoite(osoite[0])) nykyinen.email = osoite[0]
      continue
    }

    if (VERKKOSIVU.test(rivi) || KATUOSOITE.test(rivi)) continue

    const nimi = nimirivi(rivi)
    if (nimi) {
      /*
       * Oma nimike ja edeltavan rivin rooli yhteen:
       * "Arkkitehti" + "Kaavaa laativa asiantuntija".
       */
      const yhdessa = nimi.title && rooli ? `${nimi.title}, ${pieniAlku(rooli)}` : nimi.title ?? rooli
      nykyinen = {
        name: nimi.name,
        title: yhdessa ? isoAlku(yhdessa) : null,
        phone: null,
        email: null,
        organization: nimi.organization ?? organisaatio,
      }
      tulos.push(nykyinen)
      continue
    }

    /*
     * Lyhyt rivi ilman nimea on valiotsikko: rooli tai organisaatio.
     * Pitka rivi on johdantoa ja ohitetaan.
     *
     * LOHKO = valiotsikot + henkilo. Henkilon jalkeen tuleva valiotsikko
     * aloittaa uuden lohkon, joten edellinen rooli ja organisaatio
     * nollataan -- muuten kaupungin osoite liittyisi seuraavalle.
     *
     * Roolin JALKEEN tuleva toinen valiotsikko on organisaatio, vaikka
     * siina ei olisi yhtiomuotoa: Lintukankaassa "Kaavaa laativa
     * konsultti" -> "A-  Insinöörit" -> henkilo.
     */
    const sanoja = rivi.split(/\s+/).length
    if (sanoja <= 6 && !/\d/.test(rivi) && !rivi.endsWith(":")) {
      if (nykyinen) {
        rooli = null
        organisaatio = null
      }
      nykyinen = null
      if (ORGANISAATIO.test(rivi) || (rooli !== null && organisaatio === null)) {
        organisaatio = siistiOrganisaatio(rivi)
      } else {
        rooli = rivi
        organisaatio = null
      }
    }
  }

  /* Ilman puhelinta ja sahkopostia nimi ei ole yhteystieto. */
  return tulos.filter((h) => h.phone || h.email)
}
