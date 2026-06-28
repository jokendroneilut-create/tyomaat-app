export type CandidateQualityRule = {
  keyword: string
  points: number
  reason: string
}

export const positiveCandidateQualityRules: CandidateQualityRule[] = [
  { keyword: "datakeskus", points: 45, reason: "Datakeskukseen liittyvä hanke" },
  { keyword: "data center", points: 45, reason: "Datakeskukseen liittyvä hanke" },

  { keyword: "tarjouspyyntö", points: 35, reason: "Tarjousmahdollisuus havaittu" },
  { keyword: "urakkalaskenta", points: 35, reason: "Tarjousmahdollisuus havaittu" },
  { keyword: "hankintailmoitus", points: 35, reason: "Tarjousmahdollisuus havaittu" },

  { keyword: "kerrostalo", points: 30, reason: "Relevantti rakennustyyppi" },
  { keyword: "toimitila", points: 30, reason: "Relevantti rakennustyyppi" },
  { keyword: "liikerakennus", points: 30, reason: "Relevantti rakennustyyppi" },
  { keyword: "logistiikkakeskus", points: 30, reason: "Relevantti rakennustyyppi" },
  { keyword: "teollisuushalli", points: 30, reason: "Relevantti rakennustyyppi" },
  { keyword: "varastohalli", points: 25, reason: "Relevantti rakennustyyppi" },

  { keyword: "koulu", points: 30, reason: "Julkinen palvelurakennus" },
  { keyword: "päiväkoti", points: 30, reason: "Julkinen palvelurakennus" },
  { keyword: "sairaala", points: 30, reason: "Julkinen palvelurakennus" },

  { keyword: "rakennuslupa", points: 20, reason: "Rakentamiseen liittyvä konkreettinen signaali" },
  { keyword: "rakennetaan", points: 20, reason: "Rakentamiseen liittyvä konkreettinen signaali" },
  { keyword: "rakentaminen alkaa", points: 25, reason: "Rakentamisen aloitukseen liittyvä signaali" },
]

export const negativeCandidateQualityRules: CandidateQualityRule[] = [
  { keyword: "omakotitalo", points: -60, reason: "Pieni yksityinen rakennuskohde" },
  { keyword: "autotalli", points: -60, reason: "Pieni tai vähäarvoinen rakennuskohde" },
  { keyword: "autokatos", points: -60, reason: "Pieni tai vähäarvoinen rakennuskohde" },
  { keyword: "sauna", points: -70, reason: "Pieni tai vähäarvoinen rakennuskohde" },
  { keyword: "terassi", points: -70, reason: "Pieni tai vähäarvoinen rakennuskohde" },
  { keyword: "piharakennus", points: -60, reason: "Pieni tai vähäarvoinen rakennuskohde" },
  { keyword: "varasto", points: -40, reason: "Mahdollisesti vähäarvoinen rakennuskohde" },
  { keyword: "laajennus", points: -30, reason: "Laajennus voi olla pieni yksityinen kohde" },
  { keyword: "julkisivuremontti", points: -30, reason: "Mahdollisesti vähäinen korjaushanke" },
]