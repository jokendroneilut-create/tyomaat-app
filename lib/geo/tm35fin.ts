import proj4 from "proj4"

/*
 * EPSG:3067 (ETRS-TM35FIN) — Suomen kansallinen koordinaattijärjestelmä,
 * jota mm. Lupapisteen rajapinta käyttää suoraan.
 */
const TM35FIN =
  "+proj=utm +zone=35 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs"

export function tm35finToWgs84(x: number, y: number): { lat: number; lon: number } {
  const [lon, lat] = proj4(TM35FIN, "WGS84", [x, y])
  return { lat, lon }
}
