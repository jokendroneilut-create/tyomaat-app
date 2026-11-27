import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue; let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"'))) v = v.slice(1, -1); if (!(m[1] in process.env)) process.env[m[1]] = v }

/*
 * DYNASTYN PÄÄTÖSKOHDAN TUNNISTE POIS LUPANUMEROSTA (27.11.2026, D-457).
 *
 * Dynasty-päätöslähteet tallensivat asiakohdan id:n lupanumeroksi, joten
 * TIC näytti sen "Lupanumerona" (Kouvolan uudessa muodossa koko linkkinä).
 * Lupanumero toimi samalla saman päätöksen tunnistuksena. Siksi:
 *   1. ensin jokaiselle rivillä tunniste `dynasty_item_id` =
 *      "<lähde>:<id>" project_identifiers-tauluun (jono- ja hankeriville),
 *   2. vasta sitten väärä lupanumero tyhjäksi — vain jos se on tämä id,
 *      sen numeerinen alku tai linkki, ei koskaan oikea lupatunnus.
 *
 * Kuivaharjoitus oletuksena; --apply kirjoittaa.
 */
import { createClient } from "@supabase/supabase-js"
import { dynastyKohdanTunniste } from "../lib/agent/fetchDynastySource"
import { linkIdentifier } from "../lib/projects/identity"

const APPLY = process.argv.includes("--apply")

function onVaaraLupanumero(lupa: string | null | undefined, id: string, url: string): boolean {
  if (!lupa) return false
  if (lupa === id || lupa === url || /^https?:/i.test(lupa)) return true
  const numeroalku = id.match(/^[0-9-]+/)?.[0]
  return Boolean(numeroalku) && lupa === numeroalku
}

async function main() {
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const hae = async (taulu: "potential_projects" | "projects") => {
    const rivit: any[] = []
    const sarakkeet = taulu === "potential_projects" ? "id,status,permit_number,metadata" : "id,status,metadata"
    for (let from = 0; ; from += 1000) {
      const { data, error } = await s.from(taulu).select(sarakkeet).ilike("metadata->>source_url", "%DREQUEST.PHP%").range(from, from + 999)
      if (error) throw error
      rivit.push(...(data ?? [])); if (!data || data.length < 1000) break
    }
    return rivit
  }
  const jono = await hae("potential_projects")
  const hankkeet = await hae("projects")
  const hankeJonorivista = new Map<string, string>()
  for (const j of jono) if (j.metadata?.approved_project_id) hankeJonorivista.set(j.id, j.metadata.approved_project_id)

  let tunnisteita = 0, jonoTyhjennys = 0, hankeTyhjennys = 0, ohitettu = 0
  for (const [taulu, rivit] of [["potential_projects", jono], ["projects", hankkeet]] as const) {
    for (const r of rivit as any[]) {
      const md = r.metadata ?? {}
      const url = String(md.source_url ?? "")
      const id = dynastyKohdanTunniste(url)
      const lahde = md.source_name ?? md.source
      if (!id || !lahde) { ohitettu++; continue }
      const arvo = `${lahde}:${id}`
      tunnisteita++
      if (APPLY) {
        await linkIdentifier({
          type: "dynasty_item_id",
          value: arvo,
          potentialProjectId: taulu === "potential_projects" ? r.id : null,
          projectId: taulu === "projects" ? r.id : hankeJonorivista.get(r.id) ?? null,
          sourceName: lahde,
          supabase: s,
        })
      }
      const sarake = taulu === "potential_projects" ? r.permit_number : null
      const vaaraSarake = taulu === "potential_projects" && onVaaraLupanumero(sarake, id, url)
      const vaaraMeta = onVaaraLupanumero(md.permit_number, id, url)
      if (!vaaraSarake && !vaaraMeta) continue
      if (taulu === "potential_projects") jonoTyhjennys++; else hankeTyhjennys++
      if (APPLY) {
        const upd: any = { metadata: { ...md, permit_number: vaaraMeta ? null : md.permit_number, decision_item_id: id } }
        if (vaaraSarake) upd.permit_number = null
        const { error } = await s.from(taulu).update(upd).eq("id", r.id)
        if (error) console.log("VIRHE", taulu, r.id, error.message)
      }
    }
  }
  console.log({ jonorivit: jono.length, hankkeet: hankkeet.length, tunnisteita, jonoTyhjennys, hankeTyhjennys, ohitettu, apply: APPLY })
}
main()
