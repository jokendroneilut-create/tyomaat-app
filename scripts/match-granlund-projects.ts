import { mkdirSync, readFileSync, writeFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * GRANLUNDIN HANKKEIDEN TÄSMÄYTYS OLEMASSA OLEVIIN.
 *
 * Granlund on suunnittelija ja mukana vuosia ennen urakoitsijaa, joten
 * sama hanke on meillä usein jo toisesta lähteestä toisella nimellä.
 * Löytölähteenä Granlund antaa vain kesken olevat 6 hanketta (D-131);
 * tämä ajo hyödyntää loputkin RIKASTUKSENA.
 *
 * Kaksi tasoa, koska mittaus 26.8.2026 osoitti massatäsmäytyksen
 * vaaralliseksi (ks. lib/agent/granlundMatch.ts):
 *
 *   VARMA         otsikko käytännössä sama samassa kaupungissa -> rikastetaan
 *   KATSELMOITAVA tuotannon vertailija 50-69 -> pelkkä lista ihmiselle
 *
 * Rikastus vain TÄYDENTÄÄ tyhjiä kenttiä. Mitään olemassa olevaa ei
 * ylikirjoiteta, koska väärä täsmäytys ei saa tuhota oikeaa tietoa.
 *
 * Kuivaharjoitus oletuksena; kirjoittaa vasta --apply.
 */

const API = "https://www.granlund.fi/wp-json/wp/v2/projects"
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
const APPLY = process.argv.includes("--apply")

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { parseGranlundFields, parseGranlundDescription } = await import("../lib/agent/granlundProject")
  const { calculateMatch } = await import("../lib/agent/projectMatcher")
  const { competingTitles, normalizeTitle, titleSimilarity, CERTAIN_THRESHOLD, REVIEW_THRESHOLD } =
    await import("../lib/agent/granlundMatch")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const posts: any[] = []
  for (let page = 1; page <= 3; page++) {
    const r = await fetch(`${API}?per_page=100&page=${page}&lang=fi`, { headers: { "User-Agent": UA } })
    if (!r.ok) break
    const sivu = await r.json()
    if (!Array.isArray(sivu) || !sivu.length) break
    posts.push(...sivu)
    if (sivu.length < 100) break
  }

  const lataa = async (t: string, s: string) => {
    const r: any[] = []
    for (let f = 0; ; f += 1000) {
      const { data, error } = await supabase.from(t).select(s).range(f, f + 999)
      if (error) throw error
      r.push(...(data ?? [])); if (!data || data.length < 1000) break
    }
    return r
  }

  const projects = (await lataa("projects", "id,name,city,region,location,phase,status,developer,builder,metadata"))
    .map((p: any) => ({ ...p, taulu: "projects" }))
  const potential = (await lataa("potential_projects", "id,title,municipality,address,status,metadata"))
    .map((p: any) => ({ ...p, name: p.title, city: p.municipality, location: p.address, taulu: "potential_projects" }))
  const kaikki = [...projects, ...potential]

  console.log(`${APPLY ? "AJO" : "KUIVAHARJOITUS"}: Granlund ${posts.length} | vertailtavia ${kaikki.length}\n`)

  const asProject = (p: any) => ({
    id: p.id, name: p.name, city: p.city, region: p.region ?? p.metadata?.region ?? null,
    location: p.location ?? null, phase: p.phase ?? p.metadata?.phase_hint ?? null,
    status: p.status, developer: p.developer ?? p.metadata?.developer ?? null,
    builder: p.builder ?? p.metadata?.builder ?? null,
  })

  const varmat: any[] = []
  const katselmoitavat: any[] = []

  /*
   * Kaupungeittain kaikki lahteen otsikot, jotta saman rakennuksen
   * useampi hanke voidaan havaita ennen tasmaytysta.
   */
  const puhdistaOtsikko = (post: any) =>
    String(post?.title?.rendered ?? "").replace(/&#8211;/g, "–").replace(/&amp;/g, "&")
  const kaupungeittain = new Map<string, { title: string }[]>()
  for (const post of posts) {
    const c = parseGranlundFields(post?.content?.rendered ?? "").city
    if (!c) continue
    const avain = c.trim().toLowerCase()
    const lista = kaupungeittain.get(avain) ?? []
    lista.push({ title: puhdistaOtsikko(post) })
    kaupungeittain.set(avain, lista)
  }
  const kaupunginPostit = (c: string) => kaupungeittain.get(c.trim().toLowerCase()) ?? []

  for (const post of posts) {
    const html = post?.content?.rendered ?? ""
    const f = parseGranlundFields(html)
    const title = String(post?.title?.rendered ?? "").replace(/&#8211;/g, "–").replace(/&amp;/g, "&")
    if (!f.city) continue

    /* Vertailu vain saman kaupungin sisalla, kuten tuotannossa. */
    const ehdokkaat = kaikki.filter(
      (p) => String(p.city ?? "").trim().toLowerCase() === f.city!.trim().toLowerCase()
    )
    if (!ehdokkaat.length) continue

    const gTitle = normalizeTitle(title)
    let paras: any = null, pisteet = 0, parasNimi: any = null, nimiOsuus = 0

    for (const p of ehdokkaat) {
      const c = calculateMatch(asProject(p), {
        name: title, sourceTitle: title, city: f.city, region: null,
        location: null, propertyId: null, developer: f.developer ?? null,
        buildingType: f.projectType ?? null,
        description: parseGranlundDescription(html) ?? null,
      })?.confidence ?? 0
      if (c > pisteet) { pisteet = c; paras = p }

      const s = titleSimilarity(gTitle, normalizeTitle(p.name))
      if (s > nimiOsuus) { nimiOsuus = s; parasNimi = p }
    }

    const rivi = {
      granlundId: post.id, granlundUrl: post?.link ?? "", title, kentat: f,
      kuvaus: parseGranlundDescription(html) ?? null,
    }

    /*
     * Otsikko tunnistaa rakennuksen, ei hanketta. Jos samasta talosta on
     * Granlundilla useampi hanke, kumpaakaan ei tasmayteta - ks.
     * Finlandia-tapaus lib/agent/granlundMatch.ts.
     */
    const kilpailijat = parasNimi
      ? competingTitles(
          parasNimi.name,
          kaupunginPostit(String(f.city)).map((q) => q.title)
        )
      : 0

    if (nimiOsuus >= CERTAIN_THRESHOLD && parasNimi && kilpailijat <= 1) {
      varmat.push({ ...rivi, kohde: parasNimi, nimiOsuus, pisteet })
    } else if (nimiOsuus >= CERTAIN_THRESHOLD && parasNimi) {
      katselmoitavat.push({
        granlund: title, granlundUrl: rivi.granlundUrl, kaupunki: f.city,
        tilaaja: f.developer, meilla: parasNimi.name, meillaId: parasNimi.id,
        taulu: parasNimi.taulu, pisteet, nimiOsuus: Number(nimiOsuus.toFixed(2)),
        syy: `saman rakennuksen hankkeita lahteessa ${kilpailijat}`,
      })
    } else if (pisteet >= REVIEW_THRESHOLD && paras) {
      katselmoitavat.push({
        granlund: title, granlundUrl: rivi.granlundUrl, kaupunki: f.city,
        tilaaja: f.developer, meilla: paras.name, meillaId: paras.id,
        taulu: paras.taulu, pisteet, nimiOsuus: Number(nimiOsuus.toFixed(2)),
      })
    }
  }

  console.log(`  VARMAT (nimi >= ${CERTAIN_THRESHOLD}): ${varmat.length}`)
  console.log(`  KATSELMOITAVAT (${REVIEW_THRESHOLD}-69): ${katselmoitavat.length}\n`)

  /* Rikastus taydentaa vain tyhjia kenttia. */
  for (const v of varmat) {
    const p = v.kohde
    const meta = { ...(p.metadata ?? {}) }
    const muutokset: string[] = []
    const aseta = (avain: string, arvo: any, nykyinen: any) => {
      if (arvo == null || arvo === "" || (nykyinen != null && nykyinen !== "")) return
      meta[avain] = arvo
      muutokset.push(`${avain}=${String(arvo).slice(0, 40)}`)
    }

    aseta("developer", v.kentat.developer, p.developer ?? meta.developer)
    aseta("estimated_completion", v.kentat.estimatedCompletion, meta.estimated_completion)
    aseta("floor_area_text", v.kentat.area, meta.floor_area_text)
    aseta("building_type", v.kentat.projectType, meta.building_type)

    /* Suunnittelija lisataan mukana oleviin, ei koskaan urakoitsijaksi. */
    const yritykset: any[] = Array.isArray(meta.related_companies) ? [...meta.related_companies] : []
    if (!yritykset.some((y) => String(y?.name ?? "").toLowerCase().includes("granlund"))) {
      yritykset.push({ name: "Granlund", roles: v.kentat.granlundServices, source: v.granlundUrl })
      meta.related_companies = yritykset
      muutokset.push("related_companies+Granlund")
    }
    if (!meta.granlund_post_id) { meta.granlund_post_id = String(v.granlundId); muutokset.push("granlund_post_id") }

    console.log(`  ${v.nimiOsuus.toFixed(2)} "${v.title}"`)
    console.log(`     -> ${p.taulu === "projects" ? "hanke" : "jono"} ${p.name}  [${p.id}]`)
    console.log(`     ${muutokset.length ? muutokset.join(", ") : "ei muutettavaa (kentat jo taytetty)"}`)

    if (!APPLY || !muutokset.length) continue

    const paivitys: any = { metadata: meta }
    if (p.taulu === "projects" && !p.developer && v.kentat.developer) paivitys.developer = v.kentat.developer
    const { error } = await supabase.from(p.taulu).update(paivitys).eq("id", p.id)
    if (error) { console.log(`     VIRHE: ${error.message}`); continue }
    console.log(`     tallennettu`)
  }

  mkdirSync("C:/Users/johan/tyomaat-app/scripts/out", { recursive: true })
  const polku = "C:/Users/johan/tyomaat-app/scripts/out/granlund-review.json"
  writeFileSync(polku, JSON.stringify(katselmoitavat, null, 2), "utf8")
  console.log(`\n  katselmointilista: ${polku}`)
  for (const k of katselmoitavat) {
    console.log(`  ${String(k.pisteet).padStart(3)}  ${k.granlund.slice(0, 44).padEnd(46)} -> ${String(k.meilla).slice(0, 44)}`)
  }
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
export {}
