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
  tarkkuus: "paiva" | "kuukausi"
  osuma: string
}

export function parseFinnishStartDate(teksti: string | null | undefined): Aloitus | null {
  const t = String(teksti ?? "").replace(/\s+/g, " ")
  if (!t) return null

  const tarkka = t.match(TARKKA_PAIVA)
  if (tarkka) {
    const [, d, m, y] = tarkka
    const kuukausi = Number(m)
    const paiva = Number(d)
    if (kuukausi >= 1 && kuukausi <= 12 && paiva >= 1 && paiva <= 31) {
      return {
        paiva: `${y}-${String(kuukausi).padStart(2, "0")}-${String(paiva).padStart(2, "0")}`,
        tarkkuus: "paiva",
        osuma: tarkka[0].slice(0, 120),
      }
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
    const avain = aiempi?.[1]?.toLowerCase() ?? kv[1].toLowerCase()
    const kuukausi = MONTHS[avain] ?? MONTHS[`${avain}kuu`]
    const vuosi = Number(kv[2])
    if (kuukausi && vuosi >= 2000 && vuosi <= 2100) {
      return {
        paiva: `${vuosi}-${String(kuukausi).padStart(2, "0")}-01`,
        tarkkuus: "kuukausi",
        osuma: kv[0].slice(0, 120),
      }
    }
  }

  const ua = t.match(URAKKA_AIKA)
  if (ua) {
    const kuukausi = Number(ua[1])
    /* "04-09/2026": alkuvuosi puuttuu, jolloin se on sama kuin loppu. */
    const vuosi = Number(ua[2] ?? ua[3])
    if (kuukausi >= 1 && kuukausi <= 12 && vuosi >= 2000 && vuosi <= 2100) {
      return {
        paiva: `${vuosi}-${String(kuukausi).padStart(2, "0")}-01`,
        tarkkuus: "kuukausi",
        osuma: ua[0].slice(0, 120),
      }
    }
  }

  return null
}
