/*
 * ONKO RELEVANSSIPORTTI TAUOLLA VAI TOIPUNUT?
 *
 * TIC:n AI-suodatus-sivu nayttaa punaista heti kun ikkunassa on yksikin
 * epaonnistunut kutsu, ja vaittaa kahta asiaa jotka olivat 1.10.2026
 * molemmat vaaria:
 *
 *   "Suodatus on tauolla"            - ei ollut. Viimeisin virhe oli
 *                                      24.9. klo 19.17, ja sen jalkeen
 *                                      portti oli vastannut 131 kertaa
 *                                      sivun 200 rivin ikkunassa.
 *   "Yleisin syy on API-varojen
 *    loppuminen"                     - varoja oli 15,03 $ ja kuukauden
 *                                      kaytto 0,23 $. Virheen oma teksti
 *                                      luki samassa laatikossa:
 *                                      "Request timed out."
 *
 * Arvaus oli perua 7.9.2026 varojen loppumisesta (D-177). Se jai
 * paikalleen vaikka virheen oma viesti kertoo syyn - ja pysyva punainen
 * laatikko lakkaa olemasta varoitus, aivan kuten D-184:ssa.
 *
 * Tila paatellaan siksi datasta: jos viimeisimman virheen JALKEEN on
 * onnistuneita kutsuja, portti ei ole tauolla vaan toipunut. Syy
 * luetaan virheen omasta viestista, ei muistista.
 */

export type RelevanssiRivi = {
  created_at: string
  final_status: string | null
  llm_reason: string | null
}

export type RelevanssiportinTila = {
  virheita: number
  viimeisinVirheAika: string | null
  viimeisinVirheSyy: string | null
  /* Onnistuneet kutsut viimeisimman virheen jalkeen, ikkunan sisalla. */
  onnistuneitaVirheenJalkeen: number
  /* True vain jos uusin kutsu on virhe eika sen jalkeen ole onnistunut. */
  tauolla: boolean
  /* Selitys virheen omasta viestista, tai null jos viesti ei kerro. */
  selitys: string | null
}

/*
 * Syy luetaan viestista. Jarjestys merkitsee: aikakatkaisu ensin, koska
 * se on mitatusti yleisin (5/5 virheesta 1.10.2026 mennessa).
 */
const SYYT: { kuvio: RegExp; selitys: string }[] = [
  {
    kuvio: /timed out|timeout/i,
    selitys:
      "Kutsu ylitti 15 sekunnin aikakatkaisun. Tämä osuu ruuhkaan: yksi lähde tuo kerralla paljon ehdokkaita, ja portti kutsuu mallia rinnakkain. Aikakatkaisu on tarkoituksellinen — ilman sitä yksi jumittunut kutsu kaataisi koko lähdeajon.",
  },
  {
    kuvio: /credit balance|insufficient|billing|quota|payment/i,
    selitys: "API-varat ovat lopussa. Lisää varoja Claude Consolessa.",
  },
  { kuvio: /rate.?limit|\b429\b/i, selitys: "Pyyntöraja ylittyi. Kutsuja tuli liian tiheästi." },
  { kuvio: /\b401\b|unauthorized|authentication|invalid.*api.?key/i, selitys: "API-avain ei kelpaa." },
  {
    kuvio: /overloaded|\b529\b|\b50[023]\b/i,
    selitys: "Mallipalvelu oli hetkellisesti ylikuormittunut.",
  },
]

export function selitaVirhe(viesti: string | null | undefined): string | null {
  const teksti = String(viesti ?? "")
  if (!teksti.trim()) return null
  return SYYT.find((s) => s.kuvio.test(teksti))?.selitys ?? null
}

/*
 * `rivit` on uusin ensin, samassa jarjestyksessa kuin kysely ne antaa.
 */
export function relevanssiportinTila(rivit: RelevanssiRivi[]): RelevanssiportinTila {
  const virheIndeksi = rivit.findIndex((r) => r.final_status === "llm_error")
  const virheita = rivit.filter((r) => r.final_status === "llm_error").length

  if (virheIndeksi < 0) {
    return {
      virheita: 0,
      viimeisinVirheAika: null,
      viimeisinVirheSyy: null,
      onnistuneitaVirheenJalkeen: 0,
      tauolla: false,
      selitys: null,
    }
  }

  const virhe = rivit[virheIndeksi]

  /*
   * Uudemmat rivit ovat listan alussa. Onnistuneeksi lasketaan vain
   * oikea paatos - toinen virhe ei ole merkki toipumisesta.
   */
  const onnistuneita = rivit.slice(0, virheIndeksi).filter((r) => r.final_status !== "llm_error").length

  return {
    virheita,
    viimeisinVirheAika: virhe.created_at,
    viimeisinVirheSyy: virhe.llm_reason,
    onnistuneitaVirheenJalkeen: onnistuneita,
    tauolla: onnistuneita === 0,
    selitys: selitaVirhe(virhe.llm_reason),
  }
}
