/*
 * EI-RAKENTAMISEN HANKINNAT POIS HILMAN TUONNISTA (D-346).
 *
 * Johannes 25.10.2026 jonosta: *"jonossa on paljon avoterapiahankintoja?
 * Miksi? korjataan ja siivoa jono"* -- Kelan ratsastus-, musiikki- ja
 * perheterapian tarjouspyyntoja, CPV 85000000.
 *
 * MIKSI NE TULEVAT. Keraajan kysely on `cpvCodes:(45*)`, mutta Azure
 * Searchin oletus on `queryType: "simple"`, jossa kenttakohtaista
 * syntaksia `kentta:(arvo)` EI tueta -- se luetaan pelkkina sanoina, ja
 * `searchMode: "any"` paastaa lapi rivin jolla osuu yksi sana.
 *
 * Mitattu 25.10.2026 samalla kyselylla (100 ilmoitusta/sivu):
 *
 *   nykyinen (simple + any)   43 356 osumaa, 21 / 100 ilman 45*-koodia
 *   queryType: "full"         36 426 osumaa,  0 / 100 ilman 45*-koodia
 *
 * KYSELYA EI SILTI TIUKENNETA, ja tama on mittauksen tulos eika
 * mielipide: leveä verkko tuo hankkeita joita tiukka kysely EI toisi.
 * Hyvaksytyista 939 Hilma-hankkeesta **15:lla ei ole yhtaan 45*-koodia**
 * -- yhdeksan on suunnittelu-urakoita (CPV 71: "Piiluvan kurssi- ja
 * tapahtumakeskuksen paa- ja arkkitehtisuunnittelu", "Siltojen ja
 * taitorakenteiden suunnittelu"), loput kalustehankintoja, purkua ja
 * kiinteistoautomaatiota. Tiukka kysely olisi pudottanut ne kaikki.
 *
 * SIKSI SUODATUS TEHDAAN TUONNISSA, EI KYSELYSSA, ja vain niista
 * perheista joista EI OLE KOSKAAN tullut hyvaksyttya hanketta.
 * Jakauma Hilman riveista 25.10.2026 (hyvaksytty / hylatty+ohitettu):
 *
 *   85  terveys- ja sosiaalipalvelut     0 / 26   <- Kelan terapiat
 *   79  liikkeenjohdon palvelut          0 / 16
 *   38  laboratorio- ja mittauslaitteet  0 / 11
 *   60  kuljetuspalvelut                 0 /  9
 *   64  posti- ja teleliikenne           0 /  7
 *   30  toimistokoneet                   0 /  5
 *
 * Alle viiden hylkayksen perheita EI oteta listalle (75, 18, 73, 80,
 * 55, 15, 03...): naytto on liian ohut, ja vaara esto ei jata jalkea
 * jonoon ([[test-filter-against-approved]]).
 *
 * PERHEET JOISTA ON TULLUT EDES YKSI HYVAKSYTTY JAAVAT: 33 (PET/TT-laite
 * hylattiin, mutta sairaalalaitehankinta 1 kpl meni lapi), 50, 72, 90,
 * 48, 98. Ne pysyvat katselmoinnin paatettavina.
 *
 * 45* KUMOAA ESTON. Sairaalan uudisrakennus voi kantaa seka 45- etta
 * 85-koodin, ja silloin se on rakennushanke.
 */

/* Perheet joista ei ole koskaan tullut hyvaksyttya hanketta (>= 5 hylkaysta). */
export const EI_RAKENTAMISEN_PERHEET = ["85", "79", "38", "60", "64", "30"] as const

/* Kentta voi olla taulukko TAI valilyonnein eroteltu merkkijono. */
export function cpvKoodit(raaka: unknown): string[] {
  const lista = Array.isArray(raaka) ? raaka : raaka == null ? [] : [raaka]
  return lista
    .flatMap((c: any) => String(c?.code ?? c).split(/[\s,;]+/))
    .map((c) => c.trim())
    .filter(Boolean)
}

/*
 * Palauttaa estetyn perheen jos ilmoitus on selvasti muuta kuin
 * rakentamista, muuten null. Null = otetaan mukaan, myos silloin kun
 * koodia ei ole lainkaan ([[never-hide-on-missing-data]]).
 */
export function estettyPerhe(raaka: unknown): string | null {
  const koodit = cpvKoodit(raaka)
  if (!koodit.length) return null
  if (koodit.some((c) => c.startsWith("45"))) return null

  const perheet = new Set(koodit.map((c) => c.slice(0, 2)))
  for (const p of perheet) {
    if (!(EI_RAKENTAMISEN_PERHEET as readonly string[]).includes(p)) return null
  }
  return [...perheet].sort().join("+")
}
