import { NAME, cleanCompanyName, looksLikeCompany } from "@/lib/agent/companyName"

/*
 * KAAVAN OSAPUOLI KUVAUKSESTA, KAAVAN OMALLA SANASTOLLA (D-338).
 *
 * `extractYvaDeveloper` (D-195) ajetaan jo kaikille kaavalahteille
 * (`kaavanRakennuttaja`), mutta sen kolme ankkuria ovat YVA-tekstin
 * sanastoa: "hankkeesta vastaa", "hankevastaava" ja "X
 * suunnittelee/selvittaa/hakee/toteuttaa". Kaavapaatos puhuu toisin.
 *
 * Johannes 23.10.2026 Samppalinnan koulutontista: *"tasta ei ole poimittu
 * hankkeeseen liittyvaa yritysta TKU-Rakennus Oy joka on kuvauksessa."*
 * Teksti sanoo *"Turun kaupungin ja TKU-Rakennus Oy:n valinen
 * maaraaikainen innovaatiokumppanuus"* -- ei yhtaan YVA-ankkuria.
 *
 * ANKKURIT ON LASKETTU AINEISTOSTA, EI ARVATTU (23.10.2026). 6 092
 * kaavarivista 578:lla on yritysnimi kuvauksessa; vanha saanto loytaa
 * rakennuttajan 151:lta ja 346 jaa ilman. Niiden 675 nimiesiintyman
 * ymparilta laskettu sanajakauma antoi tasmalleen nama kuviot:
 *
 *   nimen JALKEEN   aloitteesta 18, kaavoitusaloitteen 14+6+3,
 *                   hakemuksesta 8, omistuksessa 6, esityksesta 4,
 *                   haluaa 4, suunnittelevat 4, valinen 3, esittaa 3
 *   nimen EDELLA    hyvaksya 10, vireille 8, rakennusliike 6,
 *                   lisatietoja 6, aloitteen 4, tehnyt 4, omistaa 4
 *
 * KONSULTTI EI OLE OSAPUOLI, JA SE ON SAMASSA JAKAUMASSA: "laatija" 14,
 * "kaavakonsultti" 12, "konsultti(na)" 10, "laatimisen" 5. Nimilista ei
 * riita (pienet paikalliset toimistot eivat ole listalla), joten
 * tunnistus on ROOLISANASSA nimen edella.
 *
 * KIRJAINKOKO ON KUVIOSSA, EI KOODISSA. `i`-lippu mitatoisi `NAME`-kuvion
 * ison alkukirjaimen vaatimuksen, jolloin nimi jatkuisi pienilla sanoilla
 * ([[case-insensitive-lookahead-trap]]). Jokainen ankkuri sallii ison tai
 * pienen alkukirjaimen erikseen.
 */

/*
 * Nimen EDELLA oleva roolisana kertoo konsultin tai suunnittelijan.
 * Tarkistetaan 50 merkin ikkunasta nimen edelta. Oma pieni kuvio, jossa
 * ei ole `NAME`-osaa, joten `i`-lippu on tassa turvallinen.
 */
const ROOLI_ENNEN =
  /(?:kaavan\s+laatij\w*|laatij\w*|laatimise\w*|kaavakonsultti\w*|konsultti\w*|konsulttina|suunnittelutoimisto\w*|arkkitehtitoimisto\w*|insin[öo][öo]ritoimisto\w*|tilannut|selvityks\w*|selvitykse\w*|luontoselvity\w*)[\s:,]*$/i

/*
 * KATKENNUT NIMI: ISO SANA JA "ja" NIMEN EDELLA.
 *
 * `NAME` vaatii joka sanalta ison alkukirjaimen, joten pieni sidesana
 * katkaisee nimen keskelta: "Napapiirin Energia ja Vesi Oy" -> "Vesi Oy"
 * (mitattu 3 rivilla 23.10.2026). Jos nimen edella on " ja " ja sita
 * ennen iso sana joka EI paaty genetiiviin (":n"), nimi on katkennut --
 * mieluummin tyhja kuin vaara.
 *
 * Genetiivi sailyy, koska se erottaa aidon listan: "Wartsila Finland
 * Oy:n ja EPV Energia Oy:n aloitteesta" on kaksi yritysta, ei yksi.
 */
const KATKAISSUT_JA = /[A-ZÅÄÖ][\wÅÄÖåäö.\-]*(?<!:n)\s+ja\s+$/

/*
 * Sanat jotka EIVAT voi olla osa yritysnimea. Kaavasivun osioiden
 * otsikot tulevat tekstiin ilman valimerkkia ("Lisatietoja hakijasta:
 * Kiinteisto Oy Myyrinmaki Sijainti Kuohukuja 1-3"), ja etumuotoinen
 * nimi jatkuu niihin asti. Lista on sivuilta luettu, ei arvattu.
 */
