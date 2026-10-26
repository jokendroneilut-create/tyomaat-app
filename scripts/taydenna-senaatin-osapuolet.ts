import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * SENAATIN TEKIJAT KANTAAN JA JONOON (D-355).
 *
 * Johannes 27.10.2026: *"miksi tasta lahteesta ei ole poimittu kaikkia
 * hankkeeseen liittyvia yrityksia jotka on annettu? Sama toistuu
 * lahteen muissakin hankkeissa. Korjataan kantaan ja jatkossa."* ja
 * *"myos jonossa on hankkeita joista noita puuttuu."*
 *
 * EI YHTAAN VERKKOHAKUA: sivun koko sisalto on tallessa omassa
 * datassamme (`source_documents.raw_payload.original.content.rendered`),
 * joten tama lukee sen eika kuormita Senaattia eika kantaa turhalla
 * haulla ([[supabase-outage-history]]).
 *
 * VAIN TYHJA KENTTA TAYTETAAN. Olemassa oleva arvo voi olla kasin
 * kirjattu tai tarkempi ([[manual-parties-linkedin]]); ristiriidat
 * tulostetaan luettavaksi eika niita korvata.
 *
 *   npx tsx scripts/taydenna-senaatin-osapuolet.ts
 *   npx tsx scripts/taydenna-senaatin-osapuolet.ts --apply
 */

import { looksLikeCompany } from "../lib/agent/companyName"
import { mergeCompanyNames } from "../lib/projects/projectCompanies"
import { senaatinOsapuolet, senaatinTekijat } from "../lib/agent/senaattiTekijat"

const KENTAT = [
  "builder",
  "developer",
  "architectural_design",
  "structural_design",
  "hvac_design",
  "electrical_design",
  "geotechnical_design",
] as const

