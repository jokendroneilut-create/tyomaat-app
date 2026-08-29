/*
 * HTML-SIVUN TEKSTI KUVAUKSEKSI.
 *
 * Cheerion `.text()` liittää peräkkäisten elementtien tekstit ILMAN
 * erotinta. Siitä syntyi sama vika kahdella eri lähteellä (havaittu
 * 29.8.2026):
 *
 *   Lujatalo   "...ExtensionLujatalo toteuttaa..."
 *              "...kanssa:https://...https://..."
 *   Skanska    "Asiakas:MonikäyttäjätaloPalvelu:Projektikehitys..."
 *              "...Valitse maaEuropeNorth AmericaSiirry Group sivustolle"
 *
 * Siksi teksti kootaan lohkoelementeittäin. Jaettu moduuli, koska
 * kolmas lähde törmää samaan.
 *
 * HUOM: kaikki poimijat EIVÄT halua tätä. Skanskan kenttäpoiminta
 * nojaa nimenomaan erottimettomaan muotoon ("StatusKäynnissä"), joten
 * siellä tätä käytetään vain kuvaukseen.
 */

export function blockText($: any): string {
  const palat: string[] = []

  $("h1, h2, h3, h4, p, li, td, th, blockquote").each((_: any, el: any) => {
    const teksti = $(el).text().replace(/\s+/g, " ").trim()
    if (!teksti) return
    /* Pelkkä osoite tai osoitejono ei ole kuvausta. */
    if (/^(?:https?:\/\/\S+\s*)+$/i.test(teksti)) return
    palat.push(teksti)
  })

  return palat.join(" ").replace(/\s+/g, " ").trim()
}

/*
 * Sivun loppu on usein navigaatiota jota `nav`/`footer`-poisto ei
 * tavoita: maavalitsin, karttaupotus, evästeteksti. Katkaistaan
 * ensimmäisestä tunnistetusta merkistä.
 */
export function cutAtFirstMarker(text: string, markers: RegExp): string {
  const s = String(text ?? "")
  const m = markers.exec(s)
  if (!m || m.index <= 0) return s.trim()
  return s.slice(0, m.index).trim()
}

/*
 * Linkkilistan poiston jälkeen sen otsikko jää roikkumaan:
 * "...vuonna 2025. Lisää yhteistyöhankkeista Wärtsilän kanssa:".
 * Kaksoispisteeseen päättyvä viimeinen katkelma ei kerro mitään ilman
 * listaa, joten se karsitaan.
 */
export function trimDanglingLabel(text: string): string {
  return String(text ?? "")
    .replace(/(?:^|(?<=[.!?]))\s*[^.!?]{0,90}:\s*$/, "")
    .trim()
}

/*
 * "Hankkeen laajuus on noin 11 000 bruttoneliömetriä".
 *
 * Kohdesivuilla on usein rakenteinen laajuuskenttä, mutta ei aina:
 * Wärtsilän laajennuksessa ja Skanskan Firdossa luku oli vain
 * leipätekstissä, jolloin se jäi kokonaan poimimatta ja hankkeen
 * mittaluokka jäi katselmoijalta arvailun varaan.
 *
 * Tuhaterotin sallitaan vain kolmen numeron ryhmissä, jottei luku hyppää
 * kahden luvun yli (sama ansa kuin asuntosäätiöpoimijassa).
 */
export function parseScopeFromText(text: string): string | null {
  const m =
    /(?<!\d)(\d{1,3}(?:\s\d{3})*)\s*(bruttoneliömetri[aä]?|brm2|brm²|brm|kerrosneliömetri[aä]?|k-m2|neliömetri[naä]?|m²)/i.exec(
      String(text ?? "")
    )
  if (!m) return null

  const luku = Number(m[1].replace(/\s/g, ""))
  if (!Number.isFinite(luku) || luku <= 0) return null

  return `${m[1].trim()} ${m[2]}`
}

/*
 * Sivun hännästä jää usein pelkkiä otsikoita ilman sisältöä:
 * "...puhtaan sisäilman. Sijainti". Ne eivät kerro hankkeesta mitään,
 * joten ne karsitaan lopusta.
 */
const HANTAOTSIKOT = /\s*(Kuvia|Sijainti|Yhteystiedot|Jaa|Lisätietoja|Materiaalit)\s*$/i

export function trimTrailingHeadings(text: string): string {
  let s = String(text ?? "").trim()
  for (let i = 0; i < 5; i++) {
    const uusi = s.replace(HANTAOTSIKOT, "").trim()
    if (uusi === s) break
    s = uusi
  }
  return trimDanglingLabel(s)
}
