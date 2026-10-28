/*
 * KAAVAN KUVAUS SELOSTUKSESTA (D-217).
 *
 * Kuulutus kertoo vain menettelyn: "Osallistumis- ja arviointisuunnitelma
 * sekä kaavaluonnos ovat nähtävillä 25.9.–2.11.2026 … palvelupisteiden
 * asiakaspäätteillä." Siinä ei ole sanaakaan siitä mitä alueelle
 * rakennetaan. Selostuksen luvussa "Kaavan tarkoitus" on:
 *
 *   "Tavoitteena on tehostaa maankäyttöä ja mahdollistaa nopeasti
 *    kasvaneen teknologiakeskittymän kehittyminen ja laajentuminen.
 *    Kaupunki on ostanut noin hehtaarin laajuisen määräalan Andritzilta
 *    joulukuussa 2023."
 *
 * KOKO TEKSTI EI KUULU KANTAAN. `kaavaselostusPdf.ts` rajasi aikanaan
 * poimintaan eikä tekstiin, koska selostukset ovat 229 000–884 000
 * merkkiä. Sama rajaus pätee tässä: talteen otetaan vain kaksi lukua,
 * yhteensä korkeintaan `MAX_PITUUS` merkkiä.
 *
 * KAKSI LUKUA, KOSKA NE VASTAAVAT ERI KYSYMYKSEEN. "Kaava-alue" kertoo
 * MISSÄ ja kuinka iso, "Kaavan tarkoitus" kertoo MITÄ ja MIKSI. Asiakas
 * tarvitsee molemmat; kumpikaan yksin ei riitä.
 */

/* Kuvaus on tiivistelmä, ei selostus. */
const MAX_PITUUS = 1200

/*
 * Numeroitu otsikko aloittaa luvun. Selostusten rakenne on vakiintunut
 * (1 PERUS- JA TUNNISTETIEDOT, 1.1 Kaava-alue, 1.2 Kaavan tarkoitus),
 * joten luvun raja on seuraava numeroitu otsikko.
 */
const OTSIKKORIVI = /^\s*(\d+(?:\.\d+)*)\.?\s+(\S.{1,70})$/

/* Halutut luvut. Sanamuoto vaihtelee kunnittain. */
const HALUTUT: { avain: string; kuvio: RegExp }[] = [
  /*
   * "Alueen sijainti" (D-351): sama sanajarjestysansa kuin tarkoituksessa.
   * Kuvio vaati sijainnin ENSIMMAISEKSI sanaksi, joten Suonenjoen luku 1.2
   * jai lukematta ja kuvauksesta puuttui MISSA-puoli.
   */
  { avain: "alue", kuvio: /^(kaava-?alue|suunnittelualue|sijainti|alueen\s+sijainti)\b/i },
  {
    avain: "tarkoitus",
    /*
     * "KAAVATYÖN TARKOITUS" (D-351). Suonenjoen selostuksissa luku 1.3 on
     * *"Kaavatyön tarkoitus"*, eikä `kaava(?:n|muutoksen|hankkeen)?` osu
     * siihen: väliin jää "työn". Mitattu 26.10.2026: viidestä ohuesta
     * Suonenjoen rivistä kaksi kaatui tähän ("selostuksesta ei lukua"),
     * vaikka selostus oli haettu ja luettu.
     */
    /*
     * KAKSI VAKIO-OTSIKKOA LISAA (D-352). 24 selostuksesta, joista
     * lukua ei loytynyt, nama kaksi toistuivat:
     *   "1.2 Suunnittelutehtävä – Mitä on tekeillä"  (Toholampi)
     *   "1. Mihin ja mitä suunnitellaan?"            (Inarin OAS)
     * Jalkimmainen on OAS-pohjan kysymysmuoto, joka on kaytossa
     * monessa kunnassa.
     */
    kuvio:
      /^((?:asema|ranta|yleis)?kaava(?:n|muutoksen|hankkeen|ty[öo]n|ty[öo])?\s+(?:tarkoitus|tavoit)|kaavan\s+muutoksen\s+tavoit|tavoitteet|suunnittelun\s+tavoit|suunnitteluteht[äa]v|mihin\s+ja\s+mit[äa]\s+suunnitellaan|tiivistelm)/i,
  },
]

