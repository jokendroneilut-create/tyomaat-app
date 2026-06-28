import type { Signal } from "./types"

export type ClassificationResult = {
  normalizedSignalType: string
  relevanceScore: number
  reviewStatus: "ignored" | "needs_review" | "approved"
  reason: string
}

export function classifySignal(signal: Signal): ClassificationResult {
  const text = `${signal.title} ${signal.description ?? ""}`.toLowerCase()

  const irrelevantTerms = [
    "omakotitalo",
    "autotalli",
    "autokatos",
    "sauna",
    "piharakennus",
    "terassi",
    "laajennus",
  ]

  if (irrelevantTerms.some((term) => text.includes(term))) {
    return {
      normalizedSignalType: "low_relevance",
      relevanceScore: 10,
      reviewStatus: "ignored",
      reason: "Pieni yksityinen tai vähäarvoinen rakennuskohde",
    }
  }

  if (text.includes("tarjouspyyntö") || text.includes("urakkalaskenta")) {
    return {
      normalizedSignalType: "tender_started",
      relevanceScore: 95,
      reviewStatus: "approved",
      reason: "Tarjousmahdollisuus havaittu",
    }
  }

  if (text.includes("voitti urakan") || text.includes("valittu urakoitsijaksi")) {
    return {
      normalizedSignalType: "contract_awarded",
      relevanceScore: 90,
      reviewStatus: "approved",
      reason: "Tarjouskilpailun voittaja tai urakoitsijavalinta havaittu",
    }
  }

  if (text.includes("rakennuslupa")) {
    return {
      normalizedSignalType: "building_permit",
      relevanceScore: 75,
      reviewStatus: "needs_review",
      reason: "Rakennuslupaan liittyvä signaali",
    }
  }

  if (text.includes("asemakaava") || text.includes("kaavaluonnos") || text.includes("kaava")) {
    return {
      normalizedSignalType: "zoning",
      relevanceScore: 70,
      reviewStatus: "needs_review",
      reason: "Kaavoitukseen liittyvä varhainen signaali",
    }
  }

  if (
    text.includes("koulu") ||
    text.includes("päiväkoti") ||
    text.includes("datakeskus") ||
    text.includes("liikerakennus") ||
    text.includes("logistiikkakeskus") ||
    text.includes("kerrostalo")
  ) {
    return {
      normalizedSignalType: "potential_project",
      relevanceScore: 65,
      reviewStatus: "needs_review",
      reason: "Mahdollisesti relevantti rakennushanke",
    }
  }

  return {
    normalizedSignalType: "unclassified",
    relevanceScore: 30,
    reviewStatus: "needs_review",
    reason: "Ei osunut sääntöihin, vaatii tarkistuksen",
  }
}