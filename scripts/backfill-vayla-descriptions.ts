import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * VAYLAVIRASTON KUVAUKSET TAKAUTUVASTI.
 *
 * Kuvaukseksi oli tallennettu LISTAUSSIVUN teaser, tyypillisesti yksi
 * virke. Hankesivulla sama on auki kirjoitettuna, ja siina on
 * kohdeluettelo tienumeroineen ja kilometreineen.
 *
 *   ennen:  "Lapin elinvoimakeskuksen paallystyskohteet kesalla 2026."  (56)
 *   jalkeen: sama + rahoitus, kilometrit ja 10 kohteen luettelo        (2455)
 *
 * EI LYHENNA. Jos sivulta saatu teksti on lyhyempi kuin tallennettu, se
 * ohitetaan - sama periaate kuin chooseAdditionalInfossa. Vanhempi
 * pidempi teksti voi olla kasin taydennetty.
 *
 * Kasittelee seka projects- etta potential_projects-taulun.
 *
 * Aja ensin ilman --apply-lippua.
 */

const APPLY = process.argv.includes("--apply")
const LIMIT = Number(process.argv.find((a) => a.startsWith("--limit="))?.slice(8) ?? 0)
/*
 * Kaksi rinnakkaista ja tauko jokaisen jalkeen. Neljalla rinnakkaisella
 * vayla.fi vastasi 66 kertaa 429 (liikaa pyyntoja) - lahde on julkinen
 * viranomainen, joten sita ei kuormiteta.
 */
const CONCURRENCY = 2
const DELAY_MS = 400
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"

