import { MONTHS } from "@/lib/agent/parseFinnishCompletionDate"

/*
 * RAKENTAMISEN ALOITUS TEKSTISTA, KUUKAUDEN TARKKUUDELLA (D-324).
 *
 * Johannes 20.10.2026: *"yritetaan hakea tuota aloituspaivaa kuukauden
 * tarkkuudella. katsotaan mita saadaan."*
 *
 * `construction_start` on taytetty 457 hankkeella 6 700:sta (6,8 %).
 * Teksteissa aloitus kuitenkin kerrotaan usein: "rakennustyot alkavat
 * toukokuussa 2026", "urakka-aika 04-09/2026", "rakentaminen kaynnistyi
 * tammikuussa 2025".
 *
 * KUUKAUDEN TARKKUUS, EI PAIVAN. Palautetaan kuukauden ENSIMMAINEN
 * paiva: aloitus tapahtuu kuukauden aikana, ja ensimmainen paiva on
 * ainoa jota ei tarvitse arvata. Tarkka paiva ("tyot alkavat 1.3.2026")
 * otetaan sellaisenaan.
 *
 * KOLME SAANTOA, JOTKA EIVAT SAA SEKOITTUA:
 *
 *   1. ALOITUS, ei valmistuminen. "valmistuu toukokuussa 2026" ei ole
 *      aloitus. Avainsana vaaditaan ENNEN paivaa, ja valmistumissanat
 *      katkaisevat haun.
 *   2. HANKKEEN aloitus, ei kaavan tai suunnittelun. "kaavoitus alkoi",
 *      "suunnittelu kaynnistyi" ja "YVA kaynnistyi" eivat kelpaa:
 *      niista on vuosia rakentamisen alkuun.
 *   3. MENNYT AIKAMUOTO KELPAA tassa, toisin kuin valmistumisessa:
 *      "rakentaminen alkoi huhtikuussa 2026" on nimenomaan se tieto
 *      jota haetaan. Riski on toinen: menneen muodon kohde voi olla
 *      VANHA rakennus ("rakennus valmistui 1962, purkutyot alkoivat
 *      2019"), joten vuosiluku ilman kuukautta hylataan.
 */

/* Mita aloitetaan: vain rakentaminen, ei kaava eika suunnittelu. */
const KOHDE = "(?:rakennusty[öo]t|rakennusurakka|rakentaminen|ty[öo]maa|urakka|purkuty[öo]t|purkaminen|peruskorjaus|saneeraus)"

/* Miten aloitus ilmaistaan. Mennyt muoto kelpaa. */
const ALKAA = "(?:alkaa|alkavat|alkoi|alkoivat|k[äa]ynnisty\\w+|aloitet\\w+|aloitta\\w+|p[äa][äa]stiin\\s+alkuun)"

/*
 * VUODENAIKA ALOITUKSENA (D-347).
 *
 * Johannes 25.10.2026 Nivalan aurinkovoimalasta: *"lisaa aloitus ja
 * valmistumispaiva jotka ovat loydettavissa tekstista"*. Teksti sanoo
 * *"Aurinkovoimalan rakentaminen alkaa kevaalla 2027"*, eika jasennin
 * tuntenut vuodenaikoja lainkaan -- vain kuukausinimia.
 *
 * KAUDEN ENSIMMAINEN KUUKAUSI, koska kentan lukutapa on "aikaisintaan
 * tasta". Kuukausiosuma palauttaa jo nyt kuukauden ensimmaisen paivan
 * samasta syysta. Valmistumisjasennin tekee painvastoin (kauden VIIMEINEN
 * kuukausi), ja se on tarkoituksellista: valmistuminen luetaan
 * "viimeistaan tahan mennessa".
 *
 * Kaudet ovat samat kuin valmistumisjasentimessa, jottei sama sana
 * tarkoita kahta eri jaksoa: kevat huhti-touko, kesa kesa-elo, syksy
 * syys-marras, talvi joulu-helmi.
 */
const KAUDET: Record<string, number> = {
  keväällä: 4,
  kesällä: 6,
  syksyllä: 9,
  talvella: 12,
}
const KAUSI_ALTERNAATIO = Object.keys(KAUDET).join("|")

