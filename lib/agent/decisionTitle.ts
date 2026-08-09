/*
 * Päätösotsikon yleistäminen hankkeen nimeksi.
 *
 * Kunnan otsikko nimeää PÄÄTÖKSEN, ei hanketta:
 *
 *   "Puhjon risteyssilta (W) korjausurakka 2026 (KU), korjausurakan
 *    kilpailuttaminen, kilpailutusperiaatteet (salassa pidettävä,
 *    julkisuuslaki 6.1 § 2)"
 *
 * Sama silta esiintyy jonossa toisenkin kerran nimellä "Puhjon risteyssilta
 * (W) korjausurakka, 2026 (KU) – urakan hankinta". Ne ovat sama hanke eri
 * päätösvaiheissa, mutta otsikot eivät täsmää, joten ne näkyvät kahtena.
 *
 * SOKEA POISTO OLISI VÄÄRIN. Mitattu aineistosta ennen sääntöjen
 * kirjoittamista:
 *
 *   - Yleisin pilkulla erotettu häntä on KAUPUNGINOSA (Malmi 19, Vartiokylä
 *     15, Kaarela 15, Jätkäsaari 14...). Se on sijaintitietoa, ei roskaa.
 *   - Sulkeissa on osoitteita ja kaupunginosia ("(31. kaupunginosa,
 *     Kangas)", "(Åbohusvägen 3, Östra centrum)"), ei vain koodeja.
 *
 * Siksi poisto perustuu SANASTOON eikä välimerkkeihin: poistetaan vain ne
 * jaksot jotka nimeävät päätöslajin.
 */

/*
 * Salassapitomerkintä kertoo LIITTEESTÄ, ei hankkeesta: tarjouspyyntö
 * tulee julkiseksi vasta kun hankinta on tehty (JulkL 6 § 1 mom 2 k).
 * Itse asiasivu on kunnan julkaisema ja julkinen, eikä liitteitä haeta.
 * Merkintä ei siis kuulu hankkeen nimeen.
 */
const CONFIDENTIALITY = /\s*\((?:salassa\s*pidett|julkisuuslaki|julkl)[^)]*\)/gi

/*
 * Päätöslajit. Nämä kuvaavat mitä kokouksessa tehtiin, eivät mitä
 * rakennetaan. Poistetaan vain kun jakso on kokonainen pilkulla tai
 * ajatusviivalla erotettu osa - keskeltä poistaminen katkaisisi lauseen.
 */
const DECISION_KINDS = [
  "kilpailutusperiaatteet",
  "korjausurakan kilpailuttaminen",
  "rakennusurakan kilpailuttaminen",
  "urakan kilpailuttaminen",
  "urakan hankinta",
  "urakoitsijan valinta",
  "urakoitsijoiden valinta",
  "hankintapäätös",
  "hankinnan keskeyttäminen",
  "uudelleen kilpailutus",
  "suunnittelijan valinta",
]

/*
 * Erottimet joilla häntä on liitetty. Ajatusviiva on Kouvolassa yleinen
 * ("... – urakan hankinta"), pilkku muualla.
 *
 * VÄLIVIIVA VAATII VÄLILYÖNNIN EDELLÄ. Ilman sitä kuvio osui yhdyssanan
 * sisään: "Puuppolan hoivasairaalan purku-urakoitsijan valinta" katkesi
 * muotoon "Puuppolan hoivasairaalan purku".
 */
const TAIL = new RegExp(
  `(?:\\s*,\\s*|\\s+[–—-]\\s*)(?:${DECISION_KINDS.join("|")})\\s*$`,
  "i"
)

/*
 * Vuosiluku ja kuntakoodi sulkeissa lopussa ("2026 (KU)"). Nämä erottavat
 * saman kohteen eri vuosien urakat, joten ne poistetaan vain otsikon
 * lopusta - keskellä ne voivat olla osa kohteen nimeä.
 */
const YEAR_CODE = /\s*,?\s*\d{4}(?:\s*\(\d{4}\))*\s*(?:\([A-ZÅÄÖ]{1,3}\))?\s*$/

/*
 * Vuosilukua ei irroteta jos se on osa ilmausta: "pieniä purkutöitä
 * vuodelle 2026" katkesi muotoon "...vuodelle". Sana ennen vuotta kertoo
 * kumpi on kyseessä.
 */
