import Anthropic from "@anthropic-ai/sdk"

/*
 * Poimii kaavan liiteasiakirjojen OTSIKOISTA mukana olevat yritykset
 * (arkkitehti-, insinööri- ja konsulttitoimistot). Helsingin sukka-
 * rajapinnan liiteotsikot ovat muotoa
 *   "<kaavan nimi>, <selvitystyyppi>, <Yritys> <pvm>"
 * esim. "Kulosaaren ostoskeskus, kaupallinen selvitys, Ramboll 26.8.2024".
 *
 * Firma ei ole aina viimeisenä eikä joka otsikossa ole firmaa lainkaan
 * ("kaavaselostus", "suunnitteluperiaatteet", "saatekirje"), joten
 * deterministinen jäsennin tuottaa liikaa roskaa — LLM erottaa oikeat
 * yritysnimet asiakirjatyypeistä luotettavasti. Fail-open: ilman
 * ANTHROPIC_API_KEY:tä tai virheen sattuessa palautetaan tyhjä lista.
 */
export type Consultant = { name: string; role: string | null }

const SYSTEM =
  "Saat listan suomalaisen asemakaavahankkeen liiteasiakirjojen otsikoita. " +
  "Poimi niistä MUKANA OLEVAT YRITYKSET: arkkitehti-, insinööri-, " +
  "suunnittelu- ja konsulttitoimistot sekä muut yritykset (esim. Ramboll, " +
  "Sitowise, Catella Property, Saatsi Arkkitehdit, JKMM Arkkitehdit Oy). " +
  "ÄLÄ palauta asiakirjatyyppejä tai yleissanoja (kaavaselostus, " +
  "suunnitteluperiaatteet, saatekirje, osallistumis- ja arviointisuunnitelma, " +
  "kaavakartta, havainnekuva, muistio, kysely, esitys, kaupungin museo/" +
  "kaupunkiympäristö = kaupungin omia yksiköitä ei lasketa). Päättele jokaiselle " +
  "yritykselle lyhyt ROOLI otsikon selvitystyypistä (esim. 'arkkitehti', " +
  "'rakennushistoriaselvitys', 'kaupallinen selvitys', 'arviointi', " +
  "'viitesuunnitelma'). Palauta jokainen yritys vain kerran. Jos yhtään " +
  "yritystä ei mainita, palauta tyhjä lista. Vastaa vain skeeman mukaan."

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["companies"],
  properties: {
    companies: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "role"],
        properties: {
          name: { type: "string" },
          role: { type: "string" },
        },
      },
    },
  },
} as const

let cachedClient: Anthropic | null = null
function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null
  if (!cachedClient) cachedClient = new Anthropic()
  return cachedClient
}

function normalizeName(name: string): string {
  return name
    .replace(/\s+\d{1,2}\.\d{1,2}\.\d{4}.*$/, "")
    .replace(/\s+\d{4}\s*$/, "")
    .replace(/\s+/g, " ")
    .trim()
}

export async function extractConsultantsFromAttachments(
  attachmentTitles: string[]
): Promise<Consultant[]> {
  const client = getClient()
  const titles = (attachmentTitles ?? [])
    .map((t) => (t ?? "").trim())
    .filter(Boolean)

  if (!client || titles.length === 0) return []

  try {
    const res = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 700,
      system: [
        {
          type: "text",
          text: SYSTEM,
          cache_control: { type: "ephemeral" },
        },
      ],
      output_config: {
        format: { type: "json_schema", schema: SCHEMA },
      },
      messages: [{ role: "user", content: titles.slice(0, 60).join("\n").slice(0, 6000) }],
    } as Anthropic.MessageCreateParamsNonStreaming)

    const textBlock = res.content.find((b) => b.type === "text")
    if (!textBlock || textBlock.type !== "text") return []

    const parsed = JSON.parse(textBlock.text) as {
      companies?: { name?: string; role?: string }[]
    }

    const seen = new Set<string>()
    const out: Consultant[] = []
    for (const c of parsed.companies ?? []) {
      const name = normalizeName(c.name ?? "")
      if (!name || name.length < 2) continue
      const key = name.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ name, role: c.role?.trim() || null })
    }
    return out
  } catch (err) {
    console.error("extractConsultantsFromAttachments failed (fail-open):", err)
    return []
  }
}
