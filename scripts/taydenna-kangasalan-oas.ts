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
 * KANGASALAN KAAVAT: OAS:N ALOITE JA TAVOITTEET TAKAUTUVASTI (D-439).
 *
 * Keräin lukee nyt kaavasivun OAS-liitteestä aloitteen tekijän ja
 * Aloite-/Tavoitteet-luvut. Tämä tekee saman kannan riveille:
 *
 *   - rakennuttaja: vain tyhjään (OAS:n nimetty aloitteen tekijä)
 *   - kuvaus: vain jos nykyinen on tyhjä, sisältyy OAS:n tekstiin tai on
 *     sivun lyhyt tavoitelause (alle 250 merkkiä) ja OAS:n teksti on pidempi
 *   - dokumentti: raw_payload saa developer/oas_url/oas_kuvaus, jotta
 *     keräin ei hae samaa PDF:ää uudelleen
 *
 *   npx tsx scripts/taydenna-kangasalan-oas.ts [--apply]
 */

const LAHDE = "Kangasalan vireillä olevat asemakaavat"

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const cheerio = await import("cheerio")
  const { haeOasAloite, valitseOasLinkki } = await import("../lib/agent/oasAloite")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
  console.log(apply ? "=== AJO (--apply) ===\n" : "=== KUIVAHARJOITUS ===\n")

  const sivut = (await (
    await fetch("https://www.kangasala.fi/wp-json/wp/v2/pages?parent=843&per_page=100&_fields=id,title,link,content")
  ).json()) as any[]
  const oasSivulta = new Map<string, Awaited<ReturnType<typeof haeOasAloite>>>()
  for (const s of sivut) {
    const $ = cheerio.load(s.content?.rendered ?? "")
    const url = valitseOasLinkki($("a[href]").toArray().map((a) => ({ href: $(a).attr("href") ?? "", teksti: $(a).text() })))
    if (!url) continue
    oasSivulta.set(s.link, await haeOasAloite(url))
    await new Promise((r) => setTimeout(r, 800))
  }
  console.log(`sivuja ${sivut.length}, OAS:lla ${oasSivulta.size}\n`)

  const kuvausVaihtuu = (vanha: string | null, uusi: string | null) => {
    if (!uusi) return false
    const v = (vanha ?? "").trim()
    if (!v) return true
    if (uusi.includes(v.slice(0, 60))) return uusi.length > v.length
    return v.length < 250 && uusi.length > v.length
  }

  const kasittele = async (taulu: "projects" | "potential_projects", rivit: any[]) => {
    for (const r of rivit) {
      const md: any = r.metadata ?? {}
      const oas = oasSivulta.get(md.source_url ?? md.documents_url)
      if (!oas) continue
      const vanhaKuvaus = taulu === "projects" ? (r.additional_info ?? md.description ?? null) : (md.description ?? null)
      const vanhaKehittaja = taulu === "projects" ? r.developer : md.developer
      const uusiKehittaja = !vanhaKehittaja && oas.aloitteentekija ? oas.aloitteentekija : null
      const kuvaus = kuvausVaihtuu(vanhaKuvaus, oas.kuvaus)
      if (!uusiKehittaja && !kuvaus) continue
      const nimi = taulu === "projects" ? r.name : r.title
      console.log(
        `${taulu === "projects" ? "hanke" : `jono(${r.status})`} ${r.id.slice(0, 8)} ${String(nimi).slice(0, 50).padEnd(50)} | ${uusiKehittaja ? `rakennuttaja ${uusiKehittaja} | ` : ""}${kuvaus ? `kuvaus ${vanhaKuvaus?.length ?? 0} -> ${oas.kuvaus!.length}` : ""}`
      )
      if (!apply) continue
      const uusiMd: any = {
        ...md,
        oas_url: oas.url,
        ...(kuvaus ? { description: oas.kuvaus } : {}),
        ...(uusiKehittaja
          ? {
              developer: uusiKehittaja,
              related_companies: Array.from(new Set([...(md.related_companies ?? []), uusiKehittaja])),
              field_sources: { ...(md.field_sources ?? {}), developer: "OAS:n Aloite-luku" },
            }
          : {}),
      }
      const paivitys: any = { metadata: uusiMd }
      if (taulu === "projects") {
        if (kuvaus) paivitys.additional_info = oas.kuvaus
        if (uusiKehittaja) paivitys.developer = uusiKehittaja
      }
      const { error } = await db.from(taulu).update(paivitys).eq("id", r.id)
      if (error) console.log(`  VIRHE ${error.message}`)
    }
  }

  const { data: hankkeet } = await db.from("projects").select("id,name,developer,additional_info,metadata").eq("metadata->>source_name", LAHDE)
  const { data: jono } = await db.from("potential_projects").select("id,title,status,metadata").eq("metadata->>source_name", LAHDE)
  await kasittele("projects", hankkeet ?? [])
  await kasittele("potential_projects", jono ?? [])

  if (apply) {
    const { data: docs } = await db.from("source_documents").select("id,document_url,raw_payload").eq("source_name", LAHDE)
    for (const d of docs ?? []) {
      const oas = oasSivulta.get(d.document_url)
      if (!oas) continue
      const p: any = d.raw_payload ?? {}
      await db
        .from("source_documents")
        .update({
          raw_payload: {
            ...p,
            developer: p.developer ?? oas.aloitteentekija,
            oas_url: oas.url,
            oas_kuvaus: oas.kuvaus,
            ...(kuvausVaihtuu(p.description ?? null, oas.kuvaus) ? { description: oas.kuvaus } : {}),
          },
        })
        .eq("id", d.id)
    }
  } else console.log("\nEi muutettu mitään. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
