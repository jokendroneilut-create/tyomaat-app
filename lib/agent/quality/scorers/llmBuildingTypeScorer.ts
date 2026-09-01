import Anthropic from "@anthropic-ai/sdk"

/*
 * LLM-kohdetyyppiluokitin: kartoittaa hankkeen yhteen kanonisista
 * kohdetyypeistä.
 *
 * MIKSI LLM EIKÄ SÄÄNTÖ. Sääntöpohjainen `inferBuildingType` lukee
 * otsikosta ja on tarkka silloin kun otsikossa on rakennussana. Mitattu
 * 13.8.2026: se ratkaisi 193 riviä 3 688:sta. Loput otsikot ovat
 * kaavatunnuksia ("002551 Horsmapolku", "A25500 Toivonlinnan
 * asemakaavan muutos") tai tiedoteotsikoita, joissa tyyppi on vain
 * kuvauksessa - ja kuvauksesta lukeminen tuotti säännöllä kaksi
 * kolmasosaa vääriä ("HAM Helsingin taidemuseo" -> Logistiikka).
 * Ero on juuri se jonka LLM osaa: mikä tekstissä on KOHDE ja mikä
 * ympäristöä.
 *
 * SANASTO ON SULJETTU. Kannassa oli 198 eri arvoa 1907 rivillä -
 * "Koulu" ja "koulu" erikseen, "Tuulivoima" ja "Tuulivoimalahankkeet"
 * erikseen, ja häntänä vapaata tekstiä kuten "Prisma" ja
 * "Asiantuntijapalvelut". Suodatin on siinä tilassa käyttökelvoton,
 * joten luokitin saa palauttaa VAIN listan arvoja tai null.
 *
 * NULL ON KELVOLLINEN VASTAUS. Sama periaate kuin sääntöpoiminnassa:
 * väärä kohdetyyppi on suodatin joka näyttää asiakkaalle väärän
 * hankkeen ja piilottaa oikean, joten epävarmuudessa jätetään tyhjäksi.
 */

export const BUILDING_TYPE_MODEL = "claude-haiku-4-5"

/*
 * Kanoninen sanasto. Sama lista kuin sääntöpoimijan `BUILDING_TYPES`,
 * täydennettynä niillä joita kannassa oikeasti esiintyy merkittävästi
 * (Energiantuotanto, Silta, Kauppa, Teollisuus, Asuinalue).
 */
export const BUILDING_TYPES = [
  "Datakeskus",
  "Sairaala",
  "Hoivakoti",
  "Koulu",
  "Päiväkoti",
  "Kirjasto",
  "Nuorisotila",
  "Kulttuurirakennus",
  "Liikuntapaikka",
  "Leikkipuisto",
  "Kerrostalo",
  "Rivitalo",
  "Hotelli",
  "Toimitila",
  "Kauppa",
  "Logistiikka",
  "Teollisuus",
  "Energiantuotanto",
  "Silta",
  "Infrahanke",
] as const

export type BuildingType = (typeof BUILDING_TYPES)[number]

export const BUILDING_TYPE_SYSTEM_PROMPT =
  "Luokittele suomalainen rakennushanke yhteen kohdetyyppiin. Vastaa " +
  "VAIN annetuista vaihtoehdoista tai EI_TIEDOSSA.\n\n" +
  "TÄRKEÄÄ: valitse tyyppi sen mukaan mitä RAKENNETAAN tai korjataan, ei " +
  "sen mukaan mitä ympäristössä on. Teksti mainitsee usein naapurikohteita, " +
  "vertailukohtia ja alueen muita rakennuksia - ne eivät ratkaise. Jos " +
  "kuvaus kertoo esimerkiksi taidemuseon uudesta sijainnista, tyyppi on " +
  "Kulttuurirakennus, ei Logistiikka vaikka tekstissä puhuttaisiin " +
  "varastoista.\n\n" +
  "Asemakaava tai osayleiskaava EI ole kohdetyyppi. Jos kaava " +
  "mahdollistaa asuinrakentamisen, tyyppi on Kerrostalo tai Rivitalo sen " +
  "mukaan kumpaa kaavassa nimenomaan tavoitellaan. Jos kaava on " +
  "sekakäyttöinen tai tyyppi ei selviä, vastaa EI_TIEDOSSA.\n\n" +
  "OTSIKKO YKSIN RIITTÄÄ jos se nimeää kohteen: \"Kerrostalo Tampereen " +
  "Hiedanrantaan\" on Kerrostalo ja \"Asunto Oy Helsingin Bertas\" on " +
  "Kerrostalo, vaikka kuvaus puuttuisi. Älä jätä tyhjäksi pelkän niukan " +
  "kuvauksen takia - vain silloin kun kohde jää aidosti epäselväksi.\n\n" +
  "Vastaa EI_TIEDOSSA myös silloin kun kyse ei ole rakennuskohteesta lainkaan " +
  "(palveluhankinta, lausunto, vuokraus) tai kun teksti ei riitä " +
  "päättelyyn. Väärä tyyppi on pahempi kuin tyhjä: se on suodatin, joka " +
  "näyttää asiakkaalle väärän hankkeen ja piilottaa oikean.\n\n" +
  `Vaihtoehdot: ${BUILDING_TYPES.join(", ")}`

