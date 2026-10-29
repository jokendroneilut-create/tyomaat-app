import { getMunicipalityByName } from "@/lib/geo/municipalities"
import { inferBuildingType } from "@/lib/agent/buildingType"
import { mergeCompanyNames } from "@/lib/projects/projectCompanies"
import { PHASE_LABELS } from "@/lib/projects/phases"

/*
 * JM SUOMEN ASUNTOKOHTEET (D-359).
 *
 * Johannes 29.10.2026: *"Tee JM Suomesta (jmoy.fi) lahde."* Kannassa oli
 * 11 JM-hanketta, joista 7:lta puuttui valmistumispaiva ja 10:lla ei
 * ollut lahdetta lainkaan -- eli kaikki olivat tulleet kasin tai muuta
 * kautta.
 *
 * REITTI: sivukartta `sitemap.projects.xml` antaa kohdesivut (22 kpl
 * 29.10.2026), ja jokaisen sivun takana on sama data JSONina osoitteessa
 * `<kohdesivu>/GetViewModel`. Kentat ovat rakenteisia, joten mitaan ei
 * tarvitse kaivaa leipatekstista ([[declared-field-beats-title-regex]]).
 * `robots.txt` kieltaa vain `/episerver/` ja `/sivuni/`.
 *
 * Sivu kutsuu myos `web.jmapi.io/residence/search_stage` -rajapintaa,
 * joka toisi kaikki kohteet yhdella pyynnolla. Sita EI kaytetä: pyynnon
 * muotoa ei saatu selville kolmella arvauksella eika listaussivu lahetä
 * sita lainkaan, joten reitti jaisi arvaukseksi. 23 pyyntoa kerran
 * vuorokaudessa on hinta jonka voi maksaa.
 *
 * MITATTU 29.10.2026, 22 kohdetta:
 *
 *   nimi, katuosoite, postinumero, kunta   22/22
 *   asuntojen lukumaara                    22/22
 *   koordinaatit                           22/22  (ei kaytossa, ks. alla)
 *   muuttopaiva (inhabitDate)              17/22
 *   julkaisijan oma tila                   22/22
 *   timeline.buildStart / buildEnd          0/22  -- aina tyhja
 *
 * KOORDINAATTEJA EI OTETA. Sivu antaa tarkan pisteen, mutta
 * `importCandidate` ei ota vastaan koordinaatteja, ja metadataan
 * kirjoitettu kentta jota mikaan ei lue on tunnettu ansa
 * ([[duplicate-hint-open-items]]: `possible_duplicate_of` on 1 499
 * hankkeella eika sita lue mikaan). Osoite on tarkka, ja piste haetaan
 * kunnan rekisterista kuten muillakin ([[address-register-geocode]]).
 *
 * ROOLIT: JM on seka rakennuttaja etta rakentaja, joten molempiin
 * kenttiin tulee sama nimi. Tama on eri asia kuin Jalonilla, jossa
 * julkaisija on pelkka rakentaja ([[party-role-fields]]).
 *
 * VALMISTUNEITA EI TARVITSE SUODATTAA TAALLA. Yhdeksan kohdetta on
 * `moveinready` ja yksi `soldout`, eli rakennus on valmis. Ne lahetetaan
 * silti, koska `importCandidate` kasittelee ne oikein ilman eri saantoa:
 * osumaton valmis hanke EI mene jonoon vaan kirjautuu tapahtumana
 * (`completed_source`), ja osuva paivittaa olemassa olevan rivin tilan.
 * Juuri jalkimmainen on tassa se arvo: kannan JM-rivit ovat ilman
 * valmistumispaivaa, ja osa niista on todellisuudessa valmiita.
 */

const SIVUKARTTA = "https://www.jmoy.fi/sitemap.projects.xml"
const UA = "Mozilla/5.0 (compatible; tyomaat.fi/1.0)"
const AIKAKATKAISU_MS = 30000
const HAKUJEN_VALI_MS = 500

export const JM = "JM Suomi Oy"