/* Uuden on oltava selvasti pidempi, muuten ei kannata koskea. */
const MIN_GAIN = 1.5

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      for (;;) {
        const i = next++
        if (i >= items.length) return
        results[i] = await fn(items[i])
      }
    })
  )
  return results
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { parseVaylaDescription } = await import("../lib/agent/vaylaProjectDescription")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const lataa = async (taulu: string, sarakkeet: string) => {
    const rivit: any[] = []
    for (let f = 0; ; f += 1000) {
      const { data, error } = await supabase.from(taulu).select(sarakkeet).range(f, f + 999)
      if (error) throw error
      rivit.push(...(data ?? [])); if (!data || data.length < 1000) break
    }
    return rivit
  }

  const projects = (await lataa("projects", "id,name,additional_info,metadata")).map((p: any) => ({ ...p, taulu: "projects" }))
  const potential = (await lataa("potential_projects", "id,title,metadata")).map((p: any) => ({ ...p, name: p.title, taulu: "potential_projects" }))

  const kohteet = [...projects, ...potential].filter(
    (p: any) => /väylävirasto/i.test(String(p.metadata?.source_name ?? "")) && p.metadata?.source_url
  )

  const targets = LIMIT > 0 ? kohteet.slice(0, LIMIT) : kohteet

  console.log(APPLY ? "=== AJETTU ===" : "=== KUIVAHARJOITUS (ei kirjoiteta) ===")
  console.log(`Vaylavirasto-rivja: ${kohteet.length}`)
  console.log(`  projects:         ${kohteet.filter((p: any) => p.taulu === "projects").length}`)
  console.log(`  potential:        ${kohteet.filter((p: any) => p.taulu === "potential_projects").length}`)
  console.log(`haetaan: ${targets.length}\n`)

  let haettu = 0
  const odota = (ms: number) => new Promise((r) => setTimeout(r, ms))

  /* 429 ei ole virhe vaan pyynto hidastaa - odotetaan ja yritetaan kerran. */
  const nouda = async (url: string): Promise<Response | null> => {
    for (let yritys = 0; yritys < 3; yritys++) {
      const r = await fetch(url, { headers: { "User-Agent": UA } })
      if (r.status !== 429) return r
      await odota(3000 * (yritys + 1))
    }
    return null
  }

  const tulokset = await mapWithConcurrency(targets, CONCURRENCY, async (p: any) => {
    const vanha = String(p.metadata?.description ?? "")
    try {
      const r = await nouda(String(p.metadata.source_url))
      await odota(DELAY_MS)
      if (++haettu % 40 === 0) console.log(`  ...haettu ${haettu}/${targets.length}`)
      if (!r) return { p, vanha, uusi: null, syy: "HTTP 429 (myos uusinnoilla)" }
      if (!r.ok) return { p, vanha, uusi: null, syy: `HTTP ${r.status}` }

      const uusi = parseVaylaDescription(await r.text(), p.name)
      if (!uusi) return { p, vanha, uusi: null, syy: "ei sisaltolohkoa" }
      if (uusi.length < vanha.length * MIN_GAIN) return { p, vanha, uusi: null, syy: "ei riittavasti lisaa" }

      return { p, vanha, uusi, syy: "" }
    } catch (e: any) {
      return { p, vanha, uusi: null, syy: `virhe: ${e?.message ?? e}` }
    }
  })

  let muuttuu = 0, merkkejaEnnen = 0, merkkejaJalkeen = 0
  const syyt = new Map<string, number>()
  const naytteet: string[] = []

  for (const t of tulokset as any[]) {
    if (!t.uusi) { syyt.set(t.syy, (syyt.get(t.syy) ?? 0) + 1); continue }
    muuttuu++
    merkkejaEnnen += t.vanha.length
    merkkejaJalkeen += t.uusi.length
    if (naytteet.length < 15) {
      naytteet.push(`  ${String(t.p.name).slice(0, 36).padEnd(38)} ${String(t.vanha.length).padStart(5)} -> ${String(t.uusi.length).padStart(5)}`)
    }
  }

  console.log(`paivitettavia: ${muuttuu} / ${targets.length}   ${Math.round(muuttuu / Math.max(1, targets.length) * 100)} %`)
  console.log(`kuvausteksti yhteensa: ${merkkejaEnnen} -> ${merkkejaJalkeen} merkkia`)
  console.log(`keskiarvo: ${Math.round(merkkejaEnnen / Math.max(1, muuttuu))} -> ${Math.round(merkkejaJalkeen / Math.max(1, muuttuu))}`)

  if (syyt.size) {
    console.log("\nsyyt joilla ei paivitetty:")
    for (const [k, v] of [...syyt].sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(4)}  ${k}`)
  }
  if (naytteet.length) { console.log("\nnaytteita (merkkia ennen -> jalkeen):"); for (const n of naytteet) console.log(n) }

  /* Varmistus: yksikaan ei saa lyhentya. */
  const lyhenevat = (tulokset as any[]).filter((t) => t.uusi && t.uusi.length < t.vanha.length)
  console.log(`\nlyhenevia: ${lyhenevat.length}${lyhenevat.length ? "  <-- VIRHE" : ""}`)

  if (!APPLY) return
  if (lyhenevat.length) { console.error("KESKEYTETAAN: teksti lyhenisi."); process.exit(1) }

  let n = 0
  for (const t of tulokset as any[]) {
    if (!t.uusi) continue

    const { data: nyt } = await supabase.from(t.p.taulu).select("metadata").eq("id", t.p.id).maybeSingle()
    const meta: any = nyt?.metadata ?? {}

    const paivitys: any = { metadata: { ...meta, description: t.uusi } }
    /*
     * projects-taulussa asiakkaalle nakyva teksti on additional_info.
     * Sita paivitetaan vain jos se on nykyinen teaser - kasin taydennettya
     * tai toisesta lahteesta tullutta ei ylikirjoiteta.
     */
    if (t.p.taulu === "projects") {
      const nykyinen = String(t.p.additional_info ?? "")
      if (!nykyinen || nykyinen === t.vanha) paivitys.additional_info = t.uusi
    }

    await supabase.from(t.p.taulu).update(paivitys).eq("id", t.p.id)
    if (++n % 40 === 0) console.log(`  ...kirjoitettu ${n}/${muuttuu}`)
  }
  console.log(`\nkirjoitettu: ${n}`)
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
