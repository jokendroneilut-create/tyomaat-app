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
 * SELVITYKSEN VALMISTUMINEN POIS VALMISTUMISPAIVASTA (D-303).
 *
 * Jasennin korjattiin 18.10.2026 ohittamaan virkkeet joiden aihe on
 * selvitys tai suunnitelma. Korjaus vaikuttaa vain uusiin riveihin,
 * joten vanhat paivat lasketaan uudelleen.
 *
 * KIRJOITETAAN VAIN JOS NYKYINEN ARVO ON KONEEN TUOTTAMA eli se
 * tasmaa VANHAN jasentimen tulokseen. Jos arvo on jotain muuta, joku
 * on asettanut sen kasin eika sita korvata (vrt. manual-parties).
 *
 *   npx tsx scripts/korjaa-valmistumispaiva.ts
 *   npx tsx scripts/korjaa-valmistumispaiva.ts --apply
 */

/*
 * Vanhan jasentimen tulos luetaan tiedostosta jonka
 * `measure-valmistumispaiva.ts --tallenna` kirjoitti HEAD-versiolla.
 */
const PERUSTASO = "C:/Users/johan/tyomaat-app/.valmistuminen-perustaso.json"

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const { parseEstimatedCompletionDate } = await import("../lib/agent/parseFinnishCompletionDate")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const vanha: Record<string, string | null> = JSON.parse(readFileSync(PERUSTASO, "utf8"))

  const kaikki = async (t: string, cols: string) => {
    const out: any[] = []
    for (let a = 0; ; a += 1000) {
      const { data, error } = await db.from(t).select(cols).range(a, a + 999)
      if (error) {
        console.error(`VIRHE ${t}: ${error.message}`)
        process.exit(1)
      }
      out.push(...(data ?? []))
      if ((data ?? []).length < 1000) break
    }
    return out
  }

  const jono = await kaikki("potential_projects", "id, title, metadata")
  const hankkeet = await kaikki("projects", "id, name, estimated_completion, additional_info, metadata")

  type Korjaus = {
    taulu: "jono" | "hanke"
    id: string
    otsikko: string
    kannassa: string | null
    uusi: string
    metadata: any
  }
  const korjaukset: Korjaus[] = []
  const ohitetut: string[] = []

  const kasittele = (
    taulu: "jono" | "hanke",
    id: string,
    otsikko: string,
    teksti: string,
    kannassa: string | null,
    metadata: any
  ) => {
    if (teksti.length < 60) return
    const uusi = parseEstimatedCompletionDate(teksti)
    if (!uusi) return
    if (kannassa === uusi) return
    /* Vain koneen tuottama arvo korvataan. */
    const koneen = vanha[`${taulu}:${id}`] ?? null
    if (kannassa && kannassa !== koneen) {
      ohitetut.push(`${otsikko.slice(0, 50)} (kannassa ${kannassa}, kone antoi ${koneen ?? "-"})`)
      return
    }
    if (!kannassa) return
    korjaukset.push({ taulu, id, otsikko, kannassa, uusi, metadata })
  }

  for (const r of jono) {
    const m: any = r.metadata ?? {}
    kasittele(
      "jono",
      String(r.id),
      String(r.title ?? ""),
      String(m.description ?? m.additional_info ?? ""),
      m.estimated_completion ?? null,
      m
    )
  }
  for (const p of hankkeet) {
    kasittele(
      "hanke",
      String(p.id),
      String(p.name ?? ""),
      String(p.additional_info ?? (p.metadata as any)?.description ?? ""),
      (p.estimated_completion as string) ?? null,
      p.metadata
    )
  }

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")
  console.log(`korjattavia ${korjaukset.length}, ohitettu käsin asetettuna ${ohitetut.length}\n`)
  for (const o of ohitetut) console.log(`  OHI  ${o}`)
  for (const k of korjaukset) {
    console.log(`\n${k.taulu}  ${k.id}`)
    console.log(`  ${k.kannassa}  ->  ${k.uusi}`)
    console.log(`  ${k.otsikko.slice(0, 66)}`)
  }

  if (!apply) {
    console.log("\nEi kirjoitettu. Aja --apply kun rivit on luettu.")
    return
  }

  let tehty = 0
  for (const k of korjaukset) {
    const { error } =
      k.taulu === "hanke"
        ? await db.from("projects").update({ estimated_completion: k.uusi }).eq("id", k.id)
        : await db
            .from("potential_projects")
            .update({ metadata: { ...(k.metadata ?? {}), estimated_completion: k.uusi } })
            .eq("id", k.id)
    if (error) {
      console.error(`VIRHE ${k.taulu} ${k.id}: ${error.message}`)
      continue
    }
    tehty++
  }
  console.log(`\nKORJATTU ${tehty} riviä.`)
}
main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
