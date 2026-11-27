/*
 * VANHAA TIETOA -MERKIT KATSELMOIJALLE (27.11.2026, D-461).
 *
 * Johannes 27.11.2026: *"jonossa muitakin tuntuu nyt olevan vanhaa tietoa
 * ja jo valmistuneita kohteita"*. Jonon 148 riviä läpikäytynä vanhan
 * tiedon rivit jakautuivat näin:
 *
 *   - Hilman sopimusmuutos (eForms 38) koskee aiemmin tehtyä sopimusta.
 *     Urakka on jo käynnissä tai valmis ("Sopimusmuutos: Eteläisen
 *     Postipuiston maanrakennusurakka").
 *   - Lupapisteen jatkolupa tai voimassaolon pidentäminen: rakentaminen
 *     on alkanut aiemman luvan aikana ("Jatkolupa: Rakennusluvan numero
 *     21-0386-R voimassaoloajan pidentäminen").
 *   - Rakentamisenaikainen muutos aiempaan lupaan ("… lupaan
 *     LP-858-2021-02367"): työmaa on jo olemassa.
 *   - Lupahakemus usean vuoden takaa (LP-320-2020-00101): päätös tai
 *     kuulutus tulee nyt, mutta hanke voi olla vanha.
 *
 * Sama periaate kuin D-438:n päättyneellä sopimuskaudella: ei karsita eikä
 * piiloteta, vaan katselmoija näkee syyn ja päättää. Tuntematon tieto ei
 * laukaise mitään ([[never-hide-on-missing-data]]).
 */

export type VanhaTietoMerkki = {
  avain: "sopimusmuutos" | "jatkolupa" | "muutos_aiempaan_lupaan" | "vanha_lupahakemus"
  /** Lyhyt merkki jonolistaan. */
  lyhyt: string
  /** Selitys hankesivulle. */
  selitys: string
}

type Syote = {
  title?: string | null
  permitNumber?: string | null
  metadata?: Record<string, any> | null
}

const JATKOLUPA =
  /\bjatko(?:aika)?lupa|\bvoimassaolo\w*\s+(?:\p{L}+\s+)?(?:pidentämi|pidentäm|jatkami|jatkam)|\bluvan\s+jatkaminen|\bförlängning\s+av\s+(?:bygg)?lov/iu
const RAKENTAMISENAIKAINEN = /\brakentamisenaikainen\s+muutos|\bändring\s+under\s+byggtiden/iu
const LUPANUMERO = /\bLP-\d{3}-(\d{4})-\d{3,6}\b/gi

function lupavuosi(permitNumber: string | null | undefined): number | null {
  const m = String(permitNumber ?? "").match(/^\s*LP-\d{3}-(\d{4})-/i)
  return m ? Number(m[1]) : null
}

export function vanhaTietoMerkit(syote: Syote, nyt: Date = new Date()): VanhaTietoMerkki[] {
  const metadata = syote.metadata ?? {}
  const otsikko = String(syote.title ?? "")
  const toimenpide = typeof metadata.operation === "string" ? metadata.operation : ""
  const teksti = `${otsikko} ${toimenpide}`
  const tamaVuosi = nyt.getUTCFullYear()
  const merkit: VanhaTietoMerkki[] = []

  /* Hilma: eForms-tyyppi 38 on sopimusmuutos. Otsikko varalla, jos tyyppi puuttuu. */
  if (
    String(metadata.notice_type ?? "") === "38" ||
    String(metadata.main_type ?? "").toLowerCase() === "modification" ||
    /^\s*sopimusmuutos\b/i.test(otsikko)
  ) {
    merkit.push({
      avain: "sopimusmuutos",
      lyhyt: "Sopimusmuutos",
      selitys: "Ilmoitus koskee aiemmin tehtyä sopimusta, joten urakka on jo käynnissä tai valmis.",
    })
  }

  if (JATKOLUPA.test(teksti)) {
    merkit.push({
      avain: "jatkolupa",
      lyhyt: "Jatkolupa",
      selitys: "Jatkolupa tai voimassaolon pidentäminen: hanke on aloitettu aiemman luvan aikana.",
    })
  }

  /* Muutos aiempaan lupaan: rakentamisenaikainen muutos tai viittaus vanhempaan LP-tunnukseen. */
  const oma = String(syote.permitNumber ?? "").trim().toUpperCase()
  const viitatut = [...teksti.matchAll(LUPANUMERO)].filter((m) => m[0].toUpperCase() !== oma)
  const vanhinViitattu = viitatut.length ? Math.min(...viitatut.map((m) => Number(m[1]))) : null
  const omaVuosi = lupavuosi(syote.permitNumber)
  const viittaaVanhempaan = vanhinViitattu != null && (omaVuosi == null || vanhinViitattu < omaVuosi)
  if (RAKENTAMISENAIKAINEN.test(teksti) || viittaaVanhempaan) {
    merkit.push({
      avain: "muutos_aiempaan_lupaan",
      lyhyt: viittaaVanhempaan ? `Muutos vuoden ${vanhinViitattu} lupaan` : "Muutos aiempaan lupaan",
      selitys: "Muutos jo myönnettyyn lupaan: työmaa on todennäköisesti jo olemassa.",
    })
  }

  /*
   * Hakemuksen vuosi tunnuksesta. Vuosi Y tarkoittaa hakemusta viimeistään
   * 31.12.Y, joten Y ≤ nykyinen − 2 on varmasti yli vuoden vanha. Edellisen
   * vuoden tunnus ei merkitse: tammikuussa joulukuun hakemukset ovat tuoreita.
   */
  if (omaVuosi != null && omaVuosi <= tamaVuosi - 2) {
    merkit.push({
      avain: "vanha_lupahakemus",
      lyhyt: `Lupahakemus vuodelta ${omaVuosi}`,
      selitys: `Lupatunnus on vuodelta ${omaVuosi}: päätös tai kuulutus tulee nyt, mutta hanke voi olla jo käynnissä tai valmis.`,
    })
  }

  return merkit
}
