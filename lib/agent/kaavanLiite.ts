import type { CheerioAPI } from "cheerio"

import {
  haeKaavaselostuksenTeksti,
  kaavanKuvausTekstista,
  valitseKaavanAsiakirja,
  yhdistaKuvaukset,
} from "./kaavanKuvaus"

/*
 * KAAVAN LIITE KUVAUKSEEN, SAMALLA TAVALLA JOKA KUNNASSA (D-319).
 *
 * Johannes 19.10.2026: *"kyllä on varmasti järkevää nuo pdf:t lukea jos
 * niitä on. tehdään sellainen muutos jos niitä ei ole nyt jossain
 * luettu."*
 *
 * Kaavasivun teksti kertoo missa alue on ja kuka kaavaa haki; MITA
 * alueelle rakennetaan lukee selostuksen tai OAS:n tavoiteluvussa
 * (D-317). Jasennin on yhteinen, mutta kytkenta on ollut
 * kuntakohtaista kasityota -- ja tehty vain viidelle keraajalle 241:sta.
 *
 * Tama moduuli tekee kytkennasta kahden rivin tyon: keraaja antaa
 * kuvauksen ja sivun linkit, ja saa takaisin kuvauksen johon on
 * liitetty liitteen tavoiteluku.
 *
 * LIITETTA EI TALLENNETA. Rivi pitaa entisen lahdeviitteensa (kunnan
 * kaavasivu); PDF:sta otetaan vain teksti, ja loput heitetaan pois.
 *
 * KOLME RAJAUSTA, jotta ajo pysyy kohtuullisena:
 *   1. Vain OHUT kuvaus taydennetaan. Jos sivulla on jo asiaa, PDF:aa
 *      ei haeta lainkaan.
 *   2. Budjetti per ajo. Selostukset ovat satoja kilotavuja, eika
 *      yhden keruuajon kuulu ladata niita kymmenia.
 *   3. Liite valitaan samalla saannolla kuin muualla: selostus ensin,
 *      OAS vasta jos selostusta ei ole.
 */

export type LiiteBudjetti = { haettu: number; raja: number }

/* Alle taman kuvaus on niin ohut, etta liite kannattaa avata. */
export const OHUEN_KUVAUKSEN_RAJA = 300

/*
 * Linkit siina muodossa jossa `valitseKaavanAsiakirja` ne ymmartaa.
 * Suhteellinen osoite taydennetaan sivun osoitteella, koska kuntien
 * sivuilla liite on usein "/wp-content/uploads/..." -muodossa.
 *
 * `osa` rajaa haun yhteen lohkoon: listasivulla jokaisella kaavalla on
 * oma osionsa, ja koko sivun linkeista valittaisiin vaara liite (ks.
 * [[listing-page-is-not-project-page]]).
 */
export function liitelinkit(
  $: CheerioAPI,
  sivunOsoite: string,
  osa?: ReturnType<CheerioAPI>
): { href: string; teksti: string }[] {
  const juuri = osa ?? $.root()
  return juuri
    .find("a[href]")
    .toArray()
    .map((a) => {
      const href = $(a).attr("href") ?? ""
      let taysi = href
      if (href && !/^https?:\/\//i.test(href)) {
        try {
          taysi = new URL(href, sivunOsoite).toString()
        } catch {
          taysi = href
        }
      }
      return { href: taysi, teksti: $(a).text().replace(/\s+/g, " ").trim() }
    })
}

/*
 * ONKO KUVAUS PELKKIA LIITEOTSIKOITA (D-334).
 *
 * Kokemaen listasivulla haitarin tekstisisalto on vain liitteiden
 * nimia: "Kaavaluonnos Kaavaselostus Osallistumis- ja
 * arviointisuunnitelma (OAS) Seurantalomake Kaavakartta ja maaraykset
 * A4". Sellaista ei saa jattaa kuvauksen alkuun, kun selostuksesta
 * saadaan oikea teksti.
 *
 * TARKKA YHTASUURUUS EI RIITA, ja kuivaharjoitus kertoi sen: lohkon
 * tekstissa on "(OAS)" joka on linkin ULKOPUOLELLA, joten pelkistetty
 * vertailu linkkien tekstien yhdisteeseen ei osunut. Siksi linkkien
 * tekstit poistetaan kuvauksesta ja katsotaan mita jaa: jos jaljelle
 * jaa alle `JAANNOS_RAJA` kirjainta, kuvauksessa ei ole omaa sisaltoa.
 */
const JAANNOS_RAJA = 25

/*
 * KUVAUS ILMAN LIITEOTSIKOITA (D-335).
 *
 * Paraisten lohkoissa pituus tulee TOISTUVISTA ilmoitusriveista ja
 * liitenimista:
 *
 *   "Kaavaehdotus on ollut julkisesti nahtavana 11.9-13.10.2025:
 *    Kaavaehdotus merkkienselityksineen Kaavaselostus liitteineen
 *    Luontoselvitys 2025 ... Aloitusvaiheen aineisto, kaava on
 *    ilmoitettu vireille lehti-ilmoituksella 6.6.2024: ..."
 *
 * 461 merkkia, nolla hankesisaltoa. Mitattu 23.10.2026: viisi
 * Paraisten lohkoa yhdeksasta oli tassa tilassa, eli kynnyksen takana
 * vaarin perustein.
 */
