import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * PIETARSAAREN KESKUSTAN KAKSI KAAVAA.
 *
 * Sivulla on kaksi eri kaavaa samalla otsikolla "Asemakaavan muutos
 * Keskustassa": kirkon kortteli 15 ja Maria Malmin kortteli. Ne
 * kirjoittuivat samaan tunnisteeseen, joten kirkon kortteli katosi
 * kokonaan — vaikka juuri sen luonnos oli nähtävillä keväällä 2026.
 *
 * Kerääjä erottaa ne nyt kahdesti: tunniste kuvauksen tiivisteellä ja
 * nimi kaupungin oman asiakirjan nimellä. Pelkkä tunniste ei riittänyt,
 * koska ehdokkaiden yhdistäminen putoaa viimeisenä keinona osoitteen ja
 * kunnan vertailuun, ja "osoite" on tässä lähteessä kaavan nimi.
 *
 * Tämä skripti korjaa jo tallessa olevan tiedon vastaamaan sitä:
 * olemassa oleva hanke on Maria Malm, ja se nimetään sen mukaan. Kirkon
 * kortteli tulee jonoon uutena ehdokkaana.
 *
 * Kertaluontoinen, ja jatkoa skriptille fix-pietarsaari-keskusta-slug.ts
 * joka siirsi tallessa olevan hankkeen tunnisteen. Se ei yksin riittanyt,
 * koska nimet olivat yha samat.
 *
 * Kuivaharjoitus oletuksena; kirjoittaa vasta --apply.
 */

