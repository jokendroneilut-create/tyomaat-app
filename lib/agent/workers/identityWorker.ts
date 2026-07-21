import { createClient } from "@supabase/supabase-js"
import { resolvePotentialProject } from "@/lib/agent/identity/resolvePotentialProject"
import { classifyProject } from "@/lib/agent/knowledge/projectClassifier"
import { resolveHilmaProject } from "@/lib/agent/identity/resolvers/hilmaResolver"
import { resolveLupapisteProject } from "@/lib/agent/identity/resolvers/lupapisteResolver"
import { resolveVantaaKaavaProject } from "@/lib/agent/identity/resolvers/vantaaKaavaResolver"
import { resolveHelsinkiKaavaProject } from "@/lib/agent/identity/resolvers/helsinkiKaavaResolver"
import { resolveTampereKaavaProject } from "@/lib/agent/identity/resolvers/tampereKaavaResolver"
import { resolveTurkuKaavaProject } from "@/lib/agent/identity/resolvers/turkuKaavaResolver"
import { resolveKreateProject } from "@/lib/agent/identity/resolvers/kreateResolver"
import { resolveVaylaProject } from "@/lib/agent/identity/resolvers/vaylaResolver"
import { resolveSenaattiProject } from "@/lib/agent/identity/resolvers/senaattiResolver"
import { resolvePuolustuskiinteistotProject } from "@/lib/agent/identity/resolvers/puolustuskiinteistotResolver"
import { resolveEspooKaavaProject } from "@/lib/agent/identity/resolvers/espooKaavaResolver"
import { resolveLohjaKaavaProject } from "@/lib/agent/identity/resolvers/lohjaKaavaResolver"
import { resolveRaumaKaavaProject } from "@/lib/agent/identity/resolvers/raumaKaavaResolver"
import { resolveKaarinaKaavaProject } from "@/lib/agent/identity/resolvers/kaarinaKaavaResolver"
import { resolveNokiaKaavaProject } from "@/lib/agent/identity/resolvers/nokiaKaavaResolver"
import { resolveKajaaniKaavaProject } from "@/lib/agent/identity/resolvers/kajaaniKaavaResolver"
import { resolveKangasalaKaavaProject } from "@/lib/agent/identity/resolvers/kangasalaKaavaResolver"
import { resolveYlojarviKaavaProject } from "@/lib/agent/identity/resolvers/ylojarviKaavaResolver"
import { resolveVihtiKaavaProject } from "@/lib/agent/identity/resolvers/vihtiKaavaResolver"
import { resolveImatraKaavaProject } from "@/lib/agent/identity/resolvers/imatraKaavaResolver"
import { resolveRaaheKaavaProject } from "@/lib/agent/identity/resolvers/raaheKaavaResolver"
import { resolveSastamalaKaavaProject } from "@/lib/agent/identity/resolvers/sastamalaKaavaResolver"
import { resolveHollolaKaavaProject } from "@/lib/agent/identity/resolvers/hollolaKaavaResolver"
import { resolvePirkkalaKaavaProject } from "@/lib/agent/identity/resolvers/pirkkalaKaavaResolver"
import { resolveSiilinjarviKaavaProject } from "@/lib/agent/identity/resolvers/siilinjarviKaavaResolver"
import { resolveMantsalaKaavaProject } from "@/lib/agent/identity/resolvers/mantsalaKaavaResolver"
import { resolveTornioKaavaProject } from "@/lib/agent/identity/resolvers/tornioKaavaResolver"
import { resolveLietoKaavaProject } from "@/lib/agent/identity/resolvers/lietoKaavaResolver"
import { resolveNaantaliKaavaProject } from "@/lib/agent/identity/resolvers/naantaliKaavaResolver"
import { resolveIisalmiKaavaProject } from "@/lib/agent/identity/resolvers/iisalmiKaavaResolver"
import { resolveMustasaariKaavaProject } from "@/lib/agent/identity/resolvers/mustasaariKaavaResolver"
import { resolveKempeleKaavaProject } from "@/lib/agent/identity/resolvers/kempeleKaavaResolver"
import { resolveValkeakoskiKaavaProject } from "@/lib/agent/identity/resolvers/valkeakoskiKaavaResolver"
import { resolvePietarsaariKaavaProject } from "@/lib/agent/identity/resolvers/pietarsaariKaavaResolver"
import { resolveKurikkaKaavaProject } from "@/lib/agent/identity/resolvers/kurikkaKaavaResolver"
import { resolveVarkausKaavaProject } from "@/lib/agent/identity/resolvers/varkausKaavaResolver"
import { resolveKemiKaavaProject } from "@/lib/agent/identity/resolvers/kemiKaavaResolver"
import { resolveHaminaKaavaProject } from "@/lib/agent/identity/resolvers/haminaKaavaResolver"
import { resolveJamsaKaavaProject } from "@/lib/agent/identity/resolvers/jamsaKaavaResolver"
import { resolveLaukaaKaavaProject } from "@/lib/agent/identity/resolvers/laukaaKaavaResolver"
import { resolveHeinolaKaavaProject } from "@/lib/agent/identity/resolvers/heinolaKaavaResolver"
import { resolveAanekoskiKaavaProject } from "@/lib/agent/identity/resolvers/aanekoskiKaavaResolver"
import { resolvePieksamakiKaavaProject } from "@/lib/agent/identity/resolvers/pieksamakiKaavaResolver"
import { resolveAkaaKaavaProject } from "@/lib/agent/identity/resolvers/akaaKaavaResolver"
import { resolveForssaKaavaProject } from "@/lib/agent/identity/resolvers/forssaKaavaResolver"
import { resolveJanakkalaKaavaProject } from "@/lib/agent/identity/resolvers/janakkalaKaavaResolver"
import { resolveOrimattilaKaavaProject } from "@/lib/agent/identity/resolvers/orimattilaKaavaResolver"
import { resolveYlivieskaKaavaProject } from "@/lib/agent/identity/resolvers/ylivieskaKaavaResolver"
import { resolveLoimaaKaavaProject } from "@/lib/agent/identity/resolvers/loimaaKaavaResolver"
import { resolveKontiolahtiKaavaProject } from "@/lib/agent/identity/resolvers/kontiolahtiKaavaResolver"
import { resolveKauhavaKaavaProject } from "@/lib/agent/identity/resolvers/kauhavaKaavaResolver"
import { resolveLapuaKaavaProject } from "@/lib/agent/identity/resolvers/lapuaKaavaResolver"
import { resolveKauhajokiKaavaProject } from "@/lib/agent/identity/resolvers/kauhajokiKaavaResolver"
import { resolveIlmajokiKaavaProject } from "@/lib/agent/identity/resolvers/ilmajokiKaavaResolver"
import { resolveUusikaupunkiKaavaProject } from "@/lib/agent/identity/resolvers/uusikaupunkiKaavaResolver"
import { resolvePaimioKaavaProject } from "@/lib/agent/identity/resolvers/paimioKaavaResolver"
import { resolveUlvilaKaavaProject } from "@/lib/agent/identity/resolvers/ulvilaKaavaResolver"
import { resolveKankaanpaaKaavaProject } from "@/lib/agent/identity/resolvers/kankaanpaaKaavaResolver"
import { resolveLiperiKaavaProject } from "@/lib/agent/identity/resolvers/liperiKaavaResolver"
import { resolveLieksaKaavaProject } from "@/lib/agent/identity/resolvers/lieksaKaavaResolver"
import { resolveKiteeKaavaProject } from "@/lib/agent/identity/resolvers/kiteeKaavaResolver"
import { resolveKalajokiKaavaProject } from "@/lib/agent/identity/resolvers/kalajokiKaavaResolver"
import { resolveNivalaKaavaProject } from "@/lib/agent/identity/resolvers/nivalaKaavaResolver"
import { resolveLimingaKaavaProject } from "@/lib/agent/identity/resolvers/limingaKaavaResolver"
import { resolveMuurameKaavaProject } from "@/lib/agent/identity/resolvers/muurameKaavaResolver"
import { resolveSaarijarviKaavaProject } from "@/lib/agent/identity/resolvers/saarijarviKaavaResolver"
import { resolveKeuruuKaavaProject } from "@/lib/agent/identity/resolvers/keuruuKaavaResolver"
import { resolveLoviisaKaavaProject } from "@/lib/agent/identity/resolvers/loviisaKaavaResolver"
import { resolveKuusamoKaavaProject } from "@/lib/agent/identity/resolvers/kuusamoKaavaResolver"
import { resolveKauniainenKaavaProject } from "@/lib/agent/identity/resolvers/kauniainenKaavaResolver"
import { resolveParainenKaavaProject } from "@/lib/agent/identity/resolvers/parainenKaavaResolver"
import { resolveSomeroKaavaProject } from "@/lib/agent/identity/resolvers/someroKaavaResolver"
import { resolveHuittinenKaavaProject } from "@/lib/agent/identity/resolvers/huittinenKaavaResolver"
import { resolveKokemakiKaavaProject } from "@/lib/agent/identity/resolvers/kokemakiKaavaResolver"
import { resolveUrjalaKaavaProject } from "@/lib/agent/identity/resolvers/urjalaKaavaResolver"
import { resolvePunkalaidunKaavaProject } from "@/lib/agent/identity/resolvers/punkalaidunKaavaResolver"
import { resolveLoppiKaavaProject } from "@/lib/agent/identity/resolvers/loppiKaavaResolver"
import { resolveHattulaKaavaProject } from "@/lib/agent/identity/resolvers/hattulaKaavaResolver"
import { resolveSavitaipaleKaavaProject } from "@/lib/agent/identity/resolvers/savitaipaleKaavaResolver"
import { resolveJuvaKaavaProject } from "@/lib/agent/identity/resolvers/juvaKaavaResolver"
import { resolveLapinlahtiKaavaProject } from "@/lib/agent/identity/resolvers/lapinlahtiKaavaResolver"
import { resolveKannusKaavaProject } from "@/lib/agent/identity/resolvers/kannusKaavaResolver"
import { resolveToholampiKaavaProject } from "@/lib/agent/identity/resolvers/toholampiKaavaResolver"
import { resolveKuhmoKaavaProject } from "@/lib/agent/identity/resolvers/kuhmoKaavaResolver"
import { resolveSuomussalmiKaavaProject } from "@/lib/agent/identity/resolvers/suomussalmiKaavaResolver"
import { resolveKittilaKaavaProject } from "@/lib/agent/identity/resolvers/kittilaKaavaResolver"
import { resolveKemijarviKaavaProject } from "@/lib/agent/identity/resolvers/kemijarviKaavaResolver"
import { resolveRautjarviKaavaProject } from "@/lib/agent/identity/resolvers/rautjarviKaavaResolver"
import { resolveAlajarviKaavaProject } from "@/lib/agent/identity/resolvers/alajarviKaavaResolver"
import { resolveAlavusKaavaProject } from "@/lib/agent/identity/resolvers/alavusKaavaResolver"
import { resolveIsokyroKaavaProject } from "@/lib/agent/identity/resolvers/isokyroKaavaResolver"
import { resolveKuortaneKaavaProject } from "@/lib/agent/identity/resolvers/kuortaneKaavaResolver"
import { resolveLaihiaKaavaProject } from "@/lib/agent/identity/resolvers/laihiaKaavaResolver"
import { resolveAhtariKaavaProject } from "@/lib/agent/identity/resolvers/ahtariKaavaResolver"
import { resolveEnonkoskiKaavaProject } from "@/lib/agent/identity/resolvers/enonkoskiKaavaResolver"
import { resolveHeinavesiKaavaProject } from "@/lib/agent/identity/resolvers/heinavesiKaavaResolver"
import { resolveHirvensalmiKaavaProject } from "@/lib/agent/identity/resolvers/hirvensalmiKaavaResolver"
import { resolvePuumalaKaavaProject } from "@/lib/agent/identity/resolvers/puumalaKaavaResolver"
import { resolveSulkavaKaavaProject } from "@/lib/agent/identity/resolvers/sulkavaKaavaResolver"
import { resolveHyrynsalmiKaavaProject } from "@/lib/agent/identity/resolvers/hyrynsalmiKaavaResolver"
import { resolvePaltamoKaavaProject } from "@/lib/agent/identity/resolvers/paltamoKaavaResolver"
import { resolvePuolankaKaavaProject } from "@/lib/agent/identity/resolvers/puolankaKaavaResolver"
import { resolveHausjarviKaavaProject } from "@/lib/agent/identity/resolvers/hausjarviKaavaResolver"
import { resolveJokioinenKaavaProject } from "@/lib/agent/identity/resolvers/jokioinenKaavaResolver"
import { resolveVeteliKaavaProject } from "@/lib/agent/identity/resolvers/veteliKaavaResolver"
import { resolveMultiaKaavaProject } from "@/lib/agent/identity/resolvers/multiaKaavaResolver"
import { resolvePetajavesiKaavaProject } from "@/lib/agent/identity/resolvers/petajavesiKaavaResolver"
import { resolvePihtipudasKaavaProject } from "@/lib/agent/identity/resolvers/pihtipudasKaavaResolver"
import { resolveToivakkaKaavaProject } from "@/lib/agent/identity/resolvers/toivakkaKaavaResolver"
import { resolveUurainenKaavaProject } from "@/lib/agent/identity/resolvers/uurainenKaavaResolver"
import { resolveViitasaariKaavaProject } from "@/lib/agent/identity/resolvers/viitasaariKaavaResolver"
import { resolveIittiKaavaProject } from "@/lib/agent/identity/resolvers/iittiKaavaResolver"
import { resolveMiehikkalaKaavaProject } from "@/lib/agent/identity/resolvers/miehikkalaKaavaResolver"
import { resolvePyhtaaKaavaProject } from "@/lib/agent/identity/resolvers/pyhtaaKaavaResolver"
import { resolveVirolahtiKaavaProject } from "@/lib/agent/identity/resolvers/virolahtiKaavaResolver"
import { resolveEnontekioKaavaProject } from "@/lib/agent/identity/resolvers/enontekioKaavaResolver"
import { resolveInariKaavaProject } from "@/lib/agent/identity/resolvers/inariKaavaResolver"
import { resolveKeminmaaKaavaProject } from "@/lib/agent/identity/resolvers/keminmaaKaavaResolver"
import { resolveMuonioKaavaProject } from "@/lib/agent/identity/resolvers/muonioKaavaResolver"
import { resolvePelkosenniemiKaavaProject } from "@/lib/agent/identity/resolvers/pelkosenniemiKaavaResolver"
import { resolveRanuaKaavaProject } from "@/lib/agent/identity/resolvers/ranuaKaavaResolver"
import { resolveSimoKaavaProject } from "@/lib/agent/identity/resolvers/simoKaavaResolver"
import { resolveSodankylaKaavaProject } from "@/lib/agent/identity/resolvers/sodankylaKaavaResolver"
import { resolvePelloKaavaProject } from "@/lib/agent/identity/resolvers/pelloKaavaResolver"
import { resolveRiihimakiKaavaProject } from "@/lib/agent/identity/resolvers/riihimakiKaavaResolver"
import { resolveRaaseporiKaavaProject } from "@/lib/agent/identity/resolvers/raaseporiKaavaResolver"
import { resolveRaisioKaavaProject } from "@/lib/agent/identity/resolvers/raisioKaavaResolver"
import { resolveLempaalaKaavaProject } from "@/lib/agent/identity/resolvers/lempaalaKaavaResolver"
import { resolveSavonlinnaKaavaProject } from "@/lib/agent/identity/resolvers/savonlinnaKaavaResolver"
import { resolveKuopioKaavaProject } from "@/lib/agent/identity/resolvers/kuopioKaavaResolver"
import { resolveHyvinkaaKaavaProject } from "@/lib/agent/identity/resolvers/hyvinkaaKaavaResolver"
import { resolveSeinajokiKaavaProject } from "@/lib/agent/identity/resolvers/seinajokiKaavaResolver"
import { resolveRovaniemiKaavaProject } from "@/lib/agent/identity/resolvers/rovaniemiKaavaResolver"
import { resolveMikkeliKaavaProject } from "@/lib/agent/identity/resolvers/mikkeliKaavaResolver"
import { resolveKotkaKaavaProject } from "@/lib/agent/identity/resolvers/kotkaKaavaResolver"
import { resolveSaloKaavaProject } from "@/lib/agent/identity/resolvers/saloKaavaResolver"
import { resolvePorvooKaavaProject } from "@/lib/agent/identity/resolvers/porvooKaavaResolver"
import { resolveKokkolaKaavaProject } from "@/lib/agent/identity/resolvers/kokkolaKaavaResolver"
import { resolveKirkkonummiKaavaProject } from "@/lib/agent/identity/resolvers/kirkkonummiKaavaResolver"
import { resolveKeravaKaavaProject } from "@/lib/agent/identity/resolvers/keravaKaavaResolver"
import { resolveTuusulaKaavaProject } from "@/lib/agent/identity/resolvers/tuusulaKaavaResolver"
import { resolveNurmijarviKaavaProject } from "@/lib/agent/identity/resolvers/nurmijarviKaavaResolver"
import { resolveSipooKaavaProject } from "@/lib/agent/identity/resolvers/sipooKaavaResolver"
import { resolveJarvenpaaKaavaProject } from "@/lib/agent/identity/resolvers/jarvenpaaKaavaResolver"
import { resolveLahtiKaavaProject } from "@/lib/agent/identity/resolvers/lahtiKaavaResolver"
import { resolvePoriKaavaProject } from "@/lib/agent/identity/resolvers/poriKaavaResolver"
import { resolveOuluKaavaProject } from "@/lib/agent/identity/resolvers/ouluKaavaResolver"
import { resolveJyvaskylaKaavaProject } from "@/lib/agent/identity/resolvers/jyvaskylaKaavaResolver"
import { resolveHameenlinnaKaavaProject } from "@/lib/agent/identity/resolvers/hameenlinnaKaavaResolver"
import { resolveJoensuuKaavaProject } from "@/lib/agent/identity/resolvers/joensuuKaavaResolver"
import { resolveVaasaKaavaProject } from "@/lib/agent/identity/resolvers/vaasaKaavaResolver"
import { resolveKouvolaKaavaProject } from "@/lib/agent/identity/resolvers/kouvolaKaavaResolver"
import { resolveLappeenrantaKaavaProject } from "@/lib/agent/identity/resolvers/lappeenrantaKaavaResolver"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function runIdentityWorker(documentId: string) {
  const startedAt = Date.now()

  const { data: document, error: documentError } = await supabaseAdmin
    .from("source_documents")
    .select("*")
    .eq("id", documentId)
    .maybeSingle()

  if (documentError) throw documentError

  if (!document) {
    return {
      ok: false,
      documentId,
      error: "Document not found",
    }
  }

  if (document.identity_resolved_at) {
    return {
      ok: true,
      documentId,
      message: "Identity already resolved for document",
      decisionsResolved: 0,
      results: [],
    }
  }

  const { data: facts, error: factsError } = await supabaseAdmin
    .from("project_facts")
    .select("*")
    .eq("document_id", documentId)

  if (factsError) throw factsError

  const grouped = new Map<string, any[]>()
  
  for (const fact of facts ?? []) {
    const decisionIndex = fact.metadata?.decision_index
    if (!decisionIndex) continue

    const key = String(decisionIndex)

    if (!grouped.has(key)) {
      grouped.set(key, [])
    }

    grouped.get(key)!.push(fact)
  }

  const results = []

  const sourceName = String(document.source_name ?? "").trim().toLowerCase()

if (sourceName === "hilma") {
    const result = await resolveHilmaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "lupapiste kuulutukset") {
    const result = await resolveLupapisteProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "vantaan vireillä olevat kaavat") {
    const result = await resolveVantaaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "helsingin vireillä olevat kaavat") {
    const result = await resolveHelsinkiKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "tampereen vireillä olevat kaavat") {
    const result = await resolveTampereKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "turun vireillä olevat kaavat") {
    const result = await resolveTurkuKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "kreate hankkeet") {
    const result = await resolveKreateProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "väylävirasto hankkeet") {
    const result = await resolveVaylaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "senaatti-kiinteistöt hankkeet") {
    const result = await resolveSenaattiProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "puolustuskiinteistöt uutiset") {
    const result = await resolvePuolustuskiinteistotProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "espoon ajankohtaiset asemakaavat") {
    const result = await resolveEspooKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "lohjan ajankohtaiset kaavat") {
    const result = await resolveLohjaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "rauman vireillä olevat asemakaavat") {
    const result = await resolveRaumaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "kaarinan vireillä olevat asemakaavat") {
    const result = await resolveKaarinaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "nokian vireillä olevat asemakaavat") {
    const result = await resolveNokiaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "ylöjärven vireillä olevat asemakaavat") {
    const result = await resolveYlojarviKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "vihdin vireillä olevat asemakaavat") {
    const result = await resolveVihtiKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "imatran vireillä olevat asemakaavat") {
    const result = await resolveImatraKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "raahen vireillä olevat asemakaavat") {
    const result = await resolveRaaheKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "sastamalan vireillä ja nähtävillä olevat kaavat") {
    const result = await resolveSastamalaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "hollolan aktiiviset kaavat") {
    const result = await resolveHollolaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "pirkkalan vireillä olevat asemakaavat") {
    const result = await resolvePirkkalaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "siilinjärven vireillä olevat kaavat") {
    const result = await resolveSiilinjarviKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "mäntsälän vireillä olevat asemakaavat") {
    const result = await resolveMantsalaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "kempeleen vireillä olevat asemakaavat") {
    const result = await resolveKempeleKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "valkeakosken vireillä olevat asemakaavat") {
    const result = await resolveValkeakoskiKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "pietarsaaren vireillä olevat asemakaavat") {
    const result = await resolvePietarsaariKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "kurikan vireillä olevat asemakaavat") {
    const result = await resolveKurikkaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "varkauden vireillä olevat asemakaavat") {
    const result = await resolveVarkausKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "kemin vireillä olevat asemakaavat") {
    const result = await resolveKemiKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "haminan vireillä olevat asemakaavat") {
    const result = await resolveHaminaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "jämsän vireillä olevat asemakaavat") {
    const result = await resolveJamsaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "laukaan vireillä olevat asemakaavat") {
    const result = await resolveLaukaaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "heinolan vireillä olevat asemakaavat") {
    const result = await resolveHeinolaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "äänekosken vireillä olevat asemakaavat") {
    const result = await resolveAanekoskiKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "pieksämäen vireillä olevat asemakaavat") {
    const result = await resolvePieksamakiKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "akaan vireillä olevat asemakaavat") {
    const result = await resolveAkaaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "forssan vireillä olevat asemakaavat") {
    const result = await resolveForssaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "janakkalan vireillä olevat asemakaavat") {
    const result = await resolveJanakkalaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "orimattilan vireillä olevat asemakaavat") {
    const result = await resolveOrimattilaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "ylivieskan vireillä olevat asemakaavat") {
    const result = await resolveYlivieskaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "loimaan vireillä olevat asemakaavat") {
    const result = await resolveLoimaaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "kontiolahden vireillä olevat asemakaavat") {
    const result = await resolveKontiolahtiKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "kauhavan vireillä olevat asemakaavat") {
    const result = await resolveKauhavaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "lapuan vireillä olevat asemakaavat") {
    const result = await resolveLapuaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "kauhajoen vireillä olevat asemakaavat") {
    const result = await resolveKauhajokiKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "ilmajoen vireillä olevat asemakaavat") {
    const result = await resolveIlmajokiKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "uudenkaupungin vireillä olevat asemakaavat") {
    const result = await resolveUusikaupunkiKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "paimion vireillä olevat asemakaavat") {
    const result = await resolvePaimioKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "ulvilan vireillä olevat asemakaavat") {
    const result = await resolveUlvilaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "kankaanpään vireillä olevat asemakaavat") {
    const result = await resolveKankaanpaaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "liperin vireillä olevat asemakaavat") {
    const result = await resolveLiperiKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "lieksan vireillä olevat asemakaavat") {
    const result = await resolveLieksaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "kiteen vireillä olevat asemakaavat") {
    const result = await resolveKiteeKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "kalajoen vireillä olevat asemakaavat") {
    const result = await resolveKalajokiKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "nivalan vireillä olevat asemakaavat") {
    const result = await resolveNivalaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "limingan vireillä olevat asemakaavat") {
    const result = await resolveLimingaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "muuramen vireillä olevat asemakaavat") {
    const result = await resolveMuurameKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "saarijärven vireillä olevat asemakaavat") {
    const result = await resolveSaarijarviKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "keuruun vireillä olevat asemakaavat") {
    const result = await resolveKeuruuKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "loviisan vireillä olevat asemakaavat") {
    const result = await resolveLoviisaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "kuusamon vireillä olevat asemakaavat") {
    const result = await resolveKuusamoKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "kauniaisten vireillä olevat asemakaavat") {
    const result = await resolveKauniainenKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "paraisten vireillä olevat asemakaavat") {
    const result = await resolveParainenKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "someron vireillä olevat asemakaavat") {
    const result = await resolveSomeroKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "huittisten vireillä olevat asemakaavat") {
    const result = await resolveHuittinenKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "kokemäen vireillä olevat asemakaavat") {
    const result = await resolveKokemakiKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "urjalan vireillä olevat asemakaavat") {
    const result = await resolveUrjalaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "punkalaitumen vireillä olevat asemakaavat") {
    const result = await resolvePunkalaidunKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "lopen vireillä olevat asemakaavat") {
    const result = await resolveLoppiKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "hattulan vireillä olevat asemakaavat") {
    const result = await resolveHattulaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "savitaipaleen vireillä olevat asemakaavat") {
    const result = await resolveSavitaipaleKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "juvan vireillä olevat asemakaavat") {
    const result = await resolveJuvaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "lapinlahden vireillä olevat asemakaavat") {
    const result = await resolveLapinlahtiKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "kannuksen vireillä olevat asemakaavat") {
    const result = await resolveKannusKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "toholammin vireillä olevat asemakaavat") {
    const result = await resolveToholampiKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "kuhmon vireillä olevat asemakaavat") {
    const result = await resolveKuhmoKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "suomussalmen vireillä olevat asemakaavat") {
    const result = await resolveSuomussalmiKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "kittilän vireillä olevat asemakaavat") {
    const result = await resolveKittilaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "kemijärven vireillä olevat asemakaavat") {
    const result = await resolveKemijarviKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "rautjärven vireillä olevat asemakaavat") {
    const result = await resolveRautjarviKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "alajärven vireillä olevat asemakaavat") {
    const result = await resolveAlajarviKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "alavuden vireillä olevat asemakaavat") {
    const result = await resolveAlavusKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "isonkyrön vireillä olevat asemakaavat") {
    const result = await resolveIsokyroKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "kuortaneen vireillä olevat asemakaavat") {
    const result = await resolveKuortaneKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "laihian vireillä olevat asemakaavat") {
    const result = await resolveLaihiaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "ähtärin vireillä olevat asemakaavat") {
    const result = await resolveAhtariKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "enonkosken vireillä olevat asemakaavat") {
    const result = await resolveEnonkoskiKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "heinäveden vireillä olevat asemakaavat") {
    const result = await resolveHeinavesiKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "hirvensalmen vireillä olevat asemakaavat") {
    const result = await resolveHirvensalmiKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "puumalan vireillä olevat asemakaavat") {
    const result = await resolvePuumalaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "sulkavan vireillä olevat asemakaavat") {
    const result = await resolveSulkavaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "hyrynsalmen vireillä olevat asemakaavat") {
    const result = await resolveHyrynsalmiKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "paltamon vireillä olevat asemakaavat") {
    const result = await resolvePaltamoKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "puolangan vireillä olevat asemakaavat") {
    const result = await resolvePuolankaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "hausjärven vireillä olevat asemakaavat") {
    const result = await resolveHausjarviKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "jokioisten vireillä olevat asemakaavat") {
    const result = await resolveJokioinenKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "vetelin vireillä olevat asemakaavat") {
    const result = await resolveVeteliKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "multian vireillä olevat asemakaavat") {
    const result = await resolveMultiaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "petäjäveden vireillä olevat asemakaavat") {
    const result = await resolvePetajavesiKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "pihtiputaan vireillä olevat asemakaavat") {
    const result = await resolvePihtipudasKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "toivakan vireillä olevat asemakaavat") {
    const result = await resolveToivakkaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "uuraisten vireillä olevat asemakaavat") {
    const result = await resolveUurainenKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "viitasaaren vireillä olevat asemakaavat") {
    const result = await resolveViitasaariKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "iitin vireillä olevat asemakaavat") {
    const result = await resolveIittiKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "miehikkälän vireillä olevat asemakaavat") {
    const result = await resolveMiehikkalaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "pyhtään vireillä olevat asemakaavat") {
    const result = await resolvePyhtaaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "virolahden vireillä olevat asemakaavat") {
    const result = await resolveVirolahtiKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "enontekiön vireillä olevat asemakaavat") {
    const result = await resolveEnontekioKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "inarin vireillä olevat asemakaavat") {
    const result = await resolveInariKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "keminmaan vireillä olevat asemakaavat") {
    const result = await resolveKeminmaaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "muonion vireillä olevat asemakaavat") {
    const result = await resolveMuonioKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "pelkosenniemen vireillä olevat asemakaavat") {
    const result = await resolvePelkosenniemiKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "ranuan vireillä olevat asemakaavat") {
    const result = await resolveRanuaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "simon vireillä olevat asemakaavat") {
    const result = await resolveSimoKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "sodankylän vireillä olevat asemakaavat") {
    const result = await resolveSodankylaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "pellon vireillä olevat asemakaavat") {
    const result = await resolvePelloKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "mustasaaren vireillä olevat asemakaavat") {
    const result = await resolveMustasaariKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "iisalmen vireillä olevat asemakaavat") {
    const result = await resolveIisalmiKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "naantalin vireillä olevat asemakaavat") {
    const result = await resolveNaantaliKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "liedon vireillä olevat asemakaavat") {
    const result = await resolveLietoKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "tornion kaavatori") {
    const result = await resolveTornioKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "riihimäen vireillä olevat asemakaavat") {
    const result = await resolveRiihimakiKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "raaseporin vireillä olevat asemakaavat") {
    const result = await resolveRaaseporiKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "raision vireillä olevat asemakaavat") {
    const result = await resolveRaisioKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "lempäälän vireillä olevat asemakaavat") {
    const result = await resolveLempaalaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "savonlinnan asemakaavakuulutukset") {
    const result = await resolveSavonlinnaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "kajaanin vireillä olevat asemakaavat") {
    const result = await resolveKajaaniKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "kangasalan vireillä olevat asemakaavat") {
    const result = await resolveKangasalaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "kuopion vireillä olevat kaavat") {
    const result = await resolveKuopioKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "hyvinkään vireillä olevat kaavat") {
    const result = await resolveHyvinkaaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "seinäjoen ajankohtaiset asemakaavat") {
    const result = await resolveSeinajokiKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "rovaniemen kaavatori") {
    const result = await resolveRovaniemiKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "mikkelin vireillä olevat kaavat") {
    const result = await resolveMikkeliKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "kotkan vireillä olevat asemakaavat") {
    const result = await resolveKotkaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "salon ajankohtaiset asemakaavat") {
    const result = await resolveSaloKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "porvoon asemakaavat") {
    const result = await resolvePorvooKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "kokkolan asemakaavatyöt") {
    const result = await resolveKokkolaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "kirkkonummen kaavoitus") {
    const result = await resolveKirkkonummiKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "keravan kaavahankkeet") {
    const result = await resolveKeravaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "tuusulan vireillä olevat kaavat") {
    const result = await resolveTuusulaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "nurmijärven ajankohtaiset asemakaavat") {
    const result = await resolveNurmijarviKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "sipoon vireillä olevat asemakaavat") {
    const result = await resolveSipooKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "järvenpään vireillä olevat asemakaavat") {
    const result = await resolveJarvenpaaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "lahden kaavatyökohteet") {
    const result = await resolveLahtiKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "porin vireillä olevat kaavat") {
    const result = await resolvePoriKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "oulun vireillä olevat kaavat") {
    const result = await resolveOuluKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "jyväskylän vireillä olevat kaavat") {
    const result = await resolveJyvaskylaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "hämeenlinnan vireillä olevat kaavat") {
    const result = await resolveHameenlinnaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "joensuun laadinnassa olevat kaavat") {
    const result = await resolveJoensuuKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "vaasan vireillä olevat asemakaavat") {
    const result = await resolveVaasaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "kouvolan ajankohtaiset asemakaavat") {
    const result = await resolveKouvolaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else if (sourceName === "lappeenrannan vireillä olevat asemakaavat") {
    const result = await resolveLappeenrantaKaavaProject({
      document,
      facts: facts ?? [],
    })

    results.push(result)
  } else {

  for (const [decisionIndex, decisionFacts] of grouped.entries()) {
    const metadata = decisionFacts[0]?.metadata ?? {}

    const permitNumber = metadata.permit_number ?? null
    const address = metadata.address ?? null
    const district = metadata.district ?? null
    const operation = metadata.operation ?? null
    const decisionMaker = metadata.decision_maker ?? null
    const municipality = metadata.municipality ?? "Espoo"

    const propertyFact = decisionFacts.find(
      (fact) => fact.fact_type === "property_id"
    )

    const propertyId = propertyFact?.fact_value ?? null

    const classification = classifyProject({
      operation,
      address,
      title: permitNumber ? `Rakennuslupa ${permitNumber}` : null,
    })

    const title = operation
      ? `${operation}: ${address ?? permitNumber ?? "rakennuslupa"}`
      : address
        ? `Rakennuslupa: ${address}`
        : permitNumber
          ? `Rakennuslupa: ${permitNumber}`
          : "Rakennuslupa"

    const description = [
      propertyId ? `Kiinteistötunnus: ${propertyId}` : null,
      district ? `Kaupunginosa: ${district}` : null,
      address ? `Osoite: ${address}` : null,
      operation ? `Toimenpide: ${operation}` : null,
      decisionMaker ? `Päätöksentekijä: ${decisionMaker}` : null,
      permitNumber ? `Lupatunnus: ${permitNumber}` : null,
    ]
      .filter(Boolean)
      .join("\n")

    const result = await resolvePotentialProject({
      title,
      municipality,
      address,
      propertyId,
      permitNumber,
      sourceName: decisionFacts[0]?.source_name ?? null,
      identifiers: [
        { type: "espoo_permit_number", value: permitNumber },
        { type: "property_id", value: propertyId },
      ],
      metadata: {
        source_document_id: documentId,
        decision_index: decisionIndex,
        district,
        operation,
        decision_maker: decisionMaker,
        description,
        fact_count: decisionFacts.length,
        resolver: "identityWorker",

        construction_type: classification.construction_type,
        building_type: classification.building_type,
        size_class: classification.size_class,
        business_value: classification.business_value,
        recommended_action: classification.recommended_action,
        classification_confidence: classification.confidence,
        classification_reasons: classification.reasons,
      },
    })

    results.push({
      decisionIndex,
      action: result.action,
      potentialProjectId: result.potentialProject.id,
      title: result.potentialProject.title,
      address: result.potentialProject.address,
      permitNumber: result.potentialProject.permit_number,
      operation,
      classification,
    })
  }}

  await supabaseAdmin
    .from("source_documents")
    .update({
      identity_resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", documentId)

  const candidatesCreated = results.filter(
    (result) => result.action === "created_new"
  ).length

  await supabaseAdmin.from("agent_runs").insert({
    agent_type: "identity_worker",
    source_id: document.source_id,
    source_name: document.source_name,
    status: "success",
    started_at: new Date(startedAt).toISOString(),
    finished_at: new Date().toISOString(),
    duration_ms: Date.now() - startedAt,
    candidates_created: candidatesCreated,
    payload: {
      documentId,
      decisionsResolved: results.length,
      candidatesCreated,
    },
  })

  return {
    ok: true,
    documentId,
    decisionsResolved: results.length,
    results,
  }
}