/*
 * Johanneksen pyynnosta 13.10.2026 yhdistetyt tuplat (Torppari-korjauksen
 * yhteydessa havaitut): Makasiinilaituri x3 ja Mt 180 Kurkela–Kuusisto.
 *
 * Sama logiikka kuin TIC:n vahvistusnapissa (duplicates/review):
 * jaava valitaan (tassa kasin, ks. alla), `moreAdvancedPhase` nostaa
 * vaiheen, toinen piilotetaan (is_public=false) ja pari kirjataan
 * `confirmed_duplicate`. Lisaksi jaavan TYHJAT kentat taytetaan
 * piilotettavista - mitaan olemassa olevaa ei korvata, ja nimi ei muutu
 * (piilotettavan nimi also_known_as-listaan, ks. title precedence).
 *
 *   npx tsx --env-file=.env.local scripts/yhdista-tuplat-13-10.ts             (kuivaharjoitus)
 *   npx tsx --env-file=.env.local scripts/yhdista-tuplat-13-10.ts --kirjoita
 */
import { createClient } from "@supabase/supabase-js"
import { moreAdvancedPhase } from "../lib/projects/duplicateSurvivor"
import { phaseOrder } from "../lib/projects/phases"
import { mergeCompanyNames } from "../lib/projects/projectCompanies"

const KIRJOITA = process.argv.includes("--kirjoita")

/*
 * Jaava valitaan kasin eika `chooseDuplicateSurvivor`illa: se valitsi
 * Makasiinilaiturille uutisotsikon "GRK voitti ... 16 milj.euroa", ja
 * yhdistaminen ei koskaan muuta nimea. Torpparin "Helsingin
 * Makasiinilaituri" on siisti nimi ja juuri tama urakka (GRK, 16 M€).
 *
 * `eiSiirreta`: hankesuunnitelma kattaa myos Pakkahuoneenlaiturin, joten
 * sen ala ja 31 M€ eivat kuulu pelkalle Makasiinilaiturille.
 *
 * `vainTaydennys`: aiemmin jo piilotetut tuplat, joilta otetaan vain
 * puuttuvat kentat (Kurkelan koordinaatit).
 */
type Ryhma = { jaa: string; piiloon: string[]; vainTaydennys?: string[]; eiSiirreta?: Record<string, string[]> }

const RYHMAT: Ryhma[] = [
  {
    jaa: "82374c31-5563-4ba5-8a33-5a30d9b9516a", // Helsingin Makasiinilaituri (Torppari)
    piiloon: [
      "bdbd99a9-7d72-4aa9-a135-4d956e6f7e4c", // GRK voitti (Rakennuslehti)
      "fedd3f4d-6e1f-4e2d-af2d-5e68633a8ed8", // hankesuunnitelma (paatokset.hel.fi)
    ],
    eiSiirreta: { "fedd3f4d-6e1f-4e2d-af2d-5e68633a8ed8": ["floor_area", "estimated_cost"] },
  },
  {
    /* Jaava valittiin jo aiemmissa vahvistuksissa (3 paria confirmed). */
    jaa: "9714c25f-2f00-46f7-ab93-873d0553c89f", // Vaylahanke Kurkela - Kuusisto
    piiloon: ["3de2e85f-20be-4538-a05b-dcab55e64ce2"], // Torppari
    vainTaydennys: ["764b7ec2-de35-409b-a6a5-d9ef427b7749", "4343060d-604a-4d2c-ba8c-500868f9837f"],
  },
]

const TAYTETTAVAT = [
  "developer",
  "builder",
  "location",
  "lat",
  "lng",
  "latitude",
  "longitude",
  "property_type",
  "floor_area",
  "estimated_cost",
  "estimated_completion",
  "construction_start",
  "additional_info",
] as const

const tyhja = (v: unknown) => v === null || v === undefined || v === ""