const LOPETA = new Set(
  [
    "sijainti",
    "sijanti",
    "maanomistus",
    "maanomistaja",
    "maanomistajat",
    "asemakaava",
    "asemakaavamuutos",
    "asemakaavamuutosalue",
    "asemakaavan",
    "kaavamuutos",
    "kaavamuutosalue",
    "kaava-alue",
    "suunnittelualue",
    "suunniteltu",
    "yhteystiedot",
    "yhteyshenkilo",
    "yhteyshenkilö",
    "lisatietoja",
    "lisätietoja",
    "mita",
    "mitä",
    "hankkeesta",
    "nykytilanne",
    "tavoitteet",
    "havainnekuvat",
  ].map((s) => s.toLowerCase())
)

/* Sanat jotka eivat voi ALOITTAA nimea: rooli tai virkkeen sija. */
/*
 * "rakennusliike" vain pienella: isolla se on nimen osa ("Rakennusliike
 * Jouko Pesonen Oy", "Rakennusliike LapTi Oy", Rovaniemi, D-417).
 */
const ETUROSKA = /^(?:[Hh]akij\w*|[Ll]is[äa]tietoja|[Mm]aanomist\w*|[Aa]siaa|[Kk]aavamuutoksella|rakennusliike)$/
const SIJAPAATE = /(?:lla|llä|ssa|ssä|sta|stä|lle|ksi|een|ään|iin|ista|istä)$/i

/*
 * Pelkka maa tai paljas etumuoto on katkennut nimi, ei yritys. Syntyy kun
 * nimi alkaa pienella kirjaimella ("wpd Suomi Oy") tai kun kuvio nappaa
 * vain etuliitteen ("Kiinteisto Oy" 22 kertaa, "As Oy" 10).
 */
const KATKENNUT =
  /^(?:Suomi|Finland|Sverige|Norge|Kiinteist[öo]|Kiint\.?|As\.?|Asunto|Asunto-osakeyhti[öo]|Bostads|Fastighets|Yhti[öo]|Vesi|Energia)\s*-?\s*(?:Oy|Oyj|Ab|Abp|Ky|Ltd)\.?$/i

const URL = /\b(?:https?:\/\/|www\.)\S+/gi
const SULKU = /\s*[(（][^)）]*[)）]/g

/*
 * LIIMAUTUMINEN IRROTETAAN VAIN NUMEROSTA, EI PIENESTA KIRJAIMESTA.
 *
 * Sivulta puuttuu valilyonti kahdessa kohdassa: otsikkonumeron jaljessa
 * ("kaupunginosa nro 3RovaLappi Rakennus Oy") ja osion otsikon edessa
 * ("ABO Energy Suomi OyYhteystiedot").
 *
 * Ensin kokeiltu yleinen saanto "katkaise pienesta kirjaimesta isoon"
 * rikkoi aidot CamelCase-nimet: `WestWind Oy` -> "Wind Oy" ja
 * `RovaLappi Rakennus Oy` -> "Lappi Rakennus Oy" (mitattu 4 rivilla).
 * Rakenteellisesti niita ei voi erottaa liimautuneesta paikannimesta
 * ("OlkkajarviApukka Resort Oy"), joten saanto rajattiin numeroon --
 * yksi epatarkka nimi on halvempi kuin nelja katkaistua.
 */
function irrotaLiimattu(sana: string): string {
  const osat = sana.split(/(?<=[0-9])(?=[A-ZÅÄÖ])/)
  return osat.length > 1 ? osat[osat.length - 1] : sana
}

/* Yhtiomuoto kiinni seuraavassa sanassa: "OyYhteystiedot" -> "Oy". */
function irrotaMuoto(sana: string): string {
  const m = sana.match(/^(Oy|Oyj|Ab|Abp|Ky|Ltd)(?=[A-ZÅÄÖ])/)
  return m ? m[1] : sana
}

export function siivoaKaavanNimi(raw: string): string | null {
  let sanat = raw.trim().split(/\s+/).filter(Boolean)
  if (!sanat.length) return null

  /* Liimautunut etuliite pois ensimmaisesta sanasta, muoto irti lopusta. */
  sanat[0] = irrotaLiimattu(sanat[0])
  sanat = sanat.map(irrotaMuoto)

  /* Roska edesta. */
  while (sanat.length > 1) {
    const eka = sanat[0]
    const roska =
      ETUROSKA.test(eka) ||
      /[_\d]/.test(eka) ||
      (eka === eka.toUpperCase() && eka.length > 3) ||
      (/\.$/.test(eka) && eka.length > 4) ||
      SIJAPAATE.test(eka)
    if (!roska) break
    sanat = sanat.slice(1)
  }

  /* Osion otsikko katkaisee nimen. */
  const loppu = sanat.findIndex((s) => LOPETA.has(s.toLowerCase().replace(/[^\wåäöÅÄÖ-]/g, "")))
  if (loppu === 0) return null
  if (loppu > 0) sanat = sanat.slice(0, loppu)

  const nimi = cleanCompanyName(sanat.join(" "))
  if (nimi.length < 4) return null
  if (!looksLikeCompany(nimi)) return null
  if (KATKENNUT.test(nimi)) return null
  return nimi
}

