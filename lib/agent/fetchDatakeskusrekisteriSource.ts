import { getMunicipalityByName } from "@/lib/geo/municipalities"
import { mergeCompanyNames } from "@/lib/projects/projectCompanies"
import { PHASE_LABELS } from "@/lib/projects/phases"

/*
 * DATAKESKUSHANKKEIDEN KANSALLINEN REKISTERI (D-365).
 *
 * Johannes 30.10.2026: *"Tee datakeskusrekisteri.fi:sta lahde."* Lahde
 * loytyi YIT:n kayttajan palautteesta: Kiteen rivilta puuttui
 * rakennuttaja, koska rivi oli Lupapisteen kuulutus jossa hakijan nimi
 * on peitetty.
 *
 * MIKSI TAMA ON TARKEA. Datakeskukset ovat juuri sita lajia jota emme
 * muuten nae: yksityinen rakennuttaja, ei Hilmaa, ei kunnan paatosta
 * ennen kuin kaava on pitkalla ([[private-developer-blind-spot]]).
 * Mitattu 30.10.2026: rekisterissa 198 hanketta, meilla 59.
 *
 * REKISTERI ON KOOSTAJA, EI ALKUPERAINEN LAHDE. Se sanoo sen itse:
 * *"Rekisteri on esiversio ... Tarkista aina alkuperainen lahde."*
 * Siksi sen tieto on viimesijaista silloin kun meilla on sama kentta
 * alkuperaisesta lahteesta (D-354, [[rakennuslehti-is-secondary]]).
 *
 * LISENSSI CC BY 4.0 vaatii maininnan, ja se kirjoitetaan kuvaukseen:
 * "Datakeskushankkeiden kansallinen rekisteri (www.datakeskusrekisteri.fi)".
 *
 * REITTI: EI 198 HAKUA JOKA AJOSSA.
 *
 *   `/muutokset/json`  yksi haku, 1 Mt -> 197 hanketta id/nimi/kunta/vaihe
 *   `sitemap.xml`      yksi haku      -> 198 uuid:ta, loput kuin yksi
 *   `/hankkeet/<id>/json`             -> taydet kentat, vain `enrich`issa
 *
 * Muutosloki sisaltaa hanke-olion jokaisessa muutoksessa, joten siita
 * saa koko luettelon yhdella pyynnolla -- mitattu: 197/198. Puuttuvat
 * haetaan sivukartan erotuksesta yksitellen, korkeintaan muutama.
 * Taydet kentat (toimija, teho, pinta-ala) haetaan `enrich`issa, jota
 * keraaja kutsuu VAIN viela nakemattomille ja enintaan 40 kertaa
 * ajossa -- ilman sita yksi ajo olisi 198 hakua ja 3 Mt.
 *
 * `robots.txt` kieltaa vain `/yllapito` ja `/kirjaudu`.
 */

const PERUSTA = "https://www.datakeskusrekisteri.fi"
const MUUTOKSET = `${PERUSTA}/muutokset/json`
const SIVUKARTTA = `${PERUSTA}/sitemap.xml`
const UA = "Mozilla/5.0 (compatible; tyomaat.fi/1.0)"
const AIKAKATKAISU_MS = 30000

/* Sivukartan erotus haetaan yksitellen; raja pitaa ajon lyhyena. */
const PUUTTUVIA_KERRALLA = 5

export const ATTRIBUUTIO =
  "Lähde: Datakeskushankkeiden kansallinen rekisteri (www.datakeskusrekisteri.fi), CC BY 4.0."

/*
 * VAIHE REKISTERIN OMASTA KENTASTA (sama kuvio kuin D-339).
 *
 * `toiminnassa` ja `peruttu` jatetaan pois: valmis konesali ei ole
 * liidi eika peruttu hanke ole hanke. Ne ovat 47 hanketta 197:sta.
 *
 * YVA ohjataan Suunnitteluun, kuten Fingridin tilakuviossa (D-303):
 * ymparistovaikutusten arviointi on suunnittelua, ei lupaa.
 */
const VAIHEET: Record<string, string | null> = {
  kaavoitus: PHASE_LABELS.zoning,
  esiselvitys: PHASE_LABELS.planning,
  yva_vireilla: PHASE_LABELS.planning,
  yva_paattynyt: PHASE_LABELS.planning,
  lupamenettely: PHASE_LABELS.permit,
  rakenteilla: PHASE_LABELS.construction,
  toiminnassa: null,
  peruttu: null,
}

