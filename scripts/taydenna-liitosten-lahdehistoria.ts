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
 * LIITOSTEN LÄHTEET HANKKEEN HISTORIAAN TAKAUTUVASTI (22.11.2026).
 *
 * TIC:n hyväksyntäreitti hukkasi liitetyn ehdokkaan lähteen: metatiedot
 * yhdistettiin muodossa { ...ehdokas, ...hanke }, joten hankkeen oma
 * source_history voitti. Mitattu: 299/486 liitoksesta (62 %) lähde puuttui.
 * Reitti korjattu (lib/projects/yhdistaLahdehistoria.ts). Jokainen liitos on
 * kuitenkin kirjattu project_imports-tauluun osoitteineen, joten historia
 * täydennetään sieltä. Lisätään vain rivi; mitään olemassa olevaa ei muuteta.
 * Voittajia ei kirjata, joten liittyvät yritykset eivät muutu.
 *
 * Kuivaharjoitus oletuksena; --apply kirjoittaa.
 */
import { createClient } from "@supabase/supabase-js"
import { yhdistaLahdehistoria } from "../lib/projects/yhdistaLahdehistoria"

const APPLY = process.argv.includes("--apply")

async function main() {
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const imp: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await s.from("project_imports").select("project_id,potential_project_id,source_name,created_at,url:metadata->>source_url,dok:source_document_id,via:changes->matched_existing_project->>matchedVia").eq("action", "matched_existing_project").order("created_at").range(from, from + 999)
    if (error) throw error
    imp.push(...(data ?? [])); if (!data || data.length < 1000) break
  }
  /*
   * VAIN TUNNISTEELLA TEHDYT LIITOKSET. Sumea täsmäys teki vääriä
   * liitoksia jopa 95-100 pisteellä: 7.8.2026 SRV:n Helmi-tiedote meni
   * Hartelan A-Kruunuun ja Rautatientorin metroasema Folkhälsanin
   * senioriasuntoihin. Niiden lähde historiaan vakiinnuttaisi virheen, joten
   * ne listataan erikseen katsottaviksi. "identifier" kattaa myös TIC:n
   * "Liitä hankkeeseen" -valinnan (mergeIntoProjectId).
   */
  const perHanke = new Map<string, any[]>()
  const sumeat: any[] = []
  for (const i of imp) {
    if (!i.url && !i.dok) continue
    if (i.via !== "identifier") { sumeat.push(i); continue }
    perHanke.set(i.project_id, [...(perHanke.get(i.project_id) ?? []), i])
  }

  let hankkeita = 0, riveja = 0, jonoja = 0
  const ids = [...perHanke.keys()]
  for (let k = 0; k < ids.length; k += 100) {
    const { data } = await s.from("projects").select("id,name,metadata").in("id", ids.slice(k, k + 100))
    for (const p of data ?? []) {
      const md: any = p.metadata ?? {}
      const vanha = Array.isArray(md.source_history) ? md.source_history : []
      let uusi = vanha
      for (const i of perHanke.get(p.id) ?? []) {
        uusi = yhdistaLahdehistoria(uusi, [], {
          source_name: i.source_name ?? null,
          source_document_id: i.dok ?? null,
          document_url: i.url ?? null,
          seen_at: i.created_at,
          is_contract_award: false,
          winners: null,
        })
      }
      if (uusi.length === vanha.length) continue
      const lisatyt = uusi.slice(vanha.length)
      hankkeita++; riveja += lisatyt.length
      console.log(`${p.id.slice(0, 8)} ${String(p.name).slice(0, 60).padEnd(60)} +${lisatyt.map((r: any) => `${r.source_name} ${String(r.seen_at).slice(0, 10)}`).join(", ")}`)
      if (APPLY) {
        const merkityt = lisatyt.map((r: any) => ({ ...r, taydennetty: "project_imports 22.11.2026" }))
        const { error } = await s.from("projects").update({ metadata: { ...md, source_history: [...vanha, ...merkityt] } }).eq("id", p.id)
        if (error) console.log("  VIRHE", error.message)
      }
    }
  }

  /* Sumeat, joiden lähde puuttuu historiasta: katsottavaksi, ei kirjoiteta. */
  const sumeatIds = [...new Set(sumeat.map((i) => i.project_id))]
  let sumeitaPuuttuu = 0
  for (let k = 0; k < sumeatIds.length; k += 100) {
    const { data } = await s.from("projects").select("id,name,h:metadata->source_history").in("id", sumeatIds.slice(k, k + 100))
    for (const p of data ?? []) {
      const h = Array.isArray((p as any).h) ? (p as any).h : []
      for (const i of sumeat.filter((x) => x.project_id === p.id)) {
        if (h.some((r: any) => (i.dok && r.source_document_id === i.dok) || (i.url && r.document_url === i.url))) continue
        sumeitaPuuttuu++
        console.log(`SUMEA ${String(i.created_at).slice(0, 10)} ${p.id.slice(0, 8)} ${String(p.name).slice(0, 50).padEnd(50)} <- ${i.source_name} ${i.url ?? ""}`)
      }
    }
  }
  console.log(`sumeita liitoksia ilman lähdettä historiassa: ${sumeitaPuuttuu} (ei kirjoiteta)`)

  /* Jonorivi tietää mihin se liitettiin (vain tunnisteella liitetyt). */
  const jonoIds = imp.filter((i) => i.via === "identifier").map((i) => i.potential_project_id).filter(Boolean)
  for (let k = 0; k < jonoIds.length; k += 100) {
    const { data } = await s.from("potential_projects").select("id,metadata").in("id", jonoIds.slice(k, k + 100))
    for (const q of data ?? []) {
      const qm: any = q.metadata ?? {}
      const kohde = imp.find((i) => i.potential_project_id === q.id)?.project_id
      if (!kohde || qm.matched_existing_project_id) continue
      jonoja++
      if (APPLY) await s.from("potential_projects").update({ metadata: { ...qm, matched_existing_project_id: kohde } }).eq("id", q.id)
    }
  }
  console.log(`\n${hankkeita} hanketta, ${riveja} lähderiviä, ${jonoja} jonoriviä ${APPLY ? "päivitetty" : "päivitettäisiin"}`)
}
main()
