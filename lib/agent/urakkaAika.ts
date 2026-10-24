import { MONTHS } from "./parseFinnishCompletionDate"

/*
 * URAKKA-AIKA: VALMISTUMINEN AJANJAKSOSTA (D-342).
 *
 * Johannes 24.10.2026 Abackan sahkoaseman rivista: *"tasta ei ole
 * poimittu Arvioitu urakka-aika on huhtikuu 2026 - joulukuu 2026."*
 *
 * `parseEstimatedCompletionDate` vaatii VALMISTUMISSANAN ("valmistuu",
 * "luovutetaan", "kayttoon"). Hilman ja kuntien urakkailmoituksissa
 * valmistumista ei sanota lainkaan -- kerrotaan jakso, jonka loppu ON
 * valmistuminen. Mitattu 24.10.2026: 16 379 rivista 373:lla on
 * jaksolause, ja 260:lta puuttuu valmistuminen kokonaan.
 *
 * KOLME ASIAA JOIHIN TAMA EI SAA OSUA, kaikki aineistosta:
 *
 *   johdos        "rakennusaikaiset muutostyot", "Rakennusaikainen
 *                 tarina", "rakennusaikana", "sopimusaikana"
 *   ei paivaa     "urakka-aika alkaa kun sopimus on allekirjoitettu",
 *                 "Urakka-aika on esitetty urakkasopimusluonnoksessa"
 *   aikataululista "toteutusaikataulu on seuraava: hankesuunnitelman
 *                 hyvaksyminen 6/2026 toteutussuunnittelu 8/2026-2/2027"
 *
 * Johdokset karsiutuvat sananrajalla: "aika\b" ei osu sanaan
 * "aikainen" eika "aikana". Aikataululista karsiutuu IKKUNALLA: jakson
 * on alettava 40 merkin sisalla avainsanasta, ja listassa ensimmainen
 * vali on 70 merkin paassa. Mitattu molempiin suuntiin.
 *
 * SOPIMUSAIKA EI KELPAA LAINKAAN. Vuokramallissa sopimuskausi on
 * vuokrakausi, jonka loppu on vuosia valmistumisen jalkeen
 * ([[lease-period-is-not-build-period]]). Sama syy miksi Hilman
 * rakenteinen `sopimuskausi.loppu` on kielletty tassa kentassa
 * ([[hilma-contract-period]]).
 */

const KUUKAUDET = Object.keys(MONTHS).join("|")

/*
 * Avainsanat. Sananraja lopussa on se mika erottaa jakson johdoksesta,
 * joten `aikataulu` on lueteltava erikseen eika johdettavissa.
 */
const AVAINSANA = new RegExp(
  `(?:urakka-?aikataulu|urakka-?aika|toteutusaikataulu|toteutusaika|rakennusaika)\\b`,
  "giu"
)

/* Jakson on alettava tassa ikkunassa avainsanan jalkeen. */
const IKKUNA = 40
/* Jakso luetaan tasta ikkunasta: kaksi perakkaista valia mahtuu. */
const LUKUIKKUNA = 120

const VIIVA = "[-–—]"

/* "joulukuu 2026", "elokuuhun 2027", "kesäkuuta 2027" */
const KUUKAUSI_VUOSI = new RegExp(`(${KUUKAUDET})\\w*\\s+(\\d{4})`, "iu")
/* "05 / 2026", "12/2027" */
const KK_VUOSI = /(\d{1,2})\s*\/\s*(20\d{2})/
/* "24.9.2027" */
const PAIVA = /(\d{1,2})\.(\d{1,2})\.(20\d{2})/

function kuunViimeinen(vuosi: number, kuukausi: number): string | null {
  if (kuukausi < 1 || kuukausi > 12) return null
  if (vuosi < 2000 || vuosi > 2100) return null
  const paiva = new Date(Date.UTC(vuosi, kuukausi, 0)).getUTCDate()
  return `${vuosi}-${String(kuukausi).padStart(2, "0")}-${String(paiva).padStart(2, "0")}`
}

/* Jakson LOPPU yhdesta "alku – loppu" -parista. */
function jaksonLoppu(pala: string): string | null {
  const paiva = pala.match(PAIVA)
  if (paiva) {
    const [, p, k, v] = paiva
    const d = new Date(Date.UTC(Number(v), Number(k) - 1, Number(p)))
    if (d.getUTCMonth() !== Number(k) - 1 || d.getUTCDate() !== Number(p)) return null
    return d.toISOString().slice(0, 10)
  }

  const kk = pala.match(KK_VUOSI)
  if (kk) return kuunViimeinen(Number(kk[2]), Number(kk[1]))

  const nimi = pala.match(KUUKAUSI_VUOSI)
  if (nimi) return kuunViimeinen(Number(nimi[2]), MONTHS[nimi[1].toLowerCase()])

  return null
}

