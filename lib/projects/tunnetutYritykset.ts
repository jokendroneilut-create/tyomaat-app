import { looksLikeCompany } from "@/lib/agent/companyName"

/*
 * TUNNETTU YRITYS KUVAUKSESTA LIITTYVAKSI YRITYKSEKSI (D-343).
 *
 * Johannes 24.10.2026: *"Eikö VAV Yhtymä Oy voi lisätä yrityslistaamme
 * ja sen avulla poimia sen aina ainakin hankkeeseen liittyväksi
 * yritykseksi? Nyt sitä ei oltu poimittu mihinkään."*
 *
 * MIKSI TAMA ONNISTUU KUN PAATTELEVA TILAAJAPOIMINTA EI.
 * Lauseesta paatteleva kuvio ("sopimuksen X:n kanssa") kaatui kahdesti
 * mitattuna: se poimi PAIKANNIMIA (Myllykoski, Niinivaara, Tapiola) ja
 * kaansi ROOLIN vaarin, kun julkaisija olikin tilaaja. Tunnettu nimi ei
 * voi olla paikannimi, eika "liittyva yritys" vaita roolia -- se ei siis
 * voi kirjata rakentajaa tilaajaksi.
 *
 * LISTA ON OMASTA DATASTA. Nimet jotka esiintyvat jo `developer`-,
 * `builder`- tai `related_companies`-kentissa: 1 631 yhtiomuodollista
 * nimea (24.10.2026). Lista kasvaa itsestaan kun uusia osapuolia
 * kirjataan, eika sita tarvitse yllapitaa kasin.
 */

export type TunnettuYritys = { nimi: string; kuvio: RegExp }

/*
 * ULKOMAINEN YHTIOMUOTO JA MUODOTON NIMI (24.10.2026).
 *
 * Ensimmainen versio vaati suomalaisen yhtiomuodon, jolloin KUMPIKAAN
 * Johanneksen nimeamista ei olisi paassyt listalle:
 *
 *   "Kinland AS"               norjalainen muoto puuttui listasta
 *   "Norlandia Health & Care"  ei yhtiomuotoa lainkaan
 *
 * Muodot luetaan nyt `companyName.ts`:n yhteisesta listasta
 * (`looksLikeCompany`), joka tuntee myos AS:n, Oü:n, B.V.:n ja GmbH:n.
 *
 * MUODOTON NIMI KELPAA, KUN IHMINEN ON SEN KENTTAAN KIRJOITTANUT.
 * Lista rakennetaan `developer`-, `builder`- ja
 * `related_companies`-kentista, eli nimen on jo pitanyt lapaista
 * katselmointi. Muotovaatimus suojasi roskalta, ei muodottomilta
 * nimilta -- ja roska karsitaan nyt omilla ehdoillaan: vahintaan kaksi
 * sanaa, ei julkisyhteison sanaa (kaupunki, kunta, virasto...) eika
 * kuntanimi. Ilman naita "Helsingin kaupunki" (563 esiintymaa) osuisi
 * joka helsinkilaiseen tekstiin.
 */
/*
 * KASIN LISATYT NIMET ILMAN YHTIOMUOTOA.
 *
 * Tanne lisataan nimi kerrallaan, kun se on todettu yritykseksi.
 * Johannes 24.10.2026: *"Norlandia Health & Care lisataan se
 * yrityslistaan"* -- konsernin nimessa ei ole yhtiomuotoa, joten se ei
 * paase listalle automaattisesti. Suomen-yhtiot (Norlandia Paivakodit
 * Oy) tulevat omalla muodollaan eivatka tarvitse tata.
 */
export const KURATOIDUT = ["Norlandia Health & Care", "Norlandia Hoiva"]

const JULKISYHTEISO =
  /\b(?:kaupunki|kaupungin|kunta|kunnan|seurakunta|seurakuntayhtym[äa]|kuntayhtym[äa]|hyvinvointialue|liikelaitos|virasto|ministeri[öo]|yliopisto|ammattikorkeakoulu|elinvoimakeskus|ELY|AVI)\b/i

/*
 * KATKENNUT NIMI EI KELPAA LISTALLE. Omissa kentissamme on aiemmin
 * katkenneita nimia ("Kiinteisto Oy", "Vesi Oy", "Suomi Oy"), ja
 * listalle paastyaan ne osuisivat lahes joka tekstiin.
 */
const KATKENNUT =
  /^(?:kiinteist[oö]|kiint\.?|as\.?|asunto|asunto-osakeyhti[oö]|bostads|fastighets|vesi|energia|suomi|finland|yhti[oö]|rakennus|palvelut|group)\s*-?\s*(?:oy|oyj|ab|abp|ky|ltd)\.?$/i