const APPLY = process.argv.includes("--apply")
const SRC = "pietarsaari-vireilla-olevat-asemakaavat"
const MARIA_MALM = /maria malm/i
const EHDOKAS = "34ce0364-672f-4142-8657-36eea684f938"
const HANKE = "e86d60d3-b18d-43cc-b576-3c4deb5350a6"

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  console.log(APPLY ? "AJO\n" : "KUIVAHARJOITUS\n")

  /* 1. Kerää sivu uudelleen, jotta dokumenteilla on erotellut nimet. */
  if (APPLY) {
    const { runSourceWorker } = await import("../lib/agent/workers/sourceWorker")
    const r: any = await runSourceWorker(SRC)
    console.log(`kerays: ${JSON.stringify(r?.result ?? r)}`)
  }

  const { data: docs, error: dErr } = await admin
    .from("source_documents")
    .select("id,title,document_url,raw_payload,facts_extracted_at,identity_resolved_at")
    .eq("source_id", SRC)
    .ilike("title", "%Keskustassa%")
  if (dErr) throw dErr

  /* Erotellun tunnisteen tunnistaa kahdeksan merkin tiivisteesta lopussa. */
  const EROTELTU = /-[0-9a-f]{8}$/
  const eroteltu = (docs ?? []).filter((d: any) => EROTELTU.test(String(d.raw_payload?.slug ?? "")))
  const kirkko = eroteltu.find((d: any) => !MARIA_MALM.test(String(d.raw_payload?.description ?? "")))
  const malm = eroteltu.find((d: any) => MARIA_MALM.test(String(d.raw_payload?.description ?? "")))

  console.log("\nDOKUMENTIT:")
  for (const d of docs ?? []) console.log(`  ${String((d as any).raw_payload?.slug).padEnd(42)} ${(d as any).title}`)

  if (!kirkko || !malm) { console.log("\nMolempia kaavoja ei loytynyt eroteltuina — keskeytetaan."); return }

  const malmNimi = String((malm as any).title)
  console.log(`\n  kirkko -> ${(kirkko as any).title}`)
  console.log(`  malm   -> ${malmNimi}`)

  /* 2. Vaara tunnisterivi: kirkon slug osoittaa Maria Malmin ehdokkaaseen. */
  const { data: tunnukset } = await admin
    .from("project_identifiers")
    .select("id,identifier_value,project_id,potential_project_id")
    .eq("identifier_type", "pietarsaari_kaava_slug")
    .ilike("identifier_value", "%keskustassa%")

  console.log("\nTUNNISTEET:")
  for (const t of tunnukset ?? []) console.log(`  ${String((t as any).identifier_value).padEnd(42)} hanke=${(t as any).project_id ?? "-"} ehdokas=${(t as any).potential_project_id ?? "-"}`)

  const vaara = (tunnukset ?? []).find((t: any) => t.identifier_value === (kirkko as any).raw_payload?.slug)
  if (vaara) console.log(`  POISTETAAN vaara rivi ${(vaara as any).identifier_value} -> ehdokas ${(vaara as any).potential_project_id}`)

  if (!APPLY) {
    /*
     * Kuivaharjoituksessa dokumenteilla on viela vanhat nimet, koska
     * uudelleenkerays kirjoittaisi. Lasketaan nimet sivulta samalla
     * logiikalla, jotta lopputulos on nahtavissa etukateen.
     */
    const cheerio: any = await import("cheerio")
    const { pietarsaariKaavaDescription } = await import("../lib/agent/pietarsaariKaavaDescription")
    const { pietarsaariKaavaTitles } = await import("../lib/agent/pietarsaariKaavaSlug")
    const url = "https://pietarsaari.fi/asuminen-ja-ymparisto/tekniset-palvelut/kaavoitus/vireilla-olevat-asemakaavahankkeet"
    const $ = cheerio.load(await (await fetch(url, { cache: "no-store" })).text())
    const lohkot: any[] = []
    let nyk: any = null
    for (const el of $("div.page-content").first().children().toArray()) {
      if ((el as any).name === "h2") {
        const t = $(el).text().replace(/\s+/g, " ").trim()
        if (t.toLowerCase() === "katso myös nämä") break
        nyk = { title: t, nodes: [] as any[] }
        lohkot.push(nyk)
        continue
      }
      if (nyk) nyk.nodes.push(el)
    }
    const nimet = pietarsaariKaavaTitles(
      lohkot.map((l: any) => ({
        title: l.title,
        description: pietarsaariKaavaDescription(
          l.nodes.map((n: any) => ({ tag: String(n.name ?? ""), text: $(n).text().replace(/\s+/g, " ").trim() }))
        ),
        documents: l.nodes.flatMap((n: any) =>
          $(n)
            .find("a")
            .toArray()
            .map((a: any) => String($(a).attr("href") ?? ""))
            .filter((h: string) => /\.pdf(\?|#|$)/i.test(h))
        ),
      }))
    )
    console.log("\nNIMET JOTKA KERAYS KIRJOITTAA:")
    lohkot.forEach((l: any, i: number) => {
      if (nimet[i] !== l.title) console.log(`  ${nimet[i]}`)
    })
    console.log("\nKuivaharjoitus: mitaan ei kirjoitettu.")
    return
  }

  if (vaara) {
    const e = await admin.from("project_identifiers").delete().eq("id", (vaara as any).id)
    console.log(e.error ? `  tunnus VIRHE: ${e.error.message}` : "  vaara tunnus poistettu")
  }

  /* 3. Palauta Maria Malmin ehdokas ja hanke omaksi itsekseen. */
  const malmUrl = String((malm as any).document_url)
  const malmKuvaus = String((malm as any).raw_payload?.description ?? "")

  const { data: pp } = await admin.from("potential_projects").select("id,metadata").eq("id", EHDOKAS).maybeSingle()
  if (pp) {
    const md: any = { ...((pp as any).metadata ?? {}), slug: (malm as any).raw_payload?.slug, source_url: malmUrl, documents_url: malmUrl, description: malmKuvaus, operation: malmNimi }
    const e = await admin.from("potential_projects").update({ title: malmNimi, address: malmNimi, metadata: md }).eq("id", EHDOKAS)
    console.log(e.error ? `  ehdokas VIRHE: ${e.error.message}` : "  ehdokas palautettu Maria Malmiksi")
  }

  const { data: hanke } = await admin.from("projects").select("id,name,metadata").eq("id", HANKE).maybeSingle()
  if (hanke) {
    const md: any = { ...((hanke as any).metadata ?? {}), slug: (malm as any).raw_payload?.slug, source_url: malmUrl, documents_url: malmUrl, description: malmKuvaus, operation: malmNimi, project_address: malmNimi }
    const e = await admin.from("projects").update({ name: malmNimi, location: `${malmNimi}, Pietarsaari`, additional_info: malmKuvaus, metadata: md }).eq("id", HANKE)
    console.log(e.error ? `  hanke VIRHE: ${e.error.message}` : `  hanke nimetty: ${malmNimi}`)
  }

  /* 4. Aja molemmat dokumentit putken lapi uudelleen. */
  const r = await admin.from("source_documents").update({ facts_extracted_at: null, identity_resolved_at: null }).in("id", [(kirkko as any).id, (malm as any).id])
  console.log(r.error ? `  nollaus VIRHE: ${r.error.message}` : "  faktaliput nollattu")

  const { runDiscoveryPipeline } = await import("../lib/agent/pipeline/discoveryPipeline")
  for (let k = 1; k <= 5; k++) {
    const { count } = await admin.from("source_documents").select("id", { count: "exact", head: true }).eq("source_id", SRC).is("facts_extracted_at", null)
    if (!count) { console.log(`  putki ajettu (${k - 1} kierrosta)`); break }
    await runDiscoveryPipeline({ stages: ["facts"], maxFactJobs: 25, maxIdentityCatchUpJobs: 25 })
  }

  const { data: lopuksi } = await admin.from("potential_projects").select("id,title,status,metadata").ilike("title", "%Keskustassa%")
  console.log("\nLOPPUTILA:")
  for (const x of lopuksi ?? []) {
    if (!String((x as any).metadata?.source_name ?? "").includes("Pietarsaaren")) continue
    console.log(`  ${String((x as any).status).padEnd(9)} ${String((x as any).metadata?.slug).padEnd(42)} ${(x as any).title}`)
  }
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
export {}
