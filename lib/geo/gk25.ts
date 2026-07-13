import proj4 from "proj4"

/*
 * EPSG:3879 (ETRS-GK25FIN) — pääkaupunkiseudun kuntien (mm. Vantaan)
 * käyttämä paikallinen Gauss-Krüger-koordinaattijärjestelmä. Eri
 * järjestelmä kuin lib/geo/tm35fin.ts:n EPSG:3067.
 */
const GK25 =
  "+proj=tmerc +lat_0=0 +lon_0=25 +k=1 +x_0=25500000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs"

export function gk25ToWgs84(x: number, y: number): { lat: number; lon: number } {
  const [lon, lat] = proj4(GK25, "WGS84", [x, y])
  return { lat, lon }
}