/*
 * "TIIVISTELMA KAAVAPROSESSIN VAIHEISTA" EI OLE TIIVISTELMA KAAVASTA.
 *
 * Maankayttö- ja rakennusasetuksen mukaisessa rakenteessa tiivistelman
 * alla on kaavaprosessin aikataulu, ei kaavan sisalto. Mitattu Euran
 * Fankkee II:n selostuksesta 11.10.2026: luku 3 oli 2 413 merkkia
 * aikataulua ("Vaihe Ajankohta Kaavoituksen kaynnistaminen ...") ja se
 * olisi mennyt kuvaukseksi, vaikka samassa selostuksessa on luku 1.1.3
 * "Kaavamuutoksen tavoitteet". Aikataulu ei kerro asiakkaalle mitaan.
 */
const MENETTELYLUKU = /tiivistelm\w*\s+kaavaprosessi|kaavaprosessin\s+vaihe|prosessin\s+vaiheist/i

/*
 * PDF katkaisee sanat rivin lopussa tavuviivalla ("joulu-\nkuussa").
 * Ilman yhdistämistä kuvaukseen jää katkonaisia sanoja.
 *
 * Vain pieni kirjain molemmin puolin: "Lypsyniemenkadun lounais-" +
 * "puolelta" yhdistyy, mutta yhdysmerkillinen erisnimi
 * ("Hirvivaara-\nMurtiovaara") säilyy.
 */
function yhdistaTavutus(teksti: string): string {
  return teksti.replace(/([a-zåäö])-\n([a-zåäö])/g, "$1$2")
}

function siisti(teksti: string): string {
  return teksti
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim()
}

/*
 * Ylä- ja alatunnisteet toistuvat joka sivulla ja katkaisevat lauseen
 * keskeltä. Ne tunnistaa siitä että sama rivi esiintyy monta kertaa.
 */
function poistaToistuvatRivit(teksti: string): string {
  const rivit = teksti.split("\n")
  const laskut = new Map<string, number>()

  for (const rivi of rivit) {
    const avain = rivi.trim()
    if (avain.length < 4) continue
    laskut.set(avain, (laskut.get(avain) ?? 0) + 1)
  }

  return rivit
    .filter((rivi) => {
      const avain = rivi.trim()
      if (/^sivu\s+\d+\s*\/\s*\d+$/i.test(avain)) return false
      return (laskut.get(avain) ?? 0) < 3
    })
    .join("\n")
}

/*
 * OAS:N OTSIKOT EIVAT OLE NUMEROITUJA (D-317).
 *
 * Aloitusvaiheen kaavalla ei ole viela selostusta, vaan ainoa asiakirja
 * on osallistumis- ja arviointisuunnitelma. Sen rakenne on sama kaikissa
 * kunnissa, mutta otsikot ovat PALJAITA SANOJA omalla rivillaan:
 *
 *   Suunnittelualue / Aloite / Tavoitteet / Lahtotiedot / Kaavatilanne
 *
 * `OTSIKKORIVI` vaatii numeron, joten Salon Helenankatu 12:n OAS:sta ei
 * loytynyt yhtaan lukua ja koko tavoiteluku jai pois -- juuri se kohta
 * joka kertoo MITA alueelle rakennetaan ("edellytykset
 * toteuttamiskelpoisen asuinkerrostalon rakentamiselle Helenankadulle
 * ja palveluasumiselle tarkoitetun kerrostalon rakentaminen Turuntien
 * varteen").
 *
 * Tama on VARASIJA, ei uusi oletus: numeroitu jasennys ajetaan ensin,
 * ja paljaat otsikot kokeillaan vasta jos se ei tuottanut mitaan. Nain
 * selostusten kasittely ei muutu lainkaan, ja Euran rikkinaisten
 * fonttien roska ("AABCCDE") palautuu edelleen nullina, koska mikaan
 * paljas rivi ei vastaa sanaa "Tavoitteet".
 */
const PALJAS_OTSIKKO = /^[A-ZÄÖÅ][A-Za-zÄÖÅäöå\- ]{2,44}$/

/* Sivun alatunniste ("Salon kaupunki  4") ja kuvateksti eivat ole otsikoita. */
const EI_OTSIKKO = /^(kuva|taulukko|liite)\b|\d\s*$/i

export function onPaljasOtsikko(rivi: string): boolean {
  const t = rivi.trim()
  if (!PALJAS_OTSIKKO.test(t)) return false
  if (EI_OTSIKKO.test(t)) return false
  /* Otsikko on nimi, ei virke: enintaan neljä sanaa. */
  return t.split(/\s+/).length <= 4
}

