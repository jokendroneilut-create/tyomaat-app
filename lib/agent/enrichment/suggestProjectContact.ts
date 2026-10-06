import Anthropic from "@anthropic-ai/sdk"

/*
 * HANKKEEN YHTEYSHENKILO VERKOSTA (D-244).
 *
 * Johannes 6.10.2026: *"Olen tyytyvainen vasta kun jokaisessa hankkeessa
 * on projektikohtainen yhteystieto."* Puutteesta puolet on hankkeita
 * jotka on lisatty kasin: niilla ei ole lahdeasiakirjaa josta poimia,
 * joten ainoa tie on hakea tieto ulkopuolelta.
 *
 * TAMA ON ERI ASIA KUIN `suggestProjectParties`. Se ehdottaa OSAPUOLIA
 * (yritysnimia); tama ehdottaa IHMISTA jolle voi soittaa. Useimmilla
 * puutteellisilla hankkeilla yritys on jo tiedossa — henkilo puuttuu.
 *
 * KAKSI VAIHETTA, SAMA KAAVA KUIN D-078:SSA. Haku saa vastata vapaasti
 * (hakutyokalu tuottaa sitaattilohkoja, eika rakenteinen ulostulo toimi
 * sen kanssa), ja jasennys tehdaan erillisella kutsulla ILMAN
 * tyokaluja: se nakee vain vaiheen 1 loydokset eika voi keksia mitaan
 * mita lahteissa ei ollut.
 *
 * EI KIRJOITA ASIAKKAALLE NAKYVIA KENTTIA. Tulos on ehdotus jonka
 * ihminen hyvaksyy. Vaara nimi tai numero on asiakkaalle pahempi kuin
 * tyhja kentta — han soittaa sen.
 */

export const CONTACT_MODEL = "claude-opus-5"

const SYSTEM_PROMPT =
  "Selvitat suomalaisen rakennushankkeen YHTEYSHENKILON verkkohaun avulla. " +
  "Etsi nimetty ihminen jolla on hankkeessa rooli: projektipaallikko, " +
  "rakennuttajapaallikko, tyopaallikko, hankejohtaja tai vastaava. " +
  "ALA ARVAA. Palauta vain henkilo jonka loydat hakutuloksista ja jolle " +
  "voit antaa lahde-URL:n. Jos et loyda, sano etta et loytanyt. " +
  "ALA KEKSI sahkopostiosoitetta mallista 'etunimi.sukunimi@yritys.fi' — " +
  "palauta osoite vain jos se lukee lahteessa sellaisenaan. " +
  "VIESTINTA EI KELPAA: tiedottaja ja viestintapaallikko vastaavat " +
  "haastattelupyyntoihin, eivat hankkeesta. Alä palauta heita. " +
  "Yleinen vaihde tai kirjaamo ei ole yhteyshenkilo. " +
  "Varmuus: 'high' vain jos lahde on hankkeen oma sivu tai tiedote, " +
  "'low' jos henkilo loytyi epasuorasti."

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["found", "nimi", "nimike", "organisaatio", "email", "puhelin", "varmuus", "lahteet", "perustelu"],
  properties: {
    found: { type: "boolean" },
    nimi: { anyOf: [{ type: "string" }, { type: "null" }] },
    nimike: { anyOf: [{ type: "string" }, { type: "null" }] },
    organisaatio: { anyOf: [{ type: "string" }, { type: "null" }] },
    email: { anyOf: [{ type: "string" }, { type: "null" }] },
    puhelin: { anyOf: [{ type: "string" }, { type: "null" }] },
    varmuus: { type: "string", enum: ["high", "medium", "low"] },
    lahteet: { type: "array", items: { type: "string" } },
    perustelu: { type: "string" },
  },
} as const

export type ContactSuggestion = {
  nimi: string
  nimike: string | null
  organisaatio: string | null
  email: string | null
  puhelin: string | null
  varmuus: "high" | "medium" | "low"
  lahteet: string[]
  perustelu: string
  model: string
}

let cachedClient: Anthropic | null = null

function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null
  if (!cachedClient) cachedClient = new Anthropic()
  return cachedClient
}

export function isContactSuggestionEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

/* Nimi on kaksi sanaa; yksi sana on organisaatio tai jaannos. */
const NIMI_RE = /^[A-ZÅÄÖ][\wåäöÅÄÖ-]+(?:\s+[A-ZÅÄÖ][\wåäöÅÄÖ-]+)+$/

