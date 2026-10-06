import { nimiehdotus } from "@/lib/users/nimiehdotus"
import { haeProfiiliRivi, supabaseProfiiliAdmin } from "@/lib/users/profiiliRivi"

/*
 * OMAT TIEDOT PALVELIMELLE (D-238).
 *
 * Tervehdys tarvitsee etunimen jo ensirenderissa, joten sita ei voi hakea
 * selaimesta — muuten otsikko vilkkuisi "Huomenta" -> "Huomenta, Samu".
 *
 * Luku tehdaan service-rolella kahdesta syysta: `user_company` on
 * nimenomaan suojattu selaimelta (D-224), ja molemmat rivit saadaan
 * samalla kutsulla. Palautetaan vain taman kayttajan omat tiedot.
 */

export type OmatTiedot = {
  /* Kayttajan vahvistamat arvot. Tervehdys kayttaa VAIN naita. */
  etunimi: string
  sukunimi: string
  puhelin: string
  yritys: string | null
  /* Lomakkeen esitayte vanhasta, sahkopostista johdetusta nimesta. */
  ehdotettuEtunimi: string
  ehdotettuSukunimi: string
}

const TYHJA: OmatTiedot = {
  etunimi: "",
  sukunimi: "",
  puhelin: "",
  yritys: null,
  ehdotettuEtunimi: "",
  ehdotettuSukunimi: "",
}

export async function haeOmatTiedot(userId: string | null | undefined): Promise<OmatTiedot> {
  if (!userId) return TYHJA

  const [profiili, { data: yritys }] = await Promise.all([
    haeProfiiliRivi(userId),
    supabaseProfiiliAdmin.from("user_company").select("yritys").eq("user_id", userId).maybeSingle(),
  ])

  const ehdotus = nimiehdotus(profiili?.full_name)

  return {
    etunimi: String(profiili?.first_name ?? "").trim(),
    sukunimi: String(profiili?.last_name ?? "").trim(),
    puhelin: String(profiili?.phone ?? "").trim(),
    yritys: yritys?.yritys ?? null,
    ehdotettuEtunimi: ehdotus.etunimi,
    ehdotettuSukunimi: ehdotus.sukunimi,
  }
}
