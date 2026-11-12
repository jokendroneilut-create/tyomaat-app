/*
 * HILMAN HANKINTANUMERO (procedure) TUNNISTEENA.
 *
 * Yksi Hilman hankinta tuottaa useita ilmoituksia — hankintailmoitus,
 * korjausilmoitus, jälki-ilmoitus — ja ne kuuluvat samalle hankkeelle.
 * Osoitteessa ne erottuvat `enotice`-numerolla mutta jakavat saman
 * `procedure`-numeron:
 *
 *   /public/procedure/35852/enotice/54692/   hankintailmoitus
 *   /public/procedure/35852/enotice/59837/   jälki-ilmoitus
 *
 * ERI PROCEDURE ON ERI HANKINTA. Jaetussa urakassa jokainen urakkalaji
 * kilpailutetaan omana hankintanaan, omalla numerollaan, omalla
 * voittajallaan ja omalla summallaan.
 *
 * MIKSI TÄMÄ ON OMA VETONSA (D-408). Urakkalajiveto (`contractTrade`)
 * ei ehdi väliin, koska se vaatii urakkalajin MOLEMMILTA puolilta:
 *
 *   "...esirakentaminen, maanrakennusurakka"  -> ["maanrakennus"]
 *   "...koulutusrakennus, jaettu urakka"      -> []  (ei lajia)
 *
 * Tyhjä joukko kytkee veton pois, ja juuri "jaettu urakka" on se nimi
 * jossa osia on eniten. Mitattu 13.11.2026 koko kannasta: Hilman
 * toistokäyntejä 70, joista **34 oli eri hankintaan** ja ne kasasivat
 * 15 hankeriviä. Pahin on Oulun yliopiston normaalikoulu: yksi rivi,
 * viisi hankintaa, viisi eri voittajaa.
 *
 * VETO VAATII TIEDON MOLEMMILTA. Jos kummaltakaan puolelta ei löydy
 * numeroa, mitään ei estetä — tuntematon ei ole eri. Sama periaate kuin
 * muissa vetoissa.
 *
 * HANKKEELLA VOI OLLA MONTA NUMEROA. Ne 15 riviä ovat jo keränneet
 * useamman, ja niiden omat ilmoitukset saavat yhä osua: veto laukeaa
 * vain jos tuleva numero ei ole yhdessäkään hankkeen numeroista.
 */

const PROCEDURE = /\/procedure\/(\d+)/

export function procedureFromUrl(url: unknown): string | null {
  const osuma = String(url ?? "").match(PROCEDURE)
  return osuma ? osuma[1] : null
}

function lisaa(joukko: Set<string>, arvo: unknown): void {
  if (arvo === null || arvo === undefined) return
  const teksti = String(arvo).trim()
  if (!teksti) return
  /* Kenttä voi olla pelkkä numero tai koko osoite. */
  const url = procedureFromUrl(teksti)
  if (url) joukko.add(url)
  else if (/^\d+$/.test(teksti)) joukko.add(teksti)
}

/*
 * Hankkeen tiedossa olevat hankintanumerot: oma kenttä, lähdeosoite ja
 * jokainen lähdehistorian käynti.
 */
export function projectProcedures(project: {
  metadata?: Record<string, any> | null
}): Set<string> {
  const meta = project?.metadata ?? {}
  const joukko = new Set<string>()

  lisaa(joukko, meta.procedure_id)
  lisaa(joukko, meta.source_url)
  lisaa(joukko, meta.documents_url)

  for (const kaynti of Array.isArray(meta.source_history) ? meta.source_history : []) {
    lisaa(joukko, kaynti?.document_url)
  }

  return joukko
}

export function candidateProcedure(candidate: {
  procedureId?: unknown
  sourceUrl?: unknown
}): string | null {
  const joukko = new Set<string>()
  lisaa(joukko, candidate?.procedureId)
  lisaa(joukko, candidate?.sourceUrl)
  return joukko.size ? [...joukko][0] : null
}

/*
 * true = eri hankinta, osumaa ei synny. false = ei estettä (sama
 * hankinta, tai numero puuttuu jommaltakummalta).
 */
export function haveDifferentProcedures(
  project: { metadata?: Record<string, any> | null },
  candidate: { procedureId?: unknown; sourceUrl?: unknown }
): boolean {
  const tuleva = candidateProcedure(candidate)
  if (!tuleva) return false

  const omat = projectProcedures(project)
  if (!omat.size) return false

  return !omat.has(tuleva)
}
