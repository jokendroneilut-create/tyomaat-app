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
  if ((kuvaus ?? "").length >= kynnys) return kuvaus
  if (budjetti.haettu >= budjetti.raja) return kuvaus

  const asiakirja = valitseKaavanAsiakirja(linkit)
  if (!asiakirja) return kuvaus

  budjetti.haettu += 1
  const teksti = await haeKaavaselostuksenTeksti(asiakirja)
  const liitteenKuvaus = teksti ? kaavanKuvausTekstista(teksti) : null
  if (!liitteenKuvaus) return kuvaus

  return yhdistaKuvaukset(kuvaus, liitteenKuvaus)
}
