import { readFileSync, writeFileSync, existsSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * A/B: MITA VALMISTUMISPAIVAN POIMINNAN MUUTOS TEKEE AINEISTOLLE?
 *
 * Virhe tassa kentassa on kalliimpi kuin tyhja: mennyt paiva syottaa
 * `autoCompleteGate`:a, joka 90 vrk:n jalkeen siirtaa hankkeen
 * Valmistuneeksi ja piilottaa sen asiakkaalta (D-298).
 *
 *   npx tsx scripts/measure-valmistumispaiva.ts --tallenna   (ennen)
 *   npx tsx scripts/measure-valmistumispaiva.ts              (vertaa)
 */

const PERUSTASO = "C:/Users/johan/tyomaat-app/.valmistuminen-perustaso.json"

async function main() {
  const tallenna = process.argv.includes("--tallenna")
  const { createClient } = await import("@supabase/supabase-js")
  const { parseEstimatedCompletionDate } = await import("../lib/agent/parseFinnishCompletionDate")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

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

  const rivit: { avain: string; otsikko: string; teksti: string; kannassa: string | null }[] = []
  for (const r of jono) {
    const m: any = r.metadata ?? {}
    const teksti = String(m.description ?? m.additional_info ?? "")
    if (teksti.length < 60) continue
    rivit.push({
      avain: `jono:${r.id}`,
      otsikko: String(r.title ?? ""),
      teksti,
      kannassa: m.estimated_completion ?? null,
    })
  }
  for (const p of hankkeet) {
    const teksti = String(p.additional_info ?? (p.metadata as any)?.description ?? "")
    if (teksti.length < 60) continue
    rivit.push({
      avain: `hanke:${p.id}`,
      otsikko: String(p.name ?? ""),
      teksti,
      kannassa: (p.estimated_completion as string) ?? null,
    })
  }
  console.log(`aineisto ${rivit.length} riviä`)

  const tulos = new Map<string, string | null>()
  for (const r of rivit) tulos.set(r.avain, parseEstimatedCompletionDate(r.teksti))
  const osui = [...tulos.values()].filter(Boolean).length
  console.log(`poiminta osuu ${osui} / ${rivit.length}`)

  if (tallenna) {
    writeFileSync(PERUSTASO, JSON.stringify(Object.fromEntries(tulos)), "utf8")
    console.log(`perustaso tallennettu`)
    return
  }
  if (!existsSync(PERUSTASO)) {
    console.log(`Ei perustasoa. Aja ensin --tallenna ENNEN muutosta.`)
    return
  }

  const vanha: Record<string, string | null> = JSON.parse(readFileSync(PERUSTASO, "utf8"))
  const muuttuneet: string[] = []
  const menetetyt: string[] = []
  const uudet: string[] = []
  for (const [k, nyt] of tulos) {
    const ennen = vanha[k] ?? null
    if (ennen && nyt && ennen !== nyt) muuttuneet.push(k)
    else if (ennen && !nyt) menetetyt.push(k)
    else if (!ennen && nyt) uudet.push(k)
  }
  console.log(`\nmuuttuneet ${muuttuneet.length}, menetetyt ${menetetyt.length}, uudet ${uudet.length}`)

  const kartta = new Map(rivit.map((r) => [r.avain, r]))
  const nayta = (otsikko: string, avaimet: string[]) => {
    if (!avaimet.length) return
    console.log(`\n--- ${otsikko} ---`)
    for (const k of avaimet) {
      const r = kartta.get(k)!
      console.log(`${k}`)
      console.log(`  ennen: ${vanha[k] ?? "-"}   nyt: ${tulos.get(k) ?? "-"}   kannassa: ${r.kannassa ?? "-"}`)
      console.log(`  ${r.otsikko.slice(0, 68)}`)
      /* Molemmat maininnat nakyviin, jotta valinta voi tarkistaa. */
      for (const osuma of r.teksti.matchAll(/[^.]{0,90}valmistu[^.]{0,60}\./gi)) {
        console.log(`    > ${osuma[0].replace(/\s+/g, " ").trim().slice(0, 150)}`)
      }
    }
  }
  nayta("MUUTTUNEET", muuttuneet)
  nayta("MENETETYT", menetetyt)
  nayta("UUDET", uudet.slice(0, 10))
}
main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
