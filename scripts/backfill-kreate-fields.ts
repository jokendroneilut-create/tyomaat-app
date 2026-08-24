import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * KREATEN KUVAUKSET, OSOITTEET JA VALMISTUMISAJAT TAKAUTUVASTI.
 *
 * Sisalto on ollut kannassa koko ajan (raw_payload.original), mutta
 * resolveri ei lukenut sita. Fact-tyolainen kasittelee dokumentin vain
 * kerran, joten korjattu putki ei paivita vanhoja - siksi tama ajo.
 *
 * EI LYHENNA EIKA YLIKIRJOITA:
 *   - additional_info paivitetaan vain jos se on tyhja tai pelkka otsikko
 *   - location, estimated_completion vain jos ne puuttuvat
 *   - metadata-kentat vain jos niita ei ole
 *
 * Aja ensin ilman --apply-lippua.
 */

const APPLY = process.argv.includes("--apply")

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { parseKreateFields, parseKreateDescription } = await import("../lib/agent/kreateProject")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const docs: any[] = []
  for (let f = 0; ; f += 1000) {
    const { data, error } = await supabase
      .from("source_documents")
      .select("id,title,document_url,raw_payload")
      .ilike("source_name", "%kreate%")
      .range(f, f + 999)
    if (error) throw error
    docs.push(...(data ?? [])); if (!data || data.length < 1000) break
  }

  const perUrl = new Map<string, any>()
  for (const d of docs) {
    const html = d.raw_payload?.original?.content?.rendered ?? ""
    if (!html) continue
    const kentat = parseKreateFields(html)
    const kuvaus = parseKreateDescription(html, d.title)
    if (!kuvaus && !kentat.estimatedCompletion && !kentat.address) continue
    perUrl.set(String(d.document_url), { ...kentat, kuvaus, otsikko: d.title })
  }

  console.log(APPLY ? "=== AJETAAN ===" : "=== KUIVAHARJOITUS (ei kirjoiteta) ===")
  console.log(`Kreate-dokumentteja: ${docs.length}, poimintoja: ${perUrl.size}\n`)

  const lataa = async (t: string) => {
    const r: any[] = []
    for (let f = 0; ; f += 1000) {
      const { data, error } = await supabase.from(t).select("*").range(f, f + 999)
      if (error) throw error
      r.push(...(data ?? [])); if (!data || data.length < 1000) break
    }
    return r
  }

  for (const taulu of ["potential_projects", "projects"] as const) {
    const nimiSarake = taulu === "projects" ? "name" : "title"
    const rivit = (await lataa(taulu)).filter((p: any) => perUrl.has(String(p.metadata?.source_url ?? "")))

    const paivitykset: any[] = []
    const naytteet: string[] = []
    let kuvauksia = 0, paivia = 0, osoitteita = 0, johtajia = 0

    for (const p of rivit) {
      const k = perUrl.get(String(p.metadata.source_url))
      const meta: any = p.metadata ?? {}
      const metaLisays: Record<string, any> = {}
      const rivi: Record<string, any> = {}

      if (k.kuvaus && !meta.description) { metaLisays.description = k.kuvaus; kuvauksia++ }
      if (k.address && !meta.project_address) { metaLisays.project_address = k.address; osoitteita++ }
      if (k.estimatedCompletion && !meta.estimated_completion) {
        metaLisays.estimated_completion = k.estimatedCompletion
        metaLisays.completion_text = k.completionText
        paivia++
      }
      if (k.projectManager && !meta.project_manager) metaLisays.project_manager = k.projectManager

      /*
       * Projektinjohtaja yhteyshenkiloksi jos han ei ole jo listalla.
       * VAIN LISAYS: yhteystietokentasta ei koskaan poisteta mitaan.
       * Mitattu: 30 tapauksessa 32:sta han on jo mukana henkilostoosion
       * kautta sahkoposteineen, joten tama koskee kaytannossa yhta
       * hanketta.
       */
      if (k.projectManager) {
        const nykyiset: any[] = Array.isArray(meta.contact_persons) ? meta.contact_persons : []
        const onJo = nykyiset.some(
          (c: any) => String(c?.name ?? "").toLowerCase() === String(k.projectManager).toLowerCase()
        )
        if (!onJo) {
          metaLisays.contact_persons = [
            ...nykyiset,
            { name: k.projectManager, title: "Projektinjohtaja", phone: null, email: null },
          ]
          johtajia++
        }
      }

      if (taulu === "projects") {
        /*
         * additional_info on asiakkaalle nakyva teksti. Paivitetaan vain
         * jos se on tyhja tai pelkka otsikko - kasin taydennettya tai
         * toisesta lahteesta tullutta ei ylikirjoiteta.
         */
        const nyt = String(p.additional_info ?? "").trim()
        const onPelkkaOtsikko = !nyt || nyt === String(p.name ?? "").trim() || nyt === String(k.otsikko ?? "").trim()
        if (k.kuvaus && onPelkkaOtsikko && k.kuvaus.length > nyt.length) rivi.additional_info = k.kuvaus

        if (k.address && !String(p.location ?? "").trim()) rivi.location = k.address
        if (k.estimatedCompletion && !p.estimated_completion) rivi.estimated_completion = k.estimatedCompletion
      }

      if (!Object.keys(metaLisays).length && !Object.keys(rivi).length) continue

      if (naytteet.length < 10) {
        const osat = [
          rivi.additional_info ? `kuvaus ${nyt(p)}->${rivi.additional_info.length}` : (metaLisays.description ? `kuvaus ${metaLisays.description.length}` : ""),
          metaLisays.estimated_completion ? `valmistuu ${metaLisays.estimated_completion}` : "",
          metaLisays.project_address ? `osoite "${String(metaLisays.project_address).slice(0, 24)}"` : "",
        ].filter(Boolean).join(" | ")
        naytteet.push(`  ${String(p[nimiSarake]).slice(0, 34).padEnd(36)} ${osat}`)
      }

      paivitykset.push({ id: p.id, metaLisays, rivi })
    }

    /*
     * MENNYT VALMISTUMISPAIVA EI OLE VIRHE VAAN SEURAUS: nama hankkeet
     * ovat oikeasti valmiita (Kimolan kanava 2019, Sappi 2022). Yollinen
     * auto-complete-ajo siirtaa ne "Valmistunut"-vaiheeseen, mika on
     * oikein - mutta se on kerrottava etukateen eika loydettava jalkeen.
     */
    const tanaan = new Date().toISOString().slice(0, 10)
    const menneet = paivitykset.filter((u) => u.metaLisays.estimated_completion && u.metaLisays.estimated_completion < tanaan)

    console.log(`=== ${taulu} ===`)
    console.log(`  osuvia rivja:   ${rivit.length}`)
    console.log(`  MENNYT valmistumispaiva: ${menneet.length}  (auto-complete siirtaa nama valmistuneiksi)`)
    console.log(`  paivitettavia:  ${paivitykset.length}   (kuvaus ${kuvauksia}, valmistumisaika ${paivia}, osoite ${osoitteita}, projektinjohtaja ${johtajia})`)
    for (const n of naytteet) console.log(n)
    console.log()

    if (!APPLY) continue

    let n = 0
    for (const u of paivitykset) {
      const { data: nykyinen } = await supabase.from(taulu).select("metadata").eq("id", u.id).maybeSingle()
      const meta: any = nykyinen?.metadata ?? {}
      await supabase.from(taulu).update({ ...u.rivi, metadata: { ...meta, ...u.metaLisays } }).eq("id", u.id)
      n++
    }
    console.log(`  kirjoitettu: ${n}\n`)
  }
}

function nyt(p: any) { return String(p.additional_info ?? "").trim().length }

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
