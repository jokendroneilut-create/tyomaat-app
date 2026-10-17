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
 * A/B: MITA TILAAJAPOIMINNAN MUUTOS TEKEE KOKO AINEISTOLLE?
 *
 * Johannes 18.10.2026: *"pitaahan se tilaaja myos poimia jos se on
 * loydettavissa. tama siis kaikilta. se vaikuttaa myos
 * duplikaattiskannaukseen."*
 *
 * Poimija on yhteinen (`extractExplicitClient` /
 * `extractClientFromText`, `fetchSttHakuSource.ts`), joten muutos koskee
 * jokaista lahdetta joka sita kayttaa. Rakentajapoiminnan korjaus
 * 17.10.2026 opetti miksi tama mitataan: ensimmainen versio korjasi 5
 * poimintaa ja rikkoi 17, ja vain koko jonon yli ajettu A/B paljasti sen.
 *
 * KAYTTO on kaksivaiheinen:
 *
 *   npx tsx scripts/measure-tilaajapoiminta.ts --tallenna   (ennen muutosta)
 *   ... muuta kuviot ...
 *   npx tsx scripts/measure-tilaajapoiminta.ts              (vertaa)
 *
 * Perustaso tallentuu tiedostoon, jota ei committoida.
 */

const PERUSTASO = "C:/Users/johan/tyomaat-app/.tilaaja-perustaso.json"

async function main() {
  const tallenna = process.argv.includes("--tallenna")
  const { createClient } = await import("@supabase/supabase-js")
  const { extractExplicitClient, extractClientFromText } = await import(
    "../lib/agent/fetchSttHakuSource"
  )
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

  /*
   * Teksti luetaan samasta kentasta jonka kayttaja nakee
   * (`additional_info`), ei metadata.descriptionista — eri kentta antoi
   * aiemmin eri tuloksen.
   */
  const jono = await kaikki("potential_projects", "id, title, status, metadata")
  const hankkeet = await kaikki("projects", "id, name, developer, additional_info, metadata")

  type Rivi = { avain: string; otsikko: string; teksti: string; nykyinen: string | null }
  const rivit: Rivi[] = []

  for (const r of jono) {
    const m: any = r.metadata ?? {}
    const teksti = String(m.description ?? m.additional_info ?? "")
    if (teksti.length < 80) continue
    rivit.push({
      avain: `jono:${r.id}`,
      otsikko: String(r.title ?? ""),
      teksti,
      nykyinen: m.developer ?? null,
    })
  }
  for (const p of hankkeet) {
    const teksti = String(p.additional_info ?? (p.metadata as any)?.description ?? "")
    if (teksti.length < 80) continue
    rivit.push({
      avain: `hanke:${p.id}`,
      otsikko: String(p.name ?? ""),
      teksti,
      nykyinen: p.developer ?? null,
    })
  }
  console.log(`aineisto: ${rivit.length} riviä (jono ${jono.length}, hankkeet ${hankkeet.length})\n`)

  const tulos = new Map<string, { explicit: string | null; laaja: string | null; otsikko: string; teksti: string }>()
  for (const r of rivit) {
    tulos.set(r.avain, {
      explicit: extractExplicitClient(r.teksti),
      laaja: extractClientFromText(r.otsikko, r.teksti),
      otsikko: r.otsikko,
      teksti: r.teksti,
    })
  }

  const explicitOsui = [...tulos.values()].filter((t) => t.explicit).length
  const laajaOsui = [...tulos.values()].filter((t) => t.laaja).length
  console.log(`extractExplicitClient osuu  ${explicitOsui} / ${rivit.length}`)
  console.log(`extractClientFromText osuu  ${laajaOsui} / ${rivit.length}`)

  if (tallenna) {
    const kevyt: Record<string, [string | null, string | null]> = {}
    for (const [k, v] of tulos) kevyt[k] = [v.explicit, v.laaja]
    writeFileSync(PERUSTASO, JSON.stringify(kevyt), "utf8")
    console.log(`\nperustaso tallennettu (${Object.keys(kevyt).length} riviä)`)
    return
  }

  if (!existsSync(PERUSTASO)) {
    console.log(`\nEi perustasoa. Aja ensin --tallenna ENNEN muutosta.`)
    return
  }

  const vanha: Record<string, [string | null, string | null]> = JSON.parse(
    readFileSync(PERUSTASO, "utf8")
  )

  for (const [nimi, idx] of [["explicit", 0], ["laaja", 1]] as const) {
    const uusia: string[] = []
    const menetetyt: string[] = []
    const muuttuneet: string[] = []
    for (const [k, v] of tulos) {
      const ennen = vanha[k]?.[idx] ?? null
      const nyt = idx === 0 ? v.explicit : v.laaja
      if (!ennen && nyt) uusia.push(k)
      else if (ennen && !nyt) menetetyt.push(k)
      else if (ennen && nyt && ennen !== nyt) muuttuneet.push(k)
    }
    console.log(`\n=== ${nimi} ===`)
    console.log(`  uusia       ${uusia.length}`)
    console.log(`  MENETETYT   ${menetetyt.length}`)
    console.log(`  muuttuneet  ${muuttuneet.length}`)

    const nayta = (otsikko: string, avaimet: string[], kaikkiRivit: boolean) => {
      if (!avaimet.length) return
      console.log(`\n  --- ${otsikko} ---`)
      for (const k of kaikkiRivit ? avaimet : avaimet.slice(0, 25)) {
        const v = tulos.get(k)!
        const ennen = vanha[k]?.[idx] ?? null
        const nyt = idx === 0 ? v.explicit : v.laaja
        console.log(`  ${k}`)
        console.log(`    ennen: ${ennen ?? "-"}   nyt: ${nyt ?? "-"}`)
        console.log(`    otsikko: ${v.otsikko.slice(0, 80)}`)
        /* Kohta josta poiminta tuli, luettavaksi. */
        const avainsana = String(nyt ?? ennen ?? "").split(/\s+/)[0]
        const i = avainsana ? v.teksti.indexOf(avainsana) : -1
        if (i >= 0) console.log(`    teksti:  ...${v.teksti.slice(Math.max(0, i - 110), i + 90)}...`)
      }
    }
    /* Menetetyt ja muuttuneet luetaan kokonaan: ne ovat regressioriski. */
    nayta("MENETETYT (regressio)", menetetyt, true)
    nayta("muuttuneet", muuttuneet, true)
    nayta("uusia", uusia, false)
  }
}
main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
