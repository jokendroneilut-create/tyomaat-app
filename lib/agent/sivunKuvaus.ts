import { extractReleaseBody } from "@/lib/agent/companyRelease"

/*
 * SIVUN TEKSTI HANKKEEN KUVAUKSEKSI (D-272).
 *
 * `extractReleaseBody` poimii tiedotteen rungon, mutta kasin lisattyjen
 * hankkeiden osoitteet osoittavat kaikenlaisille sivuille: yritysten
 * uutishuoneisiin, kuntien sivuille, paatosjarjestelmiin ja
 * myyntisivuille. Taman moduulin saannot torjuvat sen mika nayttaa
 * kuvaukselta olematta sellainen. JOKAINEN SAANTO ON LUETUSTA RIVISTA,
 * ei etukateen keksitty — perustelut kunkin kohdalla.
 */

export const MIN_KUVAUS = 200
export const MAX_KUVAUS = 1500

/*
 * EVASTEBANNERI ALUSSA. inderes.fi:n tiedote alkoi sanoilla
 * "YksityisyysasetuksetInderes kayttaa evasteita tarjotakseen paremman
 * kayttokokemuksen... Hyvaksy kaikkiVain..." — teksti on oikea, mutta
 * alussa on suostumuslomake.
 */
const EVASTEROSKA =
  /^.{0,600}?(hyvaksy kaikki|hyvaksy valitut|salli kaikki evasteet|hyväksy kaikki|hyväksy valitut|salli kaikki evästeet)[^.]{0,80}?(?=[A-ZÄÖ])/i

/*
 * NAVIGAATIO EI OLE KUVAUS. Kouvolan Dynasty-sivulta tuli
 * "Dynasty tietopalvelu Siirry suoraan paasisaltoon Kouvolan kaupunki
 * RSS Haku RSS-linkkiKokousasiat:https://..." — pelkkaa valikkoa.
 */
const NAVIROSKA =
  /siirry suoraan p(ä|a)(ä|a)sis(ä|a)lt(ö|o)(ö|o)n|dynasty tietopalvelu|rss-linkki|evästeasetukset|hyppää sisältöön|virhe päätöstä ladattaessa|went wrong loading decision|kirjaudu sisään tiedotteet|uutishuoneet tilaa tiedotteita|tietoa palvelusta yhteydenotto/i