const KUUKAUDET = Object.keys(MONTHS).join("|")
/* Yhdyssanan ensimmainen osa: "elo-syyskuussa" -> elo. */
const VARTALOT = Object.keys(MONTHS)
  .map((k) => k.replace(/kuu$/, ""))
  .join("|")

/*
 * Vali avainsanan ja paivan valilla. Piste katkaisee, jottei seuraavan
 * virkkeen paiva paady aloitukseksi -- sama syy kuin
 * valmistumisjasentimessa (GAP).
 */
const VALI = "[^.\\d]{0,40}?"

const KUUKAUSI_VUOSI = new RegExp(
  `${KOHDE}\\w*\\s+(?:\\w+\\s+){0,2}?${ALKAA}${VALI}\\b(${KUUKAUDET})\\w*\\s+(\\d{4})`,
  "i"
)

const KAUSI_VUOSI = new RegExp(
  `${KOHDE}\\w*\\s+(?:\\w+\\s+){0,2}?${ALKAA}${VALI}\\b(${KAUSI_ALTERNAATIO})\\s+(\\d{4})`,
  "i"
)

const TARKKA_PAIVA = new RegExp(
  `${KOHDE}\\w*\\s+(?:\\w+\\s+){0,2}?${ALKAA}${VALI}\\b(\\d{1,2})\\.(\\d{1,2})\\.(\\d{4})`,
  "i"
)

/*
 * URAKKA-AIKA. "Hanke urakoidaan ajanjaksolla 04-09/2026" ja
 * "urakka-aika 9/2026-12/2027": ensimmainen kuukausi on aloitus.
 * Oteranin jasennin lukee samasta muodosta LOPPUkuukauden (D-310);
 * tassa luetaan alku.
 */
const URAKKA_AIKA = new RegExp(
  `(?:ajanjaksolla|urakka-?aika\\w*|rakentamisaika\\w*)\\s*:?\\s*(\\d{1,2})(?:\\/(\\d{4}))?\\s*[-–]\\s*\\d{1,2}\\/(\\d{4})`,
  "i"
)

export type Aloitus = {
  paiva: string
  tarkkuus: "paiva" | "kuukausi" | "kausi"
  osuma: string
}

/*
 * SANEERAUS EI AINA OLE RAKENNUKSEN SANEERAUS (D-326).
 *
 * "Tärkeät Tekijät Oy hakeutui yrityssaneerausmenettelyyn ja se
 * aloitettiin 10.10.2022 Helsingin käräjäoikeuden päätöksellä."
 * KOHDE-listan `saneeraus` osui sanan sisälle, ja pääurakoitsijan
 * yrityssaneerauksen aloituspäivä päätyi hankkeen aloituspäiväksi.
 *
 * Sanarajaa ei voi vaatia KOHTEEN eteen, koska aidot yhdyssanat ovat
 * yleisiä ja arvokkaita: linjasaneeraus, putkisaneeraus,
 * julkisivusaneeraus. Siksi suljetaan nimetyt ei-rakentamiset.
 */
const EI_RAKENTAMISTA = /yrityssaneeraus|saneerausmenettely|velkajarjestely|velkaj[äa]rjestely|konkurssi/i

/*
 * YLI VIISI VUOTTA VANHA ALOITUS KERTOO HISTORIASTA (D-326).
 *
 * "Alakylän ohituskaistojen rakentaminen alkoi maaliskuussa 2014" --
 * virke on täydellinen osuma, mutta kohde on hankkeen JO VALMISTUNUT
 * aiempi osuus, jota kuvaus kertaa menneessä muodossa ("Hankkeessa
 * rakennettiin ... kokonaiskustannukset olivat").
 *
 * Kentän tarkoitus rajaa tämän: Johannes 21.10.2026 *"asiakkaat ovat
 * kiinnostuneita aloituspäivästä koska siitä voi päätellä kuinka
 * pitkällä hanke on nyt."* Yli viisi vuotta sitten alkanut hanke, joka
 * on yhä listalla, on joko vanhentunut rivi tai virke kertoo
 * historiasta -- kumpikaan ei palvele sitä päättelyä.
 *
 * Mitattu 22.10.2026: raja pudottaa yhden rivin 104:sta. Pitkät
 * suurhankkeet menettävät aidon aloituspäivänsä, mutta tyhjä on
 * parempi kuin väärä.
 */