/*
 * Kuvateksti ja sivun alatunniste ovat luvun sisalla omina riveinaan.
 * Numeroidussa selostuksessa ne ovat aina olleet mukana, joten niita ei
 * suodateta sielta (muutos vaatisi oman mittauksen); OAS-varasijalla ne
 * poistetaan, koska muuten kuvaus paattyy sanoihin "Kuva 2
 * Kaava-alueen sijaintikartta. @Salon kaupunki Salon kaupunki 4".
 */
const KUVATEKSTI = /^(kuva|kuvio|taulukko)\s*\d/i
const ALATUNNISTE = /^[A-Za-zÄÖÅäöå\- ]{3,40}\s+\d{1,3}$/

/*
 * "Nosto Consulting Oy 5 (19)" on kaavakonsultin alatunniste, jossa on
 * sivunumero ja sivumaara. Se ei toistu samanlaisena (numero vaihtuu),
 * joten `poistaToistuvatRivit` ei poista sita, ja se katkaisi Salon
 * Kajalanrinteen kuvauksessa virkkeen keskelta: "Voimassa olevan
 * ranta-asemakaavan Nosto Consulting Oy 5 (19) mukainen LV-alue...".
 *
 * Tama muoto poistetaan MOLEMMISSA jasennyksissa, koska se ei voi olla
 * leipatekstia: "N (M)" rivin lopussa on aina sivulaskuri. Vaaljempi
 * alatunnistesaanto jaa OAS-varasijalle, koska se voisi osua oikeaan
 * lauseeseen ("Kaava-alueen pinta-ala on 4189").
 */
const SIVULASKURI = /\b\d{1,3}\s*\(\s*\d{1,3}\s*\)\s*$/

/* Kuvateksti ja kuvan lahdemerkinta: "Sijaintikartta © Salon kaupunki". */
const TEKIJANOIKEUS = /[©]/

/*
 * SEURAAVAN LUVUN OTSIKKO SAMALLA RIVILLA (D-317).
 *
 * Osassa PDF:ia rivinvaihdot katoavat niin, etta seuraavan luvun
 * otsikko jatkuu samalla rivilla edellisen tekstin perassa:
 *
 *   "...yleiskaavan tavoitteiden mukaisesti. 3 Lähtökohdat 3.1
 *    Selvitys suunnittelualueen oloista 3.1.1 Alueen yleiskuvaus ..."
 *
 * Silloin rivijako ei loyda luvun loppua ja koko loppuselostus valuu
 * kuvaukseen. Katkaisu tehdaan ensimmaiseen rakenteelliseen otsikkoon:
 * pieni numero (ei vuosiluku) ja sita seuraava selostuksen vakioluvun
 * nimi. Sanalista on suljettu, jotta "korttelin 9 Armfeltin" ei katkaise
 * oikeaa lausetta.
 */
const LUVUN_ALKU =
  /\s\d{1,2}(?:\.\d{1,2})*\.?\s+(Tiivistelmä|Lähtökohdat|Selvitys|Suunnittelun|Asemakaavan kuvaus|Perus-|Osallistumis|Vaikutusten|Kaavaratkaisu)/

function katkaiseLukuun(sisalto: string): string {
  const osuma = sisalto.match(LUVUN_ALKU)
  let teksti = sisalto
  if (osuma && osuma.index !== undefined) {
    /*
     * Alle 30 merkin kohdalla otsikko on luvun omassa nimessa, ei
     * seuraavan luvun alku. Raja oli ensin 60, mutta silloin Salon
     * Inkerinkadun kuvaus ("...mukaisesti. 3 Lähtökohdat 3.1 Selvitys
     * suunnittelualueen oloista...") jai katkaisematta.
     */
    if (osuma.index >= 30) teksti = sisalto.slice(0, osuma.index).trim()
  }
  /* Irrallinen sivunumero lopussa: "Kaava-alue on kooltaan 1,6 ha. 2". */
  return teksti.replace(/(?<=[.!?])\s+\d{1,3}\s*$/, "").trim()
}

