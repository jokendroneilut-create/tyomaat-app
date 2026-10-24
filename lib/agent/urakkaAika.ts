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

/*
 * JAKSON VIIVA, EI YHDYSMERKKI (korjattu 24.10.2026).
 *
 * Avainsana itse sisaltaa yhdysmerkin, ja ilmoituksissa se toistuu
 * otsikkona ja virkkeena perakkain: *"URAKKA-AIKA Urakka-aika on
 * 15.12.2026 - 22.2.2026"*. Ensimmaisen osuman ikkunassa ensimmainen
 * viiva oli silloin sanan `Urakka-aika` oma yhdysmerkki, ja sen
 * jalkeinen pala "aika on 15.12.2026" luki ALKUPAIVAN loppupaivaksi.
 *
 * Viiva kelpaa vain numeron, pisteen tai valilyonnin jalkeen, ja sen
 * jalkeen on tultava numero tai valilyonti. Piste on sallittava, koska
 * suomalainen lyhennetty jakso paattyy siihen: "1.3.-15.6.2027" ja
 * "1.10.-31.12.2026" (mitattu kahdella rivilla, jotka ensimmainen
 * tiukempi versio hylkasi). Kirjainten valinen yhdysmerkki ei kelpaa.
 */
const VIIVA = "(?<=[\\d\\s.])[-–—](?=[\\d\\s])"

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

/*
 * "VALMIINA X MENNESSA" (D-342 jatko).
 *
 * Johannes 24.10.2026: *"lisaa myos muoto 'sen tulee olla valmiina
 * 30.6.2027 mennessa'."* Muoto loytyi rivilta, jolla jakso ei kertonut
 * valmistumista -- eika kumpikaan jasennin tunne sita:
 * `parseEstimatedCompletionDate` vaatii oman avainsanansa EIKA osaa
 * paivamuotoa 30.6.2027 lainkaan.
 *
 * ANKKURI ON "VALMIINA", EI "VIIMEISTAAN". Mitattu 24.10.2026: sana
 * "viimeistaan + paiva" esiintyy 316 rivilla, ja valtaosa on muiden
 * asioiden maaraaikoja -- *"mielipiteet tulee toimittaa viimeistaan
 * 5.12.2025"*, *"ilmoittautumaan tilaisuuteen viimeistaan 17.8.2026"*,
 * *"muistutukset tulee jattaa viimeistaan 6.7.2026"*. Pelkka
 * "viimeistaan" olisi kirjannut kaavan kuulutusajan hankkeen
 * valmistumiseksi.
 *
 * Siksi ankkuri on valmiusssana, ja paiva luetaan sen jalkeisesta
 * lyhyesta ikkunasta -- "viimeistaan" ja "mennessa" saavat olla
 * valissa mutta eivat yksin riita.
 */
const VALMIS_ANKKURI =
  /\bvalmii(?:na|t|ksi|den)\b|\bvalmis\b|\bluovutettavissa\b|\bluovutuskunnossa\b/giu

/* Ikkuna valmiussanan jalkeen: "osalta viimeistaan 30.10.2026" mahtuu. */
const VALMIS_IKKUNA = 70

/*
 * SUUNNITELMA EI OLE HANKE. Sama rajaus kuin
 * `parseEstimatedCompletionDate`issa (D-298): virke jonka aihe on
 * selvitys, suunnitelma tai lupa jatetaan lukematta, koska sen
 * valmistuminen ei ole hankkeen valmistuminen.
 */
const EI_HANKKEEN_VALMIUS =
  /selvity|suunnitelm|suunnittelu|hakemus|tarjous|lupa|asiakirja|piirustu|kaava/iu

export function valmiinaMennessa(teksti: string | null | undefined): string | null {
  const t = String(teksti ?? "").replace(/\s+/g, " ")
  if (!t) return null

  const loydetyt: string[] = []

  VALMIS_ANKKURI.lastIndex = 0
  for (const osuma of t.matchAll(VALMIS_ANKKURI)) {
    const alku = (osuma.index ?? 0) + osuma[0].length

    /* Virke ankkurin ymparilta: onko aihe hanke vai asiakirja? */
    const virkeAlku = t.lastIndexOf(". ", osuma.index ?? 0) + 1
    const virkeLoppu = t.indexOf(". ", alku)
    const virke = t.slice(virkeAlku, virkeLoppu === -1 ? t.length : virkeLoppu)
    if (EI_HANKKEEN_VALMIUS.test(virke)) continue

    const paiva = jaksonLoppu(t.slice(alku, alku + VALMIS_IKKUNA))
    if (paiva) loydetyt.push(paiva)
  }

  if (!loydetyt.length) return null
  return loydetyt.sort().at(-1) ?? null
}

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

  const loppu = loput.sort().at(-1) ?? null
  if (!loppu) return null

  /*
   * LOPPU ENNEN ALKUA ON LAHTEEN VIRHE, EI JAKSO.
   *
   * Mitattu 24.10.2026: *"Urakka-aika on 15.12.2026 - 22.2.2026"* --
   * loppuvuosi on jaanyt kirjoittamatta (2027). Jaksoa ei voi lukea
   * oikein, joten kentta jatetaan tyhjaksi: vaara valmistuminen
   * siirtaa hankkeen Valmistuneeksi ja piilottaa sen asiakkaalta
   * (D-298).
   */
  const alku = jaksonAlku(t)
  if (alku && loppu < alku) return null

  return loppu
}

/*
 * Jakson ALKU samasta lauseesta, vain jarkevyystarkistusta varten.
 * Ensimmainen paivays avainsanan jalkeen ennen viivaa.
 */
function jaksonAlku(teksti: string): string | null {
  AVAINSANA.lastIndex = 0
  for (const osuma of teksti.matchAll(AVAINSANA)) {
    const alku = (osuma.index ?? 0) + osuma[0].length
    const ikkuna = teksti.slice(alku, alku + IKKUNA)
    const ennenViivaa = ikkuna.split(new RegExp(VIIVA, "u"))[0] ?? ""
    const paiva = jaksonLoppu(ennenViivaa)
    if (paiva) return paiva
  }
  return null
}
