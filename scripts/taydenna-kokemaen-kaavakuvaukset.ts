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
 * KOKEMAEN KAAVAKUVAUKSET SELOSTUKSISTA (D-334).
 *
 * Johannes 22.10.2026: *"tasta pitaisi olla kuvauksessa ainakin [1.2
 * Kaava-alueen sijainti ja 1.3 Kaavan tarkoitus] ... loytyy
 * dokumenteista. katso myos muut tuosta lahteesta aiemmin tulleet ja
 * jonossa olevat."*
 *
 * Kerraaja otti kuvaukseksi haitarin tekstin, joka on Kokemaella pelkka
 * lista liitteiden nimia (43-114 merkkia). Jasennin oli jo valmis:
 * `taydennaKuvausLiitteesta` poimi kaikilta neljalta kaavalta
 * tavoiteluvun sellaisenaan. Kerraaja on nyt korjattu; tama ajo hoitaa
 * olemassa olevat rivit.
 *
 * HAITARIN TEKSTI PUDOTETAAN kun se on pelkkia linkkiotsikoita, jottei
 * otsikkolista jaa kuvauksen alkuun.
 *
 * HAKIJAA EI KIRJOITETA. Selostukset kertovat MAANOMISTUKSEN, ei
 * hakijaa, eika se ole sama asia: "Valtatien 2 etelapuolen" on
 * osittain yksityisessa, valtion ja kaupungin omistuksessa. Omistus
 * jaa metadataan luettavaksi, ja kenttapaatos on Johanneksen.
 *
 *   npx tsx scripts/taydenna-kokemaen-kaavakuvaukset.ts
 *   npx tsx scripts/taydenna-kokemaen-kaavakuvaukset.ts --apply
 */

import * as cheerio from "cheerio"
import {
  liitelinkit,
  onVainLiiteotsikot,
  taydennaKuvausLiitteesta,
  type LiiteBudjetti,
} from "../lib/agent/kaavanLiite"

const LISTA = "https://kokemaki.fi/asuminen-ja-ymparisto/kaavoitus-ja-maankaytto/asemakaavat/"
const LAHDE = "Kokemäen vireillä olevat asemakaavat"

/*
 * Maanomistus vain SELKEASTA lauseesta. Kuivaharjoitus nappasi ensin
 * koko pitkan tavoitevirkkeen, koska "omistamalle" osui sen sisalla --
 * siksi vaaditaan "omistuksessa" ja lyhyt lause.
 */
const OMISTUS = /\bomistuksessa\b/i
const OMISTUS_MAKS = 200

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  const r = await fetch(LISTA, { cache: "no-store", headers: { "User-Agent": "Mozilla/5.0" } })
  if (!r.ok) {
    console.error(`VIRHE: listasivu ${r.status}`)
    process.exit(1)
  }
  const $ = cheerio.load(await r.text())
  const h2 = $("h2")
    .toArray()
    .find((el) => $(el).text().trim() === "Vireillä olevat asemakaavat")
  if (!h2) {
    console.error("VIRHE: 'Vireillä olevat asemakaavat' -otsikkoa ei loytynyt")
    process.exit(1)
  }
  const accordion = $(h2).parent().next(".accordion")
  const budjetti: LiiteBudjetti = { haettu: 0, raja: 20 }

  /* Sivulta poimitut kuvaukset otsikon mukaan. */
  const sivulta = new Map<string, { kuvaus: string; omistus: string[] }>()

  for (const itemEl of accordion.find(".accordion__item").toArray()) {
    const item = $(itemEl)
    const title = item.find(".accordion__item__heading").first().text().replace(/\s+/g, " ").trim()
    if (!title || !/asemakaava/i.test(title) || /yleiskaava|ranta-asemakaava/i.test(title)) continue

    const content = item.find(".accordion__item__content").first()
    const haitari = content.text().replace(/\s+/g, " ").trim()
    const linkit = liitelinkit($, LISTA, content)
    const pohja = onVainLiiteotsikot(haitari, linkit) ? "" : haitari

    const taydennetty = (await taydennaKuvausLiitteesta(pohja, linkit, budjetti)) ?? pohja
    const omistus = taydennetty
      .split(/(?<=\.)\s+/)
      .map((l) => l.trim())
      .filter((l) => OMISTUS.test(l) && l.length <= OMISTUS_MAKS)
    sivulta.set(title, { kuvaus: taydennetty, omistus })
  }

  console.log(`\nSivulta ${sivulta.size} kaavaa, liitehakuja ${budjetti.haettu}\n`)

  /* Jonorivit samasta lahteesta: kaikki tilat paitsi ignored. */
  const rivit: any[] = []
  for (let a = 0; ; a += 500) {
    const { data, error } = await db
      .from("potential_projects")
      .select("id, title, status, kuvaus:metadata->>description, lahde:metadata->>source_name")
      .range(a, a + 499)
    if (error) {
      console.error(`VIRHE: ${error.message}`)
      process.exit(1)
    }
    rivit.push(...(data ?? []))
    if ((data ?? []).length < 500) break
  }
  const kohteet = rivit.filter((p) => String(p.lahde ?? "") === LAHDE && p.status !== "ignored")

  let muutettu = 0
  for (const p of kohteet) {
    const uusi = sivulta.get(String(p.title))
    const vanha = String(p.kuvaus ?? "")
    if (!uusi) {
      console.log(`   EI SIVULLA  ${String(p.title).slice(0, 46).padEnd(48)} [${p.status}]  kuvaus ${vanha.length}`)
      continue
    }
    if (uusi.kuvaus.length <= vanha.length) {
      console.log(`   EI PAREMPI  ${String(p.title).slice(0, 46).padEnd(48)} [${p.status}]  ${vanha.length} -> ${uusi.kuvaus.length}`)
      continue
    }

    console.log(`\n   ${String(p.title).slice(0, 52)}  [${p.status}]`)
    console.log(`      kuvaus ${vanha.length} -> ${uusi.kuvaus.length} merkkia`)
    console.log(`      "${uusi.kuvaus.slice(0, 260)}…"`)
    if (uusi.omistus.length) console.log(`      maanomistus: ${uusi.omistus.join(" / ").slice(0, 160)}`)
    muutettu += 1

    if (!apply) continue

    /* Taysi metadata vain muuttuville riveille. */
    const { data: taysi, error: lukuVirhe } = await db
      .from("potential_projects")
      .select("metadata")
      .eq("id", p.id)
      .maybeSingle()
    if (lukuVirhe || !taysi) {
      console.error(`      VIRHE luku: ${lukuVirhe?.message ?? "ei rivia"}`)
      continue
    }
    const md: Record<string, any> = { ...((taysi as any).metadata ?? {}) }
    md.description = uusi.kuvaus
    if (uusi.omistus.length) md.maanomistus_selostuksesta = uusi.omistus
    md.kuvaus_liitteesta = {
      lahde: LISTA,
      edellinen_pituus: vanha.length,
      edellinen: vanha,
      milloin: new Date().toISOString().slice(0, 10),
    }
    const { error } = await db.from("potential_projects").update({ metadata: md }).eq("id", p.id)
    if (error) console.error(`      VIRHE: ${error.message}`)
  }

  console.log(`\nJonorivit lahteesta ${kohteet.length}, taydennetaan ${muutettu}`)
  if (!apply) console.log("Ei kirjoitettu. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
