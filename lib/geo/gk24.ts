import proj4 from "proj4"

/*
 * EPSG:3878 (ETRS-GK24FIN) — Tampereen käyttämä paikallinen
 * Gauss-Krüger-koordinaattijärjestelmä. Eri järjestelmä kuin
 * lib/geo/tm35fin.ts:n EPSG:3067 ja lib/geo/gk25.ts:n EPSG:3879.
 */
const GK24 =
  "+proj=tmerc +lat_0=0 +lon_0=24 +k=1 +x_0=24500000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs"

export function gk24ToWgs84(x: number, y: number): { lat: number; lon: number } {
  const [lon, lat] = proj4(GK24, "WGS84", [x, y])
  return { lat, lon }
}