export function onNavigaatiota(teksti: string): boolean {
  if (NAVIROSKA.test(teksti.slice(0, 400))) return true
  /* Kaksi osoitetta alussa = linkkilista, ei leipatekstia. */
  return (teksti.slice(0, 400).match(/https?:\/\//g) ?? []).length >= 2
}

/*
 * TIEDOTTEEN ALOITUSSANA ON PAREMPI ANKKURI KUIN EVASTELISTA.
 *
 * inderes.fi:n sivulla ennen varsinaista tekstia on evastebanneri,
 * vastuuvapauslauseke JA tekijanoikeusrivi — niita ei saa kiinni
 * yhdella hahmolla. Sen sijaan tiedote alkaa lahes aina sanalla
 * "Lehdistotiedote", "Tiedote" tai vastaavalla. Leikataan kaikki
 * VIIMEISEN aloitussanan edelta, jos sellainen on alkupaassa.
 */
const ALOITUSSANA =
  /(lehdist(ö|o)tiedote|pressmeddelande|press release|sijoittajauutinen|artikkeli julkaistu:?|tiedote)\s*/gi

function leikkaaAlkuroska(teksti: string): string {
  let viimeinen = -1
  let loppu = -1
  /*
   * IKKUNA ON KAPEA TAHALLAAN. 800 merkin ikkuna soi oikeaa tekstia:
   * Hartelan tiedote alkoi "Rakentaminen on alkanut maaliskuussa 2025,
   * ja kohde valmistuu alkusyksysta 2026..." ja sana "tiedote" esiintyi
   * vasta myohemmin — leikkaus vei alun pois. Sivupohja on lyhyt, joten
   * 150 merkkia riittaa.
   */
  for (const osuma of teksti.slice(0, 150).matchAll(ALOITUSSANA)) {
    viimeinen = osuma.index!
    loppu = osuma.index! + osuma[0].length
  }
  if (viimeinen < 0) return teksti
  const jaljella = teksti.slice(loppu).trim()
  /* Tyhja on pahempi kuin roskainen alku. */
  return jaljella.length >= MIN_KUVAUS ? jaljella : teksti
}

/*
 * Sivun kategorialinkit tekstina: "Ajankohtaista Rakentaminen
 * Toimitilarakentaminen Fira Oy ja Tokmanni ovat..."
 *
 * TARKISTUS ON KOODISSA, EI KUVIOSSA. Regexin `i`-lippu tekee
 * lookaheadista `(?=[A-ZÄÖÅ])` hyodyttoman, koska se osuu myos pieniin
 * kirjaimiin — ja silloin saanto soi virkkeen alun: "Rakentaminen on
 * alkanut maaliskuussa 2025" -> "on alkanut maaliskuussa 2025".
 * Kategoriasana poistetaan vain jos SEURAAVA sana alkaa isolla.
 */
const KATEGORIASANAT = new Set([
  "ajankohtaista",
  "uutiset",
  "tiedotteet",
  "media",
  "projektit",
  "kodit",
  "takaisin",
  "rakentaminen",
  "toimitilarakentaminen",
  "asuntorakentaminen",
  "asuntokirjasto",
  "vieraskynä",
  "kategoriat",
])

function poistaKategoriat(teksti: string): string {
  let t = teksti
  for (let i = 0; i < 4; i++) {
    const osat = t.split(/\s+/)
    if (osat.length < 3) break
    const eka = osat[0].replace(/[|›>-]$/, "").toLowerCase()
    if (!KATEGORIASANAT.has(eka)) break
    const seuraava = osat[1] ?? ""
    if (!/^[A-ZÄÖÅ]/.test(seuraava)) break
    t = osat.slice(1).join(" ")
  }
  return t
}

/*
 * Aloitussanan jalkeen jaa viela pikkuroskaa: pilkku ja kellonaika
 * ("...Lehdistotiedote, 30.1.2026 kello 14:00Toivo Group Oyj"),
 * jakonappi ("share") tai pelkka paivays. Siistitaan kaksi kierrosta,
 * koska ne esiintyvat perakkain.
 */
export function siistiAlku(teksti: string): string {
  let t = poistaKategoriat(teksti)
  for (let i = 0; i < 2; i++) {
    t = poistaKategoriat(t)
    t = t
      .replace(/^[\s,.:;|–-]+/, "")
      /* Murupolku: "Etusivu > Ajankohtaista > Tiedotteet > ..." */
      .replace(/^(etusivu|home|frontpage)\s*[>|›/]\s*([^>|›/]{1,40}[>|›/]\s*){0,4}/i, "")
      /* Videokehotteet ja ePressin sivupalkki. */
      .replace(/^(selaimesi ei tue videota|your browser does not support the video tag\.?)+\s*/i, "")
      .replace(/^kooste\s+sosiaalinen media[\s\S]{0,180}?twitter(\s+facebook\s+twitter)?\s*/i, "")
      /* "Olli Urpela Viestintapaallikko ..." — kirjoittajarivi ilman otsikkoa. */
      .replace(
        /^[A-ZÄÖÅ][a-zäöå]+\s+[A-ZÄÖÅ][a-zäöå]+\s+(viestint(ä|a)|markkinointi|tiedotus)[a-zäöå-]*(p(ä|a)(ä|a)llikk(ö|o)|johtaja)\s+/,
        ""
      )
      /* "Kirjoittaja X Viestintapaallikko Kategoriat Ajankohtaista ..." */
      .replace(/^(kirjoittaja|vieraskynä)\s+[A-ZÄÖÅ][^.]{0,60}?(kategoriat|ajankohtaista|rakentaminen)\s+/i, "")
      .replace(/^(share|jaa|tulosta|print|kopioi linkki)\s+/i, "")
      .replace(/^\d{1,2}\.\d{1,2}\.\d{4}(\s+kello\s+\d{1,2}[:.]\d{2})?\s*/, "")
      .trim()
  }
  return t
}

/* Katkaisu virkkeen rajalta, kuten muissakin poimijoissa. */
export function rajaaPituus(teksti: string): string {
  if (teksti.length <= MAX_KUVAUS) return teksti
  const leikattu = teksti.slice(0, MAX_KUVAUS)
  const piste = leikattu.lastIndexOf(". ")
  return piste > MAX_KUVAUS * 0.5 ? leikattu.slice(0, piste + 1) : `${leikattu.trim()}…`
}

/*
 * OSUUKO TEKSTI TAHAN HANKKEESEEN? Sivakan "Tulevia kohteita"
 * -listaussivu antoi tekstia, muttei tasta kohteesta. Vaaditaan etta
 * hankkeen kunta tai nimen harvinainen sana esiintyy tekstissa.
 */
export const YLEISSANA =
  /^(kerrostalo|rivitalo|asuinkerrostalo|hanke|rakennus|uusi|uudet|asunnot|asuntoja|koteja|laajennus|peruskorjaus|saneeraus|toimitilat|alue|alueen|keskus)$/i

export function osuukoHankkeeseen(teksti: string, nimi: string, kunta: string): boolean {
  const matala = teksti.toLowerCase()
  if (kunta && matala.includes(kunta.toLowerCase().slice(0, Math.max(4, kunta.length - 2))))
    return true
  for (const sana of nimi.split(/[^\wäöåÄÖÅ-]+/)) {
    if (sana.length < 6 || YLEISSANA.test(sana)) continue
    const kanta = sana.length > 7 ? sana.slice(0, -2) : sana
    if (matala.includes(kanta.toLowerCase())) return true
  }
  return false
}

/* Sovitut rajaukset: naihin isantiin ei kohdisteta pyyntoja. */
export const KIELLETYT =
  /mfiles\.lappeenranta\.fi|asiakirjat\.ouka\.fi|tweb|hyvinkaa\.fi|vantaa\.fi\/paatokset/i

export function normalisoi(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase()
}



/*
 * RAKENTAMISEN SANASTO. Arvatulta osoitteelta vaaditaan todiste siita
 * etta sivu puhuu rakentamisesta: mitattu 12.10.2026 etta ilman tata
 * "Kaupungintalon saneeraus" osui Kouvolan LIPUTUSKAYTANTOIHIN ja
 * "Kerrostalo Westend" Etuoven myynti-ilmoituslistaukseen.
 */
const RAKENNUSSANASTO =
  /rakenne(taan|tava)|rakentam|rakennust(yo|yö)|rakennusurakka|urakka|urakoi|urakoitsija|peruskorja|saneeraa|saneeraus|laajennus|laajenne|investoin|purkutyo|purkutyö|puretaan|valmistuu|hankkeen|kaavoit|rakennuslupa|rakennuttaa|toteuttaa/i

/*
 * LISTAUSSIVU: "Myytavat kerrostaloasunnot Westend, Espoo: 86 kpl".
 * Numero + kpl, tai monta hintaa, kertoo hakutuloslistasta.
 */
const LISTAUSSIVU = /\d+\s*kpl|hakuehdot|myytavat|myytävät|vapaat asunnot|sivu \d+ \/ \d+/i

export function puhuukoRakentamisesta(teksti: string): boolean {
  if (LISTAUSSIVU.test(teksti.slice(0, 400))) return false
  return RAKENNUSSANASTO.test(teksti)
}

/*
 * Koko ketju yhdessa: HTML -> siivottu kuvaus tai null.
 */
export function kuvausSivusta(html: string): string | null {
  const raaka = extractReleaseBody(html)
  if (!raaka) return null
  if (onNavigaatiota(raaka)) return null
  const teksti = rajaaPituus(siistiAlku(leikkaaAlkuroska(raaka.replace(EVASTEROSKA, "").trim())))
  return teksti.length >= MIN_KUVAUS ? teksti : null
}
