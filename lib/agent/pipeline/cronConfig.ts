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
 *
 * NOSTO 14 -> 20 (15.8.2026). Vuorokauden `refresh_minutes` ei
 * toteutunut lähelläkään, ja korjatun lähteen paluu terveeksi kesti
 * päiviä.
 *
 * Kierros lasketaan samalla kaavalla kuin Operations-sivulla: taatut
 * lähteet (priority > 10) varaavat kiinteän paikan joka ajossa eivätkä
 * kierrä muiden mukana, joten perustason kierto lasketaan jäljelle
 * jäävillä paikoilla. Taattuja on yksi (Hilma).
 *
 *   14 paikkaa -> 13 perustason paikkaa/ajo = 52/vrk -> kierros 6 vrk
 *   20 paikkaa -> 19 perustason paikkaa/ajo = 76/vrk -> kierros 4 vrk
 *
 * Vanhentumisraja (kierros × 1,5) lyhenee samalla 9 -> 6 vrk.
 *
 * Kaksi mittausta perustelevat noston:
 *
 *   AIKA. 14.8. klo 21 lähteet veivät 317 s 380 sekunnin budjetista.
 *   15.8. klo 12 samat 14 paikkaa veivät ~138 s. Ero tulee
 *   nähty-tarkistuksen korjauksesta (D-068), joka poisti satojen jo
 *   käsiteltyjen kandidaattien uudelleentuonnin joka ajossa.
 *
 *   JONOT. Käsittelypuoli on tyhjä: 0 dokumenttia odottaa faktojen
 *   poimintaa ja kaikki 137 agent_jobs-työtä on onnistunut. Lisää
 *   dokumentteja siis mahtuu ilman että jono alkaa kasvaa.
 *
 * Välivaiheet nostetaan samassa suhteessa samasta syystä kuin
 * 2026-07: enemmän lähteitä = enemmän dokumentteja. `maxFactJobs`
 * jätetään ennalleen, koska faktoilla on oma cron-kutsunsa
 * (DISCOVERY_PROCESS_CONFIG) eikä sen jono ole kasvamassa.
 *
 * MITTAA kesto Ajot-sivulta parin ajon jälkeen; tämän päivän 138 s
 * koostui kevyistä kaavalähteistä, ja raskaampi erä (Espoon Asunnot
 * 72 s, stt_haku ~42 s) vie enemmän. Oma rajamme on 500 s ja alustan
 * kova katto 800 s, eli marginaalia on 300 s.
 */
export const DISCOVERY_CRON_CONFIG = {
  maxSourceCount: 20,
  maxArticleJobs: 20,
  maxPdfJobs: 20,
  maxTextJobs: 20,
  maxFactJobs: 45,
}

/*
 * KASITTELYAJO OMANA KUTSUNAAN.
 *
 * Kerays ja kasittely jakoivat saman aikabudjetin, jolloin kasittely sai
 * aina vain sen mita keraykselta jai yli. Mitattu 14.8.2026 klo 21:
 * lahteet veivat 317 s 380 sekunnin budjetista, faktavaihe ehti 14 tyota
 * ja jono kasvoi 34 -> 41. Ajo paattyi merkinnalla `stopped_at: "facts"`.
 *
 * Jako kahteen cron-kutsuun oli jo kuvattu discoveryPipeline.ts:n
 * kommentissa suunnitelmana, mutta toista cronia ei ollut koskaan lisatty
 * vercel.jsoniin. Nyt se on: kerays klo 0/6/12/18, kasittely kymmenen
 * minuuttia myohemmin omalla taydella budjetillaan.
 *
 * `maxSourceCount` on nolla varmuuden vuoksi - vaiheet on jo rajattu
 * `stages`-listalla, mutta ilman tata yksi vaara parametri kaynnistaisi
 * keraysvaiheen uudelleen kesken kasittelyajon.
 */
export const DISCOVERY_PROCESS_CONFIG = {
  stages: ["facts"] as const,
  maxSourceCount: 0,
  maxFactJobs: 120,
  maxIdentityCatchUpJobs: 40,
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