/*
 * JULKAISIJAN OMA TILA VAIHEEKSI (sama kuvio kuin D-339).
 *
 * Tila luetaan rakenteisesta kentasta `dataLayer.projectPageStatus`, ei
 * paatella paivamaarasta. Mitattu: kentta vastaa 1:1 `stageStatus`-
 * GUIDia (9/7/4/1/1), joten GUIDeja ei tarvitse purkaa.
 *
 * HUOM: tila kertoo MYYNNIN vaiheen. Kaksi arvoa kertoo silti suoraan
 * rakentamisesta: `planned` = ei rakenneta viela, `moveinready` =
 * muuttovalmis. Niiden valissa olevat kolme kertovat vain siita missa
 * asuntokauppa menee, joten niille ei vaiteta tarkempaa vaihetta kuin
 * Rakenteilla.
 *
 * `currentTimeline` (0-3) EI kelpaa taman tarkentamiseen: mitattuna se
 * on myynnin aikajana (0 = ei mitaan, 3 = muuttovalmis), ei
 * rakentamisen.
 */
const TILAT: Record<string, { phase: string; valmis: boolean }> = {
  planned: { phase: PHASE_LABELS.planning, valmis: false },
  preselling: { phase: PHASE_LABELS.planning, valmis: false },
  forsale: { phase: PHASE_LABELS.construction, valmis: false },
  soldout: { phase: PHASE_LABELS.construction, valmis: false },
  moveinready: { phase: PHASE_LABELS.completed, valmis: true },
}

/*
 * MENNYT MUUTTOPAIVA ON VALMISTUMINEN, VAIKKA MYYNTITILA SANOISI MUUTA.
 *
 * Tama ei ole varmuuden vuoksi lisatty ehto vaan kahden mitatun rivin
 * korjaus. `soldout`-kohde Vaskiseppa on myyty loppuun ja muuttopaiva
 * oli 2.12.2024, mutta JM ei ollut kaantanyt tilaa `moveinready`ksi --
 * eli myyntitila jaa roikkumaan. `forsale`-kohde Kuunliljan muuttopaiva
 * oli 23.9.2026 eli jo mennyt, ja se on silti myynnissa, koska asuntoja
 * on vapaana. Molemmissa rakennus on olemassa.
 *
 * Ilman tata ne menisivat jonoon vaiheessa Rakenteilla. Tavallisesti
 * `importCandidate` estaisi sen itse (`isStaleCompletion`), MUTTA se
 * ehto on `!body.phase_authoritative` -- eli kun lahde ilmoittaa
 * lukevansa vaiheen rakenteisesta kentasta, se samalla luopuu tasta
 * suojasta ja vastaa itse vanhentuneista riveista.
 */
function muuttoMennyt(paiva: string | null, nyt: Date): boolean {
  if (!paiva) return false
  return paiva < nyt.toISOString().slice(0, 10)
}

export type JmKohde = {
  nimi: string
  osoite: string | null
  postinumero: string | null
  kunta: string | null
  asuntoja: number | null
  energialuokka: string | null
  muuttopaiva: string | null
  muuttopaivaVarma: boolean
  tila: string | null
  intro: string
  leipateksti: string
  myynti: { nimi: string | null; puhelin: string | null; sahkoposti: string | null } | null
  linkki: string
}

/* ---------------------------------------------------------------- */

export function jasennaSivukartta(xml: string): string[] {
  const osoitteet: string[] = []
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(String(xml ?? "")))) {
    const url = m[1].trim()
    if (url.startsWith("https://www.jmoy.fi/")) osoitteet.push(url)
  }
  return [...new Set(osoitteet)]
}

/*
 * NIMETYT ENTITEETIT PURETAAN, EI PYYHITA.
 *
 * Tama on D-341:n hiljainen virhe toisessa lahteessa: siella `&auml;`
 * muuttui valilyonniksi, jolloin "Lisatiedot" oli "Lis tiedot" eika
 * yhteystietolohkoa loytynyt. Oire on pelkka puuttuva kentta.
 *
 * Taalla sama vika tuottaisi kuvauksen "kodit on suunniteltu kest m n
 * aikaa": luettavaa tekstia, joka menee asiakkaalle
 * ([[description-is-the-product]]). Mitattu: yhdessa kuvauksessa on 65
 * nimettya entiteettia.
 */
