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
    "kaarina",
    "kangasala",
    "siuntio",
    "hyvinkää",
    "ii",
    "nurmijärvi",
    "kokkola",
    "porvoo",
    "naantali",
    "lieto",
    "valkeakoski",
    "heinola",
  ]

  const lower = text.toLowerCase()

  const cityAliases: Record<string, string> = {
    "kempeleessä": "Kempele",
    "ylöjärvellä": "Ylöjärvi",
    "hämeenlinnan": "Hämeenlinna",
    "tampereen": "Tampere",
    "kaarinaan": "Kaarina",
    "kangasalan": "Kangasala",
    "siuntion": "Siuntio",
    "helsingin": "Helsinki",
    "helsingistä": "Helsinki",
    "helsingissä": "Helsinki",
    "hyvinkäälle": "Hyvinkää",
    "iissä": "Ii",
    "turun": "Turku",
    "klaukkalaan": "Nurmijärvi",
    "nihdin": "Helsinki",
    "lahteen": "Lahti",
    "lahdessa": "Lahti",
    "turussa": "Turku",
    "liedon": "Lieto",
    "ouluun": "Oulu",
    "valkeakoskelle": "Valkeakoski",
  }

  for (const [alias, city] of Object.entries(cityAliases)) {
    if (lower.includes(alias)) return city
  }

  for (const city of cities) {
    const regex = new RegExp(
      `\\b${city}(ssa|ssä|sta|stä|seen|lla|ella|llä|lta|ltä|lle|an|na|nä|n|in|en)?\\b`,
      "i"
    )

    if (regex.test(lower)) {
      return city.charAt(0).toUpperCase() + city.slice(1)
    }
  }

  return null
}