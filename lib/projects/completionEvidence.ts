/*
 * Onko poimittu valmistumisaika AIKATAULU vai TAVOITE?
 *
 * `estimated_completion` ei ole pelkkä lisätieto: kun päivä menee,
 * auto-complete-cron merkitsee hankkeen valmistuneeksi ja se katoaa
 * asiakkaan listalta. Siksi kentän täyttäminen on väite hankkeen tilasta,
 * ei havainto tekstistä.
 *
 * MITATTU TAPAUS. Helsingin tarveselvitys (8/2021) Abraham Wetterin tien
 * päiväkodista lupasi: "Uudisrakennus otetaan käyttöön kalustettuna
 * elokuuhun 2023 mennessä." Urakoitsijan mukaan rakentaminen kesti
 * 1/2024-5/2025 ja kohde luovutettiin käyttäjille 8/2025 - **kaksi vuotta
 * luvattua myöhemmin**. Varhaisen vaiheen päätöksessä esitetty päivä on
 * siis tavoite, ei aikataulu.
 *
 * Jos tavoite kirjoitetaan kenttään, hanke merkitään valmiiksi kaksi
 * vuotta ennen kuin se on. Tässä tapauksessa se olisi piilottanut
 * asiakkaalta työmaan joka oli juuri alkamassa.
 */

/*
 * Varhaisen vaiheen päätös: hanketta ei ole vielä kilpailutettu eikä
 * urakoitsijaa valittu, joten aikataulu on arvio.
 */
const PLAN_STAGE_DECISION =
  /tarveselvity|tarvepäätös|hankesuunnitel|kehityssuunnitel|\blausunto/i

/*
 * Kuinka kauas päätöksestä luvattu päivä saa olla, jotta sitä pidetään
 * aikatauluna? Mitattu jakauma jonossa: mediaani 9 kuukautta, mutta
 * 75 riviä 218:sta lupaa yli 18 kuukautta eteenpäin. Kirsikkapuiston
 * kahden vuoden liuku osui juuri tähän joukkoon.
 */
const SCHEDULE_HORIZON_MONTHS = 18

export type CompletionEvidence = "schedule" | "target" | "impossible"

export function completionEvidence({
  title,
  decisionDate,
  completionDate,
}: {
  title: string | null | undefined
  decisionDate: string | null | undefined
  completionDate: string | null | undefined
}): CompletionEvidence {
  if (!completionDate) return "impossible"

  /*
   * VALMISTUMINEN ENNEN PÄÄTÖSTÄ ON MAHDOTON. Mitattu: jonossa oli
   * rivejä joilla ero oli -124 kuukautta. Ne eivät ole aikatauluja vaan
   * poimintavirheitä - teksti viittasi menneeseen tapahtumaan.
   */
  if (decisionDate && completionDate < decisionDate) return "impossible"

  if (PLAN_STAGE_DECISION.test(String(title ?? ""))) return "target"

  if (decisionDate) {
    const decided = new Date(decisionDate)
    const promised = new Date(completionDate)
    const months =
      (promised.getTime() - decided.getTime()) / (1000 * 60 * 60 * 24 * 30.4)
    if (months > SCHEDULE_HORIZON_MONTHS) return "target"
  }

  return "schedule"
}
