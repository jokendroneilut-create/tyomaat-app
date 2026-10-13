/*
 * YMPÄRISTÖLUPA-ASIAN KUVAUS ASIAKIRJASTA.
 *
 * Miksi tämä on olemassa. Ympäristölupalähde löytää juuri ne yksityiset
 * teollisuus-, energia- ja datakeskushankkeet, joita ei näy Hilmassa
 * eikä kaavoissa — mutta hakurajapinta antaa niistä vain otsikon,
 * hakijan ja diaarinumeron. Jonoriville kirjoittui siksi kuvaukseksi
 * "Ympäristölupa-asia (diaarinro LSSAVI/26273/2025). Hakija: Berner Oy."
 * eli 79 merkkiä, jossa ei lue sanaakaan siitä mitä rakennetaan.
 *
 * Mitattu 13.10.2026: tämän lähteen jonoriveistä hyväksyttiin 47 %
 * (kuvauksen mediaani 79 merkkiä), kun YVA-lähteestä — samaa toimialaa,
 * sama katselmoija, mutta rikastin olemassa — hyväksyttiin 85 %
 * (mediaani 4 892 merkkiä). Hylkäys ei siis johtunut hankkeesta vaan
 * siitä ettei siitä kerrottu mitään. Ks. [[description-is-the-product]].
 *
 * Mistä teksti tulee. Asian asiakirjat saa rajapinnasta
 * `/api/v1/cases/actions/{id}` ja itse tiedoston osoitteesta
 * `/api/v1/documents/attachment/{attachmentId}`. Kahdessa asiakirja-
 * tyypissä on vakioluku, josta kuvaus irtoaa:
 *
 *   KUULUTUS  luku "6 Asian pääasiallinen sisältö" — syntyy jo
 *             vireilletulovaiheessa ja on pieni (3 sivua, ~100 kt).
 *   PÄÄTÖS    luku "Toiminta" sivulla 1 — syntyy vasta päätöksestä ja
 *             on iso (48-69 sivua, 0,4-5,7 Mt).
 *
 * Kuulutus on siksi ensisijainen: se on sekä aikaisempi että halvempi.
 *
 * "Vireilletulotiedot" EI kelpaa vaikka nimi lupaa: mitattu sisältö on
 * 287 merkkiä, joista kaikki on diaarinumeroa ja päivämäärää.
 */

export type Asiakirja = {
  attachmentId: number | string
  name: string
  extension?: string | null
  contentLengthKB?: number | null
}

/* Nimestä päätellään tyyppi; rajapinta ei kerro sitä erikseen. */
const KUULUTUS = /kuulutus/i
const PAATOS = /p[aä]{1,2}t[oö]s/i
const HYODYTON = /vireilletulotiedot|saateki|l[aä]hete|kartta|asemapiirustus|leikkaus/i

/*
 * Paras asiakirja kuvauksen lähteeksi, tai null jos mikään ei kelpaa.
 * Järjestys on mitattu eikä mielipide: kuulutus on aikaisempi ja
 * kymmenesosa päätöksen koosta.
 */
export function valitseAsiakirja(asiakirjat: Asiakirja[]): Asiakirja | null {
  const kelpaavat = asiakirjat.filter((a) => !HYODYTON.test(String(a.name ?? "")))
  if (kelpaavat.length === 0) return null

  const kuulutus = kelpaavat.filter((a) => KUULUTUS.test(a.name))
  const paatos = kelpaavat.filter((a) => PAATOS.test(a.name))

  /* Saman tyypin sisällä pienin ensin: sama teksti, halvempi jäsennys. */
  const pienin = (lista: Asiakirja[]) =>
    [...lista].sort((a, b) => (a.contentLengthKB ?? 1e9) - (b.contentLengthKB ?? 1e9))[0]

  if (kuulutus.length > 0) return pienin(kuulutus)
  if (paatos.length > 0) return pienin(paatos)
  return null
}

/*
 * Sivunumerot ("2 (65)"), ylätunniste ja viraston yhteystiedot pois.
 * Ne toistuvat joka sivulla ja söisivät kuvauksesta puolet.
 */
