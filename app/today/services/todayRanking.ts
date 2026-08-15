import type { TodaySettings } from "./getTodaySettings"
import { projectSource } from "./todayFilters"
import type { FeedbackContext } from "./getUserFeedbackContext"
import {
  normalizeLegacyPhase,
  PHASE_LABELS,
  type PhaseKey,
} from "@/lib/projects/phases"
import { projectPhaseKey } from "@/lib/opportunity/projectPhaseKey"
import {
  resolveStageFit,
  ROLE_DATIVE_LABEL,
  type StageFit,
} from "@/lib/opportunity/roleStageMatrix"

const FEEDBACK_ATTRIBUTE_WEIGHT = 5
const FEEDBACK_SCORE_CAP = 30
const ROLE_STAGE_MAX_POINTS = 40
const TRADE_KEYWORD_POINTS_PER_HIT = 12
const TRADE_KEYWORD_MAX_POINTS = 25
/*
 * 20 eikä 30: vanha substring-versio antoi 20 pistettä per osunut sääntö ja
 * katkaisi 30:een vasta jos kaksi sääntöä osui samaan hankkeeseen. Kanonisella
 * vaiheella osumia on täsmälleen yksi, joten 20 on sama arvo kuin ennenkin —
 * 30 olisi nostanut moduulin painoa 50 % korjauksen sivutuotteena.
 */
const SALES_MOMENT_POINTS = 20

/*
 * Viitemaksimi 0–100 match-%:n normalisointiin (P1 V2): erinomainen osuma =
 * rooli-huippu (40) + suuri hanke (50) + uusi tänään (25) + hyvä lähde (15) +
 * myyntihetki (20) = 150. Avainsana- ja palautemoduulit voivat nostaa yli,
 * siksi clampataan 0–100.
 *
 * Luku pidetään 160:ssä vaikka erittelyn summa on 150: jakaja on
 * normalisointivakio, ja sen säätäminen siirtäisi JOKAISEN käyttäjän
 * match-prosenttia aina kun yksittäisen moduulin pisteitä hienosäädetään.
 */
const MATCH_REFERENCE_MAX = 160

export function matchPercent(score: number): number {
  return Math.max(0, Math.min(100, Math.round((score / MATCH_REFERENCE_MAX) * 100)))
}

/*
 * Pisteytysmoduuli palauttaa pisteet + valinnaisen ihmisluettavan syyn
 * ("miksi tämä sopii sinulle"). Syyt kootaan kortille (P1, §4–§5).
 */
type ScoreResult = { points: number; reason?: string }

type OpportunityContext = {
  project: any
  phaseKey: PhaseKey | null
  stageFit: StageFit
  settings: TodaySettings
  feedback?: FeedbackContext
}

function daysSince(dateValue: string | null | undefined) {
  if (!dateValue) return 999

  const created = new Date(dateValue).getTime()
  if (Number.isNaN(created)) return 999

  const now = Date.now()
  return Math.max(0, Math.floor((now - created) / (1000 * 60 * 60 * 24)))
}

/*
 * ⭐ Rooli → elinkaaren vaihe. P1:n ydinmoduuli: yritysprofiili ohjaa
 * pisteytystä (aiemmin inertti). Ks. `lib/opportunity/roleStageMatrix.ts`.
 *
 * Paino ratkaistaan kolmiportaisesti (rooli → omat myyntihetket → mitattu
 * oletus), joten myös roolittomat ja "Muu"-käyttäjät saavat vaihepisteytyksen.
 * Selitysteksti kertoo rehellisesti kummasta on kyse: ilmoitettu rooli vai
 * pääteltu signaali.
 */
function roleStageFit(ctx: OpportunityContext): ScoreResult {
  const { weight, source } = ctx.stageFit
  if (weight <= 0) return { points: 0 }

  const points = Math.round(weight * ROLE_STAGE_MAX_POINTS)
  const phaseLabel = ctx.phaseKey ? PHASE_LABELS[ctx.phaseKey] : ""

  if (source === "moments") {
    return { points, reason: `${phaseLabel} — valitsemasi myyntihetki` }
  }

  if (source === "default") {
    return { points, reason: `${phaseLabel} — tyypillinen myyntihetki` }
  }

  const dative =
    ROLE_DATIVE_LABEL[ctx.settings.companyProfile ?? ""] ?? "sinulle"

  return { points, reason: `${phaseLabel} — sopii ${dative}` }
}

