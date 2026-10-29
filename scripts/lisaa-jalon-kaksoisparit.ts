import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); const q = v.slice(0,1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1,-1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * JALONIN TYOMAALUETTELON KAKSOISKAPPALEET KATSELMOINTIJONOON (D-357).
 *
 * Jalon nimeaa kohteen osoitteella ("Kuninkaantammi, Paletinkierto 11
 * 00430 Helsinki"), kun sama hanke on kannassa tilaajan nimella ("Heka
 * Kuninkaantammi, Paletinkierto 11"). Otsikkovertailu ei loyda naita;
 * katunumero loytaa. Skripti EI yhdista mitaan, vaan kirjaa parin
 * samaan jonoon kuin TIC:n "Merkitse duplikaatiksi".
 *
 *   npx tsx scripts/lisaa-jalon-kaksoisparit.ts            (kuivaharjoitus)
 *   npx tsx scripts/lisaa-jalon-kaksoisparit.ts --apply
 */
const APPLY = process.argv.includes("--apply")

/* [Jalonin rivi, kannassa jo oleva rivi, peruste] */
const PARIT: [string, string, string][] = [
  [
    "e9251741-9b30-4011-928b-8fbeaf08c717",
    "f007b1a9-3deb-46cf-b438-5229d2bbd361",
    "sama osoite Pomonkatu 2 ja sama sana tilamuutokset; Hilma-rivin liittyvissa yrityksissa on jo Jalon Rakentajat Oy eli urakan voittaja",
  ],
  [
    "0f258d5d-71ca-4ec2-8b46-832a424ec30a",
    "898706e3-4efc-4c7c-9e71-bc0aa79113a1",
    "sama osoite Paletinkierto 11 ja sama kaupunginosa Kuninkaantammi, samat koordinaatit",
  ],
  [
    "f2915026-91b7-4b1b-9ea5-0e4d2678900e",
    "c29ea9d9-7517-4d33-b2e7-948d9dc29fa4",
    "sama osoite Kiribatinkatu 1, samat koordinaatit; Jalonin otsikko nimeaa kaksi taloyhtiota samalla tontilla",
  ],
]

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  let uusia = 0
  for (const [jalonId, kantaId, peruste] of PARIT) {
    const { data: rivit, error } = await db.from("projects")
      .select("id,name,city,phase,is_public,developer,builder,estimated_completion")
      .in("id", [jalonId, kantaId])
    if (error) throw error
    const a = (rivit ?? []).find((r: any) => r.id === jalonId)
    const b = (rivit ?? []).find((r: any) => r.id === kantaId)
    if (!a || !b) { console.log(`EI LOYDY: ${jalonId} / ${kantaId}`); continue }

    const [idA, idB] = [jalonId, kantaId].sort()
    const { data: onJo } = await db.from("project_duplicate_candidates")
      .select("status").eq("project_id_a", idA).eq("project_id_b", idB).maybeSingle()

    const kuvaa = (p: any) =>
      `${String(p.name).slice(0, 62)}\n      ${p.city} | ${p.phase} | julkinen ${p.is_public} | valm ${p.estimated_completion ?? "-"} | tilaaja ${p.developer ?? "-"} | rakentaja ${p.builder ?? "-"}`
    console.log(`${onJo ? `JO JONOSSA (${onJo.status})` : "UUSI PARI"}`)
    console.log(`   JALON: ${kuvaa(a)}`)
    console.log(`   KANTA: ${kuvaa(b)}`)
    console.log(`   peruste: ${peruste}\n`)
    if (onJo) continue
    uusia++
    if (!APPLY) continue
    const { error: e2 } = await db.from("project_duplicate_candidates").insert({
      project_id_a: idA,
      project_id_b: idB,
      confidence: 100,
      reasons: ["manual", "sama katuosoite", peruste],
      status: "pending",
    })
    if (e2) throw e2
  }
  console.log(`=== ${APPLY ? "AJETTU" : "KUIVAHARJOITUS"}: ${uusia} uutta paria ===`)
}
main().catch((e) => { console.error(e); process.exit(1) })