function siivoa(teksti: string): string {
  return (
    teksti
      .replace(/\n\s*\d+\s*\(\d+\)\s*\n/g, "\n")
      .replace(/Lupa- ja valvontavirasto[\s\S]*?Y-tunnus\s+[\d-]+/g, " ")
      .replace(/PL 20, 13035 LVV|kirjaamo@lvv\.fi|lvv\.fi|Puhelin: 0295 254 000/g, " ")
      /*
       * Ennen 1.1.2026 asiat olivat aluehallintovirastossa, ja sen
       * alatunniste on eri. Ilman tätä se jäi kuvauksen perään:
       * "...Hamina. Etelä-Suomen aluehallintovirasto, ympäristölupa-
       * vastuualue Postiosoite: PL 1, 13035 AVI..."
       */
      .replace(/[A-ZÄÖÅ][a-zäöå]+-?[A-ZÄÖÅ]?[a-zäöå]* aluehallintovirasto, ymp[aä]rist[oö]lupavastuualue/g, " ")
      .replace(/Postiosoite: PL \d+, \d+ AVI|Puhelinvaihde: [\d ]+|ymparistoluvat\.[a-z]+@avi\.fi|www\.avi\.fi/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\s*\n\s*/g, "\n")
      .trim()
  )
}

/*
 * Sisällysluettelon rivi näyttää otsikolta mutta jatkuu pisteillä
 * ("TOIMINTA JA SEN SIJAINTI ....... 6"). Osuma kelpaa vain jos sen
 * perässä on tekstiä eikä pisterivistöä.
 */
function ensimmainenSisalto(teksti: string, otsikko: RegExp): string | null {
  const haku = new RegExp(otsikko.source, otsikko.flags.includes("g") ? otsikko.flags : otsikko.flags + "g")
  for (const osuma of teksti.matchAll(haku)) {
    if (osuma.index === undefined) continue
    const jatko = teksti.slice(osuma.index + osuma[0].length)
    if (/^\s*\.{8,}/.test(jatko)) continue
    return jatko
  }
  return null
}

/*
 * Kuulutuksen luku on numeroitu ("6 Asian pääasiallinen sisältö") ja
 * päättyy seuraavaan numeroituun lukuun. Numero vaihtelee asiasta
 * toiseen, joten sitä ei saa kiinnittää.
 */
function kuulutuksesta(teksti: string): string | null {
  /*
   * Luvun numero on uudessa muodossa ("6 Asian pääasiallinen sisältö")
   * ja puuttuu vanhassa AVI-kuulutuksessa, jossa otsikko on lisäksi
   * "Päätöksen pääasiallinen sisältö". Molemmat samaan hakuun.
   */
  const loppuun = ensimmainenSisalto(
    teksti,
    /\n\s*(?:\d+\s+)?(?:Asian|P[aä]{1,2}t[oö]ksen) p[aä]{1,2}asiallinen sis[aä]lt[oö]\s*\n/
  )
  if (loppuun === null) return null

  const seuraava = loppuun.match(
    /\n\s*(?:\d+\s+[A-ZÄÖÅ][a-zäöå]|N[aä]ht[aä]vill[aä]pito|Muutoksenhaku|Lis[aä]tietoja)/
  )
  return (seuraava?.index !== undefined ? loppuun.slice(0, seuraava.index) : loppuun).trim() || null
}

/*
 * Päätöksen "Toiminta" on sivun 1 kolmas luku (Asia, Hakija, Toiminta)
 * ja päättyy sivun alatunnisteeseen tai sisällysluetteloon. Otsikko on
 * omalla rivillään — ilman sitä osuisi myös leipätekstin sanaan
 * "toiminta", jota näissä on kymmeniä.
 */
