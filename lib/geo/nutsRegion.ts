/*
 * NUTS-KOODI MAAKUNNAKSI.
 *
 * MIKSI. Hilman ilmoituksessa on rakenteinen alueen koodi (`nutsCodes`),
 * mutta maakunta johdettiin vain kunnasta: jos kuntaa ei tunnistettu,
 * maakunta jäi tyhjäksi vaikka alue oli tiedossa. Fingridin "IV03 -
 * Ivalon sähköaseman uusiminen" kantoi koodia `FI1D7` eli Lappia, ja
 * kannassa oli `region: null` (D-292).
 *
 * Mitattu 16.10.2026: 1 448 Hilma-dokumentissa 1 544:stä on nutsCodes,
 * ja 73 jonorivillä on maakuntatasoinen koodi mutta ei maakuntaa.
 *
 * KARTTA ON JOHDETTU OMASTA AINEISTOSTA, EI MUISTISTA. Ensimmäinen
 * versio kirjoitettiin muistinvaraisesti ja siinä oli neljä virhettä:
 * `FI198` ei ole Pirkanmaa vaan Keski-Suomi, `FI199` ei ole Keski-Suomi
 * vaan Etelä-Pohjanmaa, `FI1C6` ei ole Satakunta vaan Päijät-Häme, ja
 * Etelä-Savon koodi on `FI1DA` eikä `FI1DD`. Lisäksi siinä oli kymmenen
 * koodia joita aineistossa ei esiinny lainkaan.
 *
 * Kartta johdettiin riveistä joilla on SEKÄ maakunta ETTÄ yksi
 * NUTS-koodi (`scripts/_nutskartta.ts`-tyyppinen ajo): koodi hyväksyttiin
 * vain jos ääniä oli vähintään 3 ja yksimielisyys vähintään 90 %.
 * Yksimielisyys oli 91-100 %; loput ovat rajatapauksia, joissa kunta
 * kuuluu naapurimaakuntaan.
 *
 * PALJAS "FI" EI OLE MAAKUNTA. Koodilla `FI` oli 134 ääntä, jotka
 * jakautuivat 16 eri maakuntaan — se tarkoittaa koko Suomea ("Kelan
 * kiinteistöjen arviointi", "moottorikelkkaurien tienylityspaikat").
 * Sen kääntäminen miksi tahansa maakunnaksi olisi keksitty tieto.
 * Sama koskee ulkomaisia koodeja: `ITH35` on Venetsia.
 *
 * AHVENANMAA (`FI200`) PUUTTUU TARKOITUKSELLA: ääniä oli 2, eli alle
 * kynnyksen. Koodi on todennäköisesti oikein, mutta sitä ei lisätä
 * ennen kuin aineisto sanoo niin — tyhjä maakunta ei valehtele.
 */

export const NUTS_MAAKUNNAT: Record<string, string> = {
  FI196: "Satakunta",
  FI198: "Keski-Suomi",
  FI199: "Etelä-Pohjanmaa",
  FI19A: "Pohjanmaa",
  FI19B: "Pirkanmaa",
  FI1B1: "Uusimaa",
  FI1C1: "Varsinais-Suomi",
  FI1C2: "Kanta-Häme",
  FI1C5: "Etelä-Karjala",
  FI1C6: "Päijät-Häme",
  FI1C7: "Kymenlaakso",
  FI1D5: "Keski-Pohjanmaa",
  FI1D7: "Lappi",
  FI1D8: "Kainuu",
  FI1D9: "Pohjois-Pohjanmaa",
  FI1DA: "Etelä-Savo",
  FI1DB: "Pohjois-Savo",
  FI1DC: "Pohjois-Karjala",
}

/*
 * Maakunta koodilistasta. Kenttä voi sisältää useita koodeja
 * välilyönnein eroteltuna, ja tuntematon koodi on ESTE eikä ohitettava:
 * "FI" ja "ITH35" eivät ole maakuntia, ja niiden sivuuttaminen tekisi
 * monialuehankkeesta yksialueisen.
 *
 * Kahden maakunnan hanke (esim. voimajohto) jätetään tyhjäksi, koska
 * puolet alueesta olisi väärä vastaus.
 */
export function maakuntaNutsKoodista(koodit: string | null | undefined): string | null {
  if (!koodit) return null

  const osat = String(koodit)
    .trim()
    .split(/[\s,;]+/)
    .filter(Boolean)
  if (!osat.length) return null

  const maakunnat = new Set<string>()
  for (const osa of osat) {
    const maakunta = NUTS_MAAKUNNAT[osa.toUpperCase()]
    if (!maakunta) return null
    maakunnat.add(maakunta)
  }

  return maakunnat.size === 1 ? [...maakunnat][0] : null
}
