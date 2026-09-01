import {
  BUILDING_TYPES,
  isBuildingTypeScorerEnabled,
  scoreBuildingType,
} from "@/lib/agent/quality/scorers/llmBuildingTypeScorer"

/*
 * KOHDETYYPPI EHDOKKAALLE: SÄÄNTÖ ENSIN, MALLI VASTA SEN JÄLKEEN.
 *
 * Kohdetyyppi on asiakkaan ensisijainen suodatin, ja se puuttui
 * 1.9.2026 mitattuna **2 438 näkyvältä hankkeelta**. Pahempi on vauhti:
 * viimeisen 14 vrk aikana luoduista 371 hankkeesta 225:ltä (61 %) se
 * puuttui — eli aukko kasvaa nopeammin kuin sitä on täytetty.
 *
 * Luokitin oli olemassa ja mitattu, mutta vain skriptissä
 * (`scripts/backfill-llm-building-type.ts`). Sama vika kuin
 * kustannuspoimijassa aikanaan: kenttä täyttyi vain silloin kun joku
 * muisti ajaa skriptin. Nyt se on siinä missä ehdokkaat syntyvät.
 *
 * SÄÄNTÖ VOITTAA. `classifyProject` lukee tyypin otsikosta ja on
 * mitattu lähes virheettömäksi eikä maksa mitään, joten mallilta
 * kysytään vain kun sääntö ei osaa. Kontrolliajo 100 rivillä joiden
 * tyyppi tiedetään otsikosta: 94 samaa mieltä, 4 tyhjää, 2
 * puolustettavaa erimielisyyttä — tarkkuus vastatuissa 98 %.
 *
 * FAIL-OPEN JA TYHJÄ SALLITTU. Ilman API-avainta tai mallin virheessä
 * kenttä jää tyhjäksi kuten ennenkin. Väärä kohdetyyppi on suodatin
 * joka näyttää asiakkaalle väärän hankkeen ja piilottaa oikean, joten
 * epävarmuudessa jätetään tyhjäksi.
 */

export type BuildingTypeResult = {
  /* Metadataan yhdistettävä osa. Tyhjä jos mitään ei ratkennut. */
  metadata: Record<string, unknown>
}

const EI_TULOSTA: BuildingTypeResult = { metadata: {} }

/*
 * SANASTON ULKOPUOLINEN ARVO EI OLE TYYPPI VAAN TEKSTI.
 *
 * Asiakkaan suodatin tuntee vain kanonisen sanaston, joten "koulu",
 * "Julkinen rakennus" tai "Metallimalmien ... louhinta" (YVA:n oma
 * luokitus) eivät osu suodattimeen lainkaan — hanke on käytännössä
 * tyypitön. Mitattu 1.9.2026: näkyvistä 5 742 hankkeesta 2 446:lta
 * tyyppi puuttui ja 108:lla se oli sanaston ulkopuolella, 43 eri
 * arvona. Niille kysytään malli samalla tavalla kuin tyhjille, jotta
 * häntä ei kasva takaisin heti backfillin jälkeen.
 */
const KANONISET = new Set<string>(BUILDING_TYPES)

/*
 * Alaraja on 0-1 asteikolla. Otoksessa matalan varmuuden rivit olivat
 * juuri niita joissa otsikko ei kerro tyyppia: "Kaarela, Kayrapolun
 * puistikon portaiden puistosuunnitelma" sai 0,35.
 */
const VARMUUS_RAJA = 0.8

export async function resolveBuildingType(input: {
  title: string | null
  description?: string | null
  /* Säännön jo päättelemä tyyppi. Jos tämä on, mallia ei kysytä. */
  ruleBuildingType: string | null | undefined
}): Promise<BuildingTypeResult> {
  const saannosta = String(input.ruleBuildingType ?? "").trim()
  if (saannosta && KANONISET.has(saannosta)) return EI_TULOSTA
  if (!input.title) return EI_TULOSTA
  if (!isBuildingTypeScorerEnabled()) return EI_TULOSTA

  try {
    /*
     * KAKSI KUTSUA, JOIDEN ON OLTAVA SAMAA MIELTA.
     *
     * Varmuusluku ei erottele oikeaa vaarasta: mitattu 1.9.2026 60
     * rivin otoksella, jossa molemmat selvat virheet ("Puuilo-myymala"
     * -> Toimitila, "logistiikkarakennus" -> Toimitila) olivat 0,95:n
     * kaistalla. EROTTELEVA SIGNAALI ON ERIMIELISYYS: sama otsikko sai
     * eri vastauksen eri kutsulla, ja 9/60 rivilla vastaukset erosivat
     * - kaikki loydetyt virheet olivat siina joukossa.
     *
     * Kutsut ovat rinnakkain, joten portti ei hidasta tuontia; hinta
     * kaksinkertaistuu, mutta vain niilla riveilla joita saanto ei
     * osannut. Erimielisyys jattaa kentan tyhjaksi: kohdetyyppi on
     * asiakkaan suodatin, ja vaara arvo seka piilottaa hankkeen
     * oikeasta suodattimesta etta nostaa sen vaaraan.
     */
    const [eka, toka] = await Promise.all([
      scoreBuildingType({ title: input.title, description: input.description ?? null }),
      scoreBuildingType({ title: input.title, description: input.description ?? null }),
    ])

    if (!eka?.type || !toka?.type) return EI_TULOSTA
    if (eka.type !== toka.type) return EI_TULOSTA
    if (Math.min(eka.confidence ?? 0, toka.confidence ?? 0) < VARMUUS_RAJA) return EI_TULOSTA

    return {
      metadata: {
        building_type: eka.type,
        building_type_confidence: Math.min(eka.confidence ?? 0, toka.confidence ?? 0),
        /*
         * Merkitään lähde, jotta mallin arvaus erottuu lähteen omasta
         * tiedosta myöhemmissä mittauksissa ja korjauksissa.
         */
        building_type_source: "llm",
        building_type_model: eka.model,
      },
    }
  } catch {
    /* Fail-open: kohdetyyppi ei ole sen arvoinen että ajo kaatuisi. */
    return EI_TULOSTA
  }
}
