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
 * Kestomittaus: arvoilla 8/8/8/8/30 ajot kestivät ~75-230s (ka ~140s) 500s
 * turvabudjetista, eli runsaasti pelivaraa. Nostettu 2026-07 työmäärää per ajo
 * (ei ajotiheyttä), jotta perustason lähteen kierto lyhenee ~9 pv -> ~4,5 pv
 * ILMAN lisää cron-kutsuja. Lähdemäärän kanssa nostettiin myös välivaiheet ja
 * faktat samassa suhteessa, ettei mikään jono ala kasvaa (enemmän lähteitä =
 * enemmän dokumentteja = enemmän faktoja). Jos näitä nostetaan lisää, MITTAA
 * uusi kesto Ajot-sivulta - kesto ei skaalaudu täysin lineaarisesti (osa
 * vaiheista on kiinteän kokoisia) eikä 500s-kattoa saa ylittää.
 */
export const DISCOVERY_CRON_CONFIG = {
  maxSourceCount: 14,
  maxArticleJobs: 14,
  maxPdfJobs: 14,
  maxTextJobs: 14,
  maxFactJobs: 45,
}

/*
 * Kuinka monta discovery-ajoa vuorokaudessa. Vastaa vercel.jsonin cronia
 * "/api/tic/discovery/run", joka ajetaan kuuden tunnin välein = 4 kertaa/vrk
 * (klo 0, 6, 12, 18). Operations-sivun "täysi kierros" -laskenta tarvitsee tämän:
 * yksittäinen
 * perustason lähde ehtii vuoroon (lähdemäärä ÷ paikat/ajo ÷ ajot/vrk) päivässä.
 * Jos vercel.jsonin cron-aikataulua muutetaan, päivitä tämä samaksi.
 */
export const DISCOVERY_RUNS_PER_DAY = 4

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
