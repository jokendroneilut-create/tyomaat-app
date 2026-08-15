import {
  normalizeLegacyPhase,
  PHASE_KEYS_IN_ORDER,
  PHASE_LABELS,
  type PhaseKey,
} from "@/lib/projects/phases"

/*
 * Rooli → elinkaaren vaihe -relevanssimatriisi (P1 Opportunity Engine, §2).
 *
 * Kunkin roolin "myyntihetki" johdetaan hankkeen kanonisesta vaiheesta
 * (`PhaseKey`) painoilla: huippuvaihe = 1.0, viereiset = osittainen. Logiikka:
 * mitä myöhempi rooli arvoketjussa, sitä myöhempi vaihe on relevantti —
 * arkkitehti kaavassa, materiaalitoimittaja rakentamisessa.
 *
 * Tämä on TARKOITUKSELLA yksi tarkistettava taulukko: kaikki roolikohtainen
 * pisteytyslogiikka on tässä, ei hajautettuna. Säädä painoja käyttäjäpalautteen
 * mukaan. Roolien nimet vastaavat `todaySettingsConfig.ts`:n `companyProfiles`.
 */

export type StageWeights = Partial<Record<PhaseKey, number>>

export const ROLE_STAGE_MATRIX: Record<string, StageWeights> = {
  Arkkitehti: { idea: 1.0, zoning: 1.0, planning: 0.8 },
  Kiinteistönomistaja: { idea: 1.0, zoning: 0.8, planning: 0.6 },
  Rakennesuunnittelu: { planning: 1.0, permit: 0.8 },
  Rakennusliike: { tender: 1.0, permit: 0.6, contract_awarded: 0.4 },
  Infra: { zoning: 0.4, tender: 1.0, construction: 0.7 },
  Sähköurakoitsija: { contract_awarded: 1.0, tender: 0.7, construction: 0.6 },
  Talotekniikka: { contract_awarded: 1.0, tender: 0.7, construction: 0.6 },
  Rakennustuotteet: {
    contract_awarded: 0.8,
    construction: 1.0,
    nearing_completion: 0.5,
  },

  /*
   * Nämä neljä lisättiin 15.8.2026, koska puolet käyttäjistä (13/26) oli
   * roolissa "Muu" eikä siis saanut roolipisteytystä lainkaan. Syy ei ollut
   * laiskuus vaan se ETTEI LISTALLA OLLUT HEIDÄN TOIMIALAANSA: mitattuna
   * "Muu"-tilien verkkotunnukset olivat henkilöstövuokraus (4 tiliä),
   * erikoisurakointi (maalaus, teräsrakenteet), konevuokraus ja
   * mittauspalvelu. Painot on johdettu NÄIDEN SAMOJEN TILIEN itse
   * valitsemista myyntihetkistä, ei arvattu.
   */
  Henkilöstövuokraus: {
    tender: 0.5,
    contract_awarded: 0.8,
    construction: 1.0,
    nearing_completion: 0.5,
  },
  Aliurakointi: {
    permit: 0.4,
    contract_awarded: 1.0,
    construction: 0.9,
    nearing_completion: 0.4,
  },
  Konevuokraus: {
    permit: 0.5,
    contract_awarded: 0.8,
    construction: 1.0,
    nearing_completion: 0.3,
  },
  /*
   * Konsultti on heterogeenisin uusi rooli: painot noudattavat blueprintin
   * logiikkaa (konsultti myy varhain, suunnitteluvaiheessa), mutta ainoa
   * mitattu konsulttitili — mittauspalvelu — valitsi itse myöhemmät vaiheet.
   * Tämä on ensimmäinen rivi jota kannattaa tarkistaa kun konsultteja
   * rekisteröityy lisää.
   */
  Konsultti: {
    planning: 1.0,
    permit: 0.8,
    tender: 0.6,
    contract_awarded: 0.5,
    construction: 0.6,
  },

  Muu: {},
}

/*
 * "Muu"-roolin oletuspainot, kun käyttäjä ei ole valinnut myyntihetkiäkään.
 *
 * Ei arvattu: mitattu 15.8.2026 niiden 13 "Muu"-tilin omista valinnoista,
 * jotka olivat myyntihetkensä valinneet. Rakenteilla oli valittuna 13/13,
 * Sopimus myönnetty 9/13, Valmistumassa 7/13, Kilpailutus 7/13. Roolittoman
 * käyttäjän paras arvaus on siis käynnissä oleva työmaa.
 *
 * Huippu on tarkoituksella 0.9 eikä 1.0: P2-hälytykset laukeavat vain
 * painolla 1.0, ja pääteltyä signaalia ei saa nostaa ilmoitettua roolia
 * vastaavaksi — se lähettäisi sähköpostia ihmisille jotka eivät ole
 * kertoneet meille mitä tekevät. Ks. D-071.
 */