/* Genetiivi + jalkisana: "X Oy:n kaavoitusaloite", "X Oy:n aloitteesta". */
const GENETIIVI_ANKKURIT = [
  `(${NAME}):n\\s+(?:kaavoitusaloit\\w+|aloitte\\w+|aloite\\b|hakemukse\\w+|hakemus\\b|esitykse\\w+|pyynn[öo]st[äa])`,
  /*
   * "Turun kaupungin ja TKU-Rakennus Oy:n valinen kumppanuus": nimi on
   * genetiivissa ja rooli tulee sanasta "valinen".
   */
  `(${NAME}):n\\s+v[äa]li(?:nen|se\\w*)`,
  `(${NAME}):n\\s+kanssa\\s+(?:tehty\\s+|solmittu\\s+)?(?:kumppanuus|sopimus|maank[äa]ytt[öo]sopimus)\\w*`,
]

/* Nimi subjektina: "X Oy haluaa paivittaa", "X Oy on tehnyt aloitteen". */
const VERBI_ANKKURIT = [
  `(${NAME})\\s+(?:haluaa|esitt[äa][äa]|kartoittaa|suunnittelevat|hakeutuu)\\b`,
  `(${NAME})\\s+on\\s+(?:hakenut|tehnyt\\s+aloitteen|j[äa]tt[äa]nyt)\\b`,
  /*
   * D-417 (Rovaniemi): "X Oy on esittänyt kaupungille", "X Oy on
   * valtakirjalla hakenut". Pelkka "on esittänyt" ei riita: Oulussa
   * "TeliaSonera Oyj on esittänyt aiemman suunnittelun yhteydessä" on
   * lausunto, ei aloite.
   */
  `(${NAME})\\s+on\\s+(?:esitt[äa]nyt\\s+(?:kaupungille|kunnalle|asemakaava\\w*|kaava\\w*)|valtakirjalla\\s+hakenut)\\b`,
]

/* Rooli nimen edella: "hakijana on X Oy", "hyvaksya X Oy:n aloite". */
const ETUANKKURIT = [
  `[Hh]akij(?:a|ana|asta|an)\\s*:?\\s*(?:on\\s+)?(${NAME})`,
  /* D-417 (Rovaniemi): "Asemakaavamuutoksen hakijat ovat Kiinteistö Oy Lapinmaa ja ...". */
  `[Hh]akijat\\s+ovat\\s+(${NAME})`,
  /* D-417 (Rovaniemi): "Aloite kaavatyön aloittamisesta on tullut Roy Service Oy:ltä." */
  `[Aa]loite\\s+(?:\\S+\\s+){0,3}?on\\s+tullut\\s+(${NAME}):lt[äa]`,
  `[Hh]yv[äa]ksy[äa]\\s+(${NAME}):n`,
  `aloitteen\\s+(?:on\\s+)?teh(?:nyt|neet)\\s+(?:\\w+\\s+){0,2}?(${NAME})`,
  `[Hh]ankkeesta\\s+vastaava\\w*\\s*:?\\s*(?:yhti[öo]\\s+)?(?:on\\s+|toimii\\s+)?(${NAME})`,
  `[Vv]ireille\\s+(?:tullut\\s+)?(?:\\w+\\s+){0,3}?(${NAME}):n`,
]

const KAIKKI = [...GENETIIVI_ANKKURIT, ...VERBI_ANKKURIT, ...ETUANKKURIT].map(
  (p) => new RegExp(p, "g")
)

