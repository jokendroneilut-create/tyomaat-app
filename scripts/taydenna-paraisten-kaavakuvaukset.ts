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
 * PARAISTEN KAAVAKUVAUKSET SELOSTUKSISTA (D-335).
 *
 * Johannes 23.10.2026: *"korjataan tama, tarkistetaan jo
 * hyvaksytyista ja korjataan etta tulisi jatkossa myos nama."*
 *
 * Kerraaja on korjattu (jatkossa), ja tama ajo hoitaa olemassa olevat
 * rivit MOLEMMISTA tauluista: jonorivit seka hyvaksytyista syntyneet
 * hankkeet, koska jonorivin metadata ei siirry hyvaksynnan jalkeen
 * mihinkaan ([[measure-the-field-the-user-reads]]).
 *
 * VAIN PIDEMPI KORVAA. Jos rivilla on jo pidempi kuvaus, sita ei
 * ylikirjoiteta: se voi olla toisesta lahteesta tai kasin kirjoitettu.
 *
 *   npx tsx scripts/taydenna-paraisten-kaavakuvaukset.ts
 *   npx tsx scripts/taydenna-paraisten-kaavakuvaukset.ts --apply
 */

import * as cheerio from "cheerio"
import { taydennaKuvausLiitteesta, type LiiteBudjetti } from "../lib/agent/kaavanLiite"

const LISTA = "https://www.pargas.fi/fi/asemakaavat"
const LAHDE = "Paraisten vireillä olevat asemakaavat"

