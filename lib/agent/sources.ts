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
} from "./fetchDynastySource"
import { fetchTamperePaatoksetSource } from "./fetchCaseMSource"
import { fetchTurkuPaatoksetSource } from "./fetchTurkuSource"
import { fetchYitSource } from "./fetchYitSource"
import { fetchAsuntosaatioSource } from "./fetchAsuntosaatioSource"
import { fetchAsuraSource } from "./fetchAsuraSource"
import { fetchAuraSource } from "./fetchAuraSource"
import { fetchBonavaSource } from "./fetchBonavaSource"
import { fetchFiraSource } from "./fetchFiraSource"
import { fetchSkanskaSource } from "./fetchSkanskaSource"
import { fetchNccSource } from "./fetchNccSource"
import { fetchPeabSource } from "./fetchPeabSource"
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
import { fetchRakennuslehtiSource } from "./fetchRakennuslehtiSource"
import { fetchSttHakuSource, enrichSttCandidate } from "./fetchSttHakuSource"
import { fetchYmparistolupaSource } from "./fetchYmparistolupaSource"
import { fetchYvaSource } from "./fetchYvaSource"
import { fetchSuunnittelukilpailuSource } from "./fetchSuunnittelukilpailuSource"

export const sources = [
  { name: "lapti", fetch: fetchTestSource },
  { name: "yit", fetch: fetchYitSource },
  { name: "asuntosaatio", fetch: fetchAsuntosaatioSource },
  { name: "asura", fetch: fetchAsuraSource,},
  { name: "aura", fetch: fetchAuraSource },
  { name: "bonava", fetch: fetchBonavaSource },
  { name: "fira", fetch: fetchFiraSource },
  { name: "skanska", fetch: fetchSkanskaSource },
  { name: "ncc", fetch: fetchNccSource },
  { name: "peab", fetch: fetchPeabSource },
  { name: "hartela", fetch: fetchHartelaSource },
  { name: "grk", fetch: fetchGrkSource },
  { name: "tekova", fetch: fetchTekovaSource },
  { name: "jatke", fetch: fetchJatkeSource },
  { name: "espoon_asunnot", fetch: fetchEspoonAsunnotSource },
  { name: "meijou", fetch: fetchMeijouSource },
  { name: "mangrove", fetch: fetchMangroveSource },
  { name: "srv", fetch: fetchSrvSource },
  { name: "helsinki_paatokset", fetch: fetchHelsinkiPaatoksetSource },
  { name: "espoo_paatokset", fetch: fetchEspooPaatoksetSource },
  { name: "kuopio_paatokset", fetch: fetchKuopioPaatoksetSource },
  { name: "lahti_paatokset", fetch: fetchLahtiPaatoksetSource },
  { name: "kirkkonummi_paatokset", fetch: fetchKirkkonummiPaatoksetSource },
  { name: "tuusula_paatokset", fetch: fetchTuusulaPaatoksetSource },
  { name: "savonlinna_paatokset", fetch: fetchSavonlinnaPaatoksetSource },
  { name: "tornio_paatokset", fetch: fetchTornioPaatoksetSource },
  { name: "ylojarvi_paatokset", fetch: fetchYlojarviPaatoksetSource },
  { name: "tampere_paatokset", fetch: fetchTamperePaatoksetSource },
  { name: "turku_paatokset", fetch: fetchTurkuPaatoksetSource },
  { name: "ysaatio", fetch: fetchYsaatioSource },
  { name: "pohjola_rakennus", fetch: fetchPohjolaRakennusSource },
  { name: "varte", fetch: fetchVarteSource },
  { name: "lujatalo", fetch: fetchLujataloSource },
  { name: "kas_asunnot", fetch: fetchKasSource },
  { name: "hausia", fetch: fetchHausiaSource },
  { name: "rakennusteho", fetch: fetchRakennustehoSource },
  { name: "marvea", fetch: fetchMarveaSource },
  { name: "marttilan", fetch: fetchMarttilanSource },
  { name: "brand_toimitilat", fetch: fetchBrandToimitilatSource },
  { name: "helsinki_uutiset", fetch: fetchHelsinkiUutisetSource },
  { name: "rakennuslehti", fetch: fetchRakennuslehtiSource },
  { name: "stt_haku", fetch: fetchSttHakuSource, enrich: enrichSttCandidate },
  { name: "ymparistolupa", fetch: fetchYmparistolupaSource },
  { name: "yva", fetch: fetchYvaSource },
  { name: "suunnittelukilpailu", fetch: fetchSuunnittelukilpailuSource },
]