export type DatakeskusHanke = {
  id: string
  nimi: string
  kunta: string | null
  vaihe: string | null
}

/*
 * OSAPUOLI ROOLEINEEN (D-365, laajennettu 31.10.2026).
 *
 * Merkinta on omavarainen: nimi, roolin ihmisluettava muoto seka
 * todiste (`lahde_url` + `lahde_kohta`, esim. YVA-selostuksen PDF ja
 * "s. 1"). Mitattu: 46 hanketta 150:sta, 64 merkintaa.
 */
export type DatakeskusOrganisaatio = {
  rooli?: string | null
  rooli_meta?: { nimi?: string | null } | null
  organisaatio?: { nimi?: string | null } | null
  lahde_url?: string | null
  lahde_kohta?: string | null
}

/* Paatos on KIRJOITETTUA TEKSTIA, ei linkki: mediaani 159 merkkia. */
export type DatakeskusPaatos = {
  kuvaus?: string | null
  pvm?: string | null
}

export type DatakeskusTiedot = {
  organisaatiot?: DatakeskusOrganisaatio[] | null
  paatokset?: DatakeskusPaatos[] | null
  maakunta?: string | null
  sijainti_lat?: number | null
  sijainti_lon?: number | null
  teho_mw?: number | null
  it_teho_mw?: number | null
  pinta_ala_ha?: number | null
  kaavatunnus?: string | null
  kortteli?: string | null
  sijaintiperustelu?: string | null
  vanhin_vahvistettu_pvm?: string | null
  toimija?: { nimi?: string | null } | null
}

/* ---------------------------------------------------------------- */

export function jasennaMuutosloki(data: unknown): DatakeskusHanke[] {
  const j = data as { muutokset?: { hanke?: DatakeskusHanke }[] }
  const ulos = new Map<string, DatakeskusHanke>()
  for (const m of j?.muutokset ?? []) {
    const h = m?.hanke
    if (!h?.id || !h?.nimi) continue
    if (!ulos.has(h.id)) ulos.set(h.id, h)
  }
  return [...ulos.values()]
}

export function jasennaSivukartta(xml: string): string[] {
  const ulos = new Set<string>()
  for (const m of String(xml ?? "").matchAll(/\/hankkeet\/([0-9a-f-]{36})/gi)) {
    ulos.add(m[1].toLowerCase())
  }
  return [...ulos]
}

export function vaiheeksi(rekisterinVaihe: string | null | undefined): string | null {
  const v = String(rekisterinVaihe ?? "").trim().toLowerCase()
  return v in VAIHEET ? VAIHEET[v] : null
}

export function kunnaksi(nimi: string | null | undefined): string | null {
  const siivottu = String(nimi ?? "").trim()
  if (!siivottu) return null
  return getMunicipalityByName(siivottu)?.name ?? null
}

/*
 * Kuvaus rakennetaan kentista, ei leipatekstista: rekisterissa ei ole
 * kuvaustekstia lainkaan. Luvut kerrotaan vain kun ne ovat olemassa --
 * tyhja on parempi kuin arvattu, ja se on myos rekisterin oma linja.
 */
/*
 * ROOLI MEIDAN MALLIIN.
 *
 * Konsultti menee `metadata.consultants`iin, joka on jo olemassa ja
 * nakyy seka TIC:ssa etta Tanaan-modaalissa. Muut osapuolet menevat
 * liittyviksi yrityksiksi.
 *
 * KAKSI ROOLIA JATETAAN POIS TAHALLAAN:
 *   `yhteysviranomainen` on valvova viranomainen, ei hankkeen tekija.
 *   `muu` ei kerro roolia, eika osapuolelle saa keksia sellaista
 *   ([[party-role-fields]]).
 */
const KONSULTTIROOLIT: Record<string, string> = {
  yva_konsultti: "YVA-konsultti",
  kaavan_laatija: "Kaavan laatija",
  kaavoittaja: "Kaavoittaja",
  selvityksen_laatija: "Selvityksen laatija",
  lupahakemuksen_laatija: "Lupahakemuksen laatija",
}

const LIITTYVAT_ROOLIT = new Set(["hankeyhtio", "emoyhtio", "vuokralainen", "toimija"])

