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
 * VIHDIN KAAVAN VALMISTELIJA TAKAUTUVASTI (D-428).
 *
 * Keräin poimii jatkossa kaavasivun "Kaavan valmistelija: <nimi>" ja hakee
 * puhelimen kaavoituksen yhteystietosivulta. Tämä tekee saman jo
 * kannassa ja jonossa oleville Vihdin kaavariveille: hakee jokaisen
 * kaavasivun, ja lisää valmistelijan yhteyshenkilöksi jos häntä ei vielä
 * ole. Olemassa olevat yhteyshenkilöt säilyvät.
 *
 *   npx tsx scripts/taydenna-vihdin-valmistelijat.ts
 *   npx tsx scripts/taydenna-vihdin-valmistelijat.ts --apply
 */

const LAHDE = "Vihdin vireillä olevat asemakaavat"

async function main() {
  const apply = process.argv.includes("--apply")
  const cheerio = await import("cheerio")
  const { createClient } = await import("@supabase/supabase-js")
  const { VIHTI_KAAVOITUS_YHTEYSTIEDOT, jasennaVihtiYhteystiedot, vihtiLaatikonYhteyshenkilot } =
    await import("../lib/agent/vihtiKaavaYhteys")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
  console.log(apply ? "=== AJO (--apply) ===\n" : "=== KUIVAHARJOITUS ===\n")

  const henkilot = jasennaVihtiYhteystiedot(await (await fetch(VIHTI_KAAVOITUS_YHTEYSTIEDOT)).text())
  console.log(`yhteystietosivulta ${henkilot.size} henkilöä\n`)

  const { data: jono } = await db
    .from("potential_projects")
    .select("id,title,status,metadata")
    .eq("metadata->>source_name", LAHDE)
    .in("status", ["new", "approved"])
  const { data: hankkeet } = await db
    .from("projects")
    .select("id,name,is_public,metadata")
    .eq("metadata->>source_name", LAHDE)

  const sivut = new Map<string, any[]>()
  async function henkilotSivulta(url: string): Promise<any[]> {
    if (!sivut.has(url)) {
      try {
        const $ = cheerio.load(await (await fetch(url)).text())
        sivut.set(url, vihtiLaatikonYhteyshenkilot($(".s-content-box__contacts").html() ?? "", henkilot))
      } catch {
        sivut.set(url, [])
      }
      await new Promise((s) => setTimeout(s, 500))
    }
    return sivut.get(url) ?? []
  }

  let lisatty = 0
  const rivit = [
    ...(jono ?? []).map((r) => ({ taulu: "potential_projects", id: r.id, nimi: r.title, md: r.metadata as any })),
    ...(hankkeet ?? []).map((r) => ({ taulu: "projects", id: r.id, nimi: r.name, md: r.metadata as any })),
  ]
  for (const r of rivit) {
    const url = r.md?.source_url ?? r.md?.documents_url
    if (!url) continue
    const vanhat: any[] = Array.isArray(r.md.contact_persons) ? r.md.contact_persons : []
    const uudet = (await henkilotSivulta(url)).filter(
      (h) => !vanhat.some((c) => String(c?.name ?? "").toLowerCase() === h.name.toLowerCase())
    )
    if (!uudet.length) continue
    lisatty++
    console.log(`${r.taulu === "projects" ? "hanke" : "jono "} ${r.id.slice(0, 8)} | ${String(r.nimi).slice(0, 55)} | + ${uudet.map((u) => `${u.name} ${u.phone ?? "-"}`).join("; ")}`)
    if (!apply) continue
    const { error } = await db
      .from(r.taulu)
      .update({ metadata: { ...r.md, contact_persons: [...uudet, ...vanhat] } })
      .eq("id", r.id)
    if (error) console.log(`  VIRHE ${error.message}`)
  }
  console.log(`\nrivejä ${rivit.length}, sivuja ${sivut.size}, lisättäviä ${lisatty}`)
  if (!apply) console.log("Ei muutettu mitaan. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
