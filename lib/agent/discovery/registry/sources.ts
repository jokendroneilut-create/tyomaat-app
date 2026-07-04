export type DiscoverySourceType = "api" | "rss" | "html" | "pdf"

export type DiscoverySource = {
  id: string
  name: string
  type: DiscoverySourceType
  category: string
  url: string
  priority: number
  enabled: boolean
  refreshMinutes: number
  collector: string
  parser: string
}

export const discoverySources: DiscoverySource[] = [
  {
    id: "espoo-open-data",
    name: "Espoon avoin data",
    type: "api",
    category: "municipality_open_data",
    url: "https://kartat.espoo.fi/avoindata/",
    priority: 10,
    enabled: true,
    refreshMinutes: 1440,
    collector: "apiCollector",
    parser: "espooOpenDataParser",
  },
  {
    id: "hilma",
    name: "Hilma",
    type: "api",
    category: "procurement",
    url: "https://www.hankintailmoitukset.fi",
    priority: 10,
    enabled: true,
    refreshMinutes: 60,
    collector: "apiCollector",
    parser: "hilmaParser",
  },
  {
    id: "espoo-building-committee",
    name: "Espoon rakennuslautakunta",
    type: "html",
    category: "municipality_decisions",
    url: "https://www.espoo.fi",
    priority: 9,
    enabled: true,
    refreshMinutes: 1440,
    collector: "htmlCollector",
    parser: "espooCommitteeParser",
  },
]