export function detectCityFromText(text: string): string | null {
  const cities = [
    "helsinki",
    "espoo",
    "vantaa",
    "tampere",
    "turku",
    "oulu",
    "jyväskylä",
    "lahti",
    "kuopio",
    "raisio",
    "kempele",
    "ylöjärvi",
    "hämeenlinna",
    "pori",
    "joensuu",
    "lappeenranta",
    "kerava",
    "tuusula",
    "järvenpää",
  ]

  const lower = text.toLowerCase()

  const cityAliases: Record<string, string> = {
    "kempeleessä": "Kempele",
    "ylöjärvellä": "Ylöjärvi",
    "hämeenlinnan": "Hämeenlinna",
  }

  for (const [alias, city] of Object.entries(cityAliases)) {
    if (lower.includes(alias)) return city
  }

  for (const city of cities) {
    const regex = new RegExp(
      `\\b${city}(ssa|ssä|sta|stä|seen|lla|llä|lta|ltä|lle|na|nä|n|in|en)?\\b`,
      "i"
    )
    if (regex.test(lower)) {
      return city.charAt(0).toUpperCase() + city.slice(1)
    }
  }

  return null
}