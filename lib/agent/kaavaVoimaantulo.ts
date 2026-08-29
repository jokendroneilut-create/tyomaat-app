/*
 * KAAVAN VOIMAANTULOPÄIVÄ.
 *
 * Kaavalähteistä tunnistettiin että kaava on tullut voimaan, mutta ei
 * milloin. Mitattu 29.8.2026: 127 hanketta näkyi asiakkaalle vaiheessa
 * "Kaavoitus" vaikka lähde kertoi kaavan tulleen voimaan, ja niistä
 * **59:llä päivää ei ollut poimittu lainkaan**.
 *
 * Päivä ratkaisee sen mitä hanke on:
 *
 *   voimaan 2026   kaava on lainvoimainen, rakentaminen voi alkaa
 *                  -> paras hetki myydä
 *   voimaan 2012   kohde on rakennettu tai ei toteudu koskaan
 *                  -> roskaa listalla
 *
 * Ilman päivää näitä ei voi erottaa toisistaan.
 *
 * TIETO OLI JO SIVULLA. Seinäjoen käsittelyvaihelista on muotoa
 * "29.1.2020 Voimaantulopäivä" — kerääjä luki vaiheen nimen ja HEITTI
 * PÄIVÄN POIS rivin alusta (`replace(/^[\d.\s–-]+/, "")`).
 *
 * KUMOTTU EI OLE VOIMAAN TULLUT. Kaava jonka hallinto-oikeus on kumonnut
 * tai jonka lautakunta on lopettanut ei toteudu. Ne luettiin samaksi
 * kuin voimaantulo, koska molemmat päättävät kaavoituksen. Tämä moduuli
 * erottaa ne: `tila` kertoo kummasta on kyse.
 */

export type KaavaTila = "voimassa" | "kumottu" | "kesken"

export type KaavaPaatos = {
  tila: KaavaTila
  /* ISO-päivä (YYYY-MM-DD) tai null jos päivää ei ole rivillä. */
  paiva: string | null
  /* Rivi sellaisena kuin se lähteessä oli, jotta päätös on jäljitettävissä. */
  rivi: string | null
}

/* Kaava on lainvoimainen. */
const VOIMAAN =
  /voimaantul\w*|voimaan tullut|tullut voimaan|kuulutettu voimaan|lainvoima\w*|saanut lain\s?voiman/i

/*
 * Kaavoitus päättyi ILMAN kaavaa: valitus meni läpi tai työ lopetettiin.
 * Tarkistetaan ENNEN voimaantuloa, koska sama rivi voi sisältää molemmat
 * ("Vaasan hallinto-oikeus on kumonnut ... asemakaavan voimaantulon").
 */
const KUMOTTU =
  /kumon|kumottu|lopetettu|rauennut|rauetettu|hylätty|peruutettu|keskeytetty/i

const PAIVA = /(?<!\d)(\d{1,2})\.(\d{1,2})\.(\d{4})(?!\d)/

export function parseKaavaPaiva(rivi: string): string | null {
  const m = PAIVA.exec(rivi)
  if (!m) return null

  const paiva = Number(m[1])
  const kuukausi = Number(m[2])
  const vuosi = Number(m[3])

  if (kuukausi < 1 || kuukausi > 12 || paiva < 1 || paiva > 31) return null
  /*
   * Kaavoja on vireillä vuosikymmeniä, mutta 1900-luvun luku rivillä on
   * todennäköisemmin kiinteistötunnus tai kirjoitusvirhe kuin päivä.
   */
  if (vuosi < 1990 || vuosi > 2100) return null

  return `${vuosi}-${String(kuukausi).padStart(2, "0")}-${String(paiva).padStart(2, "0")}`
}

/*
 * PAIVA VOI OLLA AVAINSANAN KUMMALLA PUOLELLA TAHANSA.
 *
 * Seinäjoki kirjoittaa "29.1.2020 Voimaantulopäivä" ja Pornainen
 * "29.1.2007 Kunnanvaltuusto hyväksynyt, tullut voimaan: 26.11.2007".
 * Jos päivä otetaan aina avainsanaa EDELTÄVÄSTÄ kohdasta, Pornaisten
 * kaava saa hyväksymispäivän voimaantulopäiväkseen — kymmenen kuukautta
 * väärin. Tämä osui kuivaharjoituksessa 29.8.2026 ja löytyi vasta kun
 * yksittäinen rivi tarkistettiin lähteestä.
 *
 * Siksi haku on ankkuroitu AVAINSANAAN: ensin katsotaan sen jälkeen,
 * sitten sitä ennen.
 */
const IKKUNA = 80

function paivaAvainsanalle(
  teksti: string,
  avain: RegExp
): { paiva: string; rivi: string } | null {
  const haku = new RegExp(avain.source, "gi")
  let osuma: RegExpExecArray | null
  let viimeisin: { paiva: string; rivi: string } | null = null

  while ((osuma = haku.exec(teksti)) !== null) {
    const alku = osuma.index
    const loppu = alku + osuma[0].length

    const jalkeen = teksti.slice(loppu, loppu + IKKUNA)
    const ennen = teksti.slice(Math.max(0, alku - IKKUNA), alku)

    /* Jälkeen ensin: "tullut voimaan: 26.11.2007". */
    const paiva = parseKaavaPaiva(jalkeen) ?? viimeinenPaiva(ennen)
    if (!paiva) continue

    viimeisin = {
      paiva,
      rivi: teksti.slice(Math.max(0, alku - 40), loppu + 40).trim(),
    }
  }

  return viimeisin
}

/* Ennen avainsanaa oleva päivä on LÄHIN eli viimeinen, ei ensimmäinen. */
function viimeinenPaiva(teksti: string): string | null {
  const kaikki = teksti.match(/(?<!\d)\d{1,2}\.\d{1,2}\.\d{4}(?!\d)/g)
  if (!kaikki) return null
  for (let i = kaikki.length - 1; i >= 0; i--) {
    const p = parseKaavaPaiva(kaikki[i])
    if (p) return p
  }
  return null
}

/*
 * Lukee tekstin ja kertoo mihin kaavoitus päättyi.
 *
 * Kumoaminen voittaa voimaantulon: kaava jonka hallinto-oikeus on
 * kumonnut ei toteudu, vaikka sivulla lukisi myös voimaantulo — se on
 * juuri se päätös joka kumottiin.
 */
export function parseKaavaPaatosTekstista(teksti: string): KaavaPaatos {
  const siisti = String(teksti ?? "").replace(/\s+/g, " ")

  const kumottu = paivaAvainsanalle(siisti, KUMOTTU)
  if (kumottu) return { tila: "kumottu", paiva: kumottu.paiva, rivi: kumottu.rivi }

  const voimaan = paivaAvainsanalle(siisti, VOIMAAN)
  if (voimaan) return { tila: "voimassa", paiva: voimaan.paiva, rivi: voimaan.rivi }

  return { tila: "kesken", paiva: null, rivi: null }
}

/* Rivilista on vain tekstin erikoistapaus. */
export function parseKaavaPaatos(rivit: string[]): KaavaPaatos {
  return parseKaavaPaatosTekstista(
    rivit.map((r) => String(r ?? "").replace(/\s+/g, " ").trim()).filter(Boolean).join(" · ")
  )
}
