/*
 * LIITTYVIEN YRITYSTEN LISTA (D-248).
 *
 * `related_companies` on hankkeen osapuolet joilla ei ole omaa saraketta:
 * suunnittelija, maisema-arkkitehti, konsultti. Lista nakyy asiakkaalle
 * listarivilla paaurakoitsijan vieressa.
 *
 * Logiikka on omassa tiedostossaan eika reitin sisalla, jotta
 * kaksoiskappaleen esto on testattavissa ilman HTTP-kutsua.
 */

/* Tyhjat ja ei-merkkijonot pois; jarjestys sailyy. */
export function siivoaYritykset(arvo: unknown): string[] {
  if (!Array.isArray(arvo)) return []
  return arvo
    .filter((n): n is string => typeof n === "string")
    .map((n) => n.trim())
    .filter(Boolean)
}

/*
 * Lisaa nimen listan perään, jos sita ei jo ole.
 *
 * VERTAILU EI KATSO KIRJAINKOKOA. Lahde kirjoittaa saman yrityksen
 * milloin "LOCI Maisema-arkkitehdit", milloin "Loci maisema-arkkitehdit";
 * molemmat listalla nayttaisi asiakkaalle kahdelta yritykselta.
 *
 * ENSIN KIRJATTU MUOTO VOITTAA. Jos nimi on jo listalla, lista palautuu
 * muuttumattomana — myohempi kirjoitusasu ei korvaa aiempaa, samoin kuin
 * hankkeen nimessa (ks. [[title-precedence]]).
 */
export function lisaaYritys(nykyinen: string[], nimi: string): string[] {
  const puhdas = nimi.trim()
  if (!puhdas) return nykyinen
  if (nykyinen.some((n) => n.toLowerCase() === puhdas.toLowerCase())) return nykyinen
  return [...nykyinen, puhdas]
}
