import { createClient } from "@supabase/supabase-js"
import { resolveFacts } from "@/lib/agent/facts/resolveFacts"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function runFactWorker(documentId?: string) {
  const startedAt = Date.now()

  let document: any = null

  if (documentId) {
    const { data, error } = await supabaseAdmin
      .from("source_documents")
      .select("*")
      .eq("id", documentId)
      .maybeSingle()

    if (error) throw error
    document = data
  } else {
    const { data: documents, error: documentError } = await supabaseAdmin
      .from("source_documents")
      .select("*")
      .is("facts_extracted_at", null)
      .order("created_at", { ascending: false })
      .limit(100)

    if (documentError) throw documentError

    const JSON_ONLY_SOURCES = [
      "Hilma",
      "Lupapiste kuulutukset",
      "Vantaan vireillä olevat kaavat",
      "Helsingin vireillä olevat kaavat",
      "Tampereen vireillä olevat kaavat",
      "Turun vireillä olevat kaavat",
      "Kreate hankkeet",
      "Väylävirasto hankkeet",
      "Senaatti-kiinteistöt hankkeet",
      "Puolustuskiinteistöt uutiset",
      "Espoon ajankohtaiset asemakaavat",
      "Lohjan ajankohtaiset kaavat",
      "Rauman vireillä olevat asemakaavat",
      "Kaarinan vireillä olevat asemakaavat",
      "Nokian vireillä olevat asemakaavat",
      "Kajaanin vireillä olevat asemakaavat",
      "Savonlinnan asemakaavakuulutukset",
      "Kangasalan vireillä olevat asemakaavat",
      "Ylöjärven vireillä olevat asemakaavat",
      "Vihdin vireillä olevat asemakaavat",
      "Riihimäen vireillä olevat asemakaavat",
      "Raaseporin vireillä olevat asemakaavat",
      "Raision vireillä olevat asemakaavat",
      "Lempäälän vireillä olevat asemakaavat",
      "Imatran vireillä olevat asemakaavat",
      "Raahen vireillä olevat asemakaavat",
      "Sastamalan vireillä ja nähtävillä olevat kaavat",
      "Hollolan aktiiviset kaavat",
      "Pirkkalan vireillä olevat asemakaavat",
      "Siilinjärven vireillä olevat kaavat",
      "Mäntsälän vireillä olevat asemakaavat",
      "Tornion kaavatori",
      "Liedon vireillä olevat asemakaavat",
      "Naantalin vireillä olevat asemakaavat",
      "Iisalmen vireillä olevat asemakaavat",
      "Mustasaaren vireillä olevat asemakaavat",
      "Kempeleen vireillä olevat asemakaavat",
      "Valkeakosken vireillä olevat asemakaavat",
      "Pietarsaaren vireillä olevat asemakaavat",
      "Kurikan vireillä olevat asemakaavat",
      "Varkauden vireillä olevat asemakaavat",
      "Kemin vireillä olevat asemakaavat",
      "Haminan vireillä olevat asemakaavat",
      "Jämsän vireillä olevat asemakaavat",
      "Laukaan vireillä olevat asemakaavat",
      "Heinolan vireillä olevat asemakaavat",
      "Äänekosken vireillä olevat asemakaavat",
      "Pieksämäen vireillä olevat asemakaavat",
      "Akaan vireillä olevat asemakaavat",
      "Forssan vireillä olevat asemakaavat",
      "Janakkalan vireillä olevat asemakaavat",
      "Orimattilan vireillä olevat asemakaavat",
      "Ylivieskan vireillä olevat asemakaavat",
      "Loimaan vireillä olevat asemakaavat",
      "Kontiolahden vireillä olevat asemakaavat",
      "Kauhavan vireillä olevat asemakaavat",
      "Lapuan vireillä olevat asemakaavat",
      "Kauhajoen vireillä olevat asemakaavat",
      "Ilmajoen vireillä olevat asemakaavat",
      "Uudenkaupungin vireillä olevat asemakaavat",
      "Paimion vireillä olevat asemakaavat",
      "Ulvilan vireillä olevat asemakaavat",
      "Kankaanpään vireillä olevat asemakaavat",
      "Liperin vireillä olevat asemakaavat",
      "Lieksan vireillä olevat asemakaavat",
      "Kiteen vireillä olevat asemakaavat",
      "Kalajoen vireillä olevat asemakaavat",
      "Nivalan vireillä olevat asemakaavat",
      "Limingan vireillä olevat asemakaavat",
      "Muuramen vireillä olevat asemakaavat",
      "Saarijärven vireillä olevat asemakaavat",
      "Keuruun vireillä olevat asemakaavat",
      "Loviisan vireillä olevat asemakaavat",
      "Kuusamon vireillä olevat asemakaavat",
      "Kauniaisten vireillä olevat asemakaavat",
      "Paraisten vireillä olevat asemakaavat",
      "Someron vireillä olevat asemakaavat",
      "Huittisten vireillä olevat asemakaavat",
      "Kokemäen vireillä olevat asemakaavat",
      "Urjalan vireillä olevat asemakaavat",
      "Punkalaitumen vireillä olevat asemakaavat",
      "Lopen vireillä olevat asemakaavat",
      "Hattulan vireillä olevat asemakaavat",
      "Savitaipaleen vireillä olevat asemakaavat",
      "Juvan vireillä olevat asemakaavat",
      "Lapinlahden vireillä olevat asemakaavat",
      "Kannuksen vireillä olevat asemakaavat",
      "Toholammin vireillä olevat asemakaavat",
      "Kuhmon vireillä olevat asemakaavat",
      "Suomussalmen vireillä olevat asemakaavat",
      "Kittilän vireillä olevat asemakaavat",
      "Kemijärven vireillä olevat asemakaavat",
      "Rautjärven vireillä olevat asemakaavat",
      "Alajärven vireillä olevat asemakaavat",
      "Alavuden vireillä olevat asemakaavat",
      "Isonkyrön vireillä olevat asemakaavat",
      "Kuortaneen vireillä olevat asemakaavat",
      "Laihian vireillä olevat asemakaavat",
      "Ähtärin vireillä olevat asemakaavat",
      "Enonkosken vireillä olevat asemakaavat",
      "Heinäveden vireillä olevat asemakaavat",
      "Hirvensalmen vireillä olevat asemakaavat",
      "Puumalan vireillä olevat asemakaavat",
      "Sulkavan vireillä olevat asemakaavat",
      "Hyrynsalmen vireillä olevat asemakaavat",
      "Paltamon vireillä olevat asemakaavat",
      "Puolangan vireillä olevat asemakaavat",
      "Hausjärven vireillä olevat asemakaavat",
      "Jokioisten vireillä olevat asemakaavat",
      "Vetelin vireillä olevat asemakaavat",
      "Multian vireillä olevat asemakaavat",
      "Petäjäveden vireillä olevat asemakaavat",
      "Pihtiputaan vireillä olevat asemakaavat",
      "Toivakan vireillä olevat asemakaavat",
      "Uuraisten vireillä olevat asemakaavat",
      "Viitasaaren vireillä olevat asemakaavat",
      "Iitin vireillä olevat asemakaavat",
      "Miehikkälän vireillä olevat asemakaavat",
      "Pyhtään vireillä olevat asemakaavat",
      "Pornaisten vireillä olevat kaavat",
      "Hangon ajankohtaiset kaavat",
      "Inkoon ajankohtainen kaavoitus",
      "Karkkilan vireillä olevat kaavahankkeet",
      "Siuntion vireillä olevat asemakaavat",
      "Euran kaavoitus ja maapolitiikka",
      "Siikaisten kaavoitus",
      "Joutsan kaavoitus",
      "Pielaveden kaavoitus",
      "Kiuruveden kaavoitus",
      "Auran kaavoitus",
      "Vehmaan kaavoitus",
      "Laitilan kaavoitus",
      "Kustavin kaavoitus",
      "Sievin kaavoitus",
      "Vaalan kaavoitus",
      "Siikajoen kaavoitus",
      "Siikalatvan kaavoitus",
      "Iin kaavoitus",
      "Alavieskan kaavoitus",
      "Hailuodon kaavoitus",
      "Oulaisten kaavoitus",
      "Taivalkosken kaavoitus",
      "Pöytyän kaavoitus",
      "Maskun kaavoitus",
      "Virolahden vireillä olevat asemakaavat",
      "Enontekiön vireillä olevat asemakaavat",
      "Inarin vireillä olevat asemakaavat",
      "Keminmaan vireillä olevat asemakaavat",
      "Muonion vireillä olevat asemakaavat",
      "Pelkosenniemen vireillä olevat asemakaavat",
      "Ranuan vireillä olevat asemakaavat",
      "Simon vireillä olevat asemakaavat",
      "Sodankylän vireillä olevat asemakaavat",
      "Pellon vireillä olevat asemakaavat",
      "Ylitornion vireillä olevat asemakaavat",
      "Hämeenkyrön vireillä olevat asemakaavat",
      "Ikaalisten vireillä olevat asemakaavat",
      "Mänttä-Vilppulan vireillä olevat asemakaavat",
      "Oriveden vireillä olevat asemakaavat",
      "Pälkäneen vireillä olevat asemakaavat",
      "Vesilahden vireillä olevat asemakaavat",
      "Kaskisten vireillä olevat asemakaavat",
      "Ruoveden vireillä olevat kaavat",
      "Virtain vireillä olevat kaavat",
      "Äänekosken vireillä olevat asemakaavat",
      "Kuopion vireillä olevat kaavat",
      "Hyvinkään vireillä olevat kaavat",
      "Seinäjoen ajankohtaiset asemakaavat",
      "Rovaniemen Kaavatori",
      "Mikkelin vireillä olevat kaavat",
      "Kotkan vireillä olevat asemakaavat",
      "Salon ajankohtaiset asemakaavat",
      "Porvoon asemakaavat",
      "Kokkolan asemakaavatyöt",
      "Kirkkonummen kaavoitus",
      "Keravan kaavahankkeet",
      "Tuusulan vireillä olevat kaavat",
      "Nurmijärven ajankohtaiset asemakaavat",
      "Sipoon vireillä olevat asemakaavat",
      "Järvenpään vireillä olevat asemakaavat",
      "Lahden kaavatyökohteet",
      "Porin vireillä olevat kaavat",
      "Oulun vireillä olevat kaavat",
      "Jyväskylän vireillä olevat kaavat",
      "Hämeenlinnan vireillä olevat kaavat",
      "Joensuun laadinnassa olevat kaavat",
      "Vaasan vireillä olevat asemakaavat",
      "Kouvolan ajankohtaiset asemakaavat",
      "Lappeenrannan vireillä olevat asemakaavat",
    ]

    document =
      (documents ?? []).find((d) =>
        JSON_ONLY_SOURCES.includes(d.source_name)
          ? !!(d.raw_payload?.original || d.raw_text)
          : !!d.extracted_text
      ) ?? null
  }

  if (!document) {
    return {
      ok: true,
      message: "No documents waiting for fact extraction",
    }
  }

  const { data: run, error: runError } = await supabaseAdmin
    .from("agent_runs")
    .insert({
      agent_type: "fact_worker",
      source_id: document.source_id,
      source_name: document.source_name,
      status: "started",
      started_at: new Date().toISOString(),
      payload: {
        documentId: document.id,
        documentUrl: document.document_url,
      },
    })
    .select()
    .single()

  if (runError) throw runError

  try {
    await supabaseAdmin
      .from("project_facts")
      .delete()
      .eq("document_id", document.id)

    const { decisions, facts } = resolveFacts(document)

    console.log("Decision count:", decisions.length)

    let savedCount = 0

    for (const fact of facts) {
      const { error } = await supabaseAdmin.from("project_facts").insert({
        document_id: document.id,
        fact_type: fact.fact_type,
        fact_key: fact.fact_key ?? null,
        fact_value: fact.fact_value ?? null,
        fact_number: fact.fact_number ?? null,
        fact_date: fact.fact_date ?? null,
        confidence: fact.confidence,
        source_name: document.source_name,
        metadata: fact.metadata ?? {},
      })

      if (error) throw error
      savedCount += 1
    }

    const durationMs = Date.now() - startedAt

    await supabaseAdmin
      .from("source_documents")
      .update({
        facts_extracted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", document.id)

    await supabaseAdmin
      .from("agent_runs")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        duration_ms: durationMs,
        entities_found: savedCount,
        payload: {
          documentId: document.id,
          decisionsFound: decisions.length,
          factsFound: facts.length,
          factsSaved: savedCount,
        },
      })
      .eq("id", run.id)

    return {
      ok: true,
      runId: run.id,
      documentId: document.id,
      decisionsFound: decisions.length,
      factsFound: facts.length,
      factsSaved: savedCount,
      durationMs,
    }
  } catch (error: any) {
    const durationMs = Date.now() - startedAt

    await supabaseAdmin
      .from("agent_runs")
      .update({
        status: "error",
        finished_at: new Date().toISOString(),
        duration_ms: durationMs,
        error_message: error.message,
      })
      .eq("id", run.id)

    return {
      ok: false,
      runId: run.id,
      documentId: document.id,
      error: error.message,
      durationMs,
    }
  }
}