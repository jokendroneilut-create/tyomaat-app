import { detectCityFromText } from "./detectCityFromText"

export async function fetchJatkeSource() {
  const results: any[] = []

  const cutoffDate = new Date()
  cutoffDate.setMonth(cutoffDate.getMonth() - 24)

  for (let page = 0; page < 6; page++) {
    const res = await fetch(
      `https://www.sttinfo.fi/public-website-api/pressroom/69820730/releases/20/${page}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "application/json, text/plain, */*",
          "Referer": "https://www.sttinfo.fi/uutishuone/69820730/jatke",
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
        "hoivakoti",
        "palvelutalo",
        "uudiskohde",
        "peruskorjaus",
      ]

      const excludeKeywords = [
        "nimity",
        "osavuosikatsaus",
        "tilinpäätös",
        "markkina",
        "tulos",
        "vastuullisuus",
        "johtaja",
        "yhtiökokous",
        "strategia",
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
        source_name: "jatke",
      })
    }
  }

  return results
}