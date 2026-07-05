export type ProjectClassificationInput = {
  operation?: string | null
  title?: string | null
  address?: string | null
}

export type ProjectClassification = {
  construction_type: string | null
  building_type: string | null
  size_class: "unknown" | "xs" | "s" | "m" | "l" | "xl"
  business_value: "unknown" | "low" | "medium" | "high"
  recommended_action: "ignore" | "review" | "promote"
  confidence: number
  reasons: string[]
}

export function classifyProject(
  input: ProjectClassificationInput
): ProjectClassification {
  const text = [input.operation, input.title, input.address]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  const reasons: string[] = []

  const construction_type = classifyConstructionType(text, reasons)
  const building_type = classifyBuildingType(text, reasons)

  let business_value: ProjectClassification["business_value"] = "unknown"
  let recommended_action: ProjectClassification["recommended_action"] = "review"
  let confidence = 50

  const lowSignals = [
    "maalämpökaivo",
    "energiakaivo",
    "mainoslaite",
    "mainoslaitte",
    "autotalli",
    "autokatos",
    "talousrakennus",
    "omakotitalo",
    "erillispientalo",
    "asuinpientalo",
    "paritalo",
  ]

  if (
    containsAny(text, lowSignals) ||
    building_type === "omakotitalo" ||
    building_type === "paritalo" ||
    building_type === "autotalli" ||
    building_type === "talousrakennus"
  ) {
    business_value = "low"
    recommended_action = "ignore"
    confidence = 80
    reasons.push("Pieni tai yksityinen hanke")
  }

  if (
    building_type === "kerrostalo" ||
    building_type === "koulu" ||
    building_type === "päiväkoti" ||
    building_type === "liikerakennus" ||
    building_type === "teollisuus" ||
    building_type === "logistiikka" ||
    building_type === "urheilurakennus"
  ) {
    business_value = "high"
    recommended_action = "review"
    confidence = 88
    reasons.push("Todennäköisesti kaupallisesti kiinnostava hanke")
  }

  if (
    construction_type === "uudisrakennus" ||
    construction_type === "laajennus" ||
    construction_type === "peruskorjaus" ||
    construction_type === "käyttötarkoituksen muutos"
  ) {
    confidence = Math.max(confidence, 80)
    reasons.push("Rakentamiseen viittaava toimenpide")
  }

  if (construction_type === "purku" && business_value === "unknown") {
    business_value = "medium"
    recommended_action = "review"
    confidence = Math.max(confidence, 70)
    reasons.push("Purku voi ennakoida tulevaa rakentamista")
  }

  return {
    construction_type,
    building_type,
    size_class: "unknown",
    business_value,
    recommended_action,
    confidence,
    reasons: Array.from(new Set(reasons)),
  }
}

function classifyConstructionType(text: string, reasons: string[]) {
  if (containsAny(text, ["käyttötarkoituksen muutos", "muuttaminen"])) {
    reasons.push("Tunnistettu käyttötarkoituksen muutos")
    return "käyttötarkoituksen muutos"
  }

  if (containsAny(text, ["linjasaneeraus", "peruskorjaus", "saneeraus", "korjaus"])) {
    reasons.push("Tunnistettu korjaus- tai muutostyö")
    return "peruskorjaus"
  }

  if (containsAny(text, ["laajennus", "laajentaminen"])) {
    reasons.push("Tunnistettu laajennus")
    return "laajennus"
  }

  if (containsAny(text, ["purkaminen", "purku", "purkamisilmoitus"])) {
    reasons.push("Tunnistettu purkuhanke")
    return "purku"
  }

  if (
    containsAny(text, [
      "uudisrakennus",
      "uuden rakennuksen",
      "rakentaminen",
      "rakennetaan",
      "rakennuksen rakentaminen",
    ])
  ) {
    reasons.push("Tunnistettu uudisrakentaminen")
    return "uudisrakennus"
  }

  return null
}

function classifyBuildingType(text: string, reasons: string[]) {
  if (containsAny(text, ["asuinkerrostalo", "kerrostalo"])) {
    reasons.push("Tunnistettu kerrostalo")
    return "kerrostalo"
  }

  if (containsAny(text, ["paritalo"])) {
    reasons.push("Tunnistettu paritalo")
    return "paritalo"
  }

  if (
    containsAny(text, [
      "omakotitalo",
      "erillispientalo",
      "asuinpientalo",
      "pientalo",
    ])
  ) {
    reasons.push("Tunnistettu pientalo")
    return "omakotitalo"
  }

  if (containsAny(text, ["rivitalo"])) {
    reasons.push("Tunnistettu rivitalo")
    return "rivitalo"
  }

  if (containsAny(text, ["koulu", "koulurakennus"])) {
    reasons.push("Tunnistettu koulurakennus")
    return "koulu"
  }

  if (containsAny(text, ["päiväkoti", "varhaiskasvatus"])) {
    reasons.push("Tunnistettu päiväkoti")
    return "päiväkoti"
  }

  if (
    containsAny(text, [
      "liikerakennus",
      "myymälä",
      "päivittäistavaramyymälä",
      "päivittäistavarakauppa",
      "kauppakeskus",
    ])
  ) {
    reasons.push("Tunnistettu liikerakennus")
    return "liikerakennus"
  }

  if (containsAny(text, ["toimistorakennus", "toimisto"])) {
    reasons.push("Tunnistettu toimistorakennus")
    return "toimisto"
  }

  if (containsAny(text, ["teollisuusrakennus", "tuotantorakennus", "tehdasrakennus"])) {
    reasons.push("Tunnistettu teollisuusrakennus")
    return "teollisuus"
  }

  if (containsAny(text, ["varasto", "varastorakennus", "logistiikka", "logistiikkakeskus"])) {
    reasons.push("Tunnistettu varasto/logistiikka")
    return "logistiikka"
  }

  if (containsAny(text, ["urheilukenttä", "liikuntasali", "urheilurakennus"])) {
    reasons.push("Tunnistettu urheiluun liittyvä hanke")
    return "urheilurakennus"
  }

  if (containsAny(text, ["autotalli", "autosuoja", "autokatos"])) {
    reasons.push("Tunnistettu autotalli/autokatos")
    return "autotalli"
  }

  if (containsAny(text, ["talousrakennus"])) {
    reasons.push("Tunnistettu talousrakennus")
    return "talousrakennus"
  }

  return null
}

function containsAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word))
}