async function main() {
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  for (const ryhma of RYHMAT) {
    const idt = [ryhma.jaa, ...ryhma.piiloon, ...(ryhma.vainTaydennys ?? [])]
    const { data, error } = await s.from("projects").select("*").in("id", idt)
    if (error) throw error
    const hae = (id: string) => data!.find((p) => p.id === id)!
    const jaava = hae(ryhma.jaa)
    const piiloon = ryhma.piiloon.map(hae)
    const lahteet = [...piiloon, ...(ryhma.vainTaydennys ?? []).map(hae)]

    const { data: suosikit } = await s
      .from("user_project_favorites")
      .select("project_id")
      .in("project_id", piiloon.map((p) => p.id))
    if (suosikit?.length) {
      console.log(`OHITETTU, piilotettava on kayttajan omissa: ${JSON.stringify(suosikit)}`)
      continue
    }

    const muutos: Record<string, any> = {}
    /* Ensimmainen lahde, jolla kentta on, voittaa tyhjan kentan. */
    for (const h of lahteet) {
      const estetyt = ryhma.eiSiirreta?.[h.id] ?? []
      for (const k of TAYTETTAVAT) {
        if (estetyt.includes(k)) continue
        if (tyhja(jaava[k]) && tyhja(muutos[k]) && !tyhja(h[k])) muutos[k] = h[k]
      }
      const vaihe = moreAdvancedPhase(muutos.phase ?? jaava.phase, h.phase, phaseOrder)
      if (vaihe) muutos.phase = vaihe
    }

    const md = { ...(jaava.metadata ?? {}) }
    const aka = new Set<string>(md.also_known_as ?? [])
    for (const h of piiloon) {
      if (h.name !== jaava.name) aka.add(h.name)
      for (const a of h.metadata?.also_known_as ?? []) aka.add(a)
    }
    md.also_known_as = [...aka]
    /*
     * "Torppari" ja "Torppari Yhtiöt" ovat sama yritys, eika
     * `mergeCompanyNames` tunnista sita: ensimmaisen sanan osuma riittaa.
     */
    const ekaSana = (n: string) => n.toLowerCase().split(/\s+/)[0]
    const yritykset = [...(md.related_companies ?? [])]
    for (const h of piiloon)
      for (const n of h.metadata?.related_companies ?? [])
        if (!yritykset.some((x: string) => ekaSana(x) === ekaSana(n))) yritykset.push(n)
    md.related_companies = mergeCompanyNames(yritykset)
    const henkilot = [...(md.contact_persons ?? [])]
    for (const h of piiloon)
      for (const c of h.metadata?.contact_persons ?? [])
        if (!henkilot.some((x: any) => (x.name ?? "").toLowerCase() === (c.name ?? "").toLowerCase()))
          henkilot.push(c)
    md.contact_persons = henkilot
    md.merged_from = [...(md.merged_from ?? []), ...piiloon.map((h) => ({ id: h.id, source_url: h.metadata?.source_url ?? null, merged_at: new Date().toISOString() }))]

    console.log(`\nJAA   ${jaava.id.slice(0, 8)} ${jaava.name}`)
    for (const h of piiloon) console.log(`PIILO ${h.id.slice(0, 8)} ${h.name}`)
    console.log(`   kentat: ${JSON.stringify({ ...muutos, additional_info: muutos.additional_info ? `(${muutos.additional_info.length} merkkia)` : undefined })}`)
    console.log(`   also_known_as +${md.also_known_as.length - (jaava.metadata?.also_known_as ?? []).length}, liittyvat ${JSON.stringify(md.related_companies)}, henkiloita ${(jaava.metadata?.contact_persons ?? []).length} -> ${henkilot.length}`)

    if (!KIRJOITA) continue

    const { error: e1 } = await s.from("projects").update({ ...muutos, metadata: md }).eq("id", jaava.id)
    if (e1) throw e1
    const { error: e2 } = await s.from("projects").update({ is_public: false }).in("id", piiloon.map((p) => p.id))
    if (e2) throw e2
    for (const h of piiloon) {
      const [a, b] = [jaava.id, h.id].sort()
      const { data: on } = await s
        .from("project_duplicate_candidates")
        .select("id")
        .eq("project_id_a", a)
        .eq("project_id_b", b)
        .maybeSingle()
      const rivi = { status: "confirmed_duplicate", reviewed_at: new Date().toISOString() }
      const { error: e3 } = on
        ? await s.from("project_duplicate_candidates").update(rivi).eq("id", on.id)
        : await s.from("project_duplicate_candidates").insert({ project_id_a: a, project_id_b: b, confidence: 100, reasons: ["manual"], ...rivi })
      if (e3) throw e3
    }
  }

  console.log(KIRJOITA ? "\nKirjoitettu." : "\nKuivaharjoitus. Kirjoita: --kirjoita")
}

main()
