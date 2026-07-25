import Anthropic from "@anthropic-ai/sdk"
import { getMunicipalityByName } from "@/lib/geo/municipalities"

/*
 * Poimii rakennushankkeen TYÖMAAN osoitteen ja kaupungin. Hilmassa rakenteinen
 * osoite on hankintayksikön (tilaajan) osoite — työmaan osoite on usein vain
 * vapaassa kuvaustekstissä ("rakennuspaikka sijaitsee osoitteessa: ..."). Tämä
 * täyttää sen aukon: deterministinen jäsennin ensin (halpa, luotettava
 * vakiomuotoisille osoitteille), LLM varalle sotkuisempaan tekstiin.
 *
 * Kaupunki validoidaan aina kuntarekisteristä (getMunicipalityByName), joten
 * satunnaiset isolla alkavat sanat postinumeron perässä eivät mene läpi.
 */
export type Worksite = { city: string | null; address: string | null }

export function extractWorksiteDeterministic(
  description: string | null | undefined
): Worksite {
  if (!description) return { city: null, address: null }

  let city: string | null = null

  // Kaupunki: postinumero + kaupunki, validoitu kuntarekisteristä.
  const cityRe = /\b\d{5}\s+([A-ZÅÄÖ][a-zåäö\-]+)/g
  let m: RegExpExecArray | null
  while ((m = cityRe.exec(description)) !== null) {
    const muni = getMunicipalityByName(m[1])
    if (muni) {
      city = muni.name
      break
    }
  }

  // Osoite: katu + numero, (pilkku), postinumero, kaupunki.
  let address: string | null = null
  const addrRe =
    /([A-ZÅÄÖ][a-zåäöA-ZÅÄÖ\- ]+?\s\d+[a-zA-Z]?)\s*,?\s+(\d{5})\s+([A-ZÅÄÖ][a-zåäö\-]+)/
  const am = description.match(addrRe)
  if (am) {
    const muni = getMunicipalityByName(am[3])
    if (muni) {
      address = `${am[1].trim()}, ${am[2]} ${muni.name}`
      if (!city) city = muni.name
    }
  }

  return { city, address }
}

const WORKSITE_SYSTEM =
  "Poimi rakennushankkeen TYÖMAAN osoite ja kaupunki suomalaisesta " +
  "hankekuvauksesta. ÄLÄ käytä hankintayksikön/tilaajan osoitetta, vaan " +
  "sitä missä rakennetaan. Jos työmaan osoitetta tai kaupunkia ei mainita, " +
  "palauta tyhjä merkkijono kyseiselle kentälle. Vastaa vain skeeman mukaan."

const WORKSITE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["city", "address"],
  properties: {
    city: { type: "string" },
    address: { type: "string" },
  },
} as const

let cachedClient: Anthropic | null = null
function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null
  if (!cachedClient) cachedClient = new Anthropic()
  return cachedClient
}

export async function extractWorksiteLLM(
  description: string | null | undefined
): Promise<Worksite> {
  const client = getClient()
  if (!client || !description) return { city: null, address: null }

  try {
    const res = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 300,
      system: [
        {
          type: "text",
          text: WORKSITE_SYSTEM,
          cache_control: { type: "ephemeral" },
        },
      ],
      output_config: {
        format: { type: "json_schema", schema: WORKSITE_SCHEMA },
      },
      messages: [{ role: "user", content: description.slice(0, 4000) }],
    } as Anthropic.MessageCreateParamsNonStreaming)

    const textBlock = res.content.find((b) => b.type === "text")
    if (!textBlock || textBlock.type !== "text") return { city: null, address: null }

    const parsed = JSON.parse(textBlock.text) as {
      city?: string
      address?: string
    }

    // Validoi kaupunki kuntarekisteristä; osoite otetaan sellaisenaan.
    const muni = parsed.city?.trim() ? getMunicipalityByName(parsed.city.trim()) : null
    return {
      city: muni ? muni.name : null,
      address: parsed.address?.trim() || null,
    }
  } catch (err) {
    console.error("extractWorksiteLLM failed (fail-open):", err)
    return { city: null, address: null }
  }
}

/*
 * Yhdistetty: deterministinen ensin. LLM-varajärjestelmä ajetaan vain jos
 * deterministinen ei löytänyt kaupunkia (ja ANTHROPIC_API_KEY on asetettu) —
 * eli vain pienelle osalle, kustannus minimissä.
 */
export async function extractWorksite(
  description: string | null | undefined
): Promise<Worksite> {
  const det = extractWorksiteDeterministic(description)
  if (det.city) return det

  const llm = await extractWorksiteLLM(description)
  return {
    city: det.city ?? llm.city,
    address: det.address ?? llm.address,
  }
}