function paatoksesta(teksti: string): string | null {
  /*
   * Uudessa päätöksessä luku on "Toiminta" sivulla 1; vanhassa
   * AVI-päätöksessä sama asia on versaalilla "TOIMINTA JA SEN SIJAINTI"
   * eikä sivulla 1 vaan rungossa, jolloin sisällysluettelo osuu ensin —
   * siksi `ensimmainenSisalto` ohittaa pisterivit.
   */
  const loppuun =
    ensimmainenSisalto(teksti, /\n\s*TOIMINTA JA SEN SIJAINTI\s*\n/) ??
    ensimmainenSisalto(teksti, /\n\s*Toiminta\s*\n/)
  if (loppuun === null) return null

  const seuraava = loppuun.match(
    /\n\s*(Lupa- ja valvontavirasto|Sis[aä]llysluettelo|Ratkaisu|Hakemuksen|Luvan hakemisen peruste|LUVAN HAKEMISEN PERUSTE|LUPAVIRANOMAISEN)/
  )
  return (seuraava?.index !== undefined ? loppuun.slice(0, seuraava.index) : loppuun).trim() || null
}

/*
 * Liian lyhyt osuma on huonompi kuin ei osumaa: se näyttää siltä että
 * tieto on haettu, vaikka poiminta meni ohi.
 *
 * Raja on 60 eikä 100, koska mittaus näytti rajan pudottavan aitoa
 * tietoa: "Hakemus koskee lannoiteterminaalin toimintaa osoitteessa
 * Gerhardin väylä 8, Hamina." on 83 merkkiä ja kertoo enemmän kuin
 * korvattava kuori ("Ympäristölupa-asia (diaarinro ...). Hakija: ...").
 * Lyhyt kuvaus saa siis korvata pidemmän kuoren — pituus ei ole
 * tavoite, sisältö on.
 */
const VAHIMMAISPITUUS = 60

/*
 * Luvun viimeinen rivi osuu usein sivunvaihtoon, jolloin perään jää
 * ylätunniste: "...HTC-laitoksen toimintaa. 343/2026 LVV-U/104899/2026".
 * Ne ovat aina lopussa ja tunnistettavaa muotoa — päätösnumero,
 * sivunumero, diaarinumero — joten ne karsitaan hännästä eikä koko
 * tekstistä, jottei leipätekstin luvuille käy mitään.
 */
/*
 * Luku voi jatkua sivunvaihdon yli, jolloin KESKELLE tekstiä jää
 * ylätunniste: "...raukeamaan. 205/2026 Asiatunnus LVV-U/23208/2026 1
 * Perustelut...". Hännän karsinta ei auta, koska roskan perässä on
 * lisää tekstiä. Tunniste on aina päätösnumero + diaarinumero lähekkäin
 * — se pari ei esiinny leipätekstissä, joten siihen voi katkaista.
 */
function katkaiseSivutunnisteeseen(teksti: string): string {
  const tunniste = teksti.match(/\s\d{1,4}\/\d{4}\s[\s\S]{0,40}?[A-ZÄÖÅ]{2,}(?:-[A-ZÄÖÅ])?\/\d+\/\d{4}/)
  return tunniste?.index !== undefined ? teksti.slice(0, tunniste.index) : teksti
}

function karsiHanta(teksti: string): string {
  const roska = /(?:\s|\|)*(?:\d{1,4}\/\d{4}|\d{1,3} \(\d{1,3}\)|[A-ZÄÖÅ]{2,}(?:-[A-ZÄÖÅ])?\/\d+\/\d{4})(?:\s|\|)*$/
  let tulos = teksti.trim()
  for (let i = 0; i < 6 && roska.test(tulos); i += 1) {
    tulos = tulos.replace(roska, "").trim()
  }
  return tulos.replace(/[\s|]+$/, "").trim()
}

export function kuvausAsiakirjasta(teksti: string): string | null {
  if (!teksti) return null
  const siivottu = siivoa(teksti)

  const kuvaus = kuulutuksesta(siivottu) ?? paatoksesta(siivottu)
  if (!kuvaus) return null

  const yhdella = karsiHanta(
    katkaiseSivutunnisteeseen(
      kuvaus.replace(/\s*\n\s*/g, " ").replace(/\s{2,}/g, " ").trim()
    )
  )
  return yhdella.length >= VAHIMMAISPITUUS ? yhdella : null
}

/*
 * Asian tunniste osoitteesta: .../fi-FI/asia/3283067 -> "3283067".
 */
export function asianTunnus(sourceUrl: string | null | undefined): string | null {
  const m = String(sourceUrl ?? "").match(/\/asia\/(\d+)/)
  return m ? m[1] : null
}
