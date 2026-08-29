/*
 * PIETARSAAREN KAAVAN KUVAUS.
 *
 * Kohdesivulla jokainen kaava on jaettu h4-otsikoihin, joiden alla on
 * yksi kappale. Poimija otti kuvaukseksi ENSIMMÄISEN yli 40 merkin
 * kappaleen, jolloin mukaan tuli vain sijaintikuvaus ja hankkeen
 * tarkoitus jäi kokonaan pois:
 *
 *   Suunnittelualue        "Suunnittelualue sijaitsee noin 3 km torilta."   <- tämä
 *   Suunnittelun tarkoitus "Asemakaavan tavoitteena on mahdollistaa koko
 *                           Varvetin kehittäminen pientaloalueeksi."        <- tämä puuttui
 *
 * Juuri jälkimmäinen kertoo mitä alueelle on tulossa — eli sen mitä
 * myyjä hankkeesta haluaa tietää.
 *
 * Otsikot on sallittu nimeltä eikä poissuljettu: sivulla on 18
 * "Suunnittelualue"- ja 15 "Suunnittelun tarkoitus" -osiota, ja loput
 * ovat asiakirjoja ("Osallistumis- ja arviointisuunnitelma"),
 * henkilönimiä ("Suunnittelija") tai nähtävilläolotietoja, jotka
 * luetaan erikseen vaihesignaaliksi.
 */

export type KaavaNode = { tag: string; text: string }

/* Otsikot joiden alla on hankkeen sisältöä. */
const SISALTO_OTSIKOT = /^(suunnittelualue|suunnittelun tarkoitus|kaavan tarkoitus|tavoitteet?)$/i

/*
 * Otsikko joka on livahtanut kappaleen alkuun.
 *
 * Karsitaan VAIN kun otsikkoa seuraa uusi virke isolla alkukirjaimella
 * (".Suunnittelun tarkoitus On todettu tarve"). Muuten sama sana
 * katoaisi aidosta lauseesta "Suunnittelualue sijaitsee noin 3 km
 * torilta", jossa se on lauseen subjekti eika otsikko.
 */
const OTSIKKO_ALUSSA =
  /*
   * EI /i-LIPPUA: se mitatoisi ison alkukirjaimen vaatimuksen, jolloin
   * "Suunnittelualue sijaitsee" menisi myos katki.
   */
  /^[.\s]*[Ss](?:uunnittelun tarkoitus|uunnittelualue)\s+(?=[A-ZÄÖÅ])|^[.\s]*[Kk]aavan tarkoitus\s+(?=[A-ZÄÖÅ])/

/* Liitetiedosto ei ole kuvausta. */
const LIITE = /\.pdf$/i

export function pietarsaariKaavaDescription(nodes: KaavaNode[]): string | null {
  const palat: string[] = []
  let otsikko: string | null = null

  for (const node of nodes) {
    if (node.tag === "h3" || node.tag === "h4" || node.tag === "h5") {
      otsikko = node.text.trim()
      continue
    }

    if (node.tag !== "p") continue

    /*
     * Osassa kaavoista otsikko on kappaleen SISALLA eika omana
     * h4-elementtinaan (".Suunnittelun tarkoitus On todettu tarve...").
     * Se karsitaan alusta, jottei kuvaus ala lomakekielella.
     */
    const teksti = node.text.trim().replace(OTSIKKO_ALUSSA, "").trim()
    if (!teksti || LIITE.test(teksti)) continue
    if (!otsikko || !SISALTO_OTSIKOT.test(otsikko)) continue

    palat.push(teksti)
  }

  if (palat.length) return palat.join(" ")

  /*
   * VARALLA VANHA KÄYTÖS. Jos otsikot puuttuvat tai ne on nimetty
   * toisin, kuvaus otetaan ensimmäisestä riittävän pitkästä
   * kappaleesta — muuten sivun muutos tyhjentäisi kuvaukset
   * huomaamatta.
   */
  const varalla = nodes.find(
    (n) => n.tag === "p" && n.text.trim().length > 40 && !LIITE.test(n.text.trim())
  )

  return varalla ? varalla.text.trim() : null
}
