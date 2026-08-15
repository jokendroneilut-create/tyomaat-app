import Anthropic from "@anthropic-ai/sdk"

/*
 * Hankkeen osapuolten EHDOTUS verkkohaun ja mallin avulla.
 *
 * MIKSI TÄMÄ ON POIKKEUS SÄÄNTÖÖN "deterministinen ensin" (D-006). Tavallisesti
 * osapuolet poimitaan lähdetekstistä. Käsin lisätyillä hankkeilla lähdetekstiä
 * EI OLE lainkaan — mitattu 15.8.2026: 46 hanketta joilla kuvaus on tyhjä, ei
 * lähdettä, metadatassa yksi kenttä. Poimittavaa ei siis ole, ja ainoa tie on
 * hakea tieto ulkopuolelta. Juuri tähän D-006 varaa LLM:n: "epävarmoihin ja
 * korkean arvon tapauksiin".
 *
 * HAKU + MALLI, EI PELKKÄ MALLI. Malli yksin arvaisi. Verkkohaku antaa lähteen,
 * ja lähde-URL vaaditaan jokaiselta väitteeltä — ilman sitä tulos hylätään.
 *
 * TÄMÄ EI KIRJOITA ASIAKKAALLE NÄKYVIÄ KENTTIÄ. Väärä yritysnimi on asiakkaalle
 * pahempi kuin tyhjä kenttä (D-057, D-072, D-073), joten tulos on EHDOTUS jonka
 * ihminen hyväksyy TIC:ssä. Malli ehdottaa, ihminen päättää.
 *
 * Fail-open: ilman ANTHROPIC_API_KEY:tä tai virheessä palautetaan null eikä
 * mikään muutu.
 */

export const SUGGESTION_MODEL = "claude-opus-5"

const SYSTEM_PROMPT =
  "Selvität suomalaisen rakennushankkeen osapuolet verkkohaun avulla. " +
  "Hae hankkeen nimellä ja paikkakunnalla. Palauta VAIN tiedot jotka löydät " +
  "hakutuloksista ja joille voit antaa lähde-URL:n. " +
  "ÄLÄ ARVAA. Jos et löydä tietoa, jätä kenttä tyhjäksi (null) — tyhjä kenttä " +
  "on parempi kuin väärä. Älä päättele yrityksen nimeä hankkeen nimestä. " +
  "rakennuttaja = tilaaja joka teettää hankkeen (esim. kaupunki, kiinteistöyhtiö). " +
  "paaurakoitsija = rakentava yritys. Nämä ovat eri asia — älä laita samaa " +
  "yritystä molempiin ellei lähde nimenomaan kerro sitä. " +
  "kustannus ilmoitetaan euroina kokonaislukuna (82,4 miljoonaa = 82400000). " +
  "Varmuus: 'high' vain jos useampi lähde tai virallinen lähde vahvistaa, " +
  "'low' jos tieto on epäsuora tai yksittäinen maininta."

/*
 * Rakenteinen tulos. `anyOf` null-arvoille, koska strukturoitu ulostulo ei
 * tue tyyppiunioneja suoraan.
 */
const SUGGESTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "found",
    "rakennuttaja",
    "paaurakoitsija",
    "kustannus_eur",
    "varmuus",
    "lahteet",
    "perustelu",
  ],
  properties: {
    found: { type: "boolean" },
    rakennuttaja: { anyOf: [{ type: "string" }, { type: "null" }] },
    paaurakoitsija: { anyOf: [{ type: "string" }, { type: "null" }] },
    kustannus_eur: { anyOf: [{ type: "integer" }, { type: "null" }] },
    varmuus: { type: "string", enum: ["high", "medium", "low"] },
    lahteet: { type: "array", items: { type: "string" } },
    perustelu: { type: "string" },
  },
} as const

export type PartySuggestion = {
  developer: string | null
  builder: string | null
  estimatedCost: number | null
  confidence: "high" | "medium" | "low"
  sources: string[]
  reason: string
  model: string
}

let cachedClient: Anthropic | null = null

function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null
  if (!cachedClient) cachedClient = new Anthropic()
  return cachedClient
}

export function isSuggestionEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

/*
 * Yrityskenttään kuuluu NIMI, ei selitys. Mitattu 15.8.2026: malli palautti
 * "Keski-Suomen Betonirakenne Oy (KSBR) – infraurakka (maanrakennus-,
 * perustus- ja kaapelointityöt)", mikä olisi kirjoittunut sellaisenaan
 * hankekortin urakoitsijakenttään. Katkaistaan selittävä osa ja hylätään
 * epäuskottavan pitkä arvo — tyhjä on parempi kuin sotkuinen.
 */
const MAX_NAME_LENGTH = 80