const ENTITEETIT: Record<string, string> = {
  auml: "ä", ouml: "ö", Auml: "Ä", Ouml: "Ö", aring: "å", Aring: "Å",
  uuml: "ü", eacute: "é", nbsp: " ", amp: "&", quot: '"', apos: "'",
  lt: "<", gt: ">", ndash: "–", mdash: "—", shy: "", times: "×",
  rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", hellip: "…", middot: "·",
}

/*
 * WORDISTA LIITETTY ROSKA POIS.
 *
 * Kuvauskentat on kirjoitettu Wordissa ja liitetty sellaisenaan, joten
 * niissa on ehdollisia kommentteja, `<xml>`-lohkoja ja tyylimaarittelyja:
 * yhden kohteen `body` on 40 184 merkkia, josta oikeaa tekstia on 3 100.
 * Ilman siivousta asiakas lukisi "Normal 0 21 false false false FI
 * X-NONE AR-SA mso-style-name:..." .
 */
export function siivoaTeksti(html: string | null | undefined): string {
  let s = String(html ?? "")
  s = s.replace(/<!--[\s\S]*?-->/g, " ")
  s = s.replace(/<style[\s\S]*?<\/style>/gi, " ")
  s = s.replace(/<xml[\s\S]*?<\/xml>/gi, " ")
  s = s.replace(/<(script|head)[\s\S]*?<\/\1>/gi, " ")
  s = s.replace(/<br\s*\/?>/gi, "\n")
  s = s.replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
  s = s.replace(/<[^>]+>/g, " ")
  s = s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
  s = s.replace(/&([a-zA-Z]+);/g, (kokonaan, nimi: string) =>
    nimi in ENTITEETIT ? ENTITEETIT[nimi] : kokonaan
  )
  /* Jaannos-CSS: "{mso-style-name:...;}" jaa talteen ilman tageja. */
  s = s.replace(/\{[^{}]{0,2000}\}/g, " ")
  s = s.replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{2,}/g, "\n")
  return s.trim()
}

/*
 * ENGLANNINKIELINEN HANTA POIS.
 *
 * Kuusi kohdetta 22:sta julkaisee saman tekstin myos englanniksi, aina
 * suomen JALKEEN ja omana kappaleenaan (mitatut alkukohdat 1 352-3 363
 * merkin kohdalla). Kappale tunnistetaan englannin funktiosanoista;
 * yksittainen lainasana ("penthouse") ei riita, koska vaaditaan kolme
 * eri sanaa samasta kappaleesta.
 */
const EN_SANAT = /\b(the|and|with|are|for|from|of|will|your|these|homes|apartments)\b/gi

export function katkaiseEnglanti(teksti: string): string {
  const kappaleet = teksti.split("\n")
  const pidettavat: string[] = []
  for (const k of kappaleet) {
    if (k.trim().length >= 60) {
      const osumat = new Set((k.match(EN_SANAT) ?? []).map((s) => s.toLowerCase()))
      if (osumat.size >= 3) break
    }
    pidettavat.push(k)
  }
  return pidettavat.join("\n").trim()
}

/*
 * MUUTTOPAIVA ON PAIKALLINEN PAIVA, EI UTC-PAIVA.
 *
 * Kentta on aina paikallinen keskiyo: "2027-05-18T21:00:00+00:00" on
 * 19.5.2027 klo 00 Suomen aikaa (kesalla +3, talvella +2). Suora
 * `slice(0, 10)` antaisi siis JOKA KERTA yhta vuorokautta liian
 * aikaisen paivan. Mitattu: kaikki 17 paivaa ovat tata muotoa.
 */
export function paikallinenPaiva(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const osat = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Helsinki",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d)
  return /^\d{4}-\d{2}-\d{2}$/.test(osat) ? osat : null
}

/*
 * KUNTA TARKISTETAAN REKISTERISTA. Kentta on julkaisijan oma, mutta
 * tuntematon nimi hylataan ennemmin kuin arvataan -- sama linja kuin
 * Jalonilla.
 */