export function datakeskusKonsultit(
  t: DatakeskusTiedot | null
): { name: string; role: string | null }[] {
  const ulos: { name: string; role: string | null }[] = []
  const nahdyt = new Set<string>()

  for (const o of t?.organisaatiot ?? []) {
    const nimi = o?.organisaatio?.nimi?.trim()
    const rooli = String(o?.rooli ?? "")
    if (!nimi || !KONSULTTIROOLIT[rooli]) continue

    /* Rekisterin oma ihmisluettava muoto voittaa oman kartan. */
    const rooliNimi = o?.rooli_meta?.nimi?.trim() || KONSULTTIROOLIT[rooli]
    const avain = `${nimi.toLowerCase()}|${rooliNimi.toLowerCase()}`
    if (nahdyt.has(avain)) continue
    nahdyt.add(avain)
    ulos.push({ name: nimi, role: rooliNimi })
  }

  return ulos
}

export function datakeskusLiittyvat(t: DatakeskusTiedot | null): string[] {
  const ulos: string[] = []
  for (const o of t?.organisaatiot ?? []) {
    const nimi = o?.organisaatio?.nimi?.trim()
    if (nimi && LIITTYVAT_ROOLIT.has(String(o?.rooli ?? ""))) ulos.push(nimi)
  }
  return ulos
}

