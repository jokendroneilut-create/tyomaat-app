import { readFileSync } from "node:fs"

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .replace(/\r/g, "")
  .split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * EURAN KAAVOJEN KUVAUS SELOSTUKSESTA TAKAUTUVASTI (D-268).
 *
 * Kerain hakee ne nyt selostuksesta, mutta jo tuodut rivit jaavat ilman:
 * mitattu 11.10.2026 etta Euran 14 dokumentista 14 oli ilman kuvausta.
 *
 * Sivulla ei ole hankekohtaisia alasivuja, joten kaikki liitteet ovat
 * samalla listaussivulla otsikon kanssa samassa kappaleessa. Siksi sivu
 * haetaan kerran ja liitteet yhdistetaan dokumenttiin OTSIKON mukaan.
 *
 * EI YLIKIRJOITA olemassa olevaa kuvausta.
 *
 *   npx tsx scripts/korjaa-euran-kaavakuvaukset.ts
 *   npx tsx scripts/korjaa-euran-kaavakuvaukset.ts --apply
 */

const LAHDE = "Euran kaavoitus ja maapolitiikka"
const LISTAUS =
  "https://www.eura.fi/asuminen-ja-ymparisto/rakentaminen-ymparisto-ja-luvat/kaavoitus-ja-maapolitiikka/"

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const cheerio = await import("cheerio")
  const { haeKaavaselostuksenTeksti, kaavanKuvausTekstista, valitseKaavaselostus } =
    await import("../lib/agent/kaavanKuvaus")

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  /* Listaussivu kerran: otsikko -> liitelinkit. */
  const $ = cheerio.load(
    await (await fetch(LISTAUS, { headers: { "User-Agent": "Mozilla/5.0" } })).text()
  )
  const linkitOtsikolle = new Map<string, { teksti: string; href: string }[]>()
  $("#content p").each((_, p) => {
    let otsikko: string | null = null
    for (const node of $(p).contents().toArray()) {
      if (node.type === "tag" && node.name === "strong") {
        const t = $(node).text().replace(/\s+/g, " ").trim()
        if (t) {
          otsikko = t
          if (!linkitOtsikolle.has(t)) linkitOtsikolle.set(t, [])
          continue
        }
      }
      if (!otsikko) continue
      const el = node as any
      if (el.type === "tag" && el.name === "a" && el.attribs?.href) {
        linkitOtsikolle.get(otsikko)!.push({ teksti: $(node).text().trim(), href: el.attribs.href })
      } else if (el.type === "tag") {
        for (const a of $(node).find("a[href]").toArray()) {
          linkitOtsikolle
            .get(otsikko)!
            .push({ teksti: $(a).text().trim(), href: $(a).attr("href") ?? "" })
        }
      }
    }
  })

  const { data: dokit, error } = await db
    .from("source_documents")
    .select("id, title, document_url, raw_payload")
    .eq("source_name", LAHDE)
  if (error) throw error

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")
  console.log(`dokumentteja ${dokit?.length ?? 0}, sivulta otsikoita ${linkitOtsikolle.size}\n`)

  let taydennettavia = 0

  for (const d of dokit ?? []) {
    const hyoty = (d.raw_payload ?? {}) as any
    const otsikko = String(d.title ?? "")
    console.log("=".repeat(98))
    console.log(otsikko.slice(0, 92))

    if (hyoty.description) {
      console.log(`  kuvaus on jo (${String(hyoty.description).length} merkkia) — ohitetaan\n`)
      continue
    }

    const linkit = linkitOtsikolle.get(otsikko)
    if (!linkit?.length) {
      console.log("  ei liitelinkkeja sivulla (poistunut tai nimi muuttunut)\n")
      continue
    }

    const selostus = valitseKaavaselostus(linkit)
    if (!selostus) {
      console.log(`  ${linkit.length} linkkia, ei paaselostusta\n`)
      continue
    }

    const teksti = await haeKaavaselostuksenTeksti(selostus)
    if (!teksti) {
      console.log(`  selostuksen haku epaonnistui: ${selostus.split("/").pop()}\n`)
      continue
    }

    const kuvaus = kaavanKuvausTekstista(teksti)
    if (!kuvaus) {
      console.log(
        `  ${selostus.split("/").pop()}: ${teksti.length} merkkia, EI LUETTAVAA LUKUA ` +
          "(fontissa ei merkkikarttaa tai rakenne poikkeaa)\n"
      )
      continue
    }

    taydennettavia += 1
    console.log(`  selostus: ${decodeURIComponent(selostus.split("/").pop() ?? "")}`)
    console.log(`  -> kuvaus ${kuvaus.length} merkkia:`)
    console.log(`     ${kuvaus.slice(0, 300)}${kuvaus.length > 300 ? "…" : ""}`)

    if (!apply) {
      console.log()
      continue
    }

    const { error: dokVirhe } = await db
      .from("source_documents")
      .update({
        raw_payload: { ...hyoty, description: kuvaus },
        raw_text: JSON.stringify({
          title: otsikko,
          phase: hyoty.phase ?? null,
          description: kuvaus,
        }),
        updated_at: new Date().toISOString(),
      })
      .eq("id", d.id)
    if (dokVirhe) {
      console.log(`  VIRHE dokumentissa: ${dokVirhe.message}\n`)
      continue
    }

    for (const taulu of ["potential_projects", "projects"] as const) {
      const { data: rivit } = await db
        .from(taulu)
        .select("id, metadata")
        .eq("metadata->>source_url", String(d.document_url))
      for (const r of rivit ?? []) {
        const md = ((r as any).metadata ?? {}) as any
        if (md.description) continue
        const { error: virhe } = await db
          .from(taulu)
          .update({ metadata: { ...md, description: kuvaus } })
          .eq("id", (r as any).id)
        console.log(virhe ? `  VIRHE ${taulu}: ${virhe.message}` : `  TEHTY ${taulu} ${(r as any).id}`)
      }
    }
    console.log()
  }

  console.log("=".repeat(98))
  console.log(`taydennettavia ${taydennettavia}`)
  if (!apply) console.log("Ei muutettu mitaan. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