function normalisoi(teksti: string): string {
  return String(teksti ?? "")
    .toLowerCase()
    .replace(/[^\wåäö]+/g, " ")
    .trim()
}

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  /* --- Osapuolet lahdedokumenteista, osoite avaimena --- */
  const dokit: any[] = []
  for (let a = 0; ; a += 500) {
    const { data, error } = await db
      .from("source_documents")
      .select("document_url,title,raw_payload")
      .ilike("document_url", "%senaatti.fi/hankkeet/%")
      .range(a, a + 499)
    if (error) {
      console.error(`VIRHE: ${error.message}`)
      process.exit(1)
    }
    dokit.push(...(data ?? []))
    if ((data ?? []).length < 500) break
  }

  const osapuolet = new Map<string, ReturnType<typeof senaatinOsapuolet> & { otsikko: string }>()
  for (const d of dokit) {
    const tekijat = senaatinTekijat(d.raw_payload?.original?.content?.rendered ?? "")
    if (!tekijat.length) continue
    osapuolet.set(d.document_url, {
      ...senaatinOsapuolet(tekijat, looksLikeCompany),
      otsikko: String(d.title ?? ""),
    })
  }
  console.log(`Senaatin dokumentteja ${dokit.length}, tekijälohko ${osapuolet.size}\n`)

  /* --- Rivit: osoitteella, muuten otsikolla --- */
  let kirjoitettu = 0
  const ristiriidat: string[] = []
  const korvatut: string[] = []

  for (const taulu of ["projects", "potential_projects"] as const) {
    const rivit: any[] = []
    for (let a = 0; ; a += 1000) {
      const { data, error } = await db
        .from(taulu)
        .select(
          taulu === "projects"
            ? "id,name,builder,developer,architectural_design,structural_design,hvac_design,electrical_design,geotechnical_design,metadata"
            : "id,title,status,metadata"
        )
        .ilike("metadata->>source_name", "%enaatti%")
        .range(a, a + 999)
      if (error) {
        console.error(`VIRHE ${taulu}: ${error.message}`)
        process.exit(1)
      }
      rivit.push(...(data ?? []))
      if ((data ?? []).length < 1000) break
    }
    console.log(`### ${taulu}: ${rivit.length} riviä Senaatin lähteestä`)

    for (const r of rivit) {
      if (taulu === "potential_projects" && (r.status === "ignored" || r.status === "rejected")) continue

      const osoite = String(r.metadata?.source_url ?? r.metadata?.documents_url ?? "")
      const o =
        osapuolet.get(osoite) ??
        [...osapuolet.values()].find((x) => normalisoi(x.otsikko) === normalisoi(r.name ?? r.title ?? ""))
      if (!o) continue

      const md: Record<string, any> = { ...(r.metadata ?? {}) }
      const muutokset: Record<string, any> = {}

      for (const kentta of KENTAT) {
        const arvo = o.kentat[kentta]
        if (!arvo) continue
        /* Lahde kirjoittaa avoimen kohdan sanalla, ei tyhjalla. */
        if (
          /^(tarkentuu|t[äa]ydentyy|t[äa]smentyy|avoin|ei\s+viel[äa]|ei\s+tiedossa|tbd|kilpailutetaan|valitaan|ei\s+valittu)/i.test(
            arvo
          )
        ) {
          continue
        }
        const nyt = taulu === "projects" ? (r as any)[kentta] : md[kentta]
        if (nyt && String(nyt).trim()) {
          if (normalisoi(String(nyt)) === normalisoi(arvo)) continue

          /*
           * KAKSI RISTIRIITAA KORVATAAN, MUUT VAIN TULOSTETAAN.
           *
           * 1. TILAAJA RAKENTAJAN KENTASSA. 19 rivilla rakentajaksi oli
           *    kirjattu "Senaatti-kiinteistot" eli tilaaja itse, vaikka
           *    sama sivu kertoo oikean paaurakoitsijan (SRV, Peab, NCC).
           *    Rakennuttaja ei ole oman hankkeensa urakoitsija
           *    ([[party-role-fields]]).
           * 2. LYHENNE VS. TOIMINIMI. "NCC" vs. "NCC Suomi Oy", "SRV"
           *    vs. "SRV Rakennus Oy" -- sama yritys, ja lahteen
           *    virallinen muoto on parempi.
           *
           * Aito erimielisyys ("Rakennustyo Salminen Oy" vs.
           * "Rakennustoimisto Eero Reijonen Oy") jaa koskematta: siina
           * kyse on eri rakennuksesta, eika sita ratkaista saannolla.
           */
          const nytN = normalisoi(String(nyt))
          const uusiN = normalisoi(arvo)
          /*
           * Verrataan LAHTEEN ilmoittamaan rakennuttajaan, ei rivin
           * omaan tilaajakenttaan: se on usein tyhja, jolloin saanto ei
           * lauennut lainkaan ensimmaisessa versiossa.
           */
          /*
           * JULKAISIJA ITSE EI OLE URAKOITSIJA. Vertailu lahteen
           * rakennuttajakenttaan ei riittanyt, koska sivuilla lukee eri
           * muotoja ("Senaatti-kiinteistot, rakennuttajapaallikko ...")
           * ja osassa rakennuttaja on kayttajavirasto
           * ("Rajavartiolaitos"). Senaatti on naissa aina tilaaja, ei
           * paaurakoitsija.
           */
          const tilaajaRakentajana =
            kentta === "builder" &&
            (nytN === normalisoi(o.kentat.developer ?? "") || /^senaatti kiinteist/.test(nytN))
          const samaLyhennettyna = uusiN.startsWith(nytN) && nytN.length >= 3

          if (tilaajaRakentajana || samaLyhennettyna) {
            muutokset[kentta] = arvo
            korvatut.push(
              `   ${String(r.name ?? r.title).slice(0, 36).padEnd(38)} ${kentta.padEnd(18)} "${String(nyt).slice(0, 24)}" -> "${arvo.slice(0, 26)}"  ${tilaajaRakentajana ? "(tilaaja rakentajana)" : "(lyhenne)"}`
            )
            continue
          }

          ristiriidat.push(
            `   ${String(r.name ?? r.title).slice(0, 38).padEnd(40)} ${kentta.padEnd(20)} "${String(nyt).slice(0, 26)}" vs. "${arvo.slice(0, 26)}"`
          )
          continue
        }
        muutokset[kentta] = arvo
      }

      const vanhatLiittyvat = Array.isArray(md.related_companies) ? md.related_companies : []
      const liittyvat = mergeCompanyNames(vanhatLiittyvat, o.liittyvat)
      const uusiaLiittyvia = liittyvat.length - vanhatLiittyvat.length

      if (!Object.keys(muutokset).length && !uusiaLiittyvia) continue

      console.log(`\n   ${String(r.name ?? r.title).slice(0, 62)}`)
      for (const [k, v] of Object.entries(muutokset)) console.log(`      ${k.padEnd(21)} -> ${v}`)
      if (uusiaLiittyvia) {
        console.log(`      liittyvät +${uusiaLiittyvia}: ${liittyvat.filter((n) => !vanhatLiittyvat.includes(n)).join(" | ")}`)
      }
      kirjoitettu += 1

      if (!apply) continue

      md.related_companies = liittyvat
      if (o.henkilot.length) md.senaatti_henkilot = o.henkilot
      const paivitys: Record<string, any> = { metadata: md }
      if (taulu === "projects") Object.assign(paivitys, muutokset)
      else Object.assign(md, muutokset)

      const { error } = await db.from(taulu).update(paivitys).eq("id", r.id)
      if (error) console.error(`      VIRHE: ${error.message}`)
    }
  }

  if (korvatut.length) {
    console.log(`
=== Korvatut virheelliset arvot ${korvatut.length} ===`)
    for (const k of korvatut) console.log(k)
  }

  if (ristiriidat.length) {
    console.log(`\n=== Ristiriidat (EI korvata, luettavaksi) ${ristiriidat.length} ===`)
    for (const r of ristiriidat.slice(0, 25)) console.log(r)
  }

  console.log(`\nRivejä joille kirjoitetaan: ${kirjoitettu}`)
  if (!apply) console.log("Ei kirjoitettu. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