function jaaLuvuiksi(rivit: string[], salliPaljaat: boolean) {
  const luvut: { otsikko: string; sisalto: string[] }[] = []
  for (const rivi of rivit) {
    const otsikko = rivi.match(OTSIKKORIVI)
    if (otsikko) {
      luvut.push({ otsikko: otsikko[2].trim(), sisalto: [] })
      continue
    }
    if (salliPaljaat && onPaljasOtsikko(rivi)) {
      luvut.push({ otsikko: rivi.trim(), sisalto: [] })
      continue
    }
    if (SIVULASKURI.test(rivi.trim()) || TEKIJANOIKEUS.test(rivi)) continue
    if (salliPaljaat && (KUVATEKSTI.test(rivi.trim()) || ALATUNNISTE.test(rivi.trim()))) continue
    if (luvut.length) luvut[luvut.length - 1].sisalto.push(rivi)
  }
  return luvut
}

/* Katkaisu virkkeen tai sanan rajalta, ei keskelta sanaa. */
function katkaise(teksti: string, pituus: number): string {
  if (teksti.length <= pituus) return teksti
  const leikattu = teksti.slice(0, pituus)
  const piste = leikattu.lastIndexOf(". ")
  if (piste > pituus * 0.5) return leikattu.slice(0, piste + 1).trim()
  const vali = leikattu.lastIndexOf(" ")
  return `${(vali > 0 ? leikattu.slice(0, vali) : leikattu).trim()}…`
}

function poimiOsat(luvut: { otsikko: string; sisalto: string[] }[]): string[] {
  const osat: string[] = []

  for (const { avain, kuvio } of HALUTUT) {
    const luku = luvut.find(
      (l) => kuvio.test(l.otsikko) && !MENETTELYLUKU.test(l.otsikko)
    )
    if (!luku) continue

    const sisalto = katkaiseLukuun(luku.sisalto.join(" ").replace(/\s+/g, " ").trim())

    /*
     * Liian lyhyt luku on otsikko ilman sisältöä (esim. viittaus
     * liitteeseen), liian pitkä on väärä luku tai jäsennysvirhe.
     */
    if (sisalto.length < 40) continue
    if (onLiiteluettelo(sisalto)) continue
    if (onSisallysluettelo(sisalto)) continue

    osat.push(avain === "alue" ? katkaise(sisalto, 400) : sisalto)
  }

  return osat
}

export function kaavanKuvausTekstista(raaka: string | null | undefined): string | null {
  const teksti = poistaToistuvatRivit(siisti(yhdistaTavutus(String(raaka ?? ""))))
  if (!teksti) return null

  const rivit = teksti.split("\n")

  let osat = poimiOsat(jaaLuvuiksi(rivit, false))
  if (!osat.length) osat = poimiOsat(jaaLuvuiksi(rivit, true))

  if (!osat.length) return kaavanKuvausLauseesta(raaka)

  const kuvaus = osat.join(" ").replace(/\s+/g, " ").trim()

  /*
   * KYSYMYSLISTA EI OLE KUVAUS (D-352). Inarin Vilkontien OAS:ssa luku
   * "1. Mihin ja mitä suunnitellaan?" jäi tyhjäksi taitossa, jolloin
   * luvuksi tuli seuraavien lukujen OTSIKOT: *"2. Mitä vaikutuksia
   * kaavalla saattaa olla ja miten vaikutuksia arvioidaan? 3. Miten ja
   * missä vaiheessa voi vaikuttaa kaavan valmisteluun?"*. Kaksi
   * kysymysmerkkia lyhyessa tekstissa on sisallysluettelon merkki, ei
   * kuvauksen.
   */
  if ((kuvaus.match(/\?/g) ?? []).length >= 2) return kaavanKuvausLauseesta(raaka)

  /*
   * MENETTELYLUKU MYOS SISALLON PERUSTEELLA (D-356).
   *
   * `MENETTELYLUKU` hylkaa luvun OTSIKON perusteella, mutta Hartolan
   * selostuksessa tiivistelman SISALTO oli aikataulu: *"Kaavaprosessin
   * vaiheet Vireilletulosta ilmoittaminenkuulutus 23.9.2026
   * Asemakaavaluonnos nahtavana AKL 62§..."* -- 598 merkkia
   * paivamaaria, nolla hankesisaltoa (D-268 sama opetus).
   */
  if (MENETTELYLUKU.test(kuvaus.slice(0, 80))) return kaavanKuvausLauseesta(raaka)

  /*
   * OTSIKON HANTA POIS ALUSTA. Kun luvun otsikko jakautuu kahdelle
   * riville, jalkimmainen rivi jaa sisallon alkuun: *"ja alustavat
   * tavoitteet Suunnittelualueen kaavoituksella on tavoitteena..."*.
   * Pieni alkukirjain kertoo katkelmasta.
   */
  if (/^[a-zäöå]/.test(kuvaus)) {
    const iso = kuvaus.search(/[A-ZÄÖÅ]/)
    if (iso > 0 && iso < 60) return kuvaus.slice(iso)
  }
  if (kuvaus.length <= MAX_PITUUS) return kuvaus

  /* Katkaisu virkkeen rajalta, ei keskeltä sanaa. */
  const leikattu = kuvaus.slice(0, MAX_PITUUS)
  const piste = leikattu.lastIndexOf(". ")
  return piste > MAX_PITUUS * 0.5 ? leikattu.slice(0, piste + 1) : `${leikattu.trim()}…`
}

