/*
 * VAPAAN TEKSTIHAUN KENTÄT — SAMAT HAUSSA JA HAKUVAHDISSA.
 *
 * Hankelistan haku ja hakuvahdin digest tekevät saman haun eri koodissa:
 * sivu suodattaa selaimessa riviolioista, digest kysyy PostgRESTiltä.
 * Kenttälistat olivat eri, ja käyttäjä ei voinut sitä tietää.
 *
 * Mitattu 14.10.2026 — digest haki vain nimestä, rakennuttajasta ja
 * rakentajasta, joten tallennettu vahti löysi vähemmän kuin mitä
 * käyttäjä näki hakiessaan:
 *
 *   | hakusana         | digest löysi | koko haku |
 *   |------------------|--------------|-----------|
 *   | koulu            |          283 |       792 |
 *   | helsinki         |           75 |     1 237 |
 *   | Turku            |           36 |       241 |
 *   | parainen         |            3 |        24 |
 *   | katto            |           37 |       220 |
 *
 * Ero oli suurin kuvauksessa ja paikkakentissä: "helsinki" ei osunut
 * Helsingin hankkeeseen, ellei kaupungin nimi sattunut olemaan hankkeen
 * NIMESSÄ. Lista on siksi tässä, yhdessä paikassa.
 *
 * Johannes 14.10.2026: *"en olettanut että käyttäjät yrittävät toimia
 * myös näin. Oletin että haetaan vaan aluetta ja vaihetta."*
 */

export const HAKUKENTAT = [
  "name",
  "region",
  "city",
  "phase",
  "location",
  "developer",
  "builder",
  "earthworks_contractor",
  "property_type",
  "additional_info",
] as const

export type Hakukentta = (typeof HAKUKENTAT)[number]

/*
 * Rivin hakuteksti selaimen puolelle: kaikki kentät yhtenä pienennettynä
 * merkkijonona. Esilasketaan kerran per rivi, ei joka näppäimellä (D-281).
 */
export function hakuteksti(rivi: Record<string, unknown>): string {
  return HAKUKENTAT.map((kentta) => String(rivi[kentta] ?? ""))
    .join(" ")
    .toLowerCase()
}

/*
 * PostgRESTin `or`-ehto samoille kentille. Hakusana on osamerkkijono
 * kuten sivullakin, jotta taivutus osuu ("forssa" löytyy sanasta
 * "Forssaan").
 *
 * Lainausmerkit arvon ympärille, koska hakusanassa voi olla välilyöntejä
 * ja pilkkuja; ne katkaisisivat ehtolistan.
 */
export function hakuEhto(hakusana: string, etuliite = ""): string | null {
  const sana = hakusana.trim()
  if (!sana) return null

  const turvattu = sana.replaceAll("\\", "\\\\").replaceAll('"', '\\"')
  return HAKUKENTAT.map(
    (kentta) => `${etuliite}${kentta}.ilike."%${turvattu}%"`
  ).join(",")
}
