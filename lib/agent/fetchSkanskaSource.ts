import { fetchSttPressroomProjects } from "./sttPressroom"

export async function fetchSkanskaSource() {
  return fetchSttPressroomProjects({
    publisherId: "69819623",
    sourceName: "skanska",
    referer:
      "https://www.sttinfo.fi/embedded/pressroom/69819623/widget/r?language=fi",
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
      "datakeskus",
      "teollisuus",
    ],
    excludeKeywords: [
      "nimity",
      "vahvistaa toimintaansa",
      "osavuosikatsaus",
      "tilinpäätös",
      "markkina",
      "tulos",
    ],
  })
}