/*
 * LAUSEANKKURI, KUN OTSIKKO EI OLE OMALLA RIVILLAAN (D-271).
 *
 * Riviperustainen lukuhaku olettaa etta "1.3 Kaavan tarkoitus" on oma
 * rivinsa. Osassa PDF:ia koko teksti purkautuu yhdelle riville:
 * mitattu Kangasalan kaavan 711 selostuksesta 11.10.2026, 18 975
 * merkkia ja viisi "otsikkoa", joista kaikki sisallysluettelosta.
 * Silloin ankkuri on itse SANA, ei rivi.
 *
 * Sisallysluettelo sisaltaa samat sanat, joten otetaan VIIMEINEN osuma
 * ja vaaditaan riittavasti tekstia perassa — luettelorivi loppuu
 * pistejonoon ja sivunumeroon.
 */
const ANKKURI =
  /(kaavan\s+tarkoitus(?:\s+ja\s+tavoitteet)?|(?:asema|ranta|yleis)?kaava(?:n|muutoksen|hankkeen)?\s+tavoitte\w*|suunnittelun\s+tavoitte\w*|kaavamuutoksen\s+tarkoitus)/gi

const LOPETUS =
  /(perus-\s*ja\s*tunnistetiedot|luettelo\s+selostuksen|selostuksen\s+liite|tiivistelm\w*\s+kaavaprosessi|kaavaprosessin\s+vaihe|suunnittelualueen\s+lähtökohdat|lähtökohdat\s+ja\s+nykytila|osallistumis-\s*ja\s*arviointi|vaikutusten\s+arviointi|asemakaavan\s+kuvaus|aluetta\s+koskevat\s+suunnitelmat)/i

/* Liiteluettelo ei ole kuvaus, vaikka se olisi oikeassa luvussa. */
const LIITELUETTELO = /^(kaavaselostuksen\s+liitteet|luettelo\s+selostuksen|liitteet|liite\s*\d)/i

function onLiiteluettelo(teksti: string): boolean {
  if (LIITELUETTELO.test(teksti.trim())) return true
  /* Kolme "Liite N" ensimmaisessa 300 merkissa = luettelo. */
  return (teksti.slice(0, 300).match(/liite\s*\d/gi) ?? []).length >= 3
}

/*
 * Sisallysluettelo tunnistuu pistejonoista: "4.5. Asemakaavaratkaisun
 * vaihtoehdot ......... 23". Kangasalan kaavan 876 selostuksessa
 * ankkurisana osui luetteloon, ei leipatekstiin.
 */
function onSisallysluettelo(teksti: string): boolean {
  /* Kahdeksan perakkaista pistetta ei esiinny proosassa. */
  return /\.{8,}/.test(teksti)
}

