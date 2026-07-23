/*
 * Yöllisen discovery-ajon rajat (/api/tic/discovery/run -> run-pipeline).
 * Keskitetty tänne kahdesta syystä:
 * 1) app/api/tic/discovery/run/route.ts käyttää näitä oikean ajon
 *    parametreina.
 * 2) app/tic/operations-sivu käyttää SAMOJA lukuja laskeakseen kuinka
 *    usein yksittäinen lähde todellisuudessa ehtii vuoroon (lähdemäärä ÷
 *    maxSourceCount = täyden kierroksen pituus päivinä). Jos nämä
 *    arvot muuttuvat vain route.ts:ssä, sivun näyttämä "normaali väli"
 *    vanhenee huomaamatta.
 *
 * Mitattu tuotannossa n. 187s/ajo näillä arvoilla (maxDuration 500,
 * Vercel Pro). Jos näitä nostetaan, mittaa uusi kesto ennen kuin
 * luotat siihen ettei 500s-kattoa ylitetä - kesto ei skaalaudu
 * täysin lineaarisesti (osa vaiheista on kiinteän kokoisia).
 */
export const DISCOVERY_CRON_CONFIG = {
  maxSourceCount: 8,
  maxArticleJobs: 8,
  maxPdfJobs: 8,
  maxTextJobs: 8,
  maxFactJobs: 30,
}
