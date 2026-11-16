import { readFileSync } from "node:fs"

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * RAAHEN KAAVOITTAJIEN NUMEROT HENKILÖSTÖHAUSTA (D-435).
 *
 * Kaavasivu antaa vain roolin ja nimen. Kaupungin henkilöstöhaun
 * kaavoitusyksikön taulukossa on puhelin, ja sivu ilmoittaa
 * sähköpostin muodon. Täydennetään hankkeiden, jonorivien ja
 * dokumenttien yhteyshenkilöille puuttuvat puhelin ja sähköposti nimen
 * perusteella. Olemassa oleva arvo voittaa.
 *
 *   npx tsx scripts/taydenna-raahen-numerot.ts
 *   npx tsx scripts/taydenna-raahen-numerot.ts --apply
 */

const LAHDE = "Raahen vireillä olevat asemakaavat"

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const { jasennaRaahenHenkilosto, taydennaRaahenYhteystiedot, RAAHE_KAAVOITUS_HENKILOSTO_URL } = await import(
    "../lib/agent/raaheKaava"
  )
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
  console.log(apply ? "=== AJO (--apply) ===\n" : "=== KUIVAHARJOITUS ===\n")

  const henkilosto = jasennaRaahenHenkilosto(
    await (await fetch(RAAHE_KAAVOITUS_HENKILOSTO_URL, { headers: { "user-agent": "Mozilla/5.0" } })).text()
  )
  console.log(`henkilöstössä ${henkilosto.size} nimeä`)
  for (const [nimi, h] of henkilosto) console.log(`  ${nimi.padEnd(20)} ${h.puhelin ?? "-"}  ${h.sahkoposti ?? "-"}  (${h.tehtava})`)
  if (!henkilosto.size) return console.log("henkilöstölista tyhjä — ei muuteta mitään")
  console.log()

  const muutos = (vanhat: any[]) => {
    const uudet = taydennaRaahenYhteystiedot(vanhat, henkilosto)
    const lisatty = uudet.filter((u, i) => u.phone !== vanhat[i].phone || u.email !== vanhat[i].email)
    return { uudet, lisatty }
  }

  let rivit = 0
  const { data: hankkeet } = await db.from("projects").select("id,name,metadata").eq("metadata->>source_name", LAHDE)
  for (const h of hankkeet ?? []) {
    const md: any = h.metadata ?? {}
    const { uudet, lisatty } = muutos(Array.isArray(md.contact_persons) ? md.contact_persons : [])
    if (!lisatty.length) continue
    console.log(`hanke ${h.id.slice(0, 8)} ${h.name.slice(0, 50).padEnd(50)} | ${lisatty.map((c: any) => c.name).join(", ")}`)
    if (!apply) continue
    const { error } = await db.from("projects").update({ metadata: { ...md, contact_persons: uudet } }).eq("id", h.id)
    if (error) console.log(`  VIRHE ${error.message}`)
    else rivit++
  }

  const { data: jono } = await db.from("potential_projects").select("id,title,status,metadata").eq("metadata->>source_name", LAHDE)
  for (const j of jono ?? []) {
    const md: any = j.metadata ?? {}
    const { uudet, lisatty } = muutos(Array.isArray(md.contact_persons) ? md.contact_persons : [])
    if (!lisatty.length) continue
    console.log(`jono(${j.status}) ${j.id.slice(0, 8)} ${j.title.slice(0, 45).padEnd(45)} | ${lisatty.map((c: any) => c.name).join(", ")}`)
    if (!apply) continue
    const { error } = await db.from("potential_projects").update({ metadata: { ...md, contact_persons: uudet } }).eq("id", j.id)
    if (error) console.log(`  VIRHE ${error.message}`)
    else rivit++
  }

  const { data: docs } = await db.from("source_documents").select("id,raw_payload").eq("source_name", LAHDE)
  let d2 = 0
  for (const d of docs ?? []) {
    const p: any = d.raw_payload ?? {}
    const { uudet, lisatty } = muutos(Array.isArray(p.contacts) ? p.contacts : [])
    if (!lisatty.length) continue
    d2++
    if (apply) await db.from("source_documents").update({ raw_payload: { ...p, contacts: uudet } }).eq("id", d.id)
  }

  console.log(apply ? `\nmuutettu ${rivit} riviä, dokumentteja ${d2}` : `\ndokumentteja täydennettäisiin ${d2}. Aja --apply kun rivit on luettu.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