export function kaavanKuvausLauseesta(raaka: string | null | undefined): string | null {
  const teksti = siisti(yhdistaTavutus(String(raaka ?? ""))).replace(/\s+/g, " ")
  if (!teksti) return null

  const osumat = [...teksti.matchAll(ANKKURI)]
  if (!osumat.length) return null

  for (const osuma of osumat.reverse()) {
    /*
     * Ankkurilause otetaan MUKAAN: ilman sita kuvaus alkaa kesken
     * virkkeen ("on tarkistaa asumiselle osoitetun korttelin...").
     * Mukana se lukee "Kaavamuutoksen tavoitteena on tarkistaa...".
     */
    const alku = osuma.index!

    /*
     * ANKKURIN ON ALOITETTAVA VIRKE (D-351).
     *
     * Suonenjoen korttelin 963 OAS:ssa ei ole numeroituja otsikoita
     * lainkaan, joten lauseankkuri oli ainoa reitti -- ja se osui
     * KESKELLE virkettä, maankäyttö- ja rakennuslain yleisiin
     * tavoitteisiin: *"...suunnittelun tavoitteet, joista tärkeimmät
     * ovat hyvä elinympäristö ja kestävä kehitys, 4 - toimia
     * kaavoituksen ennakoivan ... viranomaistyön välineenä"*. 1 127
     * merkkiä lakitekstiä, nolla hankesisältöä.
     *
     * Aito luku tai virke alkaa isolla kirjaimella tai edeltävästä
     * virkkeen lopusta. Pieni kirjain keskellä virkettä ei ole
     * otsikko, vaan sivulause.
     */
    const edellinen = teksti.slice(0, alku).trimEnd().slice(-1)
    const alkaaVirkkeen =
      /[A-ZÅÄÖ]/.test(teksti[alku] ?? "") || !edellinen || /[.:;!?]/.test(edellinen)
    if (!alkaaVirkkeen) continue

    let jatko = teksti.slice(alku, alku + MAX_PITUUS * 2)
    const lopetus = jatko.search(LOPETUS)
    if (lopetus > 0) jatko = jatko.slice(0, lopetus)

    const sisalto = katkaiseLukuun(
      jatko
        /* Sisallysluettelon pistejono ja sivunumero pois. */
        .replace(/\.{3,}\d{1,3}/g, " ")
        .replace(/^[\s:.–-]+/, "")
        .replace(/\s+/g, " ")
        .trim()
    )

    if (sisalto.length < 120) continue
    if (onLiiteluettelo(sisalto)) continue
    if (onSisallysluettelo(sisalto)) continue

    if (sisalto.length <= MAX_PITUUS) return sisalto
    const leikattu = sisalto.slice(0, MAX_PITUUS)
    const piste = leikattu.lastIndexOf(". ")
    return piste > MAX_PITUUS * 0.5 ? leikattu.slice(0, piste + 1) : `${leikattu.trim()}…`
  }

  return null
}

/*
 * PAASELOSTUS LIITTEIDEN JOUKOSTA (D-268).
 *
 * Kaavasivulla on tyypillisesti 5-11 liitetta, ja niista suurin osa on
 * nimetty "Selostus_Liite_N_...". Mitattu Euran sivulla 11.10.2026:
 * kortteli 353:lla yksitoista linkkia, joista kymmenen alkaa sanalla
 * "Selostus". Ensimmaisen selostus-osuman poimiminen antaisi
 * seurantalomakkeen tai lausuntoliitteen — lomakkeessa ei ole proosaa
 * lainkaan.
 *
 * Paaselostus tunnistuu siita etta nimessa EI ole liitesanaa. Sama
 * nimeamistapa toistuu kunnasta toiseen, koska selostuksen rakenne on
 * maankayttö- ja rakennusasetuksen mukainen ([[kaava-parser-vs-page]]).
 */
const SELOSTUS_NIMI = /selostus/i

const LIITESANA =
  /liite|oas|osallistumis|seuranta|kaavakartta|kartta|lausunto|vastine|havainne|maaper|melu|luonto|selvitys|tarkistus|poytakirja|pöytäkirja/i

/*
 * Kuntien sivuilla on rikkinaisia linkkeja: Euralla "http://Selostus__
 * Korttelin_353_AKM_ehdotus_17.6.2026" (isäntä puuttuu) ja
 * "//www.eura.fi/..." (protokolla puuttuu). Jalkimmainen on kelvollinen
 * suhteellinen osoite, edellinen ei osoita mihinkaan.
 */
export function normalisoiLiiteUrl(href: string | null | undefined): string | null {
  const raaka = String(href ?? "").trim()
  if (!raaka) return null
  const taydennetty = raaka.startsWith("//") ? `https:${raaka}` : raaka
  let osoite: URL
  try {
    osoite = new URL(taydennetty)
  } catch {
    return null
  }
  if (!/^https?:$/.test(osoite.protocol)) return null
  /* Isantanimi ilman pistetta ei ole verkkotunnus vaan tiedostonimi. */
  if (!osoite.hostname.includes(".")) return null
  /*
   * `.pdf` SAA OLLA POLUN KESKELLA (D-335).
   *
   * Liferay-alustalla tiedostonimi on polun keskella ja perassa on
   * UUID, esim.
   *   /documents/41921/181653/Selostus__Pappilanmalmi.pdf/c7859695-...
   * Osoite palvelee aidon PDF:n (tarkistettu: application/pdf, 5,1 MB,
   * "%PDF-1.7"), mutta loppuun sidottu tarkistus hylkasi KAIKKI
   * Paraisten liitteet -- eli yksikaan selostus ei loytynyt.
   *
   * Liferay on yleinen Suomen kunnissa, joten korjaus siirtyy muihinkin
   * ([[shared-platform-fix-transfers]]).
   */
  if (!/\.pdf(\/|$)/i.test(osoite.pathname)) return null
  return osoite.toString()
}

