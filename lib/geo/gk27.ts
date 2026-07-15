import proj4 from "proj4"

/*
 * EPSG:3881 (ETRS-GK27FIN) — Kuopion käyttämä paikallinen
 * Gauss-Krüger-koordinaattijärjestelmä. Eri järjestelmä kuin
 * lib/geo/tm35fin.ts:n EPSG:3067 ja muiden kaupunkien GK-vyöhykkeet.
 */
const GK27 =
  "+proj=tmerc +lat_0=0 +lon_0=27 +k=1 +x_0=27500000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs"

export function gk27ToWgs84(x: number, y: number): { lat: number; lon: number } {
  const [lon, lat] = proj4(GK27, "WGS84", [x, y])
  return { lat, lon }
}
