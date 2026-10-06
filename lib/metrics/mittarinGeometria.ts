/*
 * MITTARIN GEOMETRIA (D-239).
 *
 * Omana moduulinaan kahdesta syysta: kaarien ja neulan laskenta on
 * testattavissa ilman Reactia, ja esikatselu voi piirtaa TASMALLEEN sen
 * mita komponentti piirtaa. Jos esikatselu laskisi kulmat itse, se
 * nayttaisi jotain muuta kuin tuotanto.
 */

/*
 * MITAT. Asteikon numerot ovat KAAREN ULKOPUOLELLA, kuten
 * mallikuvan huoneilmamittarissa: sisapuolella ne menivat kaaren alle
 * ahtaaseen tilaan ja olivat kortin leveydella lahes lukukelvottomia
 * (katsottu esikatselusta 6.10.2026). Siksi sade on pienempi kuin
 * piirtoalue ja ylos on jatetty tilaa numeroille.
 */
export const MITTARI = {
  leveys: 220,
  korkeus: 124,
  keskiX: 110,
  keskiY: 104,
  sade: 72,
  /* Numeroiden etaisyys keskipisteesta. */
  nimikkeenSade: 92,
  /* Kaaren paksuus. */
  paksuus: 16,
} as const

/* Asteikko kulkee vasemmalta oikealle: 0 % = 180 astetta, 100 % = 0. */
export function mittarinKulma(osuus: number): number {
  const rajattu = Math.min(1, Math.max(0, osuus))
  return Math.PI * (1 - rajattu)
}

export function mittarinPiste(osuus: number, sade: number): { x: number; y: number } {
  const a = mittarinKulma(osuus)
  return {
    x: MITTARI.keskiX + sade * Math.cos(a),
    y: MITTARI.keskiY - sade * Math.sin(a),
  }
}

export function mittarinKaari(alku: number, loppu: number, sade: number): string {
  const a = mittarinPiste(alku, sade)
  const b = mittarinPiste(loppu, sade)
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${sade} ${sade} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`
}

/*
 * Vyohykkeet valittu mitatusta lahtotasosta (6.10.2026: rakenteilla
 * 63 %, suunnittelussa 48 %), ei pyoreista luvuista. Molemmat osuvat
 * keltaiselle — vihrea pitaa ansaita.
 */
export const VYOHYKKEET = [
  { alku: 0, loppu: 0.5, vari: "#dc2626", nimi: "heikko" },
  { alku: 0.5, loppu: 0.75, vari: "#f59e0b", nimi: "kohtalainen" },
  { alku: 0.75, loppu: 1, vari: "#16a34a", nimi: "hyva" },
] as const