/*
 * ALOITUSVAIHEESSA OAS ON AINOA ASIAKIRJA (D-317).
 *
 * `valitseKaavaselostus` sulkee OAS:n pois tarkoituksella: kun selostus
 * on olemassa, se on parempi lahde. Vireilletulovaiheessa selostusta ei
 * kuitenkaan OLE, ja OAS:n "Tavoitteet"-luku on ainoa paikka jossa
 * kerrotaan mita alueelle aiotaan rakentaa. Juuri se vaihe on myyjalle
 * arvokkain, joten OAS kelpaa varasijaksi -- ei koskaan selostuksen
 * ohi.
 */
const OAS_NIMI = /\boas\b|osallistumis/i

/* Kaavakartta ja selvitykset ovat liitteita, eivat OAS:ia. */
const EI_OAS = /kaavakartta|kartta|havainne|melu|luonto|maaper|selvitys|lausunto|vastine|poytakirja|pöytäkirja/i

export function valitseOas(
  linkit: { teksti?: string | null; href?: string | null }[]
): string | null {
  for (const linkki of linkit) {
    const url = normalisoiLiiteUrl(linkki.href)
    if (!url) continue
    const nimi = `${decodeURIComponent(url.split("/").pop() ?? "")} ${linkki.teksti ?? ""}`
    if (!OAS_NIMI.test(nimi)) continue
    if (EI_OAS.test(nimi)) continue
    return url
  }
  return null
}

/* Selostus ensin, OAS vasta jos selostusta ei ole. */
export function valitseKaavanAsiakirja(
  linkit: { teksti?: string | null; href?: string | null }[]
): string | null {
  return valitseKaavaselostus(linkit) ?? valitseOas(linkit)
}

export function valitseKaavaselostus(
  linkit: { teksti?: string | null; href?: string | null }[]
): string | null {
  for (const linkki of linkit) {
    const url = normalisoiLiiteUrl(linkki.href)
    if (!url) continue
    const nimi = `${decodeURIComponent(url.split("/").pop() ?? "")} ${linkki.teksti ?? ""}`
    if (!SELOSTUS_NIMI.test(nimi)) continue
    if (LIITESANA.test(nimi)) continue
    return url
  }
  return null
}

/*
 * Selostus on iso: mitattu Savonlinnan teknologiapuistossa 7,1 MB ja 42
 * sivua. Luetaan vain alkusivut ja rajataan koko, samoin kuin
 * `kaavaselostusPdf.ts`:ssä.
 */
const MAX_SIVUJA = 6
const MAX_TAVUJA = 25 * 1024 * 1024
const AIKAKATKAISU_MS = 30_000
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"

/*
 * Selostuksen teksti kerran, jotta samasta hausta saadaan seka kuvaus
 * etta yhteyshenkilot (D-230). Molemmat mahtuvat `MAX_SIVUJA`:n sisaan:
 * mitattu Lieksan Brahean selostuksesta, jossa yhteyshenkilot ovat
 * sivulla 4 ja tiivistelma sivulla 6.
 */
export async function haeKaavaselostuksenTeksti(url: string): Promise<string | null> {
  const ohjain = new AbortController()
  const kello = setTimeout(() => ohjain.abort(), AIKAKATKAISU_MS)

  try {
    const vastaus = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: ohjain.signal,
    })
    if (!vastaus.ok) return null

    const ilmoitettu = Number(vastaus.headers.get("content-length") ?? 0)
    if (ilmoitettu > MAX_TAVUJA) return null

    const buf = Buffer.from(await vastaus.arrayBuffer())
    if (buf.length > MAX_TAVUJA) return null

    /* Paketin juuri ajaa debug-tilassa oman testitiedostonsa ja kaatuu. */
    const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default as any
    const jasennetty = await pdfParse(buf, { max: MAX_SIVUJA })

    return String(jasennetty?.text ?? "") || null
  } catch {
    return null
  } finally {
    clearTimeout(kello)
  }
}