const LIIAN_VANHA_VUOTTA = 5

/*
 * VALMISTUMISSANA AVAINSANAN JA PAIVAN VALISSA (D-326).
 *
 * "rakentaminen on aloitettu, ja se valmistuu tammikuun 2026" ja
 * "rakentaminen on aloitettu ja se valmistuu aikataulun mukaan
 * 30.11.2027": virke kertoo että aloitus on TAPAHTUNUT mutta ei
 * milloin, ja löytyvä päivä on valmistuminen. Oikea vastaus on tyhjä.
 *
 * Kumpikin haara tarvitsee tämän erikseen: ensimmäinen versio portista
 * oli vain kuukausi+vuosi-haarassa, ja tarkan päivän haara päästi
 * Vartiokylän koulun läpi.
 */
/*
 * AVAJAISET OVAT MYOS LOPPU, EI ALKU (D-347). Kuivaharjoitus 110
 * vuodenaikaosumasta nosti yhden vaaran: *"rakentaminen kaynnistyy nyt
 * paattyen avajaisiin kevaalla 2027"* -- kausi kuuluu avajaisiin, ja
 * alku on "nyt". Portti on sama kuin valmistumissanalla: jos sana on
 * avainsanan ja paivan VALISSA, paiva ei ole aloitus.
 */
const VALMISTUMISSANA =
  /valmistu|k[äa]ytt[öo][öo]n|luovute|valmista on|avaja|avataan|p[äa][äa]tty|valmiiksi/i

