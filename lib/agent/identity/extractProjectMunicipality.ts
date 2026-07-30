import Anthropic from "@anthropic-ai/sdk"
import {
  getMunicipalityByAnyForm,
} from "@/lib/geo/municipalityFromName"
import type { Municipality } from "@/lib/geo/municipalities"

/*
 * Päättelee hankkeen SIJAINTIKUNNAN vapaasta tekstistä (otsikko, kuvaus,
 * tilaaja) silloin kun rakenteista sijaintitietoa ei ole lainkaan.
 *
 * Eri kysymys kuin extractWorksiteAddress: se etsii työmaan katuosoitetta ja
 * hylkää tilaajan sijainnin tarkoituksella. Tämä kysyy vain "missä kunnassa
 * hanke on", ja tilaaja kelpaa vihjeeksi.
 *
 * Miksi malli eikä merkkijonohaku: kuntanimen etsiminen tekstistä osuu
 * väärään liian usein. Kokeilussa "Kuusankosken kirkko" tulkittiin Kuusamoksi
 * ja "Saaristomeren tutkimuslaitos" Saarijärveksi, ja yritysnimi "Sonkakoti
 * Oy" tuotti Sonkajärven. Väärä maakunta nostaa hankkeen väärän alueen
 * syötteeseen, mikä on käyttäjälle pahempaa kuin puuttuva tieto.
 */
export type ProjectMunicipalityGuess = {
  municipality: Municipality | null
  /** Mallin palauttama nimi sellaisenaan - lokitusta ja tarkistusta varten. */
  raw: string | null
  /** Tekstinkohta johon päättely perustuu; helpottaa kuiva-ajon läpikäyntiä. */
  evidence: string | null
}

const EMPTY: ProjectMunicipalityGuess = {
  municipality: null,
  raw: null,
  evidence: null,
}

const SYSTEM = [
  "Päättele suomalaisen rakennushankkeen SIJAINTIKUNTA annetusta tekstistä.",
  "",
  "Säännöt:",
  "- Palauta kunnan nimi perusmuodossa (esim. Janakkala, Kouvola, Inari).",
  "- Jos hanke on valtakunnallinen, puitesopimus, markkinakartoitus tai",
  "  sijainti ei muuten käy ilmi, palauta tyhjä merkkijono. ÄLÄ ARVAA.",
  "  Tyhjä vastaus on oikea ja hyväksytty lopputulos.",
  "- Älä päättele kuntaa yrityksen tai tilaajan nimestä silloin kun se ei",
  '  kerro sijaintia: "Sonkakoti Oy" EI tarkoita Sonkajärveä.',
  '- Kunta tilaajana kertoo sijainnin: "Janakkalan kunta" -> Janakkala.',
  "- Varo samankaltaisia nimiä. Kuusankoski on Kouvolaa eikä Kuusamoa,",
  "  Saaristomeri ei ole Saarijärvi, Vuolijoki on Kajaania.",
  "- Kaupunginosa tai kylä palautetaan sen kuntana: Turenki -> Janakkala,",
  "  Ivalo -> Inari, Nauvo -> Parainen, Suomenlinna -> Helsinki.",
  "- Jos teksti mainitsee kaksi eri paikkakuntaa eikä hankkeen sijainti ole",
  "  yksikäsitteinen (esim. voimajohto kahden kunnan välillä), palauta tyhjä.",
  "",
  "Kenttään evidence lyhyt lainaus tekstistä johon päättely perustuu.",
  "Vastaa vain skeeman mukaan.",
].join("\n")

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["municipality", "evidence"],
  properties: {
    municipality: { type: "string" },
    evidence: { type: "string" },
  },
} as const

let cachedClient: Anthropic | null = null
function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null
  if (!cachedClient) cachedClient = new Anthropic()
  return cachedClient
}

/*
 * Oletusmalli on tarkoituksella iso. Tehtävä on suomalaisen mikromaantieteen
 * muistamista - mikä kaupunginosa kuuluu mihin kuntaan - ja siinä pienempi
 * malli erehtyy liikaa: mittauksessa Haiku 4.5 sijoitti Kolmenkulman
 * Helsinkiin (oikea Pirkanmaa) ja Kimolan kanavan Jämsään (oikea
 * Kymenlaakso). Kustannus on tässä käytössä senttejä, joten halvempi malli
 * ei ole säästö vaan väärän maakunnan riski.
 */
const DEFAULT_MODEL = "claude-opus-5"

export async function extractProjectMunicipality(input: {
  title?: string | null
  description?: string | null
  developer?: string | null
  model?: string
}): Promise<ProjectMunicipalityGuess> {
  const client = getClient()
  if (!client) return EMPTY

  const parts = [
    input.title ? `Otsikko: ${input.title}` : null,
    input.developer ? `Tilaaja: ${input.developer}` : null,
    input.description ? `Kuvaus: ${String(input.description).slice(0, 2000)}` : null,
  ].filter(Boolean)

  if (parts.length === 0) return EMPTY

  const model = input.model ?? DEFAULT_MODEL

  /*
   * max_tokens kattaa myös ajattelun malleilla joissa se on päällä, joten
   * varaa on oltava reilusti - muuten vastaus katkeaisi kesken. effort
   * asetetaan vain malleille jotka tukevat sitä (Haiku 4.5 hylkää sen).
   */
  const supportsEffort = !model.includes("haiku")

  try {
    const res = await client.messages.create({
      model,
      max_tokens: supportsEffort ? 4000 : 200,
      system: SYSTEM,
      output_config: {
        ...(supportsEffort ? { effort: "low" } : {}),
        format: { type: "json_schema", schema: SCHEMA },
      },
      messages: [{ role: "user", content: parts.join("\n") }],
    } as Anthropic.MessageCreateParamsNonStreaming)

    const textBlock = res.content.find((b) => b.type === "text")
    if (!textBlock || textBlock.type !== "text") return EMPTY

    const parsed = JSON.parse(textBlock.text) as {
      municipality?: string
      evidence?: string
    }

    const raw = parsed.municipality?.trim() || null

    /*
     * Vastaus validoidaan aina kuntarekisteriä vasten, joten malli ei voi
     * keksiä kuntaa jota ei ole olemassa. Haku tuntee myös taivutusmuodot
     * ja kylännimet, joten "Turengin" tai "Ivalo" kelpaa.
     */
    return {
      municipality: getMunicipalityByAnyForm(raw),
      raw,
      evidence: parsed.evidence?.trim() || null,
    }
  } catch (err) {
    console.error("extractProjectMunicipality failed (fail-open):", err)
    return EMPTY
  }
}
