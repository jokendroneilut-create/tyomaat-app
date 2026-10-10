/*
 * KENEN YHTEYSHENKILO TAMA ON (D-259).
 *
 * Johannes 9.10.2026: *"poimitaan tuo touchpoint talteen ja
 * kerrotaan/naytetaan se kayttajalle selvasti kuka on kyseessa."*
 *
 * Hilman ilmoituksella voi olla kolme eri yhteystahoa, ja ne tarkoittavat
 * myyjalle eri asiaa:
 *
 *   buyer   tilaaja itse
 *   agent   tilaajan ilmoittama hankinnan hoitaja, usein ULKOPUOLINEN
 *           konsultti (Sitowise, A-Insinoorit, TST Consulting)
 *   winner  urakan voittanut yritys
 *
 * Ilman merkintaa konsultin osoite nayttaa tilaajan omalta. Se ei ole
 * pelkka epatarkkuus: myyja aloittaisi puhelun vaaralla oletuksella
 * siita kenelle puhuu ja kuka paattaa.
 */

export type Yhteyshenkilonrooli = string | null | undefined

const SELITE: Record<string, string> = {
  buyer: "tilaaja",
  agent: "hankinnan hoitaja",
  winner: "urakoitsija",
  authority: "viranomainen",
  media: "media",
}

/* Lyhyt selite naytettavaksi nimen yhteydessa. Null = ei merkintaa. */
export function roolinSelite(rooli: Yhteyshenkilonrooli): string | null {
  const avain = String(rooli ?? "").trim().toLowerCase()
  return SELITE[avain] ?? null
}

/*
 * Pidempi selitys sille mita rooli tarkoittaa. Nayteaan vain siella
 * missa tilaa on, koska "hankinnan hoitaja" ei kerro yksin etta kyse on
 * usein eri yrityksesta kuin tilaaja.
 */
export function roolinKuvaus(rooli: Yhteyshenkilonrooli): string | null {
  const avain = String(rooli ?? "").trim().toLowerCase()
  if (avain === "agent") return "Tilaajan ilmoittama hankinnan yhteystaho — usein ulkopuolinen konsultti"
  if (avain === "buyer") return "Hankkeen tilaaja"
  if (avain === "winner") return "Urakan voittanut yritys"
  if (avain === "authority") return "Viranomainen, ei hankkeen osapuoli"
  return null
}