export function parseFinnishStartDate(
  teksti: string | null | undefined,
  nyt: Date = new Date()
): Aloitus | null {
  const t = String(teksti ?? "").replace(/\s+/g, " ")
  if (!t) return null

  const liianVanha = (paiva: string) => {
    const raja = new Date(nyt)
    raja.setFullYear(raja.getFullYear() - LIIAN_VANHA_VUOTTA)
    return paiva < raja.toISOString().slice(0, 10)
  }

  /*
   * JULKAISULEIMA EI OLE ALOITUSPAIVA (D-324). Uutissivun teksti
   * alkaa usein leimalla, joka osuu numeropaivahakuun: "rakentaminen
   * alkaa Uutiset 5.2.2026". Mitattu 21.10.2026: yksi viidesta
   * "vahvistetusta" aloituspaivasta oli tata.
   */
  const JULKAISUSANA = /\b(uutiset|uutinen|julkaistu|tiedote|artikkeli|blogi)\b/i

  const tarkka = t.match(TARKKA_PAIVA)
  if (tarkka && JULKAISUSANA.test(tarkka[0])) {
    /* Leima syo numeropaivan, mutta kuukausinimi voi yhä kelvata. */
  } else if (tarkka) {
    const [, d, m, y] = tarkka
    const kuukausi = Number(m)
    const paiva = Number(d)
    const ehdotus = `${y}-${String(kuukausi).padStart(2, "0")}-${String(paiva).padStart(2, "0")}`
    if (
      kuukausi >= 1 &&
      kuukausi <= 12 &&
      paiva >= 1 &&
      paiva <= 31 &&
      !EI_RAKENTAMISTA.test(tarkka[0]) &&
      !VALMISTUMISSANA.test(tarkka[0].slice(0, tarkka[0].lastIndexOf(d))) &&
      !liianVanha(ehdotus)
    ) {
      return { paiva: ehdotus, tarkkuus: "paiva", osuma: tarkka[0].slice(0, 120) }
    }
  }

  const kv = t.match(KUUKAUSI_VUOSI)
  if (kv) {
    /*
     * VUODETON KUUKAUSI ENNEN OSUMAA ON SE OIKEA (D-324).
     *
     * "rakennustyot alkavat huhtikuussa ja valmista on arviolta
     * lokakuussa 2026" -- vuosi on kiinni VALMISTUMISkuukaudessa, joten
     * kuukausi+vuosi-haku osui lokakuuhun. Sama "alkaa elo-syyskuussa
     * 2026" -ssa: aloitus on elokuu. Jos osuman ja avainsanan valissa
     * on toinen kuukausi ilman vuotta, se on aloitus ja vuosi lainataan
     * loytyneesta. Mitattu 20.10.2026: kolme osumaa kuudestatoista oli
     * tata, ja kaikissa kannassa oleva arvo oli oikeampi kuin poiminta.
     */
    const alku = kv[0]
    const ennen = alku.slice(0, alku.toLowerCase().lastIndexOf(kv[1].toLowerCase()))
    /*
     * Kuukausivali kirjoitetaan yhdyssanana: "elo-syyskuussa 2026".
     * Ensimmainen osa on pelkka vartalo ilman "kuu"-paatetta, joten
     * kokonaisten nimien lista ei osu siihen.
     */
    const aiempi =
      ennen.match(new RegExp(`\\b(${KUUKAUDET})\\w*`, "i")) ??
      ennen.match(new RegExp(`\\b(${VARTALOT})\\s*[-–]\\s*$`, "i"))
    /*
     * VALMISTUMISSANA VALISSA: KUUKAUSI ON VALMISTUMINEN (D-326).
     *
     * "rakentaminen on aloitettu, ja se valmistuu tammikuun 2026" --
     * vuosi on kiinni VALMISTUMISkuukaudessa, eika aiempaa vuodetonta
     * kuukautta ole, joten edellinen sääntö ei pelastanut: jäsennin
     * palautti tammikuun aloituksena. Virke kertoo että aloitus on
     * TAPAHTUNUT mutta ei milloin -- oikea vastaus on tyhjä.
     *
     * Tarkistus tehdään vain kun aiempaa kuukautta EI löytynyt: jos se
     * löytyi, se on aloitus ja valmistumissana kuuluu sen jälkeiseen
     * osaan ("alkavat huhtikuussa ja valmista on lokakuussa 2026").
     */
    if (!aiempi && VALMISTUMISSANA.test(ennen)) return null

    const avain = aiempi?.[1]?.toLowerCase() ?? kv[1].toLowerCase()
    const kuukausi = MONTHS[avain] ?? MONTHS[`${avain}kuu`]
    const vuosi = Number(kv[2])
    const ehdotus = `${vuosi}-${String(kuukausi).padStart(2, "0")}-01`
    if (
      kuukausi &&
      vuosi >= 2000 &&
      vuosi <= 2100 &&
      !EI_RAKENTAMISTA.test(kv[0]) &&
      !liianVanha(ehdotus)
    ) {
      return { paiva: ehdotus, tarkkuus: "kuukausi", osuma: kv[0].slice(0, 120) }
    }
  }

  const kausi = t.match(KAUSI_VUOSI)
  if (kausi) {
    const alku = kausi[0]
    const ennen = alku.slice(0, alku.toLowerCase().lastIndexOf(kausi[1].toLowerCase()))
    /* Sama portti kuin kuukausihaarassa: valmistumissana valissa = ei aloitus. */
    if (!VALMISTUMISSANA.test(ennen)) {
      const kuukausi = KAUDET[kausi[1].toLowerCase()]
      const vuosi = Number(kausi[2])
      const ehdotus = `${vuosi}-${String(kuukausi).padStart(2, "0")}-01`
      if (
        kuukausi &&
        vuosi >= 2000 &&
        vuosi <= 2100 &&
        !EI_RAKENTAMISTA.test(alku) &&
        !liianVanha(ehdotus)
      ) {
        return { paiva: ehdotus, tarkkuus: "kausi", osuma: alku.slice(0, 120) }
      }
    }
  }

  const ua = t.match(URAKKA_AIKA)
  if (ua) {
    const kuukausi = Number(ua[1])
    /* "04-09/2026": alkuvuosi puuttuu, jolloin se on sama kuin loppu. */
    const vuosi = Number(ua[2] ?? ua[3])
    const ehdotus = `${vuosi}-${String(kuukausi).padStart(2, "0")}-01`
    if (
      kuukausi >= 1 &&
      kuukausi <= 12 &&
      vuosi >= 2000 &&
      vuosi <= 2100 &&
      !liianVanha(ehdotus)
    ) {
      return { paiva: ehdotus, tarkkuus: "kuukausi", osuma: ua[0].slice(0, 120) }
    }
  }

  return null
}