/*
 * Mallipohjainen osoite on kielletty erikseen, koska se nayttaa
 * oikealta: "etunimi.sukunimi@senaatti.fi" on oikea muoto muttei kenenkaan
 * osoite. Mitattu Hartelan yhteystietosivulta 6.10.2026.
 */
const MALLIOSOITE = /etunimi|sukunimi|firstname|lastname/i

export async function suggestProjectContact(input: {
  name: string
  city?: string | null
  developer?: string | null
  builder?: string | null
  description?: string | null
}): Promise<ContactSuggestion | null> {
  const client = getClient()
  if (!client) return null

  const question =
    `Hanke: ${input.name}
` +
    `Paikkakunta: ${input.city ?? "-"}
` +
    `Rakennuttaja: ${input.developer ?? "-"}
` +
    `Urakoitsija: ${input.builder ?? "-"}
` +
    (input.description ? `Kuvaus: ${String(input.description).slice(0, 400)}
` : "") +
    `
Kuka on taman hankkeen yhteyshenkilo? Anna nimi, nimike, organisaatio ` +
    `seka sahkoposti tai puhelin, ja lahde-URL.`

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: question }]

  try {
    let searchResponse: Anthropic.Message | null = null

    for (let attempt = 0; attempt < 4; attempt++) {
      searchResponse = await client.messages.create({
        model: CONTACT_MODEL,
        max_tokens: 4096,
        system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 6 }],
        messages,
      } as Anthropic.MessageCreateParamsNonStreaming)

      if (searchResponse.stop_reason !== "pause_turn") break
      messages.push({ role: "assistant", content: searchResponse.content })
    }

    if (!searchResponse || searchResponse.stop_reason === "refusal") return null

    const findings = searchResponse.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n")

    if (!findings.trim()) return null

    const parseResponse = await client.messages.create({
      model: CONTACT_MODEL,
      max_tokens: 1024,
      system: [
        {
          type: "text",
          text:
            "Jasenna annetuista hakuloydoksista hankkeen yhteyshenkilo skeeman " +
            "mukaiseen muotoon. Kayta VAIN annettua tekstia — ala lisaa mitaan " +
            "mita siina ei lue. Jos tieto puuttuu, jata kentta nulliksi. " +
            "Kopioi lahde-URL:t sellaisenaan.",
          cache_control: { type: "ephemeral" },
        },
      ],
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
      messages: [{ role: "user", content: findings }],
    } as Anthropic.MessageCreateParamsNonStreaming)

    const teksti = parseResponse.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")

    const tulos = JSON.parse(teksti)
    if (!tulos?.found) return null

    const nimi = String(tulos.nimi ?? "").trim()
    if (!NIMI_RE.test(nimi)) return null

    const email = String(tulos.email ?? "").trim()
    const puhelin = String(tulos.puhelin ?? "").trim()

    /* Ilman yhteystapaa nimi ei auta ketaan soittamaan. */
    if (!email && !puhelin) return null
    if (email && MALLIOSOITE.test(email)) return null

    /* Vaite ilman lahdetta ei ole loydos vaan arvaus. */
    const lahteet = Array.isArray(tulos.lahteet) ? tulos.lahteet.filter(Boolean) : []
    if (!lahteet.length) return null

    /*
     * NIMIKE ON NIMIKE, EI SELITYS. Malli palautti ensimmaisessa ajossa
     * "hankekehityspaallikko (Solarigon yhteystietosivulla: Project
     * Development Engineer)" — sellaisenaan se menisi hankekortille.
     * Sulkeissa oleva tarkennus ja ajatusviivan jalkeinen selitys pois,
     * sama saanto kuin osapuolien nimissa (D-078).
     */
    const nimike = String(tulos.nimike ?? "")
      .split(/\s*\(/)[0]
      .split(/\s+[–—-]\s+/)[0]
      .replace(/[,;:.]+$/, "")
      .trim()
      .slice(0, 60)

    return {
      nimi,
      nimike: nimike || null,
      organisaatio: tulos.organisaatio ?? null,
      email: email || null,
      puhelin: puhelin || null,
      varmuus: tulos.varmuus ?? "low",
      lahteet,
      perustelu: String(tulos.perustelu ?? ""),
      model: CONTACT_MODEL,
    }
  } catch (error: any) {
    console.error("suggestProjectContact:", error?.message ?? error)
    return null
  }
}
