import Anthropic from "@anthropic-ai/sdk"

/*
 * LLM-relevanssiskoreri: arvioi onko signaali aito, Suomessa sijaitseva
 * rakennus-/infrahanke. Käytetään VAIN "harmaan alueen" tapauksiin, jotka
 * sääntöluokittelu (classifySignal) jätti epävarmaksi — ei selkeisiin kyllä/ei
 * -tapauksiin. Näin kustannus pysyy pienenä ja hyöty menee sinne missä säännöt
 * ovat heikoimmillaan.
 *
 * Prompti + skeema on offline-evalilla (scripts/eval-relevance.mjs) validoitu:
 * relevanssitarkkuus ~98-100 %. Pidä tämä ja evalin versio synkassa.
 *
 * Fail-open: jos ANTHROPIC_API_KEY puuttuu tai kutsu epäonnistuu, palautetaan
 * null eikä putki muutu — pysytään pelkissä säännöissä.
 */

export const RELEVANCE_MODEL = "claude-haiku-4-5"

export const RELEVANCE_SYSTEM_PROMPT =
  "Arvioi, onko annettu signaali aito, Suomessa sijaitseva rakennus- tai " +
  "infrastruktuurihanke, joka on relevantti rakennusalan myynnille. TÄRKEÄÄ: " +
  "hanke on relevantti MISSÄ TAHANSA vaiheessa aina aikaisesta kaavoituksesta " +
  "lähtien — kaavoitus, ideointi, suunnittelu, rakennuslupa, kilpailutus, " +
  "rakentaminen. Aikainen signaali on nimenomaan arvokas. Relevantteja ovat " +
  "myös energiainfran hankkeet ja niiden kaavoitus (esim. tuulivoima, " +
  "aurinkovoima) sekä rakennusluvat ja kaavaprosessit joilla on tunnistettava " +
  "hankekohde. Hylkää VAIN: pelkät hallinnolliset/menettelylliset ilmoitukset " +
  "joilla ei ole mitään tunnistettavaa hanketta (esim. yksittäinen puun kaato, " +
  "pelkkä kaavakoodi ilman muuta tietoa), uutiset ja mielipiteet ilman " +
  "konkreettista hanketta, sekä ulkomaiset kohteet. Vastaa vain annetun " +
  "skeeman mukaan. Pidä 'reason' lyhyenä: korkeintaan 1–2 lausetta."

const RELEVANCE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["relevant", "confidence", "reason"],
  properties: {
    relevant: { type: "boolean" },
    confidence: { type: "number" },
    reason: { type: "string" },
  },
} as const

export type RelevanceVerdict = {
  relevant: boolean
  confidence: number
  reason: string
  model: string
}

let cachedClient: Anthropic | null = null

function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null
  if (!cachedClient) cachedClient = new Anthropic()
  return cachedClient
}

export function isRelevanceScorerEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

export async function scoreRelevance(input: {
  title: string
  description?: string | null
  sourceName?: string | null
}): Promise<RelevanceVerdict | null> {
  const client = getClient()
  if (!client) return null

  try {
    const res = await client.messages.create({
      model: RELEVANCE_MODEL,
      max_tokens: 1024,
      // Prompt-caching: kiinteä ohje leikkaa toistojen sisääntulokustannuksen ~90 %.
      system: [
        {
          type: "text",
          text: RELEVANCE_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      output_config: {
        format: { type: "json_schema", schema: RELEVANCE_SCHEMA },
      },
      messages: [
        {
          role: "user",
          content:
            `Otsikko: ${input.title}\n` +
            `Kuvaus: ${input.description ?? "-"}\n` +
            `Lähde: ${input.sourceName ?? "-"}`,
        },
      ],
    } as Anthropic.MessageCreateParamsNonStreaming)

    const textBlock = res.content.find((b) => b.type === "text")
    if (!textBlock || textBlock.type !== "text") return null

    const parsed = JSON.parse(textBlock.text) as {
      relevant: boolean
      confidence: number
      reason: string
    }

    return { ...parsed, model: RELEVANCE_MODEL }
  } catch (err) {
    console.error("scoreRelevance failed (fail-open):", err)
    return null
  }
}