export function kunnaksi(nimi: string | null | undefined): string | null {
  const siivottu = String(nimi ?? "").trim()
  if (!siivottu) return null
  return getMunicipalityByName(siivottu)?.name ?? null
}

/* Vain ne kentat joita luetaan; sivu palauttaa naita kymmenia enemman. */
type Myyja = { name?: string | null; phone?: string | null; email?: string | null }
type Vastaus = {
  dataLayer?: { projectPageStatus?: string | null }
  template?: {
    viewModel?: {
      header?: string | null
      headerDisplay?: string | null
      address?: string | null
      postalCode?: string | null
      city?: string | null
      nrOfObjects?: number | null
      energyClass?: string | null
      inhabitDate?: string | null
      inhabitDateDetermined?: boolean | null
      intro?: string | null
      body?: string | null
      realEstateAgents?: Myyja[] | null
    }
  }
}

export function jasennaKohde(data: unknown, linkki: string): JmKohde | null {
  const j = (data ?? {}) as Vastaus
  const v = j.template?.viewModel
  if (!v) return null

  const nimi = String(v.header ?? v.headerDisplay ?? "").trim()
  if (!nimi || nimi.length < 3) return null

  const myyja = Array.isArray(v.realEstateAgents) ? v.realEstateAgents[0] : null

  return {
    nimi,
    osoite: v.address ? String(v.address).trim() : null,
    postinumero: v.postalCode ? String(v.postalCode).trim() : null,
    kunta: kunnaksi(v.city),
    asuntoja: Number.isFinite(v.nrOfObjects) ? Number(v.nrOfObjects) : null,
    energialuokka: v.energyClass ? String(v.energyClass).trim() : null,
    muuttopaiva: paikallinenPaiva(v.inhabitDate),
    muuttopaivaVarma: Boolean(v.inhabitDateDetermined),
    tila: j?.dataLayer?.projectPageStatus ? String(j.dataLayer.projectPageStatus) : null,
    intro: siivoaTeksti(v.intro),
    leipateksti: siivoaTeksti(v.body),
    myynti: myyja
      ? {
          nimi: myyja.name ? String(myyja.name).trim() : null,
          puhelin: myyja.phone ? String(myyja.phone).trim() : null,
          sahkoposti: myyja.email ? String(myyja.email).trim() : null,
        }
      : null,
    linkki,
  }
}

/*
 * KUVAUKSEN YLARAJA. Tavoite on satoja merkkeja
 * ([[description-is-the-product]]); siivottu leipateksti on mediaanilta
 * 1 891 merkkia, eli markkinointitekstia riittaa yli tarpeen. Raja
 * pitaa kuvauksen luettavana eika paasta englanninkielista hantaa
 * lapi silloinkaan kun kappalejako puuttuu.
 */
const KUVAUKSEN_RAJA = 1200

export function jmKuvaus(k: JmKohde): string {
  const tiedot: string[] = []
  tiedot.push(
    k.osoite
      ? `${JM} rakennuttaa ja rakentaa kohteen ${k.nimi}, osoite ${[k.osoite, [k.postinumero, k.kunta].filter(Boolean).join(" ")].filter(Boolean).join(", ")}.`
      : `${JM} rakennuttaa ja rakentaa kohteen ${k.nimi}.`
  )
  if (k.asuntoja) tiedot.push(`Yhtiöön tulee ${k.asuntoja} asuntoa.`)
  if (k.energialuokka) tiedot.push(`Energialuokka ${k.energialuokka}.`)
  if (k.muuttopaiva) {
    const [v, kk, p] = k.muuttopaiva.split("-")
    tiedot.push(
      k.muuttopaivaVarma
        ? `Arvioitu muuttopäivä ${Number(p)}.${Number(kk)}.${v}.`
        : `Alustava muuttopäivä ${Number(p)}.${Number(kk)}.${v}.`
    )
  }

  /*
   * "Read in English below!" on kehotus, ei kuvausta -- ja se jaisi
   * tekstiin vaikka englanninkielinen osa katkaistaan, koska se on
   * suomenkielisen kappaleen lopussa.
   */
  const intro = k.intro.replace(/\s*\b(?:read\s+)?(?:more\s+)?in\s+english[^.!?]*[.!?]/gi, " ").trim()
  const leipa = katkaiseEnglanti(k.leipateksti)

  const kokonaan = [tiedot.join(" "), intro, leipa].filter(Boolean).join("\n").replace(/[ \t]+/g, " ")
  if (kokonaan.length <= KUVAUKSEN_RAJA) return kokonaan

  /* Katkaistaan virkkeen rajalta, ei kesken sanan. */
  const paloiteltu = kokonaan.slice(0, KUVAUKSEN_RAJA)
  const viimeinen = Math.max(paloiteltu.lastIndexOf("."), paloiteltu.lastIndexOf("!"))
  return (viimeinen > 400 ? paloiteltu.slice(0, viimeinen + 1) : paloiteltu).trim()
}