/*
 * "maaliskuusta 2024 elokuuhun 2027" -- elatiivi ja illatiivi ilman
 * viivaa. Oma kuvionsa, koska yleinen viivasaanto ei nae sita.
 */
const SIJAMUOTOJAKSO = new RegExp(
  `(?:${KUUKAUDET})\\w*sta\\s+\\d{4}\\s+(${KUUKAUDET})\\w*hun\\s+(\\d{4})`,
  "iu"
)

export function urakkaAjanLoppu(teksti: string | null | undefined): string | null {
  const t = String(teksti ?? "").replace(/\s+/g, " ")
  if (!t) return null

  const loput: string[] = []

  AVAINSANA.lastIndex = 0
  for (const osuma of t.matchAll(AVAINSANA)) {
    const alku = (osuma.index ?? 0) + osuma[0].length
    const ikkuna = t.slice(alku, alku + LUKUIKKUNA)

    /*
     * "AIKATAULU ON SEURAAVA" ON LISTA, EI JAKSO.
     *
     * Helsingin paatosteksteissa aikataulu annetaan luettelona, jonka
     * luetelmaviivat ovat tavallisia viivoja heti kaksoispisteen
     * jalkeen: *"toteutusaikataulu on seuraava:- suunnittelu 2020-
     * rakentaminen/kayttoonotto 9/2020 - 12/2020- muutto..."*. 40
     * merkin ikkuna ei riita erottamaan sita, koska ensimmainen viiva
     * on heti kiinni avainsanassa.
     *
     * Mitattu 24.10.2026: ilman tata kahdelle hankkeelle olisi
     * kirjattu suunnitteluvaiheen loppu valmistumiseksi -- Laakson
     * sairaalalle 2020-12-31 ja Kontulan terveysasemalle 2021-04-30,
     * molemmat vuosia menneisyydessa ja molemmat rivilla joka on yha
     * Suunnittelussa. Mennyt paiva siirtaisi hankkeen Valmistuneeksi
     * ja piilottaisi sen asiakkaalta (D-298, [[hiding-threshold]]).
     */
    if (/^\s*(?:on\s+)?seuraava/iu.test(ikkuna)) continue

    const sijamuoto = ikkuna.match(SIJAMUOTOJAKSO)
    if (sijamuoto && (sijamuoto.index ?? 99) <= IKKUNA) {
      const loppu = kuunViimeinen(Number(sijamuoto[2]), MONTHS[sijamuoto[1].toLowerCase()])
      if (loppu) loput.push(loppu)
      continue
    }

    /*
     * Kaikki viivan jalkeiset paivat ikkunasta, koska jaksoja voi olla
     * kaksi: "Urakka-aika on 5.10. – 31.12.2026 ja 3.5. – 11.6.2027".
     * Valmistuminen on naista MYOHAISIN.
     */
    /*
     * Viiva ei kuulu kaappaukseen: ilman tata ensimmainen osuma nieli
     * 30 merkkia eteenpain, siis myos TOISEN jakson viivan, ja parista
     * luettiin vain ensimmainen paiva (mitattu "5.10. - 31.12.2026 ja
     * 3.5. - 11.6.2027" -> 2026-12-31).
     */
    const viivat = [...ikkuna.matchAll(new RegExp(`${VIIVA}\\s*([^;,\\-–—]{0,30})`, "gu"))]
    let ensimmainen = true
    for (const v of viivat) {
      /*
       * VAIN ENSIMMAINEN VIIVA ON IKKUNASSA. Se erottaa jakson
       * aikataululistasta. Sen jalkeiset luetaan, koska toinen jakso
       * tulee vasta ensimmaisen perassa: "5.10. - 31.12.2026 ja
       * 3.5. - 11.6.2027".
       */
      if (ensimmainen && (v.index ?? 99) > IKKUNA) break
      ensimmainen = false
      const loppu = jaksonLoppu(v[1])
      if (loppu) loput.push(loppu)
    }
  }

  if (!loput.length) return null
  return loput.sort().at(-1) ?? null
}