/*
 * VERKKOYHTIO EI OLE HANKKEEN OSAPUOLI.
 *
 * Helsingin katusuunnitelmapaatoksessa on vakioluettelo kadun alla
 * kaapeleita ja putkia omistavista yhtioista: *"Helsingin kaupunki,
 * HSY, Helen Oy, Helen Sahkoverkko Oy, Elisa Oyj, DNA Oyj, Telia
 * Finland Oyj, Auris Kaasunjakelu Oy, Cinia Cloud Oy. Sopimuksen
 * mukaisesti kukin sopimuksen allekirjoittanut osapuoli..."*
 *
 * Mitattu 24.10.2026: ilman tata rajausta ne olisivat **635 / 2 378**
 * eli 27 % kaikista lisatyista nimista -- neljannes kentasta samaa
 * vakioluetteloa. Ne eivat kerro hankkeesta mitaan, eika niille myyda
 * rakentamista.
 *
 * Rajaus koskee VAIN automaattista lisaysta. Jos verkkoyhtio on
 * hankkeen oikea rakennuttaja (Helenin oma voimalaitos), se on jo
 * kentassa eika tama koske sita.
 */
const VERKKOYHTIO =
  /^(?:helen|helen\s+s[äa]hk[öo]verkko|telia\s+finland|dna|elisa|caruna|auris\s+kaasunjakelu|cinia(?:\s+cloud)?|vantaan\s+energia\s+s[äa]hk[öo]verkot)\s+(?:oy|oyj|ab)$/i

/* Erotin: "A // B" tai "A, B" kun B alkaa isolla ([[party-role-fields]]). */
export function erotteleNimet(kentta: unknown): string[] {
  return String(kentta ?? "")
    .split(/\s*\/\/\s*|,(?=\s*[A-ZÅÄÖ])/)
    .map((n) => n.replace(/\s*\(\d[\d-]*\)\s*$/, "").trim())
    .filter(Boolean)
}

/*
 * LAUSE EI OLE NIMI. Kentissa on muutama kokonainen ilmaus ("Neve Oy:n
 * ja Merus Power", "Peabin ja YH Kotien yhteishanke"), ja listalle
 * paastyaan ne lisataan rivelle sellaisenaan.
 */
const LAUSE = /\s(?:ja|sekä|och)\s|:n\s/i

/*
 * TALOYHTIO ON HANKKEEN IDENTITEETTI, EI OSAPUOLI.
 *
 * Rakennuttajan tiedote luettelee usein muitakin kohteitaan, jolloin
 * toisen hankkeen taloyhtio paatyisi taman liittyvaksi yritykseksi:
 * mitattu 24.10.2026, helsinkilainen kerrostalo sai nimen "Asunto Oy
 * Oulun Graadi". Taloyhtio kuuluu omalle rivilleen, ja sinne se tulee
 * jo `housing_company`-kentasta -- ei tata kautta.
 *
 * Kiinteisto Oy EI ole tassa: se on usein aito tilaaja (kaavan hakija
 * "Kiinteisto Oy Myyrinmaki").
 */
const TALOYHTIO = /^(?:As\.?|Asunto|Bostads)[\s-]*(?:Oy|Ab)\b/i

export function kelpaaListalle(nimi: string): boolean {
  const n = nimi.trim()
  if (n.length < 6) return false
  if (LAUSE.test(n)) return false
  if (TALOYHTIO.test(n)) return false
  if (KATKENNUT.test(n) || VERKKOYHTIO.test(n)) return false
  if (JULKISYHTEISO.test(n)) return false

  /* Yhtiomuoto riittaa yksin: "Kinland AS", "Lujatalo Oy". */
  if (looksLikeCompany(n)) return true

  /*
   * MUODOTON NIMI KELPAA VAIN KURATOITUNA.
   *
   * Kokeiltu 24.10.2026 yleissaantona ("vahintaan kaksi isolla alkavaa
   * sanaa"): se olisi tuonut 311 lisaysta, mutta kenttien muodottomat
   * nimet ovat valtaosin julkisyhteisoja ja lauseita --
   * "Helsingin kaupunki" 1 445 rivia, "Kaupunki" 84, "Yksityinen" 31,
   * "Peabin ja YH Kotien yhteishanke", "Raksila 2.0, jonka muodostavat
   * SRV ja Trevian". Lisaksi hankkeen nimi paatyi listalle ("Garden
   * Helsinki"). Muotovaatimus siis suojaa oikeasti.
   *
   * Siksi muodoton nimi lisataan KASIN alla olevaan listaan, kuten
   * Johannes pyysi: *"lisataan se yrityslistaan"*. Ihminen vastaa
   * siita etta nimi on yritys eika hanke tai lause.
   */
  return KURATOIDUT.some((k) => k.toLowerCase() === n.toLowerCase())
}

