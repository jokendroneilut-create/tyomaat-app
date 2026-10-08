import { yritysavain } from "./yritysavain"

/*
 * HANKKEEN YRITYKSET ROOLEITTAIN (D-253).
 *
 * Johannes 8.10.2026, kun kysyin kuuluvatko aliurakoitsijat
 * rekisteriin: *"emmeko ole muodostamassa kuvaa verkostosta ja siina
 * toimivista ihmisista?"*
 *
 * Yritys liittyy hankkeeseen kolmella tavalla:
 *
 *   rakennuttaja    — `developer`
 *   paaurakoitsija  — `builder`
 *   osapuoli        — `metadata.related_companies` (D-248) ja
 *                     `metadata.aliurakoitsijat` ({ yritys, tyo })
 *
 * OSAPUOLI EI OLE OSTAJA. Rakennuttajan ja paaurakoitsijan ihminen on
 * se jolle myyja soittaa; aliurakoitsija tai suunnittelija on verkoston
 * jasen, ei hankkeen ostaja. Siksi rooli kulkee mukana koko ajan, eika
 * osapuolen avainta palauteta `hankkeenYritysavaimet`ista — se funktio
 * ohjaa mittaria (D-239) ja asiakkaan "yrityksen yhteyshenkilo" -riviä,
 * ja molemmat koskevat vain ostajapuolta.
 *
 * Jos sama yritys on seka urakoitsija etta related_companies-listalla,
 * se on urakoitsija: ostajapuolen rooli voittaa, eika samaa yritysta
 * nayteta kahdesti.
 */

export type YritysRooli = "rakennuttaja" | "paaurakoitsija" | "osapuoli"

export type HankkeenYritys = {
  avain: string
  /* Nimi sellaisena kuin hanke sen kertoo, ilman y-tunnusta. */
  nimi: string
  rooli: YritysRooli
  /* Aliurakoitsijan tyo, jos tiedossa ("vesikaton pintakermitys"). */
  tyo: string | null
}

export type YritysLahde = {
  developer?: string | null
  builder?: string | null
  metadata?: {
    related_companies?: unknown
    aliurakoitsijat?: unknown
  } | null
}

/* Avaimen vahimmaispituus — sama raja kuin hankkeenYritysavaimet. */
const MIN_AVAIN = 3

/*
 * Kentan nimet: sulut (y-tunnus, tarkenne) pois ENNEN pilkkujakoa,
 * koska sulkujen sisalla voi olla pilkku ("X Oy (rakenne, LVI)").
 */
export function kentanNimet(arvo: unknown): string[] {
  return String(arvo ?? "")
    .replace(/\([^)]*\)/g, " ")
    .split(/[,;]/)
    .map((osa) => osa.replace(/\s+/g, " ").trim())
    .filter(Boolean)
}

function merkkijonot(arvo: unknown): string[] {
  if (Array.isArray(arvo)) return arvo.filter((x): x is string => typeof x === "string")
  if (typeof arvo === "string") return [arvo]
  return []
}

function aliurakat(arvo: unknown): { yritys: string; tyo: string | null }[] {
  if (!Array.isArray(arvo)) return []
  const tulos: { yritys: string; tyo: string | null }[] = []
  for (const rivi of arvo) {
    if (!rivi || typeof rivi !== "object") continue
    const yritys = (rivi as { yritys?: unknown }).yritys
    const tyo = (rivi as { tyo?: unknown }).tyo
    if (typeof yritys !== "string" || !yritys.trim()) continue
    tulos.push({
      yritys,
      tyo: typeof tyo === "string" && tyo.trim() ? tyo.trim() : null,
    })
  }
  return tulos
}

export function hankkeenYritykset(hanke: YritysLahde): HankkeenYritys[] {
  const tulos: HankkeenYritys[] = []
  /* avain|rooli — sama yritys voi olla seka rakennuttaja etta urakoitsija. */
  const nahty = new Set<string>()
  const ostajapuoli = new Set<string>()

  const lisaa = (nimi: string, rooli: YritysRooli, tyo: string | null) => {
    const avain = yritysavain(nimi)
    if (avain.length < MIN_AVAIN) return
    if (rooli === "osapuoli" && ostajapuoli.has(avain)) return
    const tunniste = `${avain}|${rooli}`
    if (nahty.has(tunniste)) {
      /* Myohempi rivi voi tuoda tyon jota ensimmaisella ei ollut. */
      const olemassa = tulos.find((y) => y.avain === avain && y.rooli === rooli)
      if (olemassa && !olemassa.tyo && tyo) olemassa.tyo = tyo
      return
    }
    nahty.add(tunniste)
    if (rooli !== "osapuoli") ostajapuoli.add(avain)
    tulos.push({ avain, nimi, rooli, tyo })
  }

  for (const nimi of kentanNimet(hanke.developer)) lisaa(nimi, "rakennuttaja", null)
  for (const nimi of kentanNimet(hanke.builder)) lisaa(nimi, "paaurakoitsija", null)

  /*
   * Aliurakoitsijat ensin, jotta tyo tarttuu osapuoleen silloinkin kun
   * sama yritys on myos related_companies-listalla (yleensa on).
   */
  for (const { yritys, tyo } of aliurakat(hanke.metadata?.aliurakoitsijat)) {
    for (const nimi of kentanNimet(yritys)) lisaa(nimi, "osapuoli", tyo)
  }
  for (const kentta of merkkijonot(hanke.metadata?.related_companies)) {
    for (const nimi of kentanNimet(kentta)) lisaa(nimi, "osapuoli", null)
  }

  return tulos
}

/* Vain osapuolet: ne joita ostajapuolen avaimet eivat kata. */
export function hankkeenOsapuolet(hanke: YritysLahde): HankkeenYritys[] {
  return hankkeenYritykset(hanke).filter((y) => y.rooli === "osapuoli")
}

/*
 * Asiakkaalle nakyva nimi rooleineen: "Esimerkki Oy (osapuoli)" tai
 * "Esimerkki Oy (vesikaton pintakermitys)". Ilman merkintaa asiakas
 * voisi luulla aliurakoitsijaa ostajaksi.
 */
export function osapuolenNimi(yritys: Pick<HankkeenYritys, "nimi" | "tyo">): string {
  return `${yritys.nimi} (${yritys.tyo ?? "osapuoli"})`
}