/*
 * TYHJA ON SENTINELI, EI null.
 *
 * Skeemassa `{ type: ["string","null"], enum: [...] }` hylataan
 * rajapinnassa ("Enum value 'Datakeskus' does not match declared type").
 * Sentineli pitaa skeeman yksinkertaisena ja tekee tyhjasta vastauksesta
 * nimenomaisen valinnan mallille - ei jotain jonka se jattaa pois.
 */
const UNKNOWN = "EI_TIEDOSSA"

const BUILDING_TYPE_SCHEMA = {
  type: "object",
  required: ["type", "confidence", "reason"],
  additionalProperties: false,
  properties: {
    type: { type: "string", enum: [...BUILDING_TYPES, UNKNOWN] },
    confidence: { type: "number" },
    reason: { type: "string" },
  },
} as const

export type BuildingTypeVerdict = {
  type: BuildingType | null
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

export function isBuildingTypeScorerEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

/*
 * Kuvaus katkaistaan: hankkeen oma sisältö on tekstin alussa, ja loppu on
 * tyypillisesti liitelistoja ja päätöshistoriaa. Sama rajaus kuin
 * kustannuspoimijassa, ja se pitää myös kustannuksen kurissa.
 */
const DESCRIPTION_CHARS = 1200

export async function scoreBuildingType(input: {
  title: string
  description?: string | null
}): Promise<BuildingTypeVerdict | null> {
  const client = getClient()
  if (!client) return null

  try {
    const res = await client.messages.create({
      model: BUILDING_TYPE_MODEL,
      max_tokens: 512,
      // Prompt-caching: kiinteä ohje leikkaa toistojen sisääntulokustannuksen.
      system: [
        {
          type: "text",
          text: BUILDING_TYPE_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      output_config: {
        format: { type: "json_schema", schema: BUILDING_TYPE_SCHEMA },
      },
      messages: [
        {
          role: "user",
          content:
            `Otsikko: ${input.title}\n` +
            `Kuvaus: ${(input.description ?? "-").slice(0, DESCRIPTION_CHARS)}`,
        },
      ],
    } as Anthropic.MessageCreateParamsNonStreaming, {
      /*
       * AIKAKATKAISU, KOSKA TAMA AJETAAN NYT PUTKESSA.
       *
       * Luokitin oli aiemmin vain skriptissa, jossa hidas pyynto ei
       * haitannut. Putkessa se syo tuonnin aikabudjettia (D-155: yksi
       * hidas pyynto kaatoi koko lahteen, ei tuonti). Otsikon
       * luokittelu kestaa sekunnin; 15 s on reilusti yli sen, ja
       * ylitys tarkoittaa etta kentta jaa tyhjaksi - ei etta ajo
       * kaatuu.
       */
      timeout: 15_000,
      maxRetries: 1,
    })

    const textBlock = res.content.find((b) => b.type === "text")
    if (!textBlock || textBlock.type !== "text") return null

    const parsed = JSON.parse(textBlock.text) as {
      type: string
      confidence: number
      reason: string
    }

    /*
     * Skeema rajaa jo arvot, mutta tarkistus on halpa ja estää sen että
     * mallin keksimä arvo päätyisi suodattimeen.
     */
    const type =
      parsed.type === UNKNOWN || !BUILDING_TYPES.includes(parsed.type as BuildingType)
        ? null
        : (parsed.type as BuildingType)

    return { type, confidence: parsed.confidence, reason: parsed.reason, model: BUILDING_TYPE_MODEL }
  } catch (err) {
    console.error("scoreBuildingType failed (fail-open):", err)
    return null
  }
}