const clean = (value: unknown): string | null => {
  if (typeof value !== "string") return null

  const name = value
    .split(/\s+[–—-]\s+/)[0]
    .split(/\s*\(/)[0]
    .replace(/[,;:.]+$/, "")
    .trim()

  if (name.length < 2 || name.length > MAX_NAME_LENGTH) return null

  return name
}

export async function suggestProjectParties(input: {
  name: string
  city?: string | null
  region?: string | null
  phase?: string | null
  propertyType?: string | null
}): Promise<PartySuggestion | null> {
  const client = getClient()
  if (!client) return null

  const question =
    `Hanke: ${input.name}\n` +
    `Paikkakunta: ${input.city ?? "-"}\n` +
    `Maakunta: ${input.region ?? "-"}\n` +
    `Vaihe: ${input.phase ?? "-"}\n` +
    `Kohdetyyppi: ${input.propertyType ?? "-"}\n\n` +
    `Kuka on hankkeen rakennuttaja ja kuka pääurakoitsija? ` +
    `Mikä on hankkeen euromääräinen arvo?`

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: question }]

  try {
    /*
     * VAIHE 1 — HAKU. Vapaamuotoinen vastaus, koska hakutyökalu tuottaa
     * sitaatti- ja koodisuorituslohkoja eikä lopputeksti ole tällöin JSONia:
     * rakenteinen ulostulo yhdistettynä hakuun palautti tyhjän tuloksen
     * (mitattu 15.8.2026). Haku saa siis vastata omalla tavallaan.
     */
    let searchResponse: Anthropic.Message | null = null

    for (let attempt = 0; attempt < 4; attempt++) {
      searchResponse = await client.messages.create({
        model: SUGGESTION_MODEL,
        max_tokens: 4096,
        system: [
          {
            type: "text",
            text: SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" },
          },
        ],
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 6 }],
        messages,
      } as Anthropic.MessageCreateParamsNonStreaming)

      /*
       * Palvelintyökalu voi pysähtyä `pause_turn`iin kesken hakukierrosten.
       * Jatketaan lähettämällä sama keskustelu takaisin; katto estää silmukan.
       */
      if (searchResponse.stop_reason !== "pause_turn") break

      messages.push({ role: "assistant", content: searchResponse.content })
    }

    if (!searchResponse) return null

    /*
     * Turvaluokitus ei ole virhe vaan sisältötulos — ei kaadeta, ei ehdoteta.
     */
    if (searchResponse.stop_reason === "refusal") return null

    const findings = searchResponse.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n")

    if (!findings.trim()) return null

    /*
     * VAIHE 2 — JÄSENNYS. Erillinen kutsu ILMAN työkaluja: se näkee vain
     * vaiheen 1 löydökset eikä voi hakea uutta tietoa, joten se ei voi
     * keksiä mitään mitä lähteissä ei ollut. Vasta tässä pakotetaan skeema.
     */
    const parseResponse = await client.messages.create({
      model: SUGGESTION_MODEL,
      max_tokens: 2048,
      system: [
        {
          type: "text",
          text:
            "Jäsennä annetuista hakulöydöksistä hankkeen osapuolet skeeman " +
            "mukaiseen muotoon. Käytä VAIN annettua tekstiä — älä lisää mitään " +
            "mitä siinä ei lue. Jos tieto puuttuu, jätä kenttä nulliksi. " +
            "Kopioi lähde-URL:t sellaisenaan.",
          cache_control: { type: "ephemeral" },
        },
      ],
      output_config: {
        format: { type: "json_schema", schema: SUGGESTION_SCHEMA },
      },
      messages: [
        { role: "user", content: `Hanke: ${input.name}\n\nLöydökset:\n${findings}` },
      ],
    } as Anthropic.MessageCreateParamsNonStreaming)

    const text = parseResponse.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")

    if (!text.trim()) return null

    const parsed = JSON.parse(text)

    const developer = clean(parsed.rakennuttaja)
    const builder = clean(parsed.paaurakoitsija)
    const cost =
      typeof parsed.kustannus_eur === "number" && parsed.kustannus_eur > 0
        ? Math.round(parsed.kustannus_eur)
        : null

    const sources = Array.isArray(parsed.lahteet)
      ? parsed.lahteet.filter((s: unknown) => typeof s === "string" && /^https?:/i.test(s))
      : []

    /*
     * LÄHDE ON PAKOLLINEN. Ilman URL:ää väite ei ole tarkistettavissa, ja
     * tarkistamaton väite on juuri se mitä tässä ei haluta.
     */
    if (!sources.length) return null
    if (!developer && !builder && cost === null) return null

    return {
      developer,
      builder,
      estimatedCost: cost,
      confidence:
        parsed.varmuus === "high" || parsed.varmuus === "low"
          ? parsed.varmuus
          : "medium",
      sources,
      reason: String(parsed.perustelu ?? "").slice(0, 500),
      model: SUGGESTION_MODEL,
    }
  } catch (error: any) {
    console.error("suggestProjectParties:", error?.message ?? error)
    return null
  }
}
