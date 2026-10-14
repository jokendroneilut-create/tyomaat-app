/*
 * "KOKO SUOMI" EI OLE MAAKUNTA.
 *
 * Käyttäjä voi valita asetuksistaan alueekseen "Koko Suomi"
 * (StepRegion, RoleActivationModal, tiiminäkymä). Se ei ole maakunnan
 * nimi vaan tarkoittaa "ei aluerajausta" — yhdenkään hankkeen `region`
 * ei ole "Koko Suomi".
 *
 * Tänään-näkymän kortti "Kaikki hankkeet alueellasi" vei arvon
 * sellaisenaan hankelistan maakuntasuodattimeen
 * (`/projects?region=Koko%20Suomi`), jolloin käyttäjä päätyi **tyhjään
 * listaan**: mitattu tuotannosta 14.10.2026 "Kartassa 0 / suodatetuista
 * 0".
 *
 * Koko ei ollut pieni: 17 / 56 asetusrivistä (30 %) oli "Koko Suomi"
 * ensimmäisenä alueena, ja neljä heistä oli käynyt palvelussa viimeisen
 * 30 vrk aikana. Vika ei siis koskenut vain admin-tunnusta.
 */

export const KOKO_SUOMI = "Koko Suomi"

export function onKokoSuomi(alue: string | null | undefined): boolean {
  return (alue ?? "").trim().toLowerCase() === KOKO_SUOMI.toLowerCase()
}

/*
 * Hankelistan osoite käyttäjän alueasetuksesta. Palauttaa rajaamattoman
 * osoitteen kun aluetta ei ole tai se on koko maa — "kaikki hankkeet
 * alueellasi" tarkoittaa silloin kirjaimellisesti kaikkia hankkeita.
 */
/*
 * Maakuntarajaus listalle ja hakuvahdille: koko maa ei ole rajaus, joten
 * se karsitaan pois. Tyhjä lista tarkoittaa "ei rajausta".
 *
 * Tämä on sama sääntö jonka Tänään-näkymän laskuri on tehnyt alusta asti
 * (`getTodayProjects.ts`), mutta joka puuttui sekä hankelistalta että
 * digestistä. Seuraus: viisi päällä olevaa hakuvahtia oli tallennettu
 * alueella "Koko Suomi" eivätkä ne voineet lähettää koskaan mitään —
 * tyhjä digest ei lähde ollenkaan, joten vika oli täysin hiljainen.
 */
export function alueetSuodattimeen(alueet: unknown): string[] {
  const lista = Array.isArray(alueet)
    ? alueet
    : typeof alueet === "string" && alueet
      ? [alueet]
      : []
  return lista
    .filter((a): a is string => typeof a === "string")
    .map((a) => a.trim())
    .filter((a) => a && !onKokoSuomi(a))
}

export function hankelistanOsoite(alueet: string[] | null | undefined): string {
  const ensimmainen = (alueet ?? []).map((a) => (a ?? "").trim()).find(Boolean)
  if (!ensimmainen || onKokoSuomi(ensimmainen)) return "/projects"
  return `/projects?region=${encodeURIComponent(ensimmainen)}`
}