const YEAR_BELONGS_TO_PHRASE = /\b(?:vuo\w+|kaudel\w+|ajal\w+|mennessä)\s*$/i

/*
 * "…hankesuunnitelman hyväksyminen" -> "…hankesuunnitelma".
 *
 * Yleisin hallinnollinen häntä koko aineistossa: 177 otsikkoa päättyy
 * sanaan "hyväksyminen", ja niistä 172 on muotoa <asiakirja>n hyväksyminen.
 * Otsikko nimeää siis kokouksen toimenpiteen, ei hanketta:
 *
 *   "Tuohimäen päiväkodin elinkaarta jatkavan korjauksen
 *    hankesuunnitelman hyväksyminen"
 *
 * PELKKÄ HÄNNÄN POISTO EI RIITÄ. Se jättäisi genetiivin roikkumaan
 * ("...korjauksen hankesuunnitelman"), joten poisto ja sijamuodon muunnos
 * tehdään yhdessä - tai ei ollenkaan.
 *
 * Muunnos rajataan asiakirjatyyppeihin joita aineistossa esiintyy.
 * Tunnistamattomasta genetiivistä ("muutoksen hyväksyminen") otsikko
 * jätetään koskematta: väärä nominatiivi olisi huonompi kuin pitkä otsikko.
 */
const APPROVAL_TAIL = /\s+hyväksyminen\s*$/i

const GENITIVE_TO_NOMINATIVE: [RegExp, string][] = [
  [/suunnitelmien$/i, "suunnitelmat"],
  [/suunnitelman$/i, "suunnitelma"],
  [/selvityksen$/i, "selvitys"],
  [/ehdotuksen$/i, "ehdotus"],
]

function dropApprovalTail(title: string): string {
  if (!APPROVAL_TAIL.test(title)) return title

  const withoutTail = title.replace(APPROVAL_TAIL, "").trim()

  for (const [genitive, nominative] of GENITIVE_TO_NOMINATIVE) {
    if (!genitive.test(withoutTail)) continue

    const converted = withoutTail.replace(genitive, nominative)

    /*
     * RINNASTEINEN ASIAKIRJA MYÖS. "Mikkelänpellon puistosuunnitelman ja
     * sillan siltasuunnitelman hyväksyminen" jäi muotoon "...puisto-
     * suunnitelmaN ja ...siltasuunnitelma", eli sijamuoto vaihteli saman
     * rinnastuksen sisällä. Muunnos rajautuu samoihin asiakirjatyyppeihin,
     * joten "Koulun ja päiväkodin hankesuunnitelma" ei muutu.
     */
    return converted.replace(
      /([\wåäöÅÄÖ-]*(?:suunnitelman|suunnitelmien|selvityksen|ehdotuksen))(\s+ja\s)/gi,
      (_, word: string, tail: string) => {
        for (const [g, n] of GENITIVE_TO_NOMINATIVE) {
          if (g.test(word)) return word.replace(g, n) + tail
        }
        return word + tail
      }
    )
  }

  return title
}

export type TitleCleanOptions = {
  /*
   * Vuosiluvun poisto on valinnainen, koska se hävittää eron saman kohteen
   * peräkkäisten vuosien urakoiden välillä. Oletuksena pois.
   */
  dropYear?: boolean
}

export function genericizeDecisionTitle(
  title: string | null | undefined,
  options: TitleCleanOptions = {}
): string {
  if (!title) return ""

  let out = title.replace(CONFIDENTIALITY, "")

  /*
   * Häntiä voi olla useita peräkkäin ("..., korjausurakan kilpailuttaminen,
   * kilpailutusperiaatteet"), joten poistetaan kunnes ei enää osu.
   */
  for (let i = 0; i < DECISION_KINDS.length; i++) {
    const next = out.replace(TAIL, "")
    if (next === out) break
    out = next
  }

  out = dropApprovalTail(out.trim())

  if (options.dropYear) {
    const ilmanVuotta = out.replace(YEAR_CODE, "")
    if (!YEAR_BELONGS_TO_PHRASE.test(ilmanVuotta)) out = ilmanVuotta
  }

  /* Roikkuvat välimerkit pois, mutta sulkeet ja pisteet säilyvät. */
  return out.replace(/\s*[,;:–—-]\s*$/, "").replace(/\s+/g, " ").trim()
}
