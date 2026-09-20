import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * KOLME LÄHTEESTÄ TARKISTETTUA KORJAUSTA (D-203).
 *
 * Hakuagentit nostivat esiin kolme hanketta; jokaisen lähdesivu luettiin
 * 20.9.2026 ennen korjausta.
 *
 *   1. Villa Stenius: rakennuttajana kahden henkilön nimet. KÄYTTÄJÄ
 *      SÄILYTTÄÄ NE ("olen saattanut kaivaa ne jostain"), joten kenttään
 *      ei kosketa - SSA Rakennus Oy vain lisätään liittyviin yrityksiin.
 *      Todiste: Helsingin päätös ja SSA:n hankesivu (Qiva Haaga).
 *   2. Valmiusasema: Asuran sivu sanoo "Tilaaja: Vantaan ja Keravan
 *      hyvinvointialue" ja "Asura toimii pääurakoitsijana". Kannassa
 *      Asura oli rakennuttajana. Lisäksi Korson rivin kunta oli
 *      Helsinki, vaikka osoite on Urpiaisentie 36, 01450 Vantaa.
 *   3. Finnoo: Y-Säätiön sivu sanoo "arvioidaan valmistuvan kesällä
 *      2026" ja "urakoinnista vastaa Hausia Oy". EI merkitä valmiiksi -
 *      arvio kirjataan, ja valmistumisajastus paattaa omalla saannollaan.
 *
 *   npx tsx scripts/fix-kolme-korjausta.ts            (kuivaharjoitus)
 *   npx tsx scripts/fix-kolme-korjausta.ts --apply
 */
const APPLY = process.argv.includes("--apply")

type Korjaus = {
  tunnus: string
  nimi: string
  muutos: Record<string, unknown>
  metaMuutos?: Record<string, unknown>
  liittyvat?: string[]
  syy: string
}

const KORJAUKSET: Korjaus[] = [
  {
    tunnus: "c3b6dc06",
    nimi: "Villa Stenius",
    muutos: {},
    liittyvat: ["SSA Rakennus Oy"],
    syy: "SSA Rakennus Oy toteuttaa Qiva Haagan (ssa.fi); rakennuttajakenttään ei kosketa",
  },
  {
    tunnus: "2e23c447",
    nimi: "Valmiusasema Vantaalle",
    muutos: { developer: "Vantaan ja Keravan hyvinvointialue", builder: "Asura Oy" },
    metaMuutos: { developer: "Vantaan ja Keravan hyvinvointialue", builder: "Asura Oy" },
    syy: "asura.fi: Tilaaja Vantaan ja Keravan hyvinvointialue, Asura pääurakoitsija",
  },
  {
    tunnus: "8ac1c41d",
    nimi: "KORSON VALMIUSASEMA",
    muutos: { developer: "Vantaan ja Keravan hyvinvointialue", builder: "Asura Oy", city: "Vantaa" },
    metaMuutos: { developer: "Vantaan ja Keravan hyvinvointialue", builder: "Asura Oy" },
    syy: "asura.fi: sama hanke; osoite Urpiaisentie 36, 01450 Vantaa (kunta oli Helsinki)",
  },
  {
    tunnus: "4153e577",
    nimi: "Kerrostalo Finnooseen",
    muutos: { builder: "Hausia Oy", estimated_completion: "2026-08-31" },
    metaMuutos: { builder: "Hausia Oy", estimated_completion: "2026-08-31" },
    liittyvat: ["Y-Säätiö"],
    syy: "ysaatio.fi: Y-Säätiön rakennuttama, urakoinnista vastaa Hausia Oy, valmistuu kesällä 2026",
  },
]

/* Valmiusaseman kaksi riviä ovat sama hanke -> katselmointijonoon. */
const DUPLIKAATTI: [string, string] = ["2e23c447", "8ac1c41d"]

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { mergeCompanyNames } = await import("../lib/projects/projectCompanies")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const rivit: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("projects").select("id, name, city, developer, builder, estimated_completion, metadata").range(from, from + 999)
    if (error) throw error
    rivit.push(...(data ?? [])); if (!data || data.length < 1000) break
  }

  for (const k of KORJAUKSET) {
    const osumat = rivit.filter((r) => r.id.startsWith(k.tunnus))
    if (osumat.length !== 1) { console.log(`OHITETAAN ${k.nimi}: ${osumat.length} osumaa`); continue }
    const p = osumat[0]
    const muuttuu = Object.entries(k.muutos).filter(([kentta, arvo]) => String((p as any)[kentta] ?? "") !== String(arvo ?? ""))
    const nykyLiittyvat: string[] = p.metadata?.related_companies ?? []
    const uudetLiittyvat = k.liittyvat ? mergeCompanyNames(nykyLiittyvat, k.liittyvat) : nykyLiittyvat
    const liittyvatMuuttuu = uudetLiittyvat.length !== nykyLiittyvat.length
    if (!muuttuu.length && !liittyvatMuuttuu) { console.log(`ei muutettavaa: ${p.name}`); continue }

    console.log(`\n${p.name} [${p.city ?? "-"}]`)
    for (const [kentta, arvo] of muuttuu) console.log(`   ${kentta}: ${JSON.stringify((p as any)[kentta])} -> ${JSON.stringify(arvo)}`)
    if (liittyvatMuuttuu) console.log(`   liittyvät: +${k.liittyvat!.join(", ")}`)
    console.log(`   (${k.syy})`)

    if (!APPLY) continue
    const metadata = { ...p.metadata, ...(k.metaMuutos ?? {}), ...(liittyvatMuuttuu ? { related_companies: uudetLiittyvat } : {}) }
    const { error } = await db.from("projects").update({ ...k.muutos, metadata }).eq("id", p.id)
    if (error) throw error
  }

  const a = rivit.find((r) => r.id.startsWith(DUPLIKAATTI[0]))
  const b = rivit.find((r) => r.id.startsWith(DUPLIKAATTI[1]))
  if (a && b) {
    const [idA, idB] = [a.id, b.id].sort()
    const { data: onJo } = await db.from("project_duplicate_candidates").select("status").eq("project_id_a", idA).eq("project_id_b", idB).maybeSingle()
    console.log(`\nduplikaattipari: ${a.name} <-> ${b.name} — ${onJo ? `jo jonossa (${onJo.status})` : "lisätään jonoon"}`)
    if (APPLY && !onJo) {
      const { error } = await db.from("project_duplicate_candidates").insert({ project_id_a: idA, project_id_b: idB, confidence: 100, reasons: ["manual"], status: "pending" })
      if (error) throw error
    }
  }
  console.log(`\n=== ${APPLY ? "AJETTU" : "KUIVAHARJOITUS"} ===`)
}
main().catch((e) => { console.error(e); process.exit(1) })
