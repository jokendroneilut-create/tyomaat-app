import { fetchSttPressroomProjects } from "./sttPressroom"

export async function fetchGrkSource() {
  return fetchSttPressroomProjects({
    publisherId: "69819211",
    sourceName: "grk",
    referer: "https://www.sttinfo.fi/uutishuone/69819211/grk-infra-oyj",
    projectKeywords: [
      "rakentaa",
      "rakentaminen",
      "rakentuu",
      "toteuttaa",
      "urakka",
      "hanke",
      "kohde",
      "silta",
      "tie",
      "raide",
      "asema",
      "varikko",
      "väylä",
      "infra",
      "sairaala",
      "koulu",
      "päiväkoti",
      "toimitila",
      "logistiikka",
      "teollisuus",
      "korjaus",
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
