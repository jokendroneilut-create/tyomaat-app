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

/*
 * Sama luku kuin `export const maxDuration` app/api/tic/discovery/run/
 * route.ts:ssä JA run-pipeline/route.ts:ssä - Next.js vaatii että
 * maxDuration on kirjaimellinen literaali reitin omassa tiedostossa
 * (ei importattava vakio), joten tätä EI voida tuoda sieltä suoraan.
 * Jos jompaakumpaa route-tiedoston maxDuration-arvoa muutetaan, päivitä
 * tämä käsin samaksi, muuten Operations-sivun "% budjetista" alkaa
 * valehdella.
 *
 * Vahvistettu Vercelin hallintapaneelista (Project Settings -> Functions):
 * Fluid Compute on päällä tässä projektissa, joten todellinen kova katto
 * on 800s eikä Pro-tason 300s vakioraja. 500s on siis tarkoituksella
 * asetettu turvamarginaaliksi selvästi 800s:n alle, ei itse alustan
 * pakottama raja.
 */
export const DISCOVERY_MAX_DURATION_SECONDS = 500
export const DISCOVERY_PLATFORM_HARD_LIMIT_SECONDS = 800