/*
 * KAAVAN LAATIJA KUVAUKSESTA (D-417).
 *
 * Johannes 14.11.2026 Rovaniemen Mellavaarasta: *"Tassa kerrotaan myos
 * arkkitehti Arkkitehtitoimisto Jarmo Lokio Oy."* Kuvaus: *"Hakija
 * esittaa kaavanlaatijaksi Arkkitehtitoimisto Jarmo Lokio Oy:ta."*
 *
 * `kaavanOsapuoli` hylkaa tarkoituksella nimen jonka edella on
 * roolisana "laatija" tai "konsultti" -- konsultti ei ole rakennuttaja.
 * Mutta se on hankkeeseen liittyva yritys, ja D-414:n saannolla
 * kaavakonsultti menee `related_companies`-listaan (rooli ei ole
 * arkkitehtisuunnittelija, joten roolisaraketta ei ole).
 *
 * Ankkuri on ROOLISANA NIMEN EDELLA, sama joka osapuolipoiminnassa
 * hylkaa. Nimen on naytettava yritykselta (`siivoaKaavanNimi` vaatii
 * yhtiomuodon tai tunnetun muodon).
 */
const LAATIJA_ANKKURIT = [
  `[Kk]aavan\\s*laatij(?:a|aksi|ana|oina|oiksi)\\s*:?\\s*(?:on\\s+|toimii\\s+|toimivat\\s+)?(?:valittu\\s+)?(${NAME})`,
  `[Kk]aava(?:konsultti|konsulttina|konsultiksi)\\s*:?\\s*(?:on\\s+|toimii\\s+)?(${NAME})`,
  `[Kk]aavan\\s+laatii\\s+(${NAME})`,
  `[Kk]aavan\\s+laatimisesta\\s+vastaa\\s+(${NAME})`,
  `(${NAME})\\s+(?:laatii|on\\s+laatinut)\\s+(?:asema|yleis|osayleis|ranta)?kaava`,
]
const LAATIJA_KUVIOT = LAATIJA_ANKKURIT.map((p) => new RegExp(p, "g"))

/*
 * Nimi alkaa heti roolisanan jalkeen, joten etuosan sijapaatesiivousta
 * ei tehda: "Alusta Consulting Oy" ei ole elatiivi (mitattu 14.11.2026,
 * `siivoaKaavanNimi` antoi "Consulting Oy"). Henkilo nimen edella
 * ("DI Pertti Hartikainen Karttaako Oy:stä") hylataan -- tyhja on
 * parempi kuin henkilon nimi yrityksena.
 */
const HENKILO_ALKU = /^(?:DI|FM|TkT|DI\.|Dipl\.?|Arkkitehti|SAFA|YKS)\b/

function siivoaLaatija(raw: string): string | null {
  let sanat = raw.trim().split(/\s+/).filter(Boolean).map(irrotaMuoto)
  if (!sanat.length || HENKILO_ALKU.test(sanat[0])) return null
  const loppu = sanat.findIndex((s) => LOPETA.has(s.toLowerCase().replace(/[^\wåäöÅÄÖ-]/g, "")))
  if (loppu === 0) return null
  if (loppu > 0) sanat = sanat.slice(0, loppu)
  const nimi = cleanCompanyName(sanat.join(" "))
  if (nimi.length < 4 || !looksLikeCompany(nimi) || KATKENNUT.test(nimi)) return null
  /* Yhtiomuoto pakollinen: laatijaksi kelpaa vain yritys, ei kaupungin yksikko. */
  if (!/\b(?:Oy|Oyj|Ab|Ky|Ltd)\.?$/.test(nimi)) return null
  return nimi
}

export function kaavanLaatija(teksti: string | null | undefined): string | null {
  if (!teksti) return null
  const puhdas = String(teksti).replace(/\s+/g, " ").replace(URL, " ").replace(SULKU, " ")
  for (const kuvio of LAATIJA_KUVIOT) {
    kuvio.lastIndex = 0
    for (const osuma of puhdas.matchAll(kuvio)) {
      const nimi = siivoaLaatija(osuma[1] ?? "")
      if (nimi) return nimi
    }
  }
  return null
}

export function kaavanOsapuoli(teksti: string | null | undefined): string | null {
  if (!teksti) return null

  const puhdas = String(teksti).replace(/\s+/g, " ").replace(URL, " ").replace(SULKU, " ")

  for (const kuvio of KAIKKI) {
    kuvio.lastIndex = 0
    /*
     * KAIKKI OSUMAT, EI VAIN ENSIMMAINEN. Jos ensimmainen osuma hylataan
     * roolisanan takia, saman kuvion myohempi osuma voi olla oikea --
     * ensimmaiseen pysahtyminen hukkaisi sen.
     */
    for (const osuma of puhdas.matchAll(kuvio)) {
      const alku = (osuma.index ?? 0) + osuma[0].indexOf(osuma[1] ?? "")
      const ennen = puhdas.slice(Math.max(0, alku - 50), alku)
      if (ROOLI_ENNEN.test(ennen)) continue
      if (KATKAISSUT_JA.test(ennen)) continue

      const nimi = siivoaKaavanNimi(osuma[1] ?? "")
      if (nimi) return nimi
    }
  }

  return null
}
