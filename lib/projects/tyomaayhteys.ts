/*
 * ONKO TÄMÄ IHMINEN TYÖMAAYHTEYS? (D-381)
 *
 * Yritysrekisteri ja hankkeen yhteyshenkilöt ovat myynnin soittolista
 * hankkeesta, eivät yrityksen puhelinluetteloa (D-372). Mukaan tulee
 * ihminen jonka saa kiinni **työmaasta**: työpäällikkö, työmaapäällikkö,
 * projektipäällikkö, vastaava työnjohtaja, rakennuttajainsinööri.
 *
 * YKSI MÄÄRITELMÄ, EI KAHTA. Sääntö oli kahdessa paikassa eri muodossa:
 * `kokoa-yritysrekisteri.ts` suodatti viestinnän,
 * `julkaise-yhteyshenkiloehdotukset.ts` myynnin, eikä kumpikaan
 * molempia ([[same-term-two-definitions]]).
 *
 * `viestint` EI OSU SANAAN `viestinnän`. Generaattorin kuvio oli
 * `/viestint|tiedott|media|markkinoin/i`, joka nappaa
 * "viestintäpäällikön" muttei "viestinnän asiantuntijaa" — ja juuri
 * jälkimmäisellä nimikkeellä SRV:n kaksi ihmistä päätyi rekisteriin ja
 * sitä kautta asiakkaan näkyviin kolmella hankkeella (7.11.2026).
 *
 * PIENEN YHTIÖN TOIMITUSJOHTAJA EI OSU TÄHÄN eikä saa osua: hän on
 * usein lähin — joskus ainoa — ihminen joka vastaa työmaasta
 * ([[register-is-worksite-contacts]]). Karsitaan rooli, ei tasoa.
 */

/*
 * Viestintä kaikissa taivutusmuodoissa: `viestin` kattaa sekä
 * "viestintäpäällikkö" että "viestinnän asiantuntija".
 */
const VIESTINTA = /viestin|tiedott|\bmedia|markkinoin/i

/*
 * Myynti — ROOLISANOINA, ei alkuliitteenä.
 *
 * Ensimmäinen versio oli `\bmyy`, ja oma testi paljasti sen heti:
 * "Projektipäällikkö, **Myyr**mäen hanke" olisi karsiutunut
 * myyntirooliksi. Paikannimi ei ole rooli.
 *
 * `lkv`/`ykv`/`lvv` ovat kiinteistönvälittäjän pätevyyksiä, joista
 * tunnistaa asuntomyyjän silloinkin kun nimike on pelkkä "päällikkö".
 */
const MYYNTI =
  /\bmyyj[aä]|\bmyyntip|\bmyynnin|\bmyynti\b|asuntomyy|\bsales\b|\b(lkv|ykv|lvv)\b|kaupallinen johtaja/i

/*
 * HANKESANA KUMOAA KARSINNAN.
 *
 * Nimike voi olla seka-aikainen: "Myynti- ja hankekehityspäällikkö" on
 * puoliksi hankekehitystä, ja silloin ihminen on hankkeen puolella.
 * Mitattu 7.11.2026: ilman tätä sääntö olisi karsinut BRAND
 * toimitilojen ainoan merkinnän.
 *
 * `asiakaspäällikkö` jätettiin kokonaan pois karsinnasta: omistajan
 * puolella (Senaatti-kiinteistöt) hän on aito vastinpari hankkeelle,
 * toisin kuin urakoitsijan myyjä.
 */
const HANKESANA =
  /hankekehity|hankejohta|hankep[aä][aä]llik|projekti|ty[oö]maa|ty[oö]p[aä][aä]llik|rakennutta/i

/* Hallinto: ei vastaa työmaasta eikä osta työmaalle. */
const HALLINTO = /talousjohtaj|rekrytoint|henkil[oö]st[oö]|\bhr\b|lakimies|juristi|transaktiojohtaj/i

/**
 * Tosi, kun nimike kertoo roolin joka EI ole työmaayhteys.
 * Tyhjä nimike ei ole peruste hylätä — moni aito merkintä on ilman.
 */
export function eiTyomaaRooli(nimike: string | null | undefined): boolean {
  const teksti = String(nimike ?? "").trim()
  if (!teksti) return false
  if (HANKESANA.test(teksti)) return false
  return VIESTINTA.test(teksti) || MYYNTI.test(teksti) || HALLINTO.test(teksti)
}
