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
 * NRC GROUPIN SIVUROSKA TALLENNETUISTA KUVAUKSISTA (22.11.2026).
 *
 * Yleinen tiedotejäsennin luki NRC:n sivun loppuun asti: "Tutustu myös
 * näihin… Missasitko?" -linkkilista, jakonapin "Jaa" lainauksen edessä ja
 * lopun nostolainaus toiseen kertaan. Jäsennin korjattu
 * (lib/agent/companyRelease.ts); tämä siivoaa jo tallennetut.
 *
 * Kuivaharjoitus oletuksena; --apply kirjoittaa.
 */
import { createClient } from "@supabase/supabase-js"
import { cutReleaseTail, poistaJakonappi, poistaToistettuNosto } from "../lib/agent/companyRelease"

const APPLY = process.argv.includes("--apply")
const ROSKA = ["Tutustu myös näihin", "Missasitko?", "Jaa”", 'Jaa"']

/* Kuvagallerian kuvatekstit ja laskuri "1 / 3" jäävät hännän eteen. */
function poistaGalleria(t: string): string {
  const m = t.match(/([.!?])([^.!?]{0,400}?\d+ \/ \d+)$/)
  return m ? t.slice(0, t.length - m[2].length).trim() : t
}

/*
 * Sivun teksti on liimautunut: "…Suomessa.maajohtaja Harri Lukkarinen" ja
 * "…osaamista.Mikko Törmänen, projektipäällikkö". Välilyönti virkkeen
 * loppuun vain kun perässä on iso kirjain, tai tekstin lopussa nimike ja
 * nimi. Pieni kirjain yleisesti jätetään, ettei verkko-osoite hajoa.
 */
function erotaLiimatut(t: string): string {
  return t
    .replace(/([.!?])(?=\p{Lu}\p{Ll})/gu, "$1 ")
    .replace(/([.!?])(\p{Ll}+ \p{Lu}\p{Ll}+ \p{Lu}\p{Ll}+)$/u, "$1 $2")
}

export function siivoa(t: string): string {
  return erotaLiimatut(poistaGalleria(poistaToistettuNosto(poistaJakonappi(cutReleaseTail(t))))).trim()
}

async function main() {
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const ehto = ROSKA.flatMap((r) => [`additional_info.ilike.%${r}%`, `metadata->>description.ilike.%${r}%`]).join(",")
  const { data, error } = await s.from("projects").select("id,name,status,additional_info,metadata").or(ehto)
  if (error) throw error
  console.log(`${data?.length} riviä${APPLY ? "" : " (kuivaharjoitus)"}`)
  for (const p of data ?? []) {
    const md: any = p.metadata ?? {}
    const ai = p.additional_info ? siivoa(p.additional_info) : p.additional_info
    const desc = md.description ? siivoa(md.description) : md.description
    const jaljella = ROSKA.filter((r) => `${ai ?? ""} ${desc ?? ""}`.includes(r))
    console.log(`\n${p.id.slice(0, 8)} ${p.status} ${p.name.slice(0, 70)}`)
    for (const [k, vanha, uusi] of [["AI", p.additional_info, ai], ["DESC", md.description, desc]] as const) {
      if (vanha === uusi) { console.log(`  ${k}: ei muutosta`); continue }
      console.log(`  ${k}: ${vanha?.length}→${uusi?.length}  …${String(uusi).slice(-220)}`)
    }
    if (jaljella.length) console.log("  ! JÄLJELLÄ:", jaljella)
    if (APPLY && (ai !== p.additional_info || desc !== md.description)) {
      const { error: e } = await s.from("projects").update({ additional_info: ai, metadata: { ...md, description: desc } }).eq("id", p.id)
      if (e) console.log("  VIRHE", e.message)
    }
  }
}
main()
