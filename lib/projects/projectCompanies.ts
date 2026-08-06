/*
 * Hankkeeseen liittyvät yritykset yhtenä listana rooleineen.
 *
 * Hankekortti näytti aiemmin kiinteän joukon rooleja ("Rakennesuunnittelu: -",
 * "LVIA-suunnittelu: -", ...), joista useimmat ovat tyhjiä. Kortti näytti
 * siksi tyhjältä vaikka tiedossa olisi ollut useampikin yritys.
 *
 * Samalla korjaantuu tiedon katoaminen usean osaurakan hankkeissa: kun
 * samasta hankinnasta tulee monta voittajailmoitusta, vain ensimmäisen
 * voittaja päätyi builder-sarakkeeseen ja loput jäivät näkymättä. Mitattuna
 * kolme hanketta, pahimmassa 4 voittajaa joista 1 näkyi (Kaukametsän
 * kansalaisopisto, Kajaani). Voittajat ovat tallessa metadata.source_history
 * -merkinnöissä, joten niitä ei tarvitse siirtää minnekään - riittää että
 * ne luetaan.
 */

export type ProjectCompany = {
  role: string
  name: string
}

type CompanySource = {
  developer?: string | null
  builder?: string | null
  structural_design?: string | null
  hvac_design?: string | null
  electrical_design?: string | null
  architectural_design?: string | null
  geotechnical_design?: string | null
  earthworks_contractor?: string | null
  metadata?: Record<string, any> | null
}

/*
 * Sama yritys esiintyy eri muodoissa: y-tunnus mukana tai ilman, eri
 * kirjainkoolla. Vertailu tehdään ilman tunnusta, mutta näytettäväksi
 * valitaan pisin muoto (eli se jossa tunnus on mukana).
 */
function dedupeKey(name: string) {
  return name
    .replace(/\s*\((?:FI)?\d{6,8}-?\d?\)/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

/*
 * Yksi kenttä voi sisältää monta yritystä. Hilma erottaa voittajat
 * "//"-merkeillä, ja hyväksyntä on tallentanut niitä builder-kenttään
 * pilkulla erotettuna. Ilman pilkkomista yhdistelmä näkyisi omana
 * "yrityksenään" eikä osuisi yhteen samojen yritysten kanssa.
 *
 * Pilkku katkaisee vain y-tunnuksen jälkeen — yrityksen nimessä voi olla
 * pilkku, mutta ")" ja pilkku peräkkäin on aina tallennettu lista.
 */
function splitCompanyField(value: string): string[] {
  return value
    .split("//")
    .flatMap((part) => part.split(/(?<=\))\s*,\s*/))
    .map((part) => part.trim())
    .filter(Boolean)
}

const FIELD_ROLES: { field: keyof CompanySource; role: string }[] = [
  { field: "developer", role: "Rakennuttaja" },
  { field: "builder", role: "Pääurakoitsija" },
  { field: "structural_design", role: "Rakennesuunnittelu" },
  { field: "hvac_design", role: "LVIA-suunnittelu" },
  { field: "electrical_design", role: "Sähkösuunnittelu" },
  { field: "architectural_design", role: "Arkkitehtisuunnittelu" },
  { field: "geotechnical_design", role: "Pohjarakennesuunnittelu" },
  { field: "earthworks_contractor", role: "Maanrakentaja" },
]

export function collectProjectCompanies(
  project: CompanySource | null | undefined
): ProjectCompany[] {
  if (!project) return []

  const metadata = project.metadata ?? {}
  const found = new Map<string, ProjectCompany>()

  function add(role: string, raw: unknown) {
    const value = String(raw ?? "").trim()
    if (!value || value === "-") return

    const names = splitCompanyField(value)

    /*
     * Jos yhdessä kentässä on monta yritystä, emme voi tietää kuka niistä
     * on pääurakoitsija — usean osaurakan hankinnassa kentässä on koko
     * voittajalista. Silloin neutraalimpi "Urakoitsija" on rehellisempi
     * kuin väittää jokaista pääurakoitsijaksi.
     */
    const effectiveRole =
      names.length > 1 && role === "Pääurakoitsija" ? "Urakoitsija" : role

    for (const name of names) {
      addOne(effectiveRole, name)
    }
  }

  function addOne(role: string, name: string) {
    const key = dedupeKey(name)
    if (!key) return

    const existing = found.get(key)
    if (!existing) {
      found.set(key, { role, name })
      return
    }

    /*
     * Sama yritys jo listalla: säilytetään ensimmäinen (tarkin) rooli, mutta
     * päivitetään nimi jos uusi muoto on täydellisempi - näin y-tunnus ei
     * katoa siksi että sama yritys mainittiin ensin ilman sitä.
     */
    if (name.length > existing.name.length) {
      found.set(key, { role: existing.role, name })
    }
  }

  for (const { field, role } of FIELD_ROLES) {
    add(role, project[field])
  }

  /*
   * Voittajailmoitukset: usean osaurakan hankinnassa jokainen ilmoitus tuo
   * oman voittajansa. Rooli on "Urakoitsija", koska emme voi päätellä mikä
   * osaurakoista on pääurakka - sitä tietoa ei ole tallennettu.
   */
  const history = Array.isArray(metadata.source_history)
    ? metadata.source_history
    : []

  for (const entry of history) {
    if (!entry?.is_contract_award) continue
    for (const winner of Array.isArray(entry.winners) ? entry.winners : []) {
      add("Urakoitsija", winner)
    }
  }

  for (const winner of Array.isArray(metadata.winners) ? metadata.winners : []) {
    add("Urakoitsija", winner)
  }

  for (const company of Array.isArray(metadata.related_companies)
    ? metadata.related_companies
    : []) {
    add("Liittyvä yritys", company)
  }

  return [...found.values()]
}
