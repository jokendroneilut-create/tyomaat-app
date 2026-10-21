/*
 * URAKOITSIJA TEKSTISTA (D-328).
 *
 * MIKSI. Johannes 22.10.2026 Lakeuslinjan jonorivista: *"tässä
 * kuvauksessa on mainittu: Urakoitsijaksi on valittu Leonhard Weiss Oü
 * ja Enersense PN Oy. lisää nämä hankkeeseen liittyviksi yrityksiksi."*
 * Fingrid kertoo urakoitsijan hankesivun tekstissä, mutta kerääjä ei
 * poiminut sitä mihinkään kenttään.
 *
 * VIISI SANAMUOTOA, jotka kaikki on havaittu oikeista kuvauksista:
 *
 *   1. "Urakoitsijaksi on valittu Leonhard Weiss Oü."
 *   2. "Pääurakoitsijana hankkeessa toimii italialainen
 *      Tecnolines Italia s.r.l."   <- sana urakoitsijan ja verbin välissä
 *   3. "Urakoitsijana toimii Enersense PN Oy."
 *   4. "Urakoitsija ENP Power Oy: Lauri Tolpanniemi"  <- otsikkomuoto,
 *      ei verbiä lainkaan; esittelee kyseisen urakoitsijan yhteyshenkilöt
 *   5. "sähköasemaurakoitsijaksi on valittu Hitachi Energy Finland Oy"
 *      <- yhdyssanan sisällä, joten sanarajaa ei voi vaatia eteen
 *
 * KAKSI VIRHETTA ENSIMMAISESSA VERSIOSSA, molemmat nolla-arvoisia ja
 * molemmat sellaisia ettei yhteenveto paljastanut niitä -- 1/56 näytti
 * uskottavalta tulokselta:
 *
 *   - `i`-lippu puuttui, joten vain pienellä kirjaimella alkavat osumat
 *     kelpasivat. "Urakoitsijaksi" virkkeen alussa ei osunut, mutta
 *     "sähköasemaurakoitsijaksi" osui.
 *   - Lopun `\b` ei toimi nimessä joka päättyy ä/ö/ü:hön, koska JS:n
 *     `\w` on ASCII. "Leonhard Weiss Oü." putosi juuri siihen.
 *
 * KIRJAINKOKO ON REGEXISSA, EIKA `i`-LIPPUA KAYTETA. Ensimmainen
 * korjaus lisasi `i`-lipun ja tarkisti ison alkukirjaimen koodissa --
 * ja se oli vaarin, vaikka se noudatti muistiin kirjattua ohjetta:
 * `i`-lipun alla regex osui PIDEMPAAN, pienella alkavaan ehdokkaaseen
 * ("toimii ITALIALAINEN Tecnolines Italia s.r.l."), ja koodin tarkistus
 * heitti osuman pois -- jolloin oikea nimi jai kokonaan loytymatta.
 *
 * Siksi avainsana kirjoitetaan merkkiluokilla (`[Uu]rakoitsija`) ja
 * nimen alkukirjain vaaditaan isoksi regexissa. Nain hylatty ehdokas ei
 * kuluta osumaa vaan jasennin jatkaa seuraavaan sanaan.
 *
 * Ohje "tee kirjainkoon tarkistus koodissa" patee LOOKAHEADIIN, jossa
 * osuman pituus ei muutu -- ei kaappaavaan osaan.
 */

/*
 * Yhtiömuoto on ainoa luotettava nimen loppumerkki. Ilman sitä poiminta
 * valuisi seuraavaan virkkeeseen, ja pelkkä pisteeseen katkaisu olisi
 * katkennut jo "Oy."-pisteeseen.
 */
const YHTIOMUOTO =
  "(?:Oyj|Oy|O[üÜu]|Ab|AS|A\\/S|GmbH|Ltd|Plc|SE|s\\.r\\.l\\.|S\\.p\\.A\\.|SpA|AG|BV|NV)"

/* Nimen runko: kirjaimet, numerot, &-merkki, piste, väliviiva, väli. */
const NIMI = `([A-ZÄÖÅÜ][\\wÄÖÅäöåÜü&.\\-/ ]{1,60}?\\s${YHTIOMUOTO})`

/*
 * Nimen jälkeen vaaditaan välimerkki tai loppu. `\\b` ei kelpaa, koska
 * se on ASCII-pohjainen eikä tunnista "Oü":n jälkeistä rajaa.
 */
const LOPPU = "(?=[\\s.,:;)]|$)"

/*
 * Verbimuoto. Yksi sana saa olla urakoitsijasanan ja verbin välissä
 * ("Pääurakoitsijana HANKKEESSA toimii"), ja verbin jälkeen saa olla
 * yksi määrite ("toimii ITALIALAINEN Tecnolines").
 */
const VERBILLA = new RegExp(
  `(?:[Pp][äa][äa])?[Uu]rakoitsija\\w*\\s+(?:\\w+\\s+){0,1}?(?:on\\s+)?` +
    `(?:[Vv]alittu|[Vv]alittiin|[Vv]alitsi|[Tt]oimii|[Tt]oimivat)\\s+` +
    `(?:[a-zäöå]+\\s+){0,1}?${NIMI}${LOPPU}`,
  "g"
)

/*
 * Otsikkomuoto: "Urakoitsija ENP Power Oy:" ilman verbiä. Kaksoispiste
 * vaaditaan, jotta "urakoitsijan edustajiin" ei osu.
 */
const OTSIKKONA = new RegExp(`(?:[Pp][äa][äa])?[Uu]rakoitsija\\s+${NIMI}\\s*:`, "g")

/* Nimi ei ala pienellä kirjaimella eikä pelkällä numerolla. */
function alkaaIsolla(nimi: string): boolean {
  const eka = nimi.trim().slice(0, 1)
  return eka !== "" && eka === eka.toUpperCase() && eka !== eka.toLowerCase()
}

/*
 * Nama eivat ole yrityksia vaan tilaajia tai yleisnimia, jotka osuvat
 * muotoon. Fingrid itse mainitaan lauseissa usein.
 */
const EI_URAKOITSIJA = /^(?:fingrid|valtioneuvosto|hankkeen|hanke|osuuden|lis[äa]tietoja)/i

export function poimiUrakoitsijat(teksti: string | null | undefined): string[] {
  const t = String(teksti ?? "").replace(/\s+/g, " ")
  if (!t) return []

  const osumat: string[] = []
  for (const kuvio of [VERBILLA, OTSIKKONA]) {
    for (const m of t.matchAll(kuvio)) {
      const nimi = m[1]?.replace(/\s+/g, " ").trim()
      if (!nimi) continue
      if (!alkaaIsolla(nimi)) continue
      if (EI_URAKOITSIJA.test(nimi)) continue
      osumat.push(nimi)
    }
  }

  /* Sama yritys voi esiintya monta kertaa; jarjestys sailyy. */
  const nahty = new Map<string, string>()
  for (const nimi of osumat) {
    const avain = nimi.toLowerCase().replace(/[.\s]+/g, " ").trim()
    const vanha = nahty.get(avain)
    if (!vanha || nimi.length > vanha.length) nahty.set(avain, nimi)
  }
  return [...nahty.values()]
}
