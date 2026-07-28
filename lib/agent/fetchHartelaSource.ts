import { fetchSttPressroomProjects } from "./sttPressroom"

export async function fetchHartelaSource() {
  return fetchSttPressroomProjects({
    publisherId: "1812",
    sourceName: "hartela",
    referer: "https://www.sttinfo.fi/uutishuone/1812/hartela",
    projectKeywords: [
      "rakentaa",
      "rakentaminen",
      "rakentuu",
      "toteuttaa",
      "peruskorjaus",
      "peruskorjauksen",
      "hanke",
      "kohde",
      "asunto",
      "asuntoa",
      "asunnot",
      "kodit",
      "kortteli",
      "toimitila",
      "toimitilat",
      "koulu",
      "päiväkoti",
      "sairaala",
      "palvelukortteli",
      "palvelutalo",
      "hoivakoti",
      "uudiskohde",
    ],
    excludeKeywords: [
      "nimity",
      "osavuosikatsaus",
      "tilinpäätös",
      "markkina",
      "tulos",
      "vastuullisuus",
      "johtaja",
    ],
  })
}