export function jmEhdokas(k: JmKohde, nyt: Date = new Date()) {
  const tila = k.tila ? TILAT[k.tila] : undefined
  const valmis = Boolean(tila?.valmis) || muuttoMennyt(k.muuttopaiva, nyt)
  const vaihe = valmis ? PHASE_LABELS.completed : tila?.phase ?? null
  const sijainti = [k.osoite, [k.postinumero, k.kunta].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ")

  return {
    name: k.nimi,
    description: jmKuvaus(k),
    city: k.kunta,
    region: k.kunta ? (getMunicipalityByName(k.kunta)?.region ?? null) : null,
    location: sijainti || null,
    developer: JM,
    builder: JM,
    phase: vaihe,
    /*
     * Vaihe tulee rakenteisesta kentasta, joten tekstipaattely ei saa
     * ohittaa sita (D-339). Ilman tata otsikon "muuttovalmis" voisi
     * merkita kaynnissa olevan tyomaan valmiiksi.
     */
    phase_authoritative: Boolean(vaihe),
    completed: valmis,
    property_type: inferBuildingType(k.nimi, `${k.osoite ?? ""} ${k.intro}`),
    estimated_completion: k.muuttopaiva,
    source_url: k.linkki,
    confidence: 0.8,
    source_name: "jm_kohteet",
    metadata: {
      related_companies: mergeCompanyNames([], [JM]),
      /*
       * Asuntomyynti on organisaation laatikko, ei henkilo
       * ([[nameless-contact-is-not-broken]]). Tyomaan omia henkiloita
       * sivulla ei ole, joten tama on ainoa yhteystieto -- ja se on
       * aito reitti julkaisijaan.
       */
      contact_persons: k.myynti?.puhelin || k.myynti?.sahkoposti
        ? [
            {
              kind: "organization" as const,
              name: k.myynti.nimi,
              title: "asuntomyynti",
              organization: JM,
              email: k.myynti.sahkoposti ?? "",
              phone: k.myynti.puhelin,
              source: k.linkki,
            },
          ]
        : [],
      field_sources: {
        developer: "julkaisija",
        builder: "julkaisija",
        location: k.osoite ? "kentta" : null,
        estimated_completion: k.muuttopaiva ? "kentta (inhabitDate)" : null,
        phase: k.tila ? `julkaisijan tila (${k.tila})` : null,
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

export async function fetchJmSource() {
  const sivukartta = await hae(SIVUKARTTA)
  if (!sivukartta.ok) throw new Error(`JM: sivukartta ${sivukartta.status}`)
  const osoitteet = jasennaSivukartta(await sivukartta.text())

  const ehdokkaat: ReturnType<typeof jmEhdokas>[] = []
  for (const url of osoitteet) {
    try {
      const vastaus = await hae(`${url.replace(/\/$/, "")}/GetViewModel`)
      if (!vastaus.ok) continue
      const kohde = jasennaKohde(await vastaus.json(), url)
      if (kohde) ehdokkaat.push(jmEhdokas(kohde))
    } catch {
      /* Yksi rikkinainen sivu ei saa kaataa koko ajoa. */
    }
    await new Promise((r) => setTimeout(r, HAKUJEN_VALI_MS))
  }
  return ehdokkaat
}
