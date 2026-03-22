import { detectCityFromText } from "./detectCityFromText"

export async function fetchEspoonAsunnotSource() {
  const results: any[] = []

  const cutoffDate = new Date()
  cutoffDate.setMonth(cutoffDate.getMonth() - 24)

  for (let page = 0; page < 6; page++) {
    const res = await fetch(
      `https://www.sttinfo.fi/public-website-api/pressroom/69820862/releases/20/${page}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "application/json, text/plain, */*",
          "Referer": "https://www.sttinfo.fi/uutishuone/69820862/espoon-asunnot-oy",
        },
      }
    )

    if (!res.ok) break

    const data = await res.json()
    const releases = data?.releases || []

    if (!releases.length) break

    for (const release of releases) {
      const fi = release?.versions?.fi
      const title = (fi?.title || "").trim()
      const relativeUrl = fi?.url || ""

      if (!title || !relativeUrl) continue

      const releaseDate = release?.date ? new Date(release.date) : null
      if (releaseDate && releaseDate < cutoffDate) {
        continue
      }

      const lowerTitle = title.toLowerCase()

      const projectKeywords = [
        "rakentaa",
        "rakentaminen",
        "rakentuu",
        "toteuttaa",
        "hanke",
        "kohde",
        "asunto",
        "asuntoa",
        "asunnot",
        "vuokra-asunto",
        "vuokra-asunnot",
        "kerrostalo",
        "kortteli",
        "uudiskohde",
        "uudisrakennus",
        "peruskorjaus",
        "peruskorjauksen",
        "korjaus",
      ]

      const excludeKeywords = [
  "nimity",
  "osavuosikatsaus",
  "tilinpäätös",
  "markkina",
  "tulos",
  "vastuullisuus",
  "johtaja",
  "strategia",
  "vuosikertomus",
  "vuokrat nousevat",
  "käyttää",
  "miljoonaa euroa",
]

      if (!projectKeywords.some((k) => lowerTitle.includes(k))) continue
      if (excludeKeywords.some((k) => lowerTitle.includes(k))) continue

      const absoluteHref = relativeUrl.startsWith("http")
        ? relativeUrl
        : `https://www.sttinfo.fi${relativeUrl}`

      const completedKeywords = [
        "valmistui",
        "valmistunut",
        "luovutettu",
        "otettu käyttöön",
        "vastaanotettu",
        "on valmis",
      ]

      const completed = completedKeywords.some((k) =>
        lowerTitle.includes(k)
      )

      results.push({
        name: title,
        city: detectCityFromText(title),
        region: null,
        location: null,
        phase: completed ? "Valmistunut" : "Suunnittelussa",
        source_url: absoluteHref,
        confidence: 0.6,
        completed,
        source_name: "espoon_asunnot",
      })
    }
  }

  return results
}