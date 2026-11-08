/*
 * KAAVAN LOPPUTILA LÄHTEEN OMASTA VAIHETEKSTISTÄ (D-396).
 *
 * Johannes 8.11.2026: kaavahanke jää vaiheeseen "Kaavoitus" vaikka kaava
 * on jo tullut voimaan. Olemassa oleva `advance-effective-zoning` osaa
 * siirtää hankkeen eteenpäin, mutta se vaatii kaksi kenttää
 * (`kaava_tila = voimassa` ja `voimaantulo`-päivä), joita vain osa
 * kerääjistä tuottaa. Sivupohjaiset kaavalähteet antavat sen sijaan
 * VAIHETEKSTIN, ja se kertoo saman asian omin sanoin.
 *
 * SANASTO ON MITATTU, EI KEKSITTY. Luettu kannan 3 011 kaavoitusvaiheen
 * hankkeen lähdedokumenteista 8.11.2026; nämä muodot esiintyivät:
 *
 *   "Voimaantulo"                    "Lainvoimaisuus"
 *   "Kaava on saanut lainvoiman 20.10.2026"
 *   "Asemakaavamuutos kuulutetaan voimaan 17.8.2026."
 *   "Hyväksytty"                     "Kaavaprosessin keskeyttäminen"
 *
 * HYVÄKSYMINEN EI OLE LAINVOIMA. Valtuuston hyväksyntä alkaa
 * valitusajan, ja juuri siksi sivuilla lukee *"on hyväksytty
 * kaupunginvaltuustossa 30.9.2026, mutta se ei ole vielä
 * lainvoimainen"*. Hyväksyminen jää siis tämän säännön ulkopuolelle.
 *
 * KESKEYTETTY ON MYÖS LOPPUTILA, ja asiakkaan kannalta tärkeämpi kuin
 * moni muu: kuollut kaava näkyy listalla elävänä hankkeena. Se erotellaan
 * omaksi syykseen, jottei sitä sekoiteta lainvoimaan
 * ([[never-hide-on-missing-data]] koskee tuntematonta, ei tiedettyä).
 */

export type KaavanLopputila = {
  tila: "lainvoimainen" | "keskeytetty"
  /* ISO-päivä jos vaiheteksti sen kertoo. */
  paiva: string | null
  /* Teksti josta päätelmä tehtiin, raporttiin ja katselmointiin. */
  todiste: string
}

/*
 * "Voimaan" yksinään ei riitä: *"ehdotus asetetaan nähtäville ennen
 * voimaantuloa"* on kesken oleva kaava. Siksi kuviot vaativat joko
 * paljaan tilasanan (koko kenttä on "Voimaantulo") tai lauseen jossa
 * kaava on JO tullut voimaan.
 */
const PALJAS_LAINVOIMA = /^(voimaantulo|lainvoima(isuus|inen)?|voimassa|kaava\s+voimassa)$/i

const LAINVOIMALAUSE =
  /(saanut\s+lainvoiman|tullut\s+voimaan|tuli\s+voimaan|kuulutet(aan|tiin)\s+voimaan|astui\s+voimaan|on\s+lainvoimainen)/i

/* "ei ole vielä lainvoimainen" on päinvastainen väite. */
const KIELTO = /\b(ei\s+ole\s+(viel[äa]\s+)?lainvoimain|ei\s+viel[äa]\s+lainvoim)/i

const KESKEYTETTY =
  /(keskeytt[äa]minen|keskeytetty|kaavoitus\s+keskeytet|rauennut|rauetett|peruttu|kumottu)/i

/* "20.10.2026" tai "17.8.2026" vaiheen tekstistä. */
const PAIVA = /(\d{1,2})\.(\d{1,2})\.(\d{4})/

function isoPaiva(teksti: string): string | null {
  const m = teksti.match(PAIVA)
  if (!m) return null
  const [, d, kk, v] = m
  const paiva = new Date(Date.UTC(Number(v), Number(kk) - 1, Number(d)))
  if (Number.isNaN(paiva.getTime())) return null
  /* Tulevaisuuden päivä ei ole lainvoima vaan aikomus. */
  if (paiva.getTime() > Date.now()) return null
  return paiva.toISOString().slice(0, 10)
}

/*
 * KAAVAVAIHEIDEN JÄRJESTYS, sen verran kuin se on luotettavasti
 * tiedossa. Sanasto on kuntakohtaista, joten tunnistamaton teksti saa
 * sijan −1 eikä sitä verrata mihinkään.
 *
 * Käytetään VAIN taaksepäin menevän päivityksen estoon: kanta ei saa
 * unohtaa että kaava oli jo hyväksymisvaiheessa, jos sivu näyttää
 * hetkellisesti vanhempaa lohkoa. Sama periaate kuin `phaseAdvances`
 * hankkeen omassa vaiheessa — mitattu 8.11.2026: 9 päivitystä 208:sta
 * olisi mennyt taaksepäin.
 */
const VAIHEJARJESTYS = [
  "vireilletulo",
  "aloitus",
  "osallistumis",
  "luonnos",
  "valmistelu",
  "ehdotus",
  "hyväksy",
  "valitusaika",
  "voimaantulo",
  "lainvoima",
]

export function kaavavaiheenSija(vaiheteksti: string | null | undefined): number {
  const teksti = String(vaiheteksti ?? "").toLowerCase()
  if (!teksti.trim()) return -1
  let sija = -1
  VAIHEJARJESTYS.forEach((sana, i) => {
    if (teksti.includes(sana)) sija = Math.max(sija, i)
  })
  return sija
}

export function kaavavaiheMeneeTaaksepain(
  vanha: string | null | undefined,
  uusi: string | null | undefined
): boolean {
  const a = kaavavaiheenSija(vanha)
  const b = kaavavaiheenSija(uusi)
  if (a < 0 || b < 0) return false
  return b < a
}

export function kaavanLopputila(
  vaiheteksti: string | null | undefined
): KaavanLopputila | null {
  const teksti = String(vaiheteksti ?? "").replace(/\s+/g, " ").trim()
  if (!teksti) return null

  if (KESKEYTETTY.test(teksti)) {
    return { tila: "keskeytetty", paiva: isoPaiva(teksti), todiste: teksti }
  }

  if (KIELTO.test(teksti)) return null

  if (PALJAS_LAINVOIMA.test(teksti) || LAINVOIMALAUSE.test(teksti)) {
    return { tila: "lainvoimainen", paiva: isoPaiva(teksti), todiste: teksti }
  }

  return null
}