function businessValue(ctx: OpportunityContext): ScoreResult {
  const value = ctx.project.metadata?.business_value

  if (value === "high") return { points: 50, reason: "Suuri hanke" }
  if (value === "medium") return { points: 25, reason: "Keskikokoinen hanke" }
  if (value === "low") return { points: 5 }

  return { points: 0 }
}

function freshness(ctx: OpportunityContext): ScoreResult {
  const age = daysSince(ctx.project.created_at)

  if (age <= 1) return { points: 25, reason: "Uusi tänään" }
  if (age <= 3) return { points: 15, reason: "Uusi tällä viikolla" }
  if (age <= 7) return { points: 8 }

  return { points: 0 }
}

function sourceQuality(ctx: OpportunityContext): ScoreResult {
  const source = projectSource(ctx.project)

  if (source.includes("hilma")) return { points: 15 }
  if (source.includes("rakennuslupa")) return { points: 12 }
  if (source.includes("espoon kuulutukset")) return { points: 12 }
  if (source.includes("kaavoitus")) return { points: 10 }

  return { points: 0 }
}

/*
 * Käyttäjän manuaalisesti valitsema myyntihetki (override roolin oletukselle).
 *
 * Vertaa hankkeen KANONISEEN vaiheeseen, ei vapaaseen tekstiin. Aiempi versio
 * tunnisti viisi vaihetta yhdeksästä substring-säännöillä, joten "Sopimus
 * myönnetty", "Valmistumassa", "Valmistunut" ja "Ideointi" eivät tuottaneet
 * pisteitä koskaan — vaikka ne ovat valittavissa ja käytössä. Sama vaihelogiikka
 * on nyt yhdessä paikassa (`projectPhaseKey`) kuten muuallakin P1:ssä.
 *
 * Ei pisteitä jos vaihepaino jo johdettiin näistä samoista myyntihetkistä:
 * se olisi sama signaali laskettuna kahdesti.
 */
