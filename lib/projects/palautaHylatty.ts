/*
 * HYLKAYS ON PAATOS HETKESTA, EI IKUISUUDESTA (D-256).
 *
 * Johannes 10.10.2026 kysyi Ruoveden pelastusaseman kohdalla: *"jos
 * hylkaan taman nyt niin tuleeko se uudestaan myohemmin kun voittaja
 * valitaan?"* Ei tullut. `resolvePotentialProject` paivitti hylatyn
 * rivin metadatan mutta jatti tilan ennalleen — koodin oma kommentti
 * sanoi "Hyvaksyttyja/hylattyja ei koskettaa".
 *
 * Mitattu samana paivana: **2 360 hylatysta 140 sai myohemmin voittajan
 * tai lisaa lahdetietoa**, eika yksikaan palannut jonoon. Niista 41 oli
 * Hilman `works`-luokassa eli rakennusurakoita.
 *
 * MIKSI TAMA EI OLE "PERU HYLKAYS". Suurin osa hylkayksista on oikein
 * ja pysyvasti: mikroskooppi, autoleasing, kyselytutkimus. Niihin ei
 * kosketa. Palautus tapahtuu vain kun hylkayksen PERUSTE on vanhentunut
 * — eli kun kilpailutuksesta tulee tiedossa oleva voittaja.
 *
 * VOITTAJA ON EHTO, EI PELKKA JALKI-ILMOITUS. Sopimusilmoitus ilman
 * voittajaa tarkoittaa usein keskeytysta (D-251, `clos-nw`), eika
 * keskeytys ole syy palauttaa rivia katselmoitavaksi.
 */

type Rivi = { status?: string | null; metadata?: Record<string, any> | null }

function onVoittaja(metadata: Record<string, any> | null | undefined): boolean {
  if (!metadata) return false
  const lista = metadata.winners
  if (Array.isArray(lista) && lista.some((v) => String(v ?? "").trim())) return true
  return Boolean(String(metadata.winner_organisations ?? "").trim())
}

/*
 * Palautetaanko hylatty ehdokas katselmointijonoon taman uuden
 * lahdesignaalin perusteella?
 */
export function palautaHylattyJonoon(
  nykyinen: Rivi,
  tulevaMetadata: Record<string, any> | null | undefined
): boolean {
  if (String(nykyinen.status ?? "") !== "rejected") return false

  /* Voittaja oli jo tiedossa hylattaessa — mikaan ei ole muuttunut. */
  if (onVoittaja(nykyinen.metadata)) return false

  return onVoittaja(tulevaMetadata)
}