export function omaSisalto(
  kuvaus: string | null | undefined,
  linkit: { teksti?: string | null }[]
): string {
  let jaannos = String(kuvaus ?? "")
  /* Pisin ensin, jottei lyhyt otsikko syo pidemman osaa. */
  for (const l of [...linkit]
    .map((x) => String(x.teksti ?? "").trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)) {
    jaannos = jaannos.split(l).join(" ")
  }
  return jaannos.replace(/\s+/g, " ").trim()
}

export function onVainLiiteotsikot(
  kuvaus: string | null | undefined,
  linkit: { teksti?: string | null }[]
): boolean {
  const teksti = String(kuvaus ?? "").trim()
  if (!teksti) return true
  if (!linkit.length) return false

  const kirjaimia = (omaSisalto(teksti, linkit).match(/[A-Za-zÀ-ɏ]/g) ?? []).length
  return kirjaimia < JAANNOS_RAJA
}

/*
 * Palauttaa kuvauksen, johon liitteen tavoiteluku on yhdistetty. Jos
 * liitetta ei ole, siita ei saada tekstia tai kuvaus on jo riittava,
 * palautetaan alkuperainen kuvaus muuttumattomana.
 */
export async function taydennaKuvausLiitteesta(
  kuvaus: string | null,
  linkit: { href?: string | null; teksti?: string | null }[],
  budjetti: LiiteBudjetti,
  kynnys: number = OHUEN_KUVAUKSEN_RAJA
): Promise<string | null> {
  /*
   * KYNNYS OMAA SISALTOA VASTEN, ei raakaa pituutta (D-335). Tama vain
   * LISAA hakuja siella missa pohja oli tayteaineista; aito kappale jaa
   * yha kynnyksen ylle eika sita haeta turhaan. Hakujen maaran kattaa
   * `budjetti.raja` per ajo.
   */
  if (omaSisalto(kuvaus, linkit).length >= kynnys) return kuvaus
  if (budjetti.haettu >= budjetti.raja) return kuvaus

  const asiakirja = valitseKaavanAsiakirja(linkit)
  if (!asiakirja) return kuvaus

  budjetti.haettu += 1
  const teksti = await haeKaavaselostuksenTeksti(asiakirja)
  const liitteenKuvaus = teksti ? kaavanKuvausTekstista(teksti) : null
  if (!liitteenKuvaus) return kuvaus

  return yhdistaKuvaukset(kuvaus, liitteenKuvaus)
}

/*
 * KAAVAN OMA LOHKO OTSIKON PERUSTEELLA (D-353).
 *
 * Johannes 26.10.2026: *"eiko tuo lohkorajaus ole pakko tehda jos
 * halutaan se kuvaus hyvin tehtya?"* -- on, ja yleinen ratkaisu on
 * olemassa. Aiempi yritys (D-352) etsi lohkoa otsikon ISANTAelementista
 * ylospain, ja se osui joko liian laajaan sailioon (toisen kaavan
 * selostus) tai ei mihinkaan. Oikea suunta on ETEENPAIN: kaavan liitteet
 * ovat otsikon JALKEEN, ja lohko loppuu seuraavaan samantasoiseen
 * otsikkoon.
 *
 * Kaksi sivurakennetta, joista kumpikin toimii samalla saannolla:
 *
 *   <h2>Kaava A</h2> <ul>...liitteet...</ul> <h2>Kaava B</h2>
 *   <div class="lohko"> <h2>Kaava A</h2> <ul>...</ul> </div>
 *
 * Ensimmaisessa sisarukset haetaan otsikon tasolta, toisessa otsikon
 * oma sailio sisaltaa vain taman kaavan. Siksi: kerataan sisarukset
 * seuraavaan otsikkoon asti, ja jos niista ei loydy linkkeja, otetaan
 * otsikon sailio -- mutta vain jos siina on yksi otsikko.
 */
export function lohkonLinkit(
  $: CheerioAPI,
  sivunOsoite: string,
  otsikko: string,
  tasma: (otsikkoSivulla: string, haettu: string) => boolean
): { href: string; teksti: string }[] | null {
  const OTSIKOT = "h1, h2, h3, h4, h5, summary, dt"
  const osumat = $(OTSIKOT)
    .toArray()
    .filter((el) => tasma($(el).text().replace(/\s+/g, " ").trim(), otsikko))

  for (const el of osumat) {
    const taso = ($(el)[0] as any).tagName?.toLowerCase() ?? ""
    const kerays: any[] = []
    let n = $(el).next()
    let askel = 0
    while (n.length && askel < 12) {
      const nimi = (n[0] as any).tagName?.toLowerCase() ?? ""
      /* Seuraava samantasoinen tai ylempi otsikko paattaa lohkon. */
      if (/^h[1-5]$/.test(nimi) || nimi === "summary" || nimi === "dt") {
        if (nimi <= taso || !/^h[1-5]$/.test(taso)) break
      }
      kerays.push(n)
      n = n.next()
      askel += 1
    }

    const sisarusten = kerays.flatMap((osa) => liitelinkit($, sivunOsoite, osa))
    const pdf = (lista: { href: string; teksti: string }[]) =>
      lista.filter((l) => /\.pdf(\?|$)/i.test(l.href))
    if (pdf(sisarusten).length) return pdf(sisarusten)

    /* Otsikko on lohkon sisalla: sailio kelpaa jos siina on vain tama otsikko. */
    let p = $(el).parent()
    for (let i = 0; i < 4 && p.length; i++) {
      const linkit = pdf(liitelinkit($, sivunOsoite, p))
      if (linkit.length) {
        if (p.find(OTSIKOT).length <= 1) return linkit
        break
      }
      p = p.parent()
    }
  }

  return null
}
