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
 * ILMOITUSTYYPPI POIS NYKYISTEN HANKKEIDEN NIMISTÄ (22.11.2026, D-448).
 *
 * "JÄLKI-ILMOITUS: Osallistumispyyntö: Malmin uusi sairaala" ->
 * "Malmin uusi sairaala". Vain alusta ja lopusta, ks.
 * lib/projects/ilmoitustyyppiNimesta.ts. Vanha nimi talteen
 * metadata.also_known_as-listaan, jota täsmäys lukee.
 *
 * Kuivaharjoitus oletuksena; --apply kirjoittaa.
 */
import { createClient } from "@supabase/supabase-js"
import { poistaIlmoitustyyppi } from "../lib/projects/ilmoitustyyppiNimesta"

const APPLY = process.argv.includes("--apply")

async function main() {
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const rivit: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await s.from("projects").select("id,name,phase,status").in("status", ["active", "completed"]).range(from, from + 999)
    if (error) throw error
    rivit.push(...(data ?? [])); if (!data || data.length < 1000) break
  }
  const muutettavat = rivit
    .map((r) => ({ ...r, uusi: poistaIlmoitustyyppi(r.name) }))
    .filter((r) => r.uusi !== r.name && r.uusi !== String(r.name).replace(/\s+/g, " ").trim())
  console.log(`${muutettavat.length} nimeä${APPLY ? "" : " (kuivaharjoitus)"}`)

  for (const r of muutettavat) {
    console.log(`${r.id.slice(0, 8)} ${r.phase.padEnd(18)} ${r.name.slice(0, 70)}\n${" ".repeat(28)}-> ${r.uusi.slice(0, 90)}`)
    if (!APPLY) continue
    const { data: p } = await s.from("projects").select("metadata").eq("id", r.id).single()
    const md: any = (p as any)?.metadata ?? {}
    const aka = Array.from(new Set([...(Array.isArray(md.also_known_as) ? md.also_known_as : []), r.name]))
    const { error } = await s.from("projects").update({ name: r.uusi, metadata: { ...md, also_known_as: aka, nimi_siivottu: "ilmoitustyyppi 22.11.2026" } }).eq("id", r.id)
    if (error) console.log("  VIRHE", error.message)
  }
}
main()
