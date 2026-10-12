/*
 * HANKKEEN LAAJUUS: KOKO RAKENNUS VAI YKSI URAKKA? (D-274)
 *
 * Rakennustyyppi kertoo MIKA rakennus, ei MITA siinä tehdaan. Mitattu
 * 12.10.2026 niista 929 hankkeesta joilla kustannus on tiedossa:
 *
 *   Koulu              n=84   mediaani 3,3 M€   p25 258 k€ … p75 17,7 M€
 *   Kulttuurirakennus  n=26   mediaani 4,9 M€   p25 219 k€ … p75 25,0 M€
 *
 * Eli saman tyypin sisalla on satakertainen ero. Syy ei ole hajonta
 * vaan se etta sama tyyppi kattaa kaksi eri asiaa: koulun
 * uudisrakennus ja koulun sprinkleriurakka ovat molemmat "Koulu".
 *
 * Ilman tata ulottuvuutta "mita tamantyyppinen hanke yleensa maksaa"
 * -arvio olisi vaarassa kertaluokan verran, ja arviona esitettynakin
 * se harhauttaisi.
 *
 * JARJESTYS RATKAISEE. Luokat tutkitaan kapeimmasta laveimpaan:
 * "koulun sprinklerijarjestelman hankinta" on osaurakka vaikka siina
 * lukee myos "koulu", ja "paivakodin laajennus" on laajennus vaikka
 * siina lukee "rakentaminen".
 */

export type HankkeenLaajuus =
  | "osaurakka"
  | "purku"
  | "korjaus"
  | "laajennus"
  | "uudisrakennus"
  | "kaavoitus"

/*
 * Osaurakka = yksi tekniikkalaji tai rakennusosa, ei koko rakennus.
 * Naiden hinta on kertaluokkaa pienempi kuin koko kohteen.
 *
 * SANA "HANKINTA" EI KELPAA TUNNISTEEKSI, vaikka se esiintyy lahes
 * jokaisessa osaurakan otsikossa: Hilman otsikot paattyvat siihen myos
 * kokonaisista rakennuksista. Mitattu 12.10.2026: "Ruoveden pelastus-
 * ja ensihoitoaseman hankinta vuokramallilla" on koko asema, ei
 * osaurakka ([[vuokramalli-is-construction]]).
 */
const OSAURAKKA =
  /\b(lvi|iv-|ilmanvaihto|sprinkler|sammutusj|putki|viemäri|linjasaneeraus|sähköura|sähköasenn|automaatiourak|hissi|katto(?:saneeraus|urakka|remontti)|peltikatto|vesikat|julkisivu|ikkuna|salaoj|maalausurak|väliseinä|keittiöurak|kalusteurak|varusteurak|irtaimist|pysäköintij|valaistus|teräsrakenne|peltirakenne|louhin|maanrakennusurak|pohjatyö|piha-?urak|puitesopimus|puitejärjest|aikaveloitus)/i

/* Purku on oma lajinsa: hinta ei vertaudu rakentamiseen. */
const PURKU = /\b(purku|puretaan|purkutyö|purkuurak|purkamis)/i

const KORJAUS =
  /\b(peruskorja|perusparann|saneeraus|saneerat|korjausurak|korjaushank|kunnostus|kunnostet|remontti|restauroi|muutostyö|käyttötarkoituksen muutos)/i

/*
 * "Korottaminen" EI kelpaa laajennuksen merkiksi: Hilmassa korotetaan
 * useimmiten hankesuunnitelman enimmaishintaa, ei rakennusta.
 * Mitattu 12.10.2026: "Konalan pelastusaseman uudisrakennuksen
 * hankesuunnitelman enimmaishinnan korottaminen" luokittui
 * laajennukseksi.
 */
const LAAJENNUS = /\b(laajennus|laajenne|laajentam|lisärakenn)/i

/*
 * URAKKAMUOTO EI OLE LAAJUUS. "Kokonaisurakka", "KVR-urakka" ja
 * "projektinjohtourakka" kertovat sopimusmallin, eivat sita mita
 * tehdaan: "Kokonaisurakka Jyvaskylan yliopiston Agora-rakennuksen
 * 5. kerroksen tilamuutoksista" on korjaus, ei uudisrakennus
 * (mitattu 12.10.2026).
 */
const UUDISRAKENNUS =
  /\b(uudisrakenn|uusi\s|uuden\s|uutta\s|rakennetaan|rakentuu|rakentaa|nousee|toteuttaa|valmistuu|rakennushank)/i

const KAAVOITUS = /\b(asemakaava|kaavamuutos|kaavan muutos|osayleiskaava|ranta-?asemakaava|kaavoitus|kaavaehdotus|kaavaluonnos)/i

/*
 * Vain OTSIKOSTA. Kuvauksen ensimmaiset sadat merkit ovat usein
 * aluekuvausta, ja sielta poimittu sana on lahes aina vaara — sama
 * oppi kuin rakennustyypissa (D-274, mitattu samana paivana: runko
 * antoi tyypin "Kirjasto" aurinkovoima-osayleiskaavalle).
 */
export function hankkeenLaajuus(otsikko: string | null | undefined): HankkeenLaajuus | null {
  const teksti = String(otsikko ?? "")
  if (!teksti.trim()) return null

  if (KAAVOITUS.test(teksti)) return "kaavoitus"
  if (OSAURAKKA.test(teksti)) return "osaurakka"
  if (PURKU.test(teksti)) return "purku"
  if (LAAJENNUS.test(teksti)) return "laajennus"
  if (KORJAUS.test(teksti)) return "korjaus"
  if (UUDISRAKENNUS.test(teksti)) return "uudisrakennus"

  return null
}