/*
 * Yhtiomuoto ja valimerkit pois vertailua varten: "SRV" ja "SRV Yhtiot
 * Oyj" ovat sama yritys. Ilman tata tiedotteen otsikkorivi lisasi
 * pitkan muodon 126 kertaa riveille joilla lyhyt oli jo rakentajana.
 */
export function yritysRunko(nimi: string): string {
  return String(nimi ?? "")
    .toLowerCase()
    .replace(/\b(?:oy|oyj|ab|abp|ky|ltd|plc|gmbh)\b\.?/g, "")
    .replace(/[^\wåäö]+/g, " ")
    .trim()
}

export function teeKuviot(nimet: Iterable<string>): TunnettuYritys[] {
  const uniikit = new Map<string, string>()
  for (const nimi of nimet) {
    if (!kelpaaListalle(nimi)) continue
    const avain = nimi.trim().toLowerCase()
    if (!uniikit.has(avain)) uniikit.set(avain, nimi.trim())
  }

  /*
   * Pisin ensin: "Pohjola Rakennus Oy Suomi" ennen lyhyempaa osumaa,
   * jottei lista tuota samasta yrityksesta kahta merkintaa.
   */
  return [...uniikit.values()]
    .sort((a, b) => b.length - a.length)
    .map((nimi) => ({
      nimi,
      /*
       * SIJAPAATE SALLITAAN LOPUSSA. Ilman tata "Norlandia Hoivan
       * kanssa" ei osu nimeen "Norlandia Hoiva" -- suomessa nimi on
       * tekstissa lahes aina taivutettuna.
       */
      kuvio: new RegExp(
        `(?<![\\wÅÄÖåäö])${nimi.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}` +
          `(?:n|a|ä|lle|lla|llä|ssa|ssä|sta|stä|ksi|in)?(?![\\wÅÄÖåäö])`,
        "i"
      ),
    }))
}

/* Enintaan tama maara yhdelta rivilta: pidempi lista on kohinaa. */
export const ENINTAAN = 5

export function etsiTunnetutYritykset(
  teksti: string | null | undefined,
  lista: TunnettuYritys[],
  joTiedossa: Iterable<string> = []
): string[] {
  const t = String(teksti ?? "").replace(/\s+/g, " ")
  if (t.length < 40) return []

  const rungot = [...joTiedossa].map(yritysRunko).filter((r) => r.length >= 3)
  const loydetyt: string[] = []

  for (const { nimi, kuvio } of lista) {
    if (loydetyt.length >= ENINTAAN) break
    if (!kuvio.test(t)) continue

    const runko = yritysRunko(nimi)
    /* Sama yritys eri kirjoitusasussa ei ole uusi osapuoli. */
    if (rungot.some((r) => r.includes(runko) || runko.includes(r))) continue
    if (loydetyt.some((l) => yritysRunko(l).includes(runko))) continue

    loydetyt.push(nimi)
  }

  return loydetyt
}

/*
 * LISTAN LATAUS JA VALIMUISTI.
 *
 * Nimet luetaan `projects`-taulusta (jono antaa samat nimet). Vain
 * kolme saraketta haetaan, `related_companies` JSON-polkuna -- koko
 * metadatan vetaminen olisi moninkertainen tyo.
 *
 * Valimuisti on prosessikohtainen: discovery-ajo kasittelee satoja
 * ehdokkaita, ja ilman tata jokainen tekisi oman kyselynsa. Tunnin
 * ikkuna riittaa, koska uusi yritys tulee listalle vasta kun se on
 * kirjattu johonkin kenttaan.
 */
const VALIMUISTI_MS = 60 * 60 * 1000

let valimuisti: { lista: TunnettuYritys[]; haettu: number } | null = null

export function tyhjennaValimuisti(): void {
  valimuisti = null
}

export async function haeTunnetutYritykset(
  supabase: { from: (taulu: string) => any },
  nyt: number = Date.now()
): Promise<TunnettuYritys[]> {
  if (valimuisti && nyt - valimuisti.haettu < VALIMUISTI_MS) return valimuisti.lista

  const nimet: string[] = []
  for (let alku = 0; ; alku += 1000) {
    const { data, error } = await supabase
      .from("projects")
      .select("developer,builder,related:metadata->related_companies")
      .range(alku, alku + 999)

    /*
     * Virhe ei saa kaataa tuontia: ilman listaa liittyvat yritykset
     * jaavat poimimatta, mutta ehdokas menee silti jonoon.
     */
    if (error) break

    for (const rivi of (data ?? []) as any[]) {
      for (const kentta of [rivi.developer, rivi.builder]) {
        nimet.push(...erotteleNimet(kentta))
      }
      if (Array.isArray(rivi.related)) {
        for (const n of rivi.related) nimet.push(...erotteleNimet(n))
      }
    }
    if ((data ?? []).length < 1000) break
  }

  const lista = teeKuviot(nimet)
  valimuisti = { lista, haettu: nyt }
  return lista
}