function salesMomentFit(ctx: OpportunityContext): ScoreResult {
  if (ctx.stageFit.source === "moments") return { points: 0 }

  const moments = ctx.settings.bestSalesMoments ?? []
  if (!moments.length || !ctx.phaseKey) return { points: 0 }

  const matches = moments.some(
    (moment) => normalizeLegacyPhase(moment) === ctx.phaseKey
  )

  return matches
    ? { points: SALES_MOMENT_POINTS, reason: "Sopii valitsemaasi myyntihetkeen" }
    : { points: 0 }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/*
 * Koko hankkeen teksti, jota vasten käyttäjän avainsanat tarkistetaan.
 */
function projectKeywordText(project: any): string {
  return [
    project.name,
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

function keywordMatches(text: string, keyword: string): boolean {
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

/*
 * V3: käyttäjän oma avainsana-/toimialalista. Antaa lisäpisteitä + selityksen
 * kun hankkeen tekstissä osuu käyttäjän erikoisalan sanoihin (esim.
 * sähköurakoitsija: "sähkö, valaistus"). Deterministinen, fail-open:
 * tyhjä lista ei vaikuta mihinkään.
 */
function tradeKeywordFit(ctx: OpportunityContext): ScoreResult {
  const keywords = ctx.settings.keywords ?? []
  if (!keywords.length) return { points: 0 }

  const text = projectKeywordText(ctx.project)
  if (!text) return { points: 0 }

  const matched: string[] = []
  const seen = new Set<string>()

  for (const keyword of keywords) {
    const label = keyword.trim()
    const key = label.toLowerCase()
    if (!label || seen.has(key)) continue
    if (keywordMatches(text, label)) {
      matched.push(label)
      seen.add(key)
    }
  }

  if (!matched.length) return { points: 0 }

  const points = Math.min(
    matched.length * TRADE_KEYWORD_POINTS_PER_HIT,
    TRADE_KEYWORD_MAX_POINTS
  )
  const shown = matched.slice(0, 2).join(", ")

  return { points, reason: `${shown} mainittu` }
}

function feedbackAffinity(ctx: OpportunityContext): ScoreResult {
  const feedbackContext = ctx.feedback
  if (!feedbackContext) return { points: 0 }

  const project = ctx.project
  const attrs: Record<string, string | null | undefined> = {
    region: project.region,
    business_value: project.metadata?.business_value,
    construction_type: project.metadata?.construction_type,
    building_type: project.metadata?.building_type,
    size_class: project.metadata?.size_class,
    source_name: project.metadata?.source_name,
  }

  let score = 0

  for (const key of Object.keys(attrs)) {
    const value = attrs[key]
    if (!value) continue

    const net = feedbackContext.affinity[key]?.[value]
    if (net) score += net * FEEDBACK_ATTRIBUTE_WEIGHT
  }

  const points = Math.max(-FEEDBACK_SCORE_CAP, Math.min(FEEDBACK_SCORE_CAP, score))
  return points > 0
    ? { points, reason: "Muistuttaa hankkeita joista pidit" }
    : { points }
}

const SCORE_MODULES: ((ctx: OpportunityContext) => ScoreResult)[] = [
  roleStageFit,
  businessValue,
  freshness,
  sourceQuality,
  salesMomentFit,
  tradeKeywordFit,
  feedbackAffinity,
]

export type OpportunityBreakdownItem = {
  module: string
  points: number
  reason?: string
}

export type OpportunityScore = {
  score: number
  breakdown: OpportunityBreakdownItem[]
}

/*
 * Laskee hankkeen asiakaskohtaisen relevanssin: kokonaispisteet + erittely
 * moduuleittain (selityksiä varten). Vaihe ratkaistaan kerran per hanke.
 */
export function scoreOpportunity(
  project: any,
  settings: TodaySettings,
  feedback?: FeedbackContext
): OpportunityScore {
  const phaseKey = projectPhaseKey(project)

  const ctx: OpportunityContext = {
    project,
    phaseKey,
    stageFit: resolveStageFit(
      settings.companyProfile,
      phaseKey,
      settings.bestSalesMoments ?? []
    ),
    settings,
    feedback,
  }

  const breakdown: OpportunityBreakdownItem[] = SCORE_MODULES.map((mod) => {
    const { points, reason } = mod(ctx)
    return { module: mod.name, points, reason }
  })

  const score = breakdown.reduce((sum, item) => sum + item.points, 0)

  return { score, breakdown }
}

/*
 * Top-syyt kortille: positiivisen kontribuution moduulit suurin ensin,
 * enintään `limit`, tekstiltään uniikit.
 */
export function topReasons(
  breakdown: OpportunityBreakdownItem[],
  limit = 3
): string[] {
  const seen = new Set<string>()
  const reasons: string[] = []

  for (const item of [...breakdown].sort((a, b) => b.points - a.points)) {
    if (item.points <= 0 || !item.reason) continue
    if (seen.has(item.reason)) continue
    seen.add(item.reason)
    reasons.push(item.reason)
    if (reasons.length >= limit) break
  }

  return reasons
}

/*
 * Taaksepäin yhteensopiva: paljas kokonaispistemäärä.
 */
export function calculateTodayScore(
  project: any,
  settings: TodaySettings,
  feedbackContext?: FeedbackContext
) {
  return scoreOpportunity(project, settings, feedbackContext).score
}

export function rankTodayProjects(
  projects: any[],
  settings: TodaySettings,
  feedbackContext?: FeedbackContext
) {
  return [...projects]
    .map((project) => {
      const { score, breakdown } = scoreOpportunity(
        project,
        settings,
        feedbackContext
      )

      return {
        ...project,
        today_score: score,
        today_match: matchPercent(score),
        today_reasons: topReasons(breakdown),
      }
    })
    .sort((a, b) => {
      if (b.today_score !== a.today_score) {
        return b.today_score - a.today_score
      }

      return (
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime()
      )
    })
}
