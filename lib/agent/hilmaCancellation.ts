/*
 * KESKEYTYSILMOITUKSEN TUNNISTUS.
 *
 * Hilma julkaisee hankinnan keskeyttämisen samalla ilmoitustyypillä kuin
 * sopimuksen myöntämisen (ContractAwardNotices). Ilman tunnistusta
 * peruttu kilpailutus päätyi vaiheeseen "Sopimus myönnetty", eli
 * asiakkaalle kerrottiin että urakka on annettu jollekin - vaikka koko
 * kilpailutus peruttiin eikä ketään valittu.
 *
 * KAKSI RAKENTEISTA SIGNAALIA KOKEILTIIN JA MOLEMMAT HYLÄTTIIN.
 * Mitattu 15.8.2026, 707 Hilma-rivin aineistosta:
 *
 *   `isCancelled`  Hilman oma kenttä. Se on **false** myös ilmoituksella
 *                  jonka otsikko on "Keskeytysilmoitus, TAPO
 *                  Köyliöntien..." - varmistettu raakadatasta. Kenttä ei
 *                  kerro tästä mitään.
 *
 *   `notice_type`  Ei erottele. Tyyppi 29: 83 riviä, joista 5
 *                  keskeytyksiä. Tyyppi E4: 174 riviä, joista 5. Ne ovat
 *                  sopimusilmoituksen alatyyppejä.
 *
 * VOITTAJAN PUUTTUMINEN YKSIN ON LIIAN LÖYSÄ. 290 sopimusilmoituksesta
 * 45:ltä puuttuu voittaja, mutta vain 10 niistä on keskeytyksiä - 35
 * väärää osumaa.
 *
 * Toimiva tunnistus on OTSIKKO JA VOITTAJAN PUUTTUMINEN yhdessä: se osuu
 * kaikkiin 11 keskeytysriviin eikä yhteenkään väärään. Voittajaehto on
 * turva sille tapaukselle että ilmoitus keskeyttää vain yhden osan ja
 * myöntää toisen - silloin voittaja on merkitty eikä hanketta saa
 * palauttaa kilpailutukseen.
 */

/*
 * Mitatut otsikkomuodot: "Keskeytysilmoitus, X", "Keskeytysilmoitus: X",
 * "Keskeytys-ilmoitus-X", "KESKEYTYS: X", "JÄLKI-ILMOITUS HANKINNAN
 * KESKEYTTÄMINEN_X".
 *
 * Pelkkä "keskeytetty" on tarkoituksella pois: se esiintyy myös
 * hankkeen omassa kuvauksessa ("aiempi hanke keskeytettiin 2019") eikä
 * kerro tämän ilmoituksen luonteesta.
 */
const CANCELLATION_TITLE =
  /keskeytysilmoitus|keskeytys-ilmoitus|^keskeytys\s*[:,-]|hankinnan\s+keskeytt[äa]minen|hankinnan\s+keskeytys/i

export function titleSaysCancellation(
  title: string | null | undefined
): boolean {
  return CANCELLATION_TITLE.test(String(title ?? "").trim())
}

export function hasNoWinner(
  winners: unknown,
  winnerOrganisations: unknown
): boolean {
  const listEmpty =
    !Array.isArray(winners) || winners.length === 0
  const orgEmpty =
    winnerOrganisations === null ||
    winnerOrganisations === undefined ||
    String(winnerOrganisations).trim() === ""

  return listEmpty && orgEmpty
}

export function isCancellationNotice(input: {
  title?: string | null
  winners?: unknown
  winnerOrganisations?: unknown
}): boolean {
  if (!titleSaysCancellation(input.title)) return false
  return hasNoWinner(input.winners, input.winnerOrganisations)
}
