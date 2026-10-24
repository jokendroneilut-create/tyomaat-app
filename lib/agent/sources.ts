import { fetchTestSource } from "./fetchTestSource"
import { fetchHelsinkiPaatoksetSource } from "./fetchHelsinkiPaatoksetSource"
import {
  fetchEspooPaatoksetSource,
  fetchKuopioPaatoksetSource,
  fetchLahtiPaatoksetSource,
  fetchKirkkonummiPaatoksetSource,
  fetchTuusulaPaatoksetSource,
  fetchSavonlinnaPaatoksetSource,
  fetchTornioPaatoksetSource,
  fetchYlojarviPaatoksetSource,
  fetchJoensuuPaatoksetSource,
  fetchKouvolaPaatoksetSource,
  fetchPorvooPaatoksetSource,
} from "./fetchDynastySource"
import {
  fetchTamperePaatoksetSource,
  fetchJyvaskylaPaatoksetSource,
  fetchRovaniemiPaatoksetSource,
  fetchPoriPaatoksetSource,
} from "./fetchCaseMSource"
import { fetchTurkuPaatoksetSource } from "./fetchTurkuSource"
import { fetchYitSource } from "./fetchYitSource"
import { fetchAsuntosaatioSource } from "./fetchAsuntosaatioSource"
import { fetchAsuraSource } from "./fetchAsuraSource"
import { fetchAuraSource } from "./fetchAuraSource"
import { fetchBonavaSource } from "./fetchBonavaSource"
import { fetchFiraSource } from "./fetchFiraSource"
import { fetchSkanskaSource } from "./fetchSkanskaSource"
import { fetchNccSource } from "./fetchNccSource"
import { fetchPeabSource, enrichPeabCandidate } from "./fetchPeabSource"
import { fetchHartelaSource } from "./fetchHartelaSource"
import { fetchGrkSource } from "./fetchGrkSource"
import { fetchTekovaSource } from "./fetchTekovaSource"
import { fetchJatkeSource } from "./fetchJatkeSource"
import { fetchEspoonAsunnotSource } from "./fetchEspoonAsunnotSource"
import { fetchMeijouSource } from "./fetchMeijouSource"
import { fetchKastelliSource } from "./fetchKastelliSource"
import { fetchVrjSource } from "./fetchVrjSource"
import { fetchTorppariSource } from "./fetchTorppariSource"
import { fetchPeltiAssatSource } from "./fetchPeltiAssatSource"
import { fetchMangroveSource } from "./fetchMangroveSource"
import { fetchSrvSource } from "./fetchSrvSource"
import { fetchYsaatioSource } from "./fetchYsaatioSource"
import { fetchPohjolaRakennusSource } from "./fetchPohjolaRakennusSource"
import { fetchVarteSource } from "./fetchVarteSource"
import { fetchLujataloSource } from "./fetchLujataloSource"
import { fetchKasSource } from "./fetchKasSource"
import { fetchHausiaSource } from "./fetchHausiaSource"
import { fetchRakennustehoSource } from "./fetchRakennustehoSource"
import { fetchMarveaSource } from "./fetchMarveaSource"
import { fetchMarttilanSource } from "./fetchMarttilanSource"
import { fetchBrandToimitilatSource } from "./fetchBrandToimitilatSource"
import { fetchHelsinkiUutisetSource } from "./fetchHelsinkiUutisetSource"
import { fetchKeravaUutisetSource } from "./fetchKeravaUutisetSource"
import { fetchRakennuslehtiSource, enrichRakennuslehtiCandidate } from "./fetchRakennuslehtiSource"
import { fetchSttHakuSource, enrichSttCandidate } from "./fetchSttHakuSource"
import { fetchSttJulkaisijatSource } from "./fetchSttJulkaisijatSource"
import { luoTalotekniikkaLahde, luoTalotekniikkaRikastus } from "./talotekniikkaUutiset"
import { fetchYmparistolupaSource } from "./fetchYmparistolupaSource"
import { fetchYvaSource } from "./fetchYvaSource"
import { createYvaEnricher } from "./yvaProjectPage"
import { createYmparistolupaEnricher } from "./ymparistolupaEnricher"
import { fetchSuunnittelukilpailuSource } from "./fetchSuunnittelukilpailuSource"
import { fetchSitowiseSource } from "./fetchSitowiseSource"
import {
  fetchSkanskaProjectsSource,
  enrichSkanskaProject,
} from "./fetchSkanskaProjectsSource"
import {
  fetchLujataloProjectsSource,
  enrichLujataloProject,
} from "./fetchLujataloProjectsSource"
import { fetchLujakotiSource } from "./fetchLujakotiSource"
import { fetchLaptiKohteetSource } from "./fetchLaptiKohteetSource"
import { fetchBonavaKohteetSource } from "./fetchBonavaKohteetSource"
import { fetchT2hKohteetSource } from "./fetchT2hKohteetSource"
import { fetchHekaSource } from "./fetchHekaSource"
import { fetchTaSource } from "./fetchTaSource"
import {
  fetchNccProjectsSource,
  enrichNccProject,
} from "./fetchNccProjectsSource"
import { fetchGrkProjectsSource } from "./fetchGrkProjectsSource"
import { fetchDestiaSource } from "./fetchDestiaSource"
import { fetchOteranSource } from "./fetchOteranSource"
import { fetchLohkareSource } from "./fetchLohkareSource"
import { fetchVexatecSource } from "./fetchVexatecSource"
import { fetchTilapalvelutSource } from "./fetchTilapalvelutSource"
import { fetchFingridProjectsSource } from "./fetchFingridProjectsSource"
import { fetchToivoSource } from "./fetchToivoSource"
import { fetchNrcProjectsSource } from "./fetchNrcProjectsSource"
import { fetchHartelaAreasSource } from "./fetchHartelaAreasSource"
import { fetchHcHoivakoditSource } from "./fetchHcHoivakoditSource"
import { createCompanyEnricher } from "./companyRelease"

