import { fetchTestSource } from "./fetchTestSource"
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
import { fetchSenaattiSource } from "./fetchSenaattiSource"
import { fetchKreateSource } from "./fetchKreateSource"
import { fetchTekovaSource } from "./fetchTekovaSource"
import { fetchJatkeSource } from "./fetchJatkeSource"
import { fetchEspoonAsunnotSource } from "./fetchEspoonAsunnotSource"
import { fetchMeijouSource } from "./fetchMeijouSource"

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
  { name: "senaatti", fetch: fetchSenaattiSource },
  { name: "kreate", fetch: fetchKreateSource },
  { name: "tekova", fetch: fetchTekovaSource },
  { name: "jatke", fetch: fetchJatkeSource },
  { name: "espoon_asunnot", fetch: fetchEspoonAsunnotSource },
  { name: "meijou", fetch: fetchMeijouSource },
  
]