export const UNKNOWN_ROLE_DEFAULT_WEIGHTS: StageWeights = {
  tender: 0.4,
  contract_awarded: 0.6,
  construction: 0.9,
  nearing_completion: 0.4,
}

/*
 * Käyttäjän itse valitseman myyntihetken paino, kun roolia ei ole. Sama
 * 0.9-katto ja sama peruste kuin yllä.
 */
const SELECTED_MOMENT_WEIGHT = 0.9

/*
 * Roolin datiivimuoto selitystekstiä varten ("… sopii materiaalitoimittajalle").
 */
export const ROLE_DATIVE_LABEL: Record<string, string> = {
  Arkkitehti: "arkkitehdille",
  Kiinteistönomistaja: "kiinteistönomistajalle",
  Rakennesuunnittelu: "rakennesuunnittelijalle",
  Rakennusliike: "rakennusliikkeelle",
  Infra: "infrarakentajalle",
  Sähköurakoitsija: "sähköurakoitsijalle",
  Talotekniikka: "talotekniikkaurakoitsijalle",
  Rakennustuotteet: "materiaalitoimittajalle",
  Henkilöstövuokraus: "henkilöstövuokraajalle",
  Aliurakointi: "aliurakoitsijalle",
  Konevuokraus: "konevuokraamolle",
  Konsultti: "konsultille",
  Muu: "sinulle",
}

/*
 * Palauttaa (rooli, vaihe) -painon [0..1] tai 0 jos ei relevantti / ei roolia /
 * tuntematon vaihe.
 */
export function roleStageWeight(
  companyProfile: string | null | undefined,
  phaseKey: PhaseKey | null
): number {
  if (!companyProfile || !phaseKey) return 0
  return ROLE_STAGE_MATRIX[companyProfile]?.[phaseKey] ?? 0
}

/*
 * Mistä paino tuli — ratkaisee selitystekstin ja estää saman signaalin
 * laskemisen kahdesti (ks. `salesMomentFit` todayRankingissa).
 */
export type StageFitSource = "role" | "moments" | "default"

export type StageFit = { weight: number; source: StageFitSource }

/*
 * ⭐ Painon ratkaisu kolmella tasolla — tämä on se kohta jossa "Muu"-rooli
 * lakkaa olemasta pisteytyksen umpikuja.
 *
 * 1. ROOLI, jos sillä on painoja. Käyttäjä on kertonut suoraan mitä tekee.
 * 2. KÄYTTÄJÄN OMAT MYYNTIHETKET, jos rooli on "Muu"/tuntematon/puuttuu.
 *    Mitattu 15.8.2026: kaikki 26 asetuksensa säätänyttä tiliä oli valinnut
 *    myyntihetkensä, myös 13/13 "Muu"-tiliä. Signaali oli siis olemassa
 *    koko ajan — sitä ei vain käytetty roolin puuttuessa.
 * 3. MITATTU OLETUS, jos sekään ei ole tiedossa (ks.
 *    `UNKNOWN_ROLE_DEFAULT_WEIGHTS`).
 *
 * Fail-soft: tuntematon vaihe -> 0, ei rankaisua eikä poikkeusta.
 */
export function resolveStageFit(
  companyProfile: string | null | undefined,
  phaseKey: PhaseKey | null,
  selectedSalesMoments: string[] = []
): StageFit {
  if (!phaseKey) return { weight: 0, source: "role" }

  const roleWeights = companyProfile
    ? ROLE_STAGE_MATRIX[companyProfile]
    : undefined

  if (roleWeights && Object.keys(roleWeights).length > 0) {
    return { weight: roleWeights[phaseKey] ?? 0, source: "role" }
  }

  if (selectedSalesMoments.length > 0) {
    const selected = selectedSalesMoments.some(
      (moment) => normalizeLegacyPhase(moment) === phaseKey
    )
    return {
      weight: selected ? SELECTED_MOMENT_WEIGHT : 0,
      source: "moments",
    }
  }

  return {
    weight: UNKNOWN_ROLE_DEFAULT_WEIGHTS[phaseKey] ?? 0,
    source: "default",
  }
}

/*
 * Roolista johdetut myyntihetket (vaihe-labelit) — käytetään asetusten
 * oletuksena, jottei käyttäjän tarvitse valita niitä käsin (P1 V2). Palauttaa
 * vaiheet joilla on merkittävä paino (>= 0.6), elinkaaren järjestyksessä.
 * Labelit vastaavat `todaySettingsConfig.ts`:n `salesMoments`ia.
 */
const SALES_MOMENT_WEIGHT_THRESHOLD = 0.6

export function salesMomentsForRole(
  companyProfile: string | null | undefined
): string[] {
  if (!companyProfile) return []
  const weights = ROLE_STAGE_MATRIX[companyProfile]
  if (!weights) return []

  return PHASE_KEYS_IN_ORDER.filter(
    (key) => (weights[key] ?? 0) >= SALES_MOMENT_WEIGHT_THRESHOLD
  ).map((key) => PHASE_LABELS[key])
}
