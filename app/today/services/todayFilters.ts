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
/*
 * AVAINSANAT: MISTÄ TEKSTISTÄ OSUMAA HAETAAN.
 *
 * `property_type` on mukana, koska siinä hankkeen tyyppi oikeasti on —
 * 73 arvoa, 82 % täytetty syötteessä (mitattu 10.11.2026). Ilman sitä
 * sana "datakeskus" ei osunut hankkeeseen jonka tyyppi on Datakeskus
 * mutta jonka nimessä tai kuvauksessa sanaa ei ole; kannassa on 167
 * datakeskusriviä. `metadata.building_type` ja `construction_type`
 * jäävät mukaan, koska osalla rivejä tyyppi on vain niissä.
 */
export function projectKeywordText(project: any): string {
  return [
    project.name,
    project.property_type,
    project.metadata?.description,
    project.additional_info,
    project.metadata?.operation,
    project.metadata?.building_type,
    project.metadata?.construction_type,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export function keywordMatches(text: string, keyword: string): boolean {
  const needle = keyword.trim().toLowerCase()
  if (needle.length < 2) return false

  /*
   * Pitkät sanat: alimerkkijono käy — suomen taivutus/yhdyssanat toimivat
   * eduksi ("sähkö" osuu sanoihin "sähköistys", "sähköurakka"). Lyhyet
   * (esim. "iv", "lvi") vaativat sananrajan, etteivät osu yhdyssanan sisään.
   */
  if (needle.length >= 4) return text.includes(needle)

  const boundary = "\\wäöåÄÖÅ"
  const re = new RegExp(
    `(?<![${boundary}])${escapeRegex(needle)}(?![${boundary}])`,
    "i"
  )
  return re.test(text)
}

/* Mitkä käyttäjän sanoista osuvat hankkeeseen; järjestys = käyttäjän oma. */
export function matchedKeywords(project: any, keywords: string[]): string[] {
  if (!keywords?.length) return []

  const text = projectKeywordText(project)
  if (!text) return []

  const osumat: string[] = []
  const nahty = new Set<string>()

  for (const keyword of keywords) {
    const label = keyword.trim()
    const key = label.toLowerCase()
    if (!label || nahty.has(key)) continue
    if (keywordMatches(text, label)) {
      osumat.push(label)
      nahty.add(key)
    }
  }

  return osumat
}

/*
 * OPT-IN-SUODATIN: "Näytä vain hankkeet joissa nämä mainitaan".
 *
 * Asiakaspalaute 10.11.2026: *"asetin rajaukset vain datakeskus- ja
 * teollisuusrakentamisen hankkeisiin"* — mutta avainsanat vain nostivat
 * (enintään 25 pistettä, kun "Suuri hanke" antaa 50). Mitattuna hänen
 * 3 000 hankkeen syötteestään 234 osui sanoihin, mutta TOP 25:ssä niitä
 * oli 0 ja paras datakeskus oli sijalla 656. Seitsemästä avainsanoja
 * käyttäneestä tilistä viisi oli kirjoittanut hanketyyppejä, ei
 * ammattisanastoa — kenttää käytetään rajaukseen.
 *
 * EI PIILOTA TUNTEMATONTA. Jos hankkeesta ei ole kuvausta eikä tyyppiä,
 * osumattomuus ei todista mitään eikä riviä pudoteta — nimi yksin on
 * liian ohut peruste ([[never-hide-on-missing-data]]). Syötteessä
 * tällaisia oli 0/3 000, joten portti on halpa.
 *
 * Oletus on pois päältä, joten yhdenkään nykyisen käyttäjän näkymä ei
 * muutu ennen kuin hän itse rastittaa.
 */
export function matchesKeywordFilter(
  project: any,
  keywords: string[],
  keywordsOnly: boolean
) {
  if (!keywordsOnly || !keywords?.length) return true

  const tiedetaan =
    Boolean(String(project.property_type ?? "").trim()) ||
    Boolean(String(project.additional_info ?? "").trim()) ||
    Boolean(String(project.metadata?.description ?? "").trim())
  if (!tiedetaan) return true

  return matchedKeywords(project, keywords).length > 0
}