/* ISO-paiva suomalaiseen muotoon; kelvoton jatetaan pois. */
function suomeksiPaiva(arvo: string | null | undefined): string | null {
  const m = String(arvo ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  return `${Number(m[3])}.${Number(m[2])}.${m[1]}`
}

/* Enintaan kolme tuoreinta: mediaani on 1, mutta yhdella on seitseman. */
const PAATOKSIA_ENINTAAN = 3

export function datakeskusPaatokset(t: DatakeskusTiedot | null): string[] {
  return (t?.paatokset ?? [])
    .filter((p) => (p?.kuvaus ?? "").trim())
    .sort((a, b) => String(b?.pvm ?? "").localeCompare(String(a?.pvm ?? "")))
    .slice(0, PAATOKSIA_ENINTAAN)
    .map((p) => {
      const pvm = suomeksiPaiva(p?.pvm)
      const teksti = String(p!.kuvaus).trim()
      /*
       * Paiva kirjoitetaan eteen VAIN jos teksti ei kerro sita itse.
       * Moni paatos aloittaa omalla paivallaan, jolloin etuliite
       * tuotti "7.8.2026: Lupa- ja valvontavirasto antoi 7.8.2026 ...".
       */
      if (!pvm || teksti.includes(pvm)) return teksti
      return `${pvm}: ${teksti}`
    })
}

export function datakeskusKuvaus(h: DatakeskusHanke, t: DatakeskusTiedot | null): string {
  const osat: string[] = []
  const toimija = t?.toimija?.nimi?.trim()

  /*
   * EI TAIVUTUSTA (D-365).
   *
   * Ensimmainen versio kirjoitti `${kunta}lla` ja `${toimija}n`, ja
   * tulos luettiin ennen kuin se ehti asiakkaalle: *"Eddu Energy
   * Saarijarvi on Eddu Energyn datakeskushanke **Saarijarvilla**"*,
   * *"**Mikkelilla**"*, *"**Lapinlahtilla**"*, *"Aurora Core
   * Technology **Oyn**"*, *"Magnora **ASn**"*. Suomen paikallissijat
   * (-lla/-ssa) ja yhtiomuodon genetiivi (Oy:n) eivat taivu
   * merkkijonoa liittamalla.
   *
   * Sama opetus kuin kylanimikartassa: nimi kelpaa KENTTAAN, ei
   * vapaaseen tekstiin ([[curated-map-field-not-prose]]). Nimet
   * kirjoitetaan siksi perusmuodossa.
   */
  const alku = ["Datakeskushanke"]
  if (h.kunta) alku.push(`, kunta ${h.kunta}`)
  if (toimija) alku.push(`, toimija ${toimija}`)
  osat.push(`${h.nimi}. ${alku.join("")}.`)

  if (t?.teho_mw) osat.push(`Teho ${t.teho_mw} MW.`)
  if (t?.it_teho_mw) osat.push(`IT-teho ${t.it_teho_mw} MW.`)
  if (t?.pinta_ala_ha) osat.push(`Tontin pinta-ala ${t.pinta_ala_ha} ha.`)
  if (t?.kaavatunnus) osat.push(`Kaava: ${t.kaavatunnus}.`)
  if (t?.kortteli) osat.push(`Kortteli ${t.kortteli}.`)
  if (t?.sijaintiperustelu) osat.push(String(t.sijaintiperustelu).trim())

  /*
   * PAATOKSET OVAT KUVAUKSEN PARAS OSA.
   *
   * Ne ovat kirjoitettua tekstia eivatka linkkeja: "Lupa- ja
   * valvontavirasto antoi 7.8.2026 yhteysviranomaisen lausunnon ...".
   * Kuvaus on se mita asiakas lukee, ja lahde avataan vain 2,6 %:ssa
   * ([[description-is-the-product]]).
   */
  for (const rivi of datakeskusPaatokset(t)) osat.push(rivi)

  /*
   * Rekisteri on koostaja ja sanoo itse olevansa esiversio, joten
   * kuvaus kertoo sen asiakkaalle -- han osaa tarkistaa alkuperaisen.
   */
  osat.push(
    `Tiedot ovat datakeskushankkeiden kansallisesta rekisteristä, joka kokoaa julkisista lähteistä; tarkista alkuperäinen lähde. ${ATTRIBUUTIO}`
  )

  return osat.join(" ")
}

export function datakeskusEhdokas(h: DatakeskusHanke, t: DatakeskusTiedot | null = null) {
  const kunta = kunnaksi(h.kunta)
  const vaihe = vaiheeksi(h.vaihe)
  const toimija = t?.toimija?.nimi?.trim() || null

  return {
    name: h.nimi,
    description: datakeskusKuvaus(h, t),
    city: kunta,
    region: kunta ? (getMunicipalityByName(kunta)?.region ?? null) : null,
    /*
     * Osoitetta ei ole. Kunta yksin EI kelpaa sijainniksi: `same_location`
     * on tarkoitettu katuosoitteen todisteeksi, ja kaupunkitason arvo
     * teki kahdesta eri hankkeesta samassa kunnassa osuman (ks.
     * `projectMatcher`). Jatetaan tyhjaksi.
     */
    location: null,
    /*
     * TOIMIJA EI MENE `developer`-KENTTAAN, VAAN METADATAAN (D-365).
     *
     * Tama on se kohta jossa "koostaja on viimesijainen" (D-354)
     * toteutetaan mekaanisesti eika toiveena. `importCandidate`in
     * osumahaara kirjoittaa `body.developer || match.developer`, eli
     * lahteen arvo VOITTAA olemassa olevan. Kuivaharjoitus 30.10.2026
     * nayttti mita se olisi tehnyt:
     *
     *   Forssa:    "QTS Data Centers (Blackstone)" -> "Pikku-Muolaan Kehitys Oy"
     *   Klaukkala: "DigitalLand Services Kinetic DC Oy" -> "DayOne"
     *
     * Molemmissa meilla oli operaattorin nimi ja rekisterilla paikallinen
     * kehitysyhtio -- tieto olisi huonontunut.
     *
     * Kun kentta jatetaan tyhjaksi, osuma sailyttaa meidan arvomme.
     * Jonoon menevat rivit eivat menet mitaan: hyvaksyntareitti lukee
     * `metadata.developer`in sarakkeeseen, ja se taytetaan tassa.
     */
    developer: null,
    property_type: "Datakeskus",
    phase: vaihe,
    /*
     * Vaihe luetaan rakenteisesta kentasta, joten tekstipaattely ei saa
     * ohittaa sita (D-339).
     */
    phase_authoritative: Boolean(vaihe),
    completed: false,
    source_url: `${PERUSTA}/hankkeet/${h.id}`,
    confidence: 0.7,
    source_name: "datakeskusrekisteri",
    metadata: {
      /* Hyvaksyntareitti lukee taman sarakkeeseen; osuma ei. */
      developer: toimija,
      related_companies: mergeCompanyNames(
        [],
        [...(toimija ? [toimija] : []), ...datakeskusLiittyvat(t)]
      ),
      /*
       * Konsultit rooleineen samasta vastauksesta (31.10.2026). Kentta
       * on jo olemassa ja nakyy TIC:ssa seka Tanaan-modaalissa.
       */
      consultants: datakeskusKonsultit(t),
      contact_persons: [],
      rekisterin_vaihe: h.vaihe ?? null,
      teho_mw: t?.teho_mw ?? null,
      pinta_ala_ha: t?.pinta_ala_ha ?? null,
      lisenssi: "CC BY 4.0",
      /*
       * REKISTERIN OMA KOORDINAATTI TALTEEN (D-365).
       *
       * Rivilla ei ole katuosoitetta, joten geokoodaus saisi vain kunnan
       * nimen ja osuisi kunnan varapisteeseen -- 61 % riveistamme on
       * siella ([[address-register-geocode]]). Rekisteri antaa pisteen
       * valmiina 124 hankkeelle 150:sta.
       *
       * Kaytetaan kahteen asiaan: hyvaksyntareitti sijoittaa hankkeen
       * kartalle oikeaan paikkaan, ja jonon duplikaattivihje mittaa
       * etaisyyden olemassa oleviin hankkeisiin.
       */
      lahteen_koordinaatit:
        t?.sijainti_lat != null && t?.sijainti_lon != null
          ? { lat: t.sijainti_lat, lon: t.sijainti_lon, lahde: "datakeskusrekisteri" }
          : null,
      field_sources: {
        developer: toimija ? "datakeskusrekisteri (koostaja)" : null,
        phase: h.vaihe ? `rekisterin tila (${h.vaihe})` : null,
        property_type: "lahde on datakeskusrekisteri",
        consultants: (t?.organisaatiot ?? []).length
          ? "datakeskusrekisterin osapuolet rooleineen"
          : null,
      },
    },
  }
}

/* ---------------------------------------------------------------- */

async function hae(url: string): Promise<Response> {
  const ohjain = new AbortController()
  const kello = setTimeout(() => ohjain.abort(), AIKAKATKAISU_MS)
  try {
    return await fetch(url, { headers: { "User-Agent": UA }, signal: ohjain.signal })
  } finally {
    clearTimeout(kello)
  }
}

export async function haeHankkeenTiedot(id: string): Promise<DatakeskusTiedot | null> {
  const vastaus = await hae(`${PERUSTA}/hankkeet/${id}/json`)
  if (!vastaus.ok) return null
  /*
   * `organisaatiot` ja `paatokset` ovat `hanke`-olion SISARUKSIA, eivat
   * sen sisalla. Ensimmainen versio palautti pelkan `hanke`n ja heitti
   * ne pois, vaikka ne tulivat samassa vastauksessa -- puuttuva tieto
   * oli jo omassa hallussa ([[own-data-unread]]).
   */
  const j = (await vastaus.json()) as {
    hanke?: DatakeskusTiedot
    organisaatiot?: DatakeskusOrganisaatio[]
    paatokset?: DatakeskusPaatos[]
  }
  if (!j?.hanke) return null
  return {
    ...j.hanke,
    organisaatiot: j.organisaatiot ?? [],
    paatokset: j.paatokset ?? [],
  }
}

export async function fetchDatakeskusrekisteriSource() {
  const vastaus = await hae(MUUTOKSET)
  if (!vastaus.ok) throw new Error(`datakeskusrekisteri: muutosloki ${vastaus.status}`)
  const hankkeet = jasennaMuutosloki(await vastaus.json())

  /* Sivukartan erotus: muutoslokissa on 197/198, loput haetaan erikseen. */
  const tunnetut = new Set(hankkeet.map((h) => h.id))
  try {
    const kartta = await hae(SIVUKARTTA)
    if (kartta.ok) {
      const puuttuvat = jasennaSivukartta(await kartta.text())
        .filter((id) => !tunnetut.has(id))
        .slice(0, PUUTTUVIA_KERRALLA)
      for (const id of puuttuvat) {
        const t = await haeHankkeenTiedot(id)
        const nimi = (t as unknown as { nimi?: string })?.nimi
        const kunta = (t as unknown as { kunta?: string })?.kunta
        const vaihe = (t as unknown as { vaihe?: string })?.vaihe
        if (nimi) hankkeet.push({ id, nimi, kunta: kunta ?? null, vaihe: vaihe ?? null })
      }
    }
  } catch {
    /* Sivukartta on lisavarmistus; ilman sita jaa korkeintaan yksi hanke. */
  }

  return hankkeet.filter((h) => vaiheeksi(h.vaihe) !== null).map((h) => datakeskusEhdokas(h))
}

/*
 * Taydet kentat vain nakemattomille, enintaan 40 ajossa. Ilman tata
 * ensimmainen ajo olisi 198 hakua; nain se on kaksi.
 */
export async function enrichDatakeskusCandidate(
  kandidaatti: ReturnType<typeof datakeskusEhdokas>
): Promise<ReturnType<typeof datakeskusEhdokas>> {
  const id = String(kandidaatti.source_url ?? "").split("/").pop()
  if (!id) return kandidaatti

  const tiedot = await haeHankkeenTiedot(id)
  if (!tiedot) return kandidaatti

  return datakeskusEhdokas(
    {
      id,
      nimi: kandidaatti.name,
      kunta: kandidaatti.city,
      vaihe: String(kandidaatti.metadata?.rekisterin_vaihe ?? ""),
    },
    tiedot
  )
}
