import proj4 from "proj4"

/*
 * EPSG:3877 (ETRS-GK23FIN) — Turun käyttämä paikallinen
 * Gauss-Krüger-koordinaattijärjestelmä. Eri järjestelmä kuin
 * lib/geo/tm35fin.ts:n EPSG:3067, lib/geo/gk25.ts:n EPSG:3879 ja
 * lib/geo/gk24.ts:n EPSG:3878.
 */
const GK23 =
  "+proj=tmerc +lat_0=0 +lon_0=23 +k=1 +x_0=23500000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs"

export function gk23ToWgs84(x: number, y: number): { lat: number; lon: number } {
  const [lon, lat] = proj4(GK23, "WGS84", [x, y])
  return { lat, lon }
}
