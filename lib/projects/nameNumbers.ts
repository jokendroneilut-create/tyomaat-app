/*
 * Nimessä olevat yksilöivät numerot.
 *
 * Kaavoituksessa ja katuosoitteissa NUMERO ON IDENTITEETTI: "Vellamonkatu 11"
 * ja "Vellamonkatu 8" ovat eri tontti, "295 Pereen asemakaavan muutos" ja
 * "289 Pereen asemakaavan muutos" eri kaava. Täsmäytys ei nähnyt tätä
 * lainkaan, koska titleWords pudottaa alle neljän merkin sanat - "11", "8",
 * "295" ja "XVI" katosivat ennen vertailua, jolloin nimistä jäi jäljelle
 * täsmälleen sama sanajoukko.
 *
 * Mitattu täydestä skannauksesta: 65 katselmoitavasta parista 48 oli
 * kaavapareja ja 34:llä numero erosi - eli noin puolet jonosta oli tätä
 * yhtä syytä.
 *
 * Vaikutus on RAJOITTAVA, ei estävä (vrt. contractTrade.ts, joka estää
 * kokonaan). Eri numero laskee varmuuden yhdistämiskynnyksen alle, jolloin
 * pari jää ihmisen katsottavaksi ehdotuksena. Näin jäädään turvalliselle
 * puolelle myös silloin kun numero ei olekaan tunniste vaan mittaluku -
 * uutisotsikossa voi lukea "48 asuntoa" ja toisessa lähteessä "50 asuntoa"
 * samasta hankkeesta.
 */

/*
 * Numerotunnisteet: 1-4 numeroa omana sanana sekä roomalaiset numerot
 * (kaupunginosat kirjoitetaan niillä, esim. "XVI (Tammela)", "Kyyhkylä II").
 *
 * Sanan sisällä olevaa numeroa ei poimita, koska se on osa tunnistetta eikä
 * erottava luku: "FIN04A" ja "Ph2" ovat kokonaisia niminä eivätkä saa
 * pilkkoutua.
 */
const NUMBER_TOKEN = /(?<![\p{L}\d])\d{1,4}(?![\p{L}\d])/gu
const ROMAN_TOKEN = /(?<![\p{L}\d])[IVX]{1,4}(?![\p{L}\d])/gu

export function extractNameNumbers(name: string | null | undefined): string[] {
  if (!name) return []

  const numbers = name.match(NUMBER_TOKEN) ?? []
  /*
   * Roomalaiset vain isoilla kirjaimilla. Pienellä kirjoitettu "i" tai "x"
   * on lähes aina osa sanaa, ei numero.
   */
  const romans = (name.match(ROMAN_TOKEN) ?? []).map((value) =>
    value.toLowerCase()
  )

  return [...numbers, ...romans].sort()
}

/*
 * Eroavatko nimien numerot?
 *
 * Vaaditaan että MOLEMMILLA on numeroita: jos vain toisessa on, kyse on
 * yleensä tarkentavasta lisäyksestä eikä erosta ("Oulun elämysareena ja
 * ympäristö, Rata-aukio 2" vs "Oulun elämysareena").
 *
 * Vertailu tehdään koko joukkona, ei leikkauksena: "Asemakaava 853 14/2021"
 * ja "Asemakaava 853 5/2021" jakavat numerot 853 ja 2021, mutta ovat silti
 * eri kaava. Yksikin ero riittää.
 */
export function haveDifferentNameNumbers(
  first: string | null | undefined,
  second: string | null | undefined
): boolean {
  const a = extractNameNumbers(first)
  const b = extractNameNumbers(second)

  if (a.length === 0 || b.length === 0) return false

  return a.join(",") !== b.join(",")
}
