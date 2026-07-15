import proj4 from "proj4"

/*
 * EPSG:3882 (ETRS-GK28FIN) — Lappeenrannan käyttämä paikallinen
 * Gauss-Krüger-koordinaattijärjestelmä. Eri järjestelmä kuin
 * lib/geo/tm35fin.ts:n EPSG:3067 ja muiden kaupunkien GK-vyöhykkeet.
 */
const GK28 =
  "+proj=tmerc +lat_0=0 +lon_0=28 +k=1 +x_0=28500000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs"

export function gk28ToWgs84(x: number, y: number): { lat: number; lon: number } {
  const [lon, lat] = proj4(GK28, "WGS84", [x, y])
  return { lat, lon }
}