export const sources = [
  /*
   * LAPTI OLI AINOA YRITYSLAHDE ILMAN RIKASTAJAA.
   *
   * Havaittu 29.8.2026: Laptin omilta sivuilta tullut ehdokas ei
   * sisaltanyt kuvausta, rakennuttajaa eika liittyvia yrityksia - eli
   * Lapti itse puuttui hankkeesta, vaikka tieto oli Laptin sivuilta.
   *
   * Seuraus oli isompi kuin puuttuva nimi: ilman kuvausta ja
   * rakennuttajaa calculateMatch palauttaa null, koska yksikaan sen
   * neljasta vahimmaisehdosta ei tayty. Tyhjaa ehdokasta ei siis voi
   * edes ehdottaa yhdistettavaksi mihinkaan.
   *
   * Funktion nimi fetchTestSource kertoo mista on kyse: prototyyppi joka
   * jai tuotantoon.
   */
  {
    name: "lapti",
    fetch: fetchTestSource,
    enrich: createCompanyEnricher({ publisher: "Rakennusliike Lapti" }),
  },
  { name: "yit", fetch: fetchYitSource, enrich: createCompanyEnricher({ publisher: "YIT" }) },
  { name: "asuntosaatio", fetch: fetchAsuntosaatioSource, enrich: createCompanyEnricher({ publisher: "Asuntosäätiö", role: "developer" }) },
  { name: "asura", fetch: fetchAsuraSource, enrich: createCompanyEnricher({ publisher: "Asura" }) },
  { name: "aura", fetch: fetchAuraSource, enrich: createCompanyEnricher({ publisher: "Aura Rakennus" }) },
  { name: "bonava", fetch: fetchBonavaSource, enrich: createCompanyEnricher({ publisher: "Bonava" }) },
  { name: "fira", fetch: fetchFiraSource, enrich: createCompanyEnricher({ publisher: "Fira" }) },
  { name: "skanska", fetch: fetchSkanskaSource, enrich: createCompanyEnricher({ publisher: "Skanska" }) },
  { name: "ncc", fetch: fetchNccSource, enrich: createCompanyEnricher({ publisher: "NCC" }) },
  { name: "peab", fetch: fetchPeabSource, enrich: enrichPeabCandidate },
  { name: "hartela", fetch: fetchHartelaSource, enrich: createCompanyEnricher({ publisher: "Hartela" }) },
  { name: "grk", fetch: fetchGrkSource, enrich: createCompanyEnricher({ publisher: "GRK" }) },
  { name: "tekova", fetch: fetchTekovaSource, enrich: createCompanyEnricher({ publisher: "Tekova" }) },
  { name: "jatke", fetch: fetchJatkeSource, enrich: createCompanyEnricher({ publisher: "Jatke" }) },
  { name: "espoon_asunnot", fetch: fetchEspoonAsunnotSource, enrich: createCompanyEnricher({ publisher: "Espoon Asunnot", role: "developer" }) },
  { name: "meijou", fetch: fetchMeijouSource, enrich: createCompanyEnricher({ publisher: "Meijou" }) },
  { name: "mangrove", fetch: fetchMangroveSource, enrich: createCompanyEnricher({ publisher: "Mangrove" }) },
  /*
   * Kastelli rakentaa vuokrakohteet omaan lukuunsa yhdessa rahoittajan
   * kanssa (Novus Family Homes), eli se on urakoitsija — sama oletusrooli
   * kuin muilla rakennusliikkeilla.
   */
  { name: "kastelli", fetch: fetchKastelliSource, enrich: createCompanyEnricher({ publisher: "Kastelli-talot" }) },
  /*
   * VRJ ilman rikastajaa (D-250): jutun sivu haetaan jo julkaisupaivan
   * vuoksi, ja rikastus korvasi kuvauksen sivun kalusteilla
   * ("Ajankohtaista <otsikko> Rakennusala Tiedote VRJ").
   */
  { name: "vrj", fetch: fetchVrjSource },
  { name: "srv", fetch: fetchSrvSource, enrich: createCompanyEnricher({ publisher: "SRV" }) },
  { name: "helsinki_paatokset", fetch: fetchHelsinkiPaatoksetSource },
  { name: "espoo_paatokset", fetch: fetchEspooPaatoksetSource },
  { name: "kuopio_paatokset", fetch: fetchKuopioPaatoksetSource },
  { name: "lahti_paatokset", fetch: fetchLahtiPaatoksetSource },
  { name: "kirkkonummi_paatokset", fetch: fetchKirkkonummiPaatoksetSource },
  { name: "tuusula_paatokset", fetch: fetchTuusulaPaatoksetSource },
  { name: "savonlinna_paatokset", fetch: fetchSavonlinnaPaatoksetSource },
  { name: "tornio_paatokset", fetch: fetchTornioPaatoksetSource },
  { name: "ylojarvi_paatokset", fetch: fetchYlojarviPaatoksetSource },
  { name: "joensuu_paatokset", fetch: fetchJoensuuPaatoksetSource },
  { name: "kouvola_paatokset", fetch: fetchKouvolaPaatoksetSource },
  { name: "porvoo_paatokset", fetch: fetchPorvooPaatoksetSource },
  { name: "tampere_paatokset", fetch: fetchTamperePaatoksetSource },
  { name: "jyvaskyla_paatokset", fetch: fetchJyvaskylaPaatoksetSource },
  { name: "rovaniemi_paatokset", fetch: fetchRovaniemiPaatoksetSource },
  { name: "pori_paatokset", fetch: fetchPoriPaatoksetSource },
  { name: "turku_paatokset", fetch: fetchTurkuPaatoksetSource },
  { name: "ysaatio", fetch: fetchYsaatioSource, enrich: createCompanyEnricher({ publisher: "Y-Säätiö", role: "developer" }) },
  { name: "pohjola_rakennus", fetch: fetchPohjolaRakennusSource, enrich: createCompanyEnricher({ publisher: "Pohjola Rakennus" }) },
  { name: "varte", fetch: fetchVarteSource, enrich: createCompanyEnricher({ publisher: "Varte" }) },
  { name: "lujatalo", fetch: fetchLujataloSource, enrich: createCompanyEnricher({ publisher: "Lujatalo" }) },
  { name: "kas_asunnot", fetch: fetchKasSource, enrich: createCompanyEnricher({ publisher: "KAS-Asunnot", role: "developer" }) },
  { name: "hausia", fetch: fetchHausiaSource, enrich: createCompanyEnricher({ publisher: "Hausia" }) },
  { name: "rakennusteho", fetch: fetchRakennustehoSource, enrich: createCompanyEnricher({ publisher: "Rakennusteho" }) },
  { name: "marvea", fetch: fetchMarveaSource, enrich: createCompanyEnricher({ publisher: "Marvea" }) },
  { name: "marttilan", fetch: fetchMarttilanSource, enrich: createCompanyEnricher({ publisher: "Marttilan Rakennus" }) },
  { name: "brand_toimitilat", fetch: fetchBrandToimitilatSource, enrich: createCompanyEnricher({ publisher: "Brand Toimitilat" }) },
  { name: "helsinki_uutiset", fetch: fetchHelsinkiUutisetSource },
  /*
   * Keravan kaavahankkeet olivat jo lahteena, mutta kaavasivu ei kerro
   * kuka kilpailun voitti — uutinen kertoo (D-247).
   */
  { name: "kerava_uutiset", fetch: fetchKeravaUutisetSource },
  { name: "rakennuslehti", fetch: fetchRakennuslehtiSource, enrich: enrichRakennuslehtiCandidate },
  { name: "stt_haku", fetch: fetchSttHakuSource, enrich: enrichSttCandidate },
  /*
   * Sama rajapinta kuin stt_haku, eri kysymys: hakusanahaku etsii
   * tuntemattomia rakennuttajia, tämä varmistaa ettei nimetyn
   * rakennusliikkeen tiedote jää hakusanan ohi (D-211). Rikastus on sama.
   */
  {
    name: "stt_julkaisijat",
    fetch: fetchSttJulkaisijatSource,
    enrich: enrichSttCandidate,
  },
  /*
   * Talotekniikkaurakoitsija tiedottaa hankkeista joissa se on
   * SIVU-urakoitsija, ja nimeaa silloin usein rakennuttajan ja
   * paaurakoitsijan (D-214). Kuvaus tulee jo rajapinnasta, joten
   * erillista rikastusta ei tarvita.
   */
  {
    name: "are",
    fetch: luoTalotekniikkaLahde({
      nimi: "Are",
      endpoint: "https://www.are.fi/wp-json/wp/v2/news",
    }),
  },
  /*
   * Sarlin on HubSpotissa eika WordPressissa, ja uutiset ovat oman
   * tagin takana: `/ajankohtaista/rss.xml` on asiantuntijablogi eika
   * sisalla hankkeita lainkaan (mitattu 25.9.2026: 10 juttua, 0
   * hanketta), tag-syote antaa molemmat hankeuutiset.
   */
  {
    name: "sarlin",
    fetch: luoTalotekniikkaLahde({
      nimi: "Sarlin",
      endpoint: "https://www.sarlin.com/ajankohtaista/tag/uutinen/rss.xml",
      tyyppi: "rss",
    }),
    /*
     * RSS antaa vain kuvakaareen ja seurantapikselin, joten kuvaus
     * haetaan artikkelisivulta (D-215).
     */
    enrich: luoTalotekniikkaRikastus({ nimi: "Sarlin", endpoint: "", tyyppi: "rss" }),
  },
  /*
   * Amplitin uutisvirta on pysahtynyt 5/2025, mutta 11 hanketta on
   * takautuvasti arvokasta: ne taydentavat olemassa olevia hankkeita
   * (Laakson yhteissairaala, Tapiolan Feenix, Etu-Toolon lukio).
   */
  {
    name: "amplit",
    fetch: luoTalotekniikkaLahde({
      nimi: "Amplit",
      endpoint: "https://www.amplit.fi/wp-json/wp/v2/posts",
    }),
  },
  /*
   * Sivu-urakoitsijat Squarespace-blogista (D-250): betoni- ja siltarakenteet
   * (Torppari) ja vesikatot (Pelti-Assat). Kuten talotekniikassa,
   * julkaisija kirjataan liittyvaksi yritykseksi eika builderiksi, ja
   * koko teksti tulee jo syotteesta, joten rikastusta ei tarvita.
   */
  { name: "torppari", fetch: fetchTorppariSource },
  { name: "pelti_assat", fetch: fetchPeltiAssatSource },
  /*
   * Rikastuskoukku hakee asian kuulutuksen tai paatoksen ja poimii siita
   * kuvauksen. Ilman sita jonoriville jai vain "Ymparistolupa-asia
   * (diaarinro ...). Hakija: ..." — mitattu 13.10.2026: taman lahteen
   * hyvaksymisaste 47 % (kuvaus 79 merkkia), YVA-lahteen 85 % (4 892).
   * Ks. lib/agent/ymparistolupaAsiakirja.ts.
   */
  {
    name: "ymparistolupa",
    fetch: fetchYmparistolupaSource,
    enrich: createYmparistolupaEnricher(),
  },
  /*
   * Rikastuskoukku lukee hankesivun nimetyt kentät (hankevastaava,
   * yhteysviranomainen, diaarinumero), joita hakurajapinta ei palauta.
   * Mitattu 15.8.2026: 94 hanketta 240:stä oli ilman rakennuttajaa, koska
   * nimi ei ole leipätekstissä lainkaan. Ks. lib/agent/yvaProjectPage.ts.
   */
  { name: "yva", fetch: fetchYvaSource, enrich: createYvaEnricher() },
  { name: "suunnittelukilpailu", fetch: fetchSuunnittelukilpailuSource },
  /*
   * Ensimmäinen suunnittelutoimistolähde. Suunnittelija valitaan hankkeen
   * alussa, joten tieto tulee ennen urakkakilpailua — ja se yltää
   * yksityisiin suurhankkeisiin, joita lupa- ja hankintalähteet eivät näe.
   * Rooli "designer": julkaisijaa ei kirjata rakennuttajaksi eikä
   * urakoitsijaksi, ks. companyRelease.ts.
   */
  { name: "sitowise", fetch: fetchSitowiseSource, enrich: createCompanyEnricher({ publisher: "Sitowise", role: "designer" }) },
  /*
   * Skanskan PROJEKTISIVUT, eri lahde kuin sen uutiset. Uutinen kertoo
   * hetkesta, projektisivu hankkeen tilan ja osapuolet nimettyina
   * kenttina - ja pysyy ajan tasalla koko hankkeen ajan.
   */
  { name: "skanska_projektit", fetch: fetchSkanskaProjectsSource, enrich: enrichSkanskaProject },
  /*
   * Lujatalon referenssit, rajattuna KAYNNISSA oleviin: 115:sta 108 on
   * valmistuneita eivatka ne ole mahdollisuuksia vaan historiaa.
   */
  { name: "lujatalo_projektit", fetch: fetchLujataloProjectsSource, enrich: enrichLujataloProject },
  /*
   * Lujan OMAPERUSTEINEN asuntotuotanto. Ei paalekkain kahden muun
   * Luja-lahteen kanssa: omaperusteisesta kohteesta ei synny
   * urakkauutista eika se paady referensseihin ennen valmistumista.
   * Kohdesivu antaa rekisteroidyn taloyhtion nimen ja katuosoitteen.
   */
  { name: "lujakoti", fetch: fetchLujakotiSource },
  /*
   * Laptin taloyhtiot. Lahde `lapti` lukee uutissivun eika nae
   * omaperusteista asuntotuotantoa lainkaan (D-172). Kohdesivuilla on
   * 21 nimettya kenttaa - rikkain mitattu yrityslahde.
   */
  { name: "lapti_kohteet", fetch: fetchLaptiKohteetSource },
  /*
   * Bonavan kohdesivut. Lahde `bonava` lukee mediatiedotteet eika nae
   * omia asuntokohteita. Myyntitila on koneluettava
   * (`window.bonavaInfo.salesStatus`), ja "Planned" on aikaisin vaihe
   * jonka yksikaan mitattu rakentajasivusto merkitsee.
   */
  { name: "bonava_kohteet", fetch: fetchBonavaKohteetSource },
  /*
   * T2H:n kohdesivut. Rikkain data (schema.org, koordinaatit), mutta
   * robots.txt asettaa Crawl-delay 15, joten joka ajolla haetaan vain
   * nelja sivua ja luettelo kierretaan vuorokauden mukaan. Koko
   * luettelo (62 sivua) tulee kayodyksi noin kahdessa viikossa.
   */
  { name: "t2h_kohteet", fetch: fetchT2hKohteetSource },
  /*
   * Hekan uudiskohdeluettelo (D-251): Helsingin kaupungin vuokratalojen
   * rakenteilla olevat kohteet tarkkoine valmistumispaivineen. Ei
   * rikastajaa: kaikki kentat ovat luettelorivilla, eika kohdesivuja ole.
   */
  { name: "heka", fetch: fetchHekaSource },
  /*
   * TA-Yhtioiden tiedotteet (D-254): rakennuttajan omat hanketiedotteet
   * WP RESTista. Ei rikastajaa: rajapinta antaa koko tekstin, ja
   * `createCompanyEnricher` korvaisi vaiheen yleisella saannolla, joka ei
   * tunne TA:n muotoja ("on aloittanut ... rakentamisen").
   */
  { name: "ta_yhtiot", fetch: fetchTaSource },
  /*
   * NCC:n projektisivut - mitattuna rikkain yrityslahde. Ainoa joka tuottaa
   * katuosoitteen postinumeroineen ja suunnittelijat urakkalajeittain.
   */
  { name: "ncc_projektit", fetch: fetchNccProjectsSource, enrich: enrichNccProject },
  /*
   * GRK:n projektisivut - infrahankkeita, joissa kattavuutemme on ohuempi
   * kuin talonrakentamisessa. Ei rikastuskoukkua: sivut ovat pienia ja
   * haku tekee kaiken kerralla, joten poiminta ei ole ENRICH_PER_RUN-katon
   * takana.
   */
  { name: "grk_projektit", fetch: fetchGrkProjectsSource },
  /*
   * NRC Group Finland, sama kuvio kuin GRK:lla: iso infratoimija jonka
   * omat hankesivut kertovat kaynnissa olevat kohteet. Lisatty koska
   * asiakas ei loytanyt Turun raitiotiesta NRC:ta — hanke oli meilla,
   * mutta vain GRK:n nakokulmasta (D-288).
   */
  { name: "nrc_projektit", fetch: fetchNrcProjectsSource },
  /*
   * Fingridin kantaverkkohankkeet. Tama on se aukko joka on ollut tiedossa
   * pisimpaan: valtakunnalliset suurhankkeet eivat osu Hilmaan, kunnan
   * paatoksiin eivatka kaavoihin. Fingrid oli lahdekartoituksen 15.10.2026
   * suurin aukko - 31 hanketta ilman omaa lahdetta.
   *
   * Poikkeuksellista on vaiheen tuoreus: 50/52 hanketta on kesken, kun
   * urakoitsijoiden referenssisivuilla valtaosa on historiaa. Vaihe tulee
   * lahteesta, ei arvauksesta (D-289).
   */
  { name: "fingrid_hankkeet", fetch: fetchFingridProjectsSource },
  /*
   * Destian tiedotteet. Uutishuone renderoi listan JS:lla, mutta lista
   * tulee omasta POST-paatepisteestaan, joka antaa tiedotteet
   * rakenteisena (`postTypes: ["release"]`). docs/20 merkitsi Destian
   * hankalaksi, mutta se arvio koski referenssit-listausta (D-295).
   *
   * Suodatus on koko tyo: 12 kk:n 26 tiedotteesta 8 on hankkeita,
   * loput yritysviestintaa. Siksi vaaditaan seka urakkasignaali etta
   * poissulkeva lista.
   */
  { name: "destia_tiedotteet", fetch: fetchDestiaSource },
  /*
   * Toivo Groupin lehdistotiedotteet. docs/20:n Rakennuslehti-kartoitus
   * (17.10.2026) nosti Toivon parhaaksi yksittaiseksi ehdokkaaksi: 14
   * hanketta kannassa, joista 13 jaisi ilman tata lahdetta, koska Toivo
   * toimii usein omana rakennuttajanaan ilman nimettya rakentajaa.
   *
   * Suodatus tulee aineistosta eika sanastosta: lehdistotiedote on
   * `PRESS_RELEASE`, omien osakkeiden hankinta `SHARE_REPURCHASE`. Siksi
   * kohina karsiutuu tunnisteella, ja sanasto tarvitaan vain
   * tulosjulkistuksen kutsuihin.
   *
   * Kuvaus on poikkeuksellisen hyva: mediaani 2 368 merkkia, kun
   * Rakennuslehden ingressi on 197. Hankkeen arvo, asuntomaara,
   * kumppani ja valmistumisaika ovat tekstissa.
   */
  { name: "toivo_tiedotteet", fetch: fetchToivoSource },
  /*
   * Oteran Oy (Lohkare Infra), silta- ja vesirakentamisen paaurakoitsija
   * (D-310). WordPressin RSS, koska REST palauttaa 401. Koostejutut
   * ("Laskentakauden kuulumisia") eritellaan osioittain omiksi
   * ehdokkaikseen fragmentti-osoitteella. Ilman rikastajaa: syote antaa
   * koko tekstin, ja rikastus hakisi sivun koko koosteena uudelleen.
   */
  { name: "oteran", fetch: fetchOteranSource },
  /*
   * Lohkare Infra -konserni, Oteranin emo (D-341). WordPressin REST on
   * auki ja antaa koko tekstin. Jokainen juttu julkaistaan FI+EN-parina,
   * ja englanninkielinen pudotetaan osoitteen `/en/`-polusta.
   *
   * SUODATUS ON KOKO TYO: 22 jutusta 12 on suomeksi ja niista yksi
   * kertoo hankkeesta -- loput ovat yritysostoja ja nimityksia. Arvo on
   * TAYDENNYKSESSA: konserni tiedottaa vasta sopimuksesta, joten hanke
   * on jo kannassa Hilmasta, mutta tiedote antaa yhteyshenkilot,
   * laajuuden ja valmistumisvuoden.
   */
  { name: "lohkare", fetch: fetchLohkareSource },
  /*
   * Vexatec Oy: hoiva- ja palvelurakentamisen KVR-urakoitsija. Tiedotteet
   * ovat WordPressin omassa tyypissa `tiedotteet`, eivat RSS-syotteessa
   * -- syotteessa on vain henkilostojuttuja. Mitattu: 31 tiedotetta,
   * joista 15 kertoo kohteesta; 12 kk ikkunassa kuusi (D-322).
   */
  { name: "vexatec", fetch: fetchVexatecSource },
  /*
   * Tampereen Tilapalvelut Oy, kaupungin rakennuttaja (D-339).
   * WordPressin `portfolio`-tyyppi; vaihe julkaisijan luokituksesta
   * (tulevat / meneillaan / asiakastarinat) ja aikataulukentasta.
   * Jokaisessa jutussa hankepaallikko puhelimineen ja sahkoposteineen.
   */
  { name: "tampereen_tilapalvelut", fetch: fetchTilapalvelutSource },
  /*
   * Hartelan TULEVAT asuinalueet - eri sivu kuin referenssit, jotka ovat
   * valmistuneita. Naiden arvo on katuosoite: 8/15 sivulta loytyy osoite
   * talonumeroineen, mika on duplikaattitasmayksen vahvin avain.
   */
  { name: "hartela_asuinalueet", fetch: fetchHartelaAreasSource },
  /*
   * HC Hoivakodit. Volyymi on pieni - koko sivustolla yksi artikkeli -
   * mutta lahde on halpa ja tuo osoitteen. Tuotto on syyta tarkistaa
   * ennen kuin siihen nojataan.
   */
  { name: "hc_hoivakodit", fetch: fetchHcHoivakoditSource },
]