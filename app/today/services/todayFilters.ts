function normalize(value: unknown) {
  return String(value ?? "").trim().toLowerCase()
}

// Yhdistää projektin source_name -> näkyviin lähdekategorioihin.
// Järjestys ei vaikuta lopputulokseen; jokainen matcher arvioidaan erikseen.
const SOURCE_CATEGORY_MATCHERS: {
  key: string
  matches: (source: string, hasPermitNumber: boolean) => boolean
}[] = [
  {
    key: "ympäristö & yva",
    matches: (source) =>
      source.includes("yva") || source.includes("ymparistolupa"),
  },
  {
    key: "suunnittelukilpailut",
    matches: (source) => source.includes("suunnittelukilpailu"),
  },
  {
    key: "rakennusluvat",
    matches: (source, hasPermitNumber) =>
      source.includes("rakennuslupa") ||
      source.includes("espoon kuulutukset") ||
      source.includes("permit") ||
      source.includes("building") ||
      source.includes("discovery_agent") ||
      // permit_number leimaa rakennusluvaksi vain jos lähteellä ei ole
      // omaa kategoriaa (ymparistolupa/yva kuuluvat "Ympäristö & YVA":iin).
      (hasPermitNumber &&
        !source.includes("ymparistolupa") &&
        !source.includes("yva")),
  },
  {
    key: "hilma",
    matches: (source) => source.includes("hilma"),
  },
  {
    key: "kaavoitus",
    matches: (source) =>
      source.includes("kaava") || source.includes("zoning"),
  },
  {
    key: "kuntapäätökset",
    matches: (source) =>
      source.includes("kunta") ||
      source.includes("lautakunta") ||
      source.includes("committee"),
  },
  {
    key: "yritysuutiset",
    matches: (source) =>
      source.includes("stt") ||
      source.includes("uutiset") ||
      source.includes("news") ||
      source.includes("rakennuslehti") ||
      source.includes("lehti"),
  },
]

const ALL_SALES_MOMENT_OPTIONS = [
  "kaavoitus",
  "ideointi",
  "suunnittelu",
  "rakennuslupa",
  "kilpailutus",
  "sopimus myönnetty",
  "rakenteilla",
  "valmistumassa",
  "valmistunut",
]

function containsAllOptions(
  selectedValues: string[],
  allOptions: string[]
) {
  const normalizedValues = selectedValues.map(normalize)

  return allOptions.every((option) =>
    normalizedValues.includes(option)
  )
}

export function projectSource(project: any) {
  return normalize(
    project.metadata?.source_name ??
      project.metadata?.source ??
      project.metadata?.firstSourceName ??
      project.metadata?.lastSourceName ??
      project.metadata?.resolver ??
      ""
  )
}

export function projectPhaseText(project: any) {
  return normalize(
    [
      project.phase,
      project.metadata?.phase,
      project.metadata?.operation,
      project.metadata?.construction_type,
      project.metadata?.procurement_type_code,
      project.metadata?.source,
      project.metadata?.source_name,
    ]
      .filter(Boolean)
      .join(" ")
  )
}

export function matchesBestSalesMoments(
  project: any,
  selectedMoments: string[]
) {
  if (!selectedMoments?.length) {
    return true
  }

  const normalizedMoments = selectedMoments.map(normalize)

  if (
    normalizedMoments.includes("kaikki vaiheet") ||
    containsAllOptions(
      selectedMoments,
      ALL_SALES_MOMENT_OPTIONS
    )
  ) {
    return true
  }

  const text = projectPhaseText(project)

  return normalizedMoments.some((moment) => {
    switch (moment) {
      case "kaavoitus":
        return text.includes("kaavoitus") || text.includes("zoning")

      case "ideointi":
        return text.includes("idea") || text.includes("ennakko")

      case "suunnittelu":
        return text.includes("suunnittel")

      case "rakennuslupa":
        return (
          text.includes("rakennuslupa") ||
          text.includes("permit") ||
          text.includes("lupa")
        )

      case "kilpailutus":
        return (
          text.includes("hilma") ||
          text.includes("tarjous") ||
          text.includes("kilpailutus") ||
          text.includes("procurement") ||
          text.includes("works")
        )

      case "sopimus myönnetty":
        return (
          text.includes("sopimus") ||
          text.includes("urakoitsija valittu")
        )

      case "rakenteilla":
        return (
          text.includes("rakenteilla") ||
          text.includes("rakentaminen aloitettu") ||
          text.includes("aloit")
        )

      case "valmistumassa":
        return (
          text.includes("valmistumassa") ||
          text.includes("käyttöönot")
        )

      case "valmistunut":
        return (
          text.includes("valmistunut") ||
          text.includes("valmistui")
        )

      default:
        return false
    }
  })
}

export function matchesRegions(
  project: any,
  selectedRegions: string[]
) {
  if (!selectedRegions?.length) {
    return true
  }

  const normalizedRegions = selectedRegions.map(normalize)

  if (normalizedRegions.includes("koko suomi")) {
    return true
  }

  const projectRegion = normalize(
    project.region ??
      project.metadata?.region ??
      project.metadata?.maakunta ??
      ""
  )

  if (!projectRegion) {
    return false
  }

  return normalizedRegions.includes(projectRegion)
}