async function sivultaKuvaukset(): Promise<Map<string, string>> {
  const r = await fetch(LISTA, { cache: "no-store", headers: { "Accept-Language": "fi" } })
  if (!r.ok) throw new Error(`listasivu ${r.status}`)
  const $ = cheerio.load(await r.text())
  const h1 = $("h1")
    .toArray()
    .find((el) => $(el).text().trim() === "Asemakaavat")
  if (!h1) throw new Error("h1 'Asemakaavat' ei loytynyt")
  const container = $(h1).parent()

  type Block = { title: string; nodes: any[] }
  const blocks: Block[] = []
  let current: Block | null = null
  for (const el of container.children().toArray()) {
    if ((el as any).name === "hr") {
      current = null
      continue
    }
    if ((el as any).name !== "p") continue
    const strongEl = $(el).find("strong").first()
    const strongText = strongEl.text().replace(/\s+/g, " ").trim()
    if (strongText && !strongEl.parent().is("a")) {
      current = { title: strongText.replace(/^-\s*/, ""), nodes: [] }
      blocks.push(current)
      continue
    }
    if (current) current.nodes.push(el)
  }

  const budjetti: LiiteBudjetti = { haettu: 0, raja: 20 }
  const ulos = new Map<string, string>()
  for (const b of blocks) {
    if (!b.title) continue
    const pohja = b.nodes.map((n) => $(n).text().replace(/\s+/g, " ").trim()).join(" ")
    const linkit = b.nodes
      .flatMap((n) => $(n).find("a").toArray())
      .map((a) => ({
        teksti: $(a).text().replace(/\s+/g, " ").trim(),
        href: new URL($(a).attr("href") ?? "", LISTA).toString(),
      }))
    ulos.set(b.title, (await taydennaKuvausLiitteesta(pohja, linkit, budjetti)) ?? pohja)
  }
  console.log(`Sivulta ${ulos.size} kaavaa, liitehakuja ${budjetti.haettu}`)
  return ulos
}

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")
  const sivulta = await sivultaKuvaukset()

  /* ---------- 1. JONORIVIT ---------- */
  const { data: jono, error } = await db
    .from("potential_projects")
    .select("id, title, status, municipality, metadata")
    .eq("metadata->>source_name", LAHDE)
  if (error) {
    console.error(`VIRHE jono: ${error.message}`)
    process.exit(1)
  }
  const jonoRivit = (jono ?? []).filter((p: any) => p.status !== "ignored")
  console.log(`\n=== JONO: ${jonoRivit.length} rivia (ignored pois) ===\n`)

  let jonoMuutettu = 0
  for (const p of jonoRivit as any[]) {
    const uusi = sivulta.get(String(p.title))
    const vanha = String(p.metadata?.description ?? "")
    if (!uusi) {
      console.log(`   EI SIVULLA  ${String(p.title).slice(0, 52).padEnd(54)} [${p.status}]`)
      continue
    }
    if (uusi.length <= vanha.length) {
      console.log(`   EI PAREMPI  ${String(p.title).slice(0, 52).padEnd(54)} [${p.status}] ${vanha.length} -> ${uusi.length}`)
      continue
    }
    console.log(`   +${String(uusi.length - vanha.length).padStart(5)}  ${String(p.title).slice(0, 52).padEnd(54)} [${p.status}] ${vanha.length} -> ${uusi.length}`)
    jonoMuutettu += 1
    if (!apply) continue

    const md: Record<string, any> = { ...(p.metadata ?? {}) }
    md.description = uusi
    md.kuvaus_liitteesta = {
      lahde: LISTA,
      edellinen_pituus: vanha.length,
      edellinen: vanha,
      milloin: new Date().toISOString().slice(0, 10),
    }
    const { error: e } = await db.from("potential_projects").update({ metadata: md }).eq("id", p.id)
    if (e) console.error(`      VIRHE: ${e.message}`)
  }

  /* ---------- 2. HYVAKSYTYISTA SYNTYNEET HANKKEET ---------- */
  console.log(`\n=== HANKKEET (hyvaksytyt jonorivit) ===\n`)
  let hankeMuutettu = 0
  for (const p of (jonoRivit as any[]).filter((x) => x.status === "approved")) {
    const uusi = sivulta.get(String(p.title))
    if (!uusi) continue

    let hanke: any = null
    const matched = p.metadata?.matched_existing_project_id ?? null
    if (matched) {
      const { data } = await db.from("projects").select("id, name, additional_info, metadata").eq("id", matched).maybeSingle()
      hanke = data ?? null
    }
    if (!hanke) {
      const { data } = await db
        .from("projects")
        .select("id, name, additional_info, metadata")
        .eq("name", p.title)
        .eq("city", p.municipality)
      if ((data ?? []).length === 1) hanke = (data ?? [])[0]
      else {
        console.log(`   EI YKSI OSUMA  ${String(p.title).slice(0, 50).padEnd(52)} osumia ${(data ?? []).length}`)
        continue
      }
    }

    const vanha = String(hanke.additional_info ?? "")
    if (uusi.length <= vanha.length) {
      console.log(`   EI PAREMPI     ${String(p.title).slice(0, 50).padEnd(52)} ${vanha.length} -> ${uusi.length}`)
      continue
    }
    console.log(`   +${String(uusi.length - vanha.length).padStart(5)}  ${String(p.title).slice(0, 50).padEnd(52)} ${vanha.length} -> ${uusi.length}  (${hanke.id.slice(0, 8)})`)
    hankeMuutettu += 1
    if (!apply) continue

    const md: Record<string, any> = { ...(hanke.metadata ?? {}) }
    md.description = uusi
    md.kuvaus_liitteesta = {
      jonorivi: p.id,
      edellinen_pituus: vanha.length,
      edellinen: vanha,
      milloin: new Date().toISOString().slice(0, 10),
    }
    const { error: e } = await db
      .from("projects")
      .update({ additional_info: uusi, metadata: md })
      .eq("id", hanke.id)
    if (e) console.error(`      VIRHE: ${e.message}`)
  }

  console.log(`\nJonorivejä taydennetaan ${jonoMuutettu}, hankkeita ${hankeMuutettu}`)
  if (!apply) console.log("Ei kirjoitettu. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
