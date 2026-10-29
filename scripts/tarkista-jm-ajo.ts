import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); const q = v.slice(0,1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1,-1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * JM-LAHTEEN ENSIMMAISEN AJON TARKISTUS (D-359).
 *
 * Vertaa toteutunutta siihen mita kuivaharjoitus lupasi: montako
 * jonoriviä, montako osumaa, mitka kentat muuttuivat ja -- tarkeimpana --
 * etta kasin lisatty tyonjohtaja on yha tallessa (D-341).
 *
 *   npx tsx scripts/tarkista-jm-ajo.ts
 */
async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const { data: jono } = await db.from("potential_projects")
    .select("id,title,status,municipality,created_at")
    .eq("metadata->>source_name", "jm_kohteet").order("created_at")
  console.log(`JONORIVIT (${(jono ?? []).length}):`)
  for (const r of jono ?? []) console.log(`   ${String(r.status).padEnd(10)} ${String(r.municipality ?? "-").padEnd(10)} ${r.title}`)

  const { data: tapahtumat } = await db.from("project_import_events")
    .select("match_status,normalized_payload").eq("source_name", "jm_kohteet")
  const tilat: Record<string, number> = {}
  for (const t of tapahtumat ?? []) tilat[t.match_status] = (tilat[t.match_status] ?? 0) + 1
  console.log(`\nTUONTITAPAHTUMAT (${(tapahtumat ?? []).length}):`)
  for (const [k, v] of Object.entries(tilat)) console.log(`   ${k.padEnd(20)} ${v}`)

  const idt = [
    ["Vellamonneito (kasin taydennetty)", "44f47d02-7f16-4ab4-9961-facda0115674"],
    ["Mantylanhuippu", "b233b428-1a84-479f-827c-d5ee85b3736c"],
    ["Munkkiluodontie 43", "e314d4b6-a604-4221-b9b7-b70bb6f7167a"],
    ["Harjulanhovi", "ccf6fa45-56ed-4960-acfa-b84fb90cd6c9"],
    ["Puustellinpuisto", "40e84590-94c5-4085-a363-dd431e5e5057"],
    ["Lauttasaaren Valkosiipi", "1e582e05-aa1b-46b1-ab5b-a72e84be3689"],
  ]
  console.log(`\nOSUNEET RIVIT:`)
  for (const [nimi, id] of idt) {
    const { data } = await db.from("projects").select("*").eq("id", id).single()
    const h: any = data
    if (!h) { console.log(`   ${nimi}: EI LOYDY`); continue }
    console.log(`\n   ${nimi} — ${h.name}`)
    console.log(`      vaihe ${h.phase} | tila ${h.status} | julkinen ${h.is_public} | katselmoitava ${h.needs_review}`)
    console.log(`      valmistuu ${h.estimated_completion ?? "-"} | rakentaja ${h.builder ?? "-"} | tilaaja ${h.developer ?? "-"}`)
    console.log(`      osoite ${h.location ?? "-"}`)
    /*
     * KAKSI ERI LAHDEKENTTAA. `metadata.source_name` on rivin ALKUPERA
     * (kasin luodulla tyhja), ja osuma EI kirjoita sita -- osuman jalki
     * menee kenttiin `last_source_name` ja `last_source_url`. Ensimmainen
     * versio tasta tarkistuksesta luki vain alkuperaa ja vaitti siksi
     * ettei lahdetta tullut ([[measure-the-field-the-user-reads]]).
     */
    console.log(`      alkupera ${h.metadata?.source_name ?? "-"} | viimeisin ${h.metadata?.last_source_name ?? "-"}`)
    console.log(`      source_url ${h.source_url ?? "-"}`)
    console.log(`      last_source_url ${h.metadata?.last_source_url ?? "-"}`)
    const k = h.metadata?.contact_persons ?? []
    console.log(`      yhteyshenkilot (${k.length}): ${k.map((c: any) => `${c.name ?? "(nimeton)"}/${c.title ?? "-"}/${c.email || c.phone || "-"}`).join(" ; ") || "-"}`)
    console.log(`      kuvaus (${String(h.additional_info ?? "").length}): ${String(h.additional_info ?? "").replace(/\s+/g, " ").slice(0, 110)}…`)
  }

  /* Tarkein yksittainen tarkistus: kasin lisatty tyonjohtaja. */
  const { data: vn } = await db.from("projects").select("metadata").eq("id", "44f47d02-7f16-4ab4-9961-facda0115674").single()
  const sivula = ((vn as any)?.metadata?.contact_persons ?? []).find((c: any) => String(c.name ?? "").includes("Sivula"))
  console.log(`\nPERTTU SIVULA TALLESSA: ${sivula ? "KYLLA" : "EI — VIRHE"}`)
  if (sivula) console.log(`   ${JSON.stringify(sivula)}`)
}
main().catch((e) => { console.error(e); process.exit(1) })