export async function haeKaavanKuvaus(url: string): Promise<string | null> {
  return kaavanKuvausTekstista(await haeKaavaselostuksenTeksti(url))
}

/*
 * KUULUTUKSEN MENETTELYTEKSTI POIS, MUU SISALTO TALTEEN (D-217).
 *
 * Kuulutus on enimmakseen boilerplatea ("nahtavilla 25.9.-2.11.2026 ...
 * palvelupisteiden asiakaspaatteilla"), mutta ei aina pelkastaan: osassa
 * on virke jota selostuksessa ei ole.
 *
 *   "Asemakaavan muutos koskee kiinteistoja 740-2-8-4, 740-2-8-7 ja osaa
 *    kiinteistosta 740-3-9901-99 (kaupunginosa 2, Keskusta)."
 *   "... Savolan aluetta Brahenkadun ja Piispanmaen valissa seka
 *    Hevonpaanlahtea."
 *
 * Kiinteistotunnus on lisaksi tasmaytyksen tunniste. Siksi kuulutusta ei
 * heiteta pois vaan siita karsitaan menettelyvirkkeet.
 */
const MENETTELYVIRKE =
  /n(?:ä|a)ht(?:ä|a)vill(?:ä|a)|n(?:ä|a)ht(?:ä|a)v(?:ä|a)n(?:ä|a)|asiakasp(?:ä|a)(?:ä|a)ttei|kotisivuilla osoitteessa|mielipite|muistutu|palautetta voi|jätet(?:ä|a)(?:ä|a)n/i

export function kuulutuksenOmaSisalto(teksti: string | null | undefined): string | null {
  const puhdas = String(teksti ?? "").trim()
  if (!puhdas) return null

  const virkkeet = puhdas
    .split(/(?<=[.!?])\s+/)
    .map((v) => v.trim())
    .filter((v) => v.length >= 25 && !MENETTELYVIRKE.test(v))

  if (!virkkeet.length) return null
  return virkkeet.join(" ")
}

/*
 * SIVU JA ASIAKIRJA YHTEEN ILMAN TOISTOA (D-317).
 *
 * Kaavasivun teksti ja OAS kertovat osin samat asiat: Salon
 * Helenankatu 12:n sivulla on sama suunnittelualue- ja aloitekappale
 * kuin OAS:ssa, mutta EI tavoitelukua. Pelkka peraan liittaminen
 * toistaisi puolet kuvauksesta, ja pelkka korvaaminen hukkaisi sivun
 * omat lauseet (kaupunginhallituksen paatos, sopimusalueen pinta-ala).
 *
 * Siksi lauseittain: asiakirjan lause otetaan mukaan vain jos sita ei
 * ole jo sivun tekstissa. Vertailu tehdaan kirjainkoosta ja
 * valimerkeista riippumatta, koska PDF ja HTML eroavat juuri niissa.
 */
function lauseAvain(lause: string): string {
  return lause
    .toLowerCase()
    .replace(/[^a-zåäö0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function yhdistaKuvaukset(
  sivu: string | null | undefined,
  asiakirja: string | null | undefined
): string | null {
  const a = String(sivu ?? "").trim()
  const b = String(asiakirja ?? "").trim()
  if (!b) return a || null
  if (!a) return b

  /*
   * SISALTYVYYS, EI TASMA VERTAILU. Salon Hiekkarannassa sivun ja
   * asiakirjan lause olivat sulautuneet yhdeksi virkkeeksi ilman
   * valipistetta ("...16.4.2024 § 46 Hankkeen tarkoituksena on laatia
   * ... rantaasemakaava."), joten tasmavertailu ei tunnistanut sita ja
   * sama lause olisi lisatty joka ajolla uudelleen.
   */
  const kokoAvain = lauseAvain(a)
  const uudet = b
    .split(/(?<=[.!?])\s+/)
    .map((l) => l.trim())
    .filter((l) => {
      const avain = lauseAvain(l)
      return avain && !kokoAvain.includes(avain)
    })

  if (!uudet.length) return a
  return `${a} ${uudet.join(" ")}`.replace(/\s+/g, " ").trim()
}
