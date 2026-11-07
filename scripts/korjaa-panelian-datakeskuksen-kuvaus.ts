import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * PANELIAN DATAKESKUKSEN KUVAUS OAS:STA (D-388).
 *
 * Johannes 8.11.2026: *"tasta ei ole poimittu olennaisinta eli
 * kuvausta… korjataan tahan hankkeeseen, tarkista nykyiset hankkeet
 * seka jono ja korjaa poimija etta jatkossa poimitaan tuo."*
 *
 * Kerain on korjattu (`valitseKaavanAsiakirja` ottaa nyt OAS:n kun
 * selostusta ei ole), mutta korjaus ei kosketa jo haettua dokumenttia:
 * `raw_payload.description` on null ja kerain pitaa sita haettuna, joten
 * se ei hae uudelleen. Siksi tama ajo.
 *
 * SIVU JASENNETAAN ITEMEITTAIN, kuten kerain tekee. Yleisskripti
 * `taydenna-kaavakuvaukset.ts` lukee KAIKKI sivun 90 liitelinkkia, ja
 * Euran sivulla on kaksi Panelian kaavaa — sita reittia tama rivi sai
 * kuivaharjoituksessa TOISEN kaavan selostuksen
 * (ks. muisti: listing-page-is-not-project-page).
 *
 * Kirjoittaa kaksi paikkaa:
 *   1. `source_documents.raw_payload.description` -- jottei kerain hae
 *      selostusta uudelleen joka ajolla (`varastoidut`-valimuisti).
 *   2. jonorivin `metadata.description` -- jotta kuvaus nakyy nyt.
 *
 *   npx tsx scripts/korjaa-panelian-datakeskuksen-kuvaus.ts
 *   npx tsx scripts/korjaa-panelian-datakeskuksen-kuvaus.ts --apply
 */
const APPLY = process.argv.includes("--apply")
const EHDOKAS = "7f707328-9d88-4b30-acc6-c4b9f9b6b1c0"
const DOKUMENTTI = "76df49fa-da61-4518-807e-d60ecba27a3e"
const LISTA =
  "https://www.eura.fi/asuminen-ja-ymparisto/rakentaminen-ymparisto-ja-luvat/kaavoitus-ja-maapolitiikka/"

type Item = { title: string; text: string; links: { teksti: string; href: string }[] }

async function haeItemit(): Promise<Item[]> {
  const cheerio = await import("cheerio")
  const r = await fetch(LISTA, { cache: "no-store" })
  if (!r.ok) throw new Error(`sivu HTTP ${r.status}`)
  const $ = cheerio.load(await r.text())

  const items: Item[] = []
  $("#content p").each((_, p) => {
    let current: Item | null = null
    for (const node of $(p).contents().toArray()) {
      if (node.type === "tag" && (node as any).name === "strong") {
        const title = $(node).text().replace(/\s+/g, " ").trim()
        if (title) {
          if (current) items.push(current)
          current = { title, text: title, links: [] }
          continue
        }
      }
      if (current) {
        const t = $(node).text().replace(/\s+/g, " ").trim()
        if (t) current.text += ` ${t}`
        const el = node as any
        if (el.type === "tag" && el.name === "a" && el.attribs?.href) {
          current.links.push({ teksti: $(node).text().trim(), href: el.attribs.href })
        } else if (el.type === "tag") {
          for (const a of $(node).find("a[href]").toArray()) {
            current.links.push({ teksti: $(a).text().trim(), href: $(a).attr("href") ?? "" })
          }
        }
      }
    }
    if (current) items.push(current)
  })
  return items
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { valitseKaavanAsiakirja, haeKaavaselostuksenTeksti, kaavanKuvausTekstista } =
    await import("../lib/agent/kaavanKuvaus")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const items = await haeItemit()
  const item = items.find((i) => /panelian\s+datakesku/i.test(i.title))
  if (!item) {
    console.log("Panelian datakeskusta ei loydy sivulta -- otsikko on voinut muuttua")
    return
  }

  console.log(`ITEM: ${item.title}`)
  console.log(`  liitteita ${item.links.length}:`)
  for (const l of item.links) console.log(`    "${l.teksti}" -> ${l.href}`)

  const asiakirja = valitseKaavanAsiakirja(item.links)
  console.log(`\n  valittu asiakirja: ${asiakirja ?? "EI MITAAN"}`)
  if (!asiakirja) return

  const teksti = await haeKaavaselostuksenTeksti(asiakirja)
  if (!teksti) {
    console.log("  PDF:n luku epaonnistui")
    return
  }
  const kuvaus = kaavanKuvausTekstista(teksti)
  if (!kuvaus) {
    console.log("  jasennin ei loytanyt lukua")
    return
  }

  console.log(`\n  KUVAUS (${kuvaus.length} merkkia):\n`)
  console.log(kuvaus)

  const { data: ehdokas } = await db
    .from("potential_projects")
    .select("id,title,status,metadata")
    .eq("id", EHDOKAS)
    .maybeSingle()
  const md: any = (ehdokas as any)?.metadata ?? {}
  console.log(`\n  jonorivi: ${(ehdokas as any)?.title ?? "EI LOYDY"} (${(ehdokas as any)?.status})`)
  console.log(`  nykyinen kuvaus: ${String(md.description ?? "").length} merkkia`)

  if (!APPLY) {
    console.log("\n=== KUIVAHARJOITUS ===")
    return
  }

  const { data: dok } = await db
    .from("source_documents")
    .select("raw_payload")
    .eq("id", DOKUMENTTI)
    .maybeSingle()
  const hy: any = (dok as any)?.raw_payload ?? {}
  const { error: e1 } = await db
    .from("source_documents")
    .update({ raw_payload: { ...hy, description: kuvaus }, updated_at: new Date().toISOString() })
    .eq("id", DOKUMENTTI)
  if (e1) throw e1

  const { error: e2 } = await db
    .from("potential_projects")
    .update({
      metadata: {
        ...md,
        description: kuvaus,
        /* Mista kuvaus tuli: OAS eika selostus. */
        kuvauksen_lahde: asiakirja,
      },
    })
    .eq("id", EHDOKAS)
  if (e2) throw e2

  console.log("\n=== KIRJOITETTU ===")
  console.log("  source_documents.raw_payload.description")
  console.log("  potential_projects.metadata.description")
}
main().catch((e) => { console.error(e); process.exit(1) })
