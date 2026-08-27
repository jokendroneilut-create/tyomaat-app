/*
 * GRANLUNDIN HANKKEEN TÄSMÄYTYS OLEMASSA OLEVAAN.
 *
 * Granlund on suunnittelija ja mukana vuosia ennen urakoitsijaa, joten
 * sama hanke on meillä usein jo toisesta lähteestä toisella nimellä.
 * Prisma Hyllykallio tuli Lujatalolta ja Granlund täydensi sen.
 *
 * MASSATÄSMÄYTYS EI OLE TURVALLISTA, ja se on mitattu 26.8.2026:
 *
 *   tuotannon vertailija (calculateMatch)
 *     >= 70   0 / 204      kynnys ei ylity kertaakaan
 *     50-69   9            sisältää sekä oikeita että vääriä
 *
 *   otsikon samankaltaisuus
 *     >= 0.90 2            molemmat oikein
 *
 * Harmaa vyöhyke on aidosti sekainen: 65 pistettä sai sekä oikea
 * "Helsingin kaupungintalon auditorion peruskorjaus" että väärä
 * "Anatomian rakennus -> Porthania peruskorjaus". Kynnyksen laskeminen
 * toisi siis virheitä, ja väärä täsmäytys yhdistää kaksi eri hanketta.
 *
 * Siksi kaksi tasoa: varma täsmäytys automaattisesti, epävarma
 * katselmoitavaksi.
 */

/* Otsikot vertaillaan ilman tarkkeita ja välimerkkejä. */
export function normalizeTitle(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFD")
    /* Yhdistyvät tarkemerkit koodipisteinä, jotta tiedosto kestää siirrot. */
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

/*
 * Levenshtein normalisoituna pituuteen: 1 = identtinen.
 *
 * Kirjoitusvirhe ei saa estää täsmäytystä: meillä hanke on
 * "saneeeraus" ja Granlundilla "saneeraus" — yhden kirjaimen ero, joka
 * tarkalla vertailulla jäisi huomaamatta.
 */
export function titleSimilarity(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 1

  const m = a.length
  const n = b.length
  /* Selvästi eripituiset eivät voi olla sama nimi. */
  if (Math.min(m, n) / Math.max(m, n) < 0.6) return 0

  const rivi = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    let edellinen = rivi[0]
    rivi[0] = i
    for (let j = 1; j <= n; j++) {
      const tmp = rivi[j]
      rivi[j] = Math.min(
        rivi[j] + 1,
        rivi[j - 1] + 1,
        edellinen + (a[i - 1] === b[j - 1] ? 0 : 1)
      )
      edellinen = tmp
    }
  }
  return 1 - rivi[n] / Math.max(m, n)
}

/*
 * VARMA: käytännössä sama nimi samassa kaupungissa. Mitattuna tämä
 * tuotti 2 osumaa 204:stä ja molemmat olivat oikein.
 */
export const CERTAIN_THRESHOLD = 0.9

/*
 * KATSELMOITAVA: tuotannon vertailijan pistemäärä, jolla osui sekä
 * oikeita että vääriä. Näitä ei täsmäytetä automaattisesti.
 */
export const REVIEW_THRESHOLD = 50

/*
 * Otsikko ilman valilyonteja, jotta yhdyssanaero ei erota samaa
 * rakennusta: "Finlandia-talo" ja "Finlandiatalo perusparannus" ovat
 * samasta talosta, vaikka sanarajat ovat eri kohdissa.
 */
export function compactTitle(value: string | null | undefined): string {
  return normalizeTitle(value).replace(/ /g, "")
}

/*
 * OTSIKKO TUNNISTAA RAKENNUKSEN, EI HANKETTA.
 *
 * Tama on mitattu virheesta 28.8.2026: jonossa ollut "Finlandia Talo"
 * (Skanskan sivulta, perusparannus 2017-2024) sai taydellisen 1.00
 * osuman Granlundin hankkeeseen "Finlandia-talo" - joka on vuosien
 * 2012-2015 peruskorjaus. Rikastus olisi kirjoittanut kaynnissa olevalle
 * hankkeelle valmistumisvuodeksi 2015.
 *
 * Siksi: jos samasta rakennuksesta on lahteessa useampi hanke, yhtaan ei
 * tasmayteta automaattisesti. Saanto hylkaa, ei hyvaksy, joten liian
 * herkka tunnistus johtaa vain katselmointiin - ei vaaraan tietoon.
 */
export function competingTitles(ourTitle: string, sourceTitles: string[]): number {
  const oma = compactTitle(ourTitle)
  if (!oma) return 0
  const omaValein = normalizeTitle(ourTitle)

  let n = 0
  for (const t of sourceTitles) {
    const lahde = compactTitle(t)
    if (!lahde) continue
    if (
      lahde.includes(oma) ||
      oma.includes(lahde) ||
      titleSimilarity(omaValein, normalizeTitle(t)) >= CERTAIN_THRESHOLD
    ) {
      n++
    }
  }
  return n
}
