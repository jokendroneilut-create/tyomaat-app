import { fetchSttPressroomProjects } from "./sttPressroom"

export async function fetchTekovaSource() {
  return fetchSttPressroomProjects({
    publisherId: "69820639",
    sourceName: "tekova",
    referer: "https://www.sttinfo.fi/uutishuone/69820639/tekova-oyj",
    projectKeywords: [
      "rakentaa",
      "rakentaminen",
      "rakentuu",
      "toteuttaa",
      "urakka",
      "hanke",
      "kohde",
      "asunto",
      "asuntoa",
      "asunnot",
      "kerrostalo",
      "kortteli",
      "toimitila",
      "toimitilat",
      "koulu",
      "päiväkoti",
      "sairaala",
      "liiketila",
      "logistiikka",
      "keskus",
      "peruskorjaus",
    ],
    excludeKeywords: [
      "nimity",
      "osavuosikatsaus",
      "tilinpäätös",
      "markkina",
      "tulos",
      "vastuullisuus",
      "johtaja",
      "yhtiökokous",
    ],
  })
}
