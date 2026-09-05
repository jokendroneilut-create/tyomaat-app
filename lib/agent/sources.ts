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
import { fetchRakennuslehtiSource, enrichRakennuslehtiCandidate } from "./fetchRakennuslehtiSource"
import { fetchSttHakuSource, enrichSttCandidate } from "./fetchSttHakuSource"
import { fetchYmparistolupaSource } from "./fetchYmparistolupaSource"
import { fetchYvaSource } from "./fetchYvaSource"
import { createYvaEnricher } from "./yvaProjectPage"
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
import {
  fetchNccProjectsSource,
  enrichNccProject,
} from "./fetchNccProjectsSource"
import { fetchGrkProjectsSource } from "./fetchGrkProjectsSource"
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
  { name: "rakennuslehti", fetch: fetchRakennuslehtiSource, enrich: enrichRakennuslehtiCandidate },
  { name: "stt_haku", fetch: fetchSttHakuSource, enrich: enrichSttCandidate },
  { name: "ymparistolupa", fetch: fetchYmparistolupaSource },
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