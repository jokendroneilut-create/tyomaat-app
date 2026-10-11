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
 * HELSINGIN OHUET KAAVAKUVAUKSET LIITTEISTA TAKAUTUVASTI (D-270).
 *
 * Kerain hakee ne nyt myos ohuille (ei vain tyhjille), mutta jo tuodut
 * rivit jaavat ennalleen. Mitattu 11.10.2026: SUKKA:n 228 kaavasta
 * 64:lla kuvaus oli alle 200 merkkia; kymmenen otoksesta yhdeksan
 * piteni 444-600 merkkiin.
 *
 * PISIN VOITTAA eika mitaan ylikirjoiteta lyhyemmalla.
 *
 *   npx tsx scripts/korjaa-helsingin-kaavakuvaukset.ts
 *   npx tsx scripts/korjaa-helsingin-kaavakuvaukset.ts --apply
 */

const LAHDE = "Helsingin vireillä olevat asemakaavat (SUKKA)"
const SUKKA_URL = "https://kartta.hel.fi/api-sw/layer/sukka_asemakaava_user/feature"
const MIN_KUVAUS = 200
const MAX_PITUUS = 1200

function poimiOas(pdfText: string): string | null {
  const clean = pdfText.replace(/\r/g, "").replace(/-\n/g, "").replace(/[ \t]+/g, " ")
  const heading = clean.match(/Suunnittelun tavoit[a-zä]*(?:\s+ja\s+alue)?/i)
  if (!heading) return null
  let after = clean.slice(heading.index! + heading[0].length)
  const stop = after.search(
    /\n\s*(Osallistuminen|Vaikutusten arviointi|Aikataulu|Kaavan valmistelu|Nykytilanne|Lisätiedot|Mielipiteet|Kaavoituksen|Suunnittelun taustaa)/i
  )
  if (stop > 0) after = after.slice(0, stop)
  const desc = after
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !/^\d{1,3}$/.test(l))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
  /* Sivutunniste "2 (6)" pois (sama kuin keraimessa). */
  const siivottu = desc.replace(/^\d{1,3}\s*\(\d{1,3}\)\s*/, "").trim()
  if (!siivottu) return null
  if (siivottu.length <= MAX_PITUUS) return siivottu
  const leikattu = siivottu.slice(0, MAX_PITUUS)
  const piste = leikattu.lastIndexOf(". ")
  return piste > MAX_PITUUS * 0.5 ? leikattu.slice(0, piste + 1) : `${leikattu.trim()}…`
}

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const { valitseKaavaselostus } = await import("../lib/agent/kaavanKuvaus")
  const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default as any

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const attRes = await fetch(SUKKA_URL.replace("sukka_asemakaava_user", "sukka_attachment"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ bbox: [0, 0, 99999999, 99999999], srs: "EPSG:3879" }),
    cache: "no-store",
  })
  if (!attRes.ok) throw new Error(`liitteiden haku epaonnistui: ${attRes.status}`)
  const attJson = await attRes.json()
  const liitteet = new Map<number, { teksti: string; href: string }[]>()
  const oasUrl = new Map<number, string>()
  for (const a of attJson.features ?? []) {
    const pid = a.properties?.plan_id
    const nimi = String(a.properties?.name_fi ?? "").trim()
    const url = String(a.properties?.url ?? "").replace(/&#x2F;/g, "/").trim()
    if (typeof pid !== "number" || !nimi || !url) continue
    const lista = liitteet.get(pid) ?? []
    lista.push({ teksti: nimi, href: url })
    liitteet.set(pid, lista)
    if (!oasUrl.has(pid) && /osallistumis.*arviointisuunnitelma/i.test(nimi)) oasUrl.set(pid, url)
  }

  const dokit: any[] = []
  for (let f = 0; f < 20000; f += 1000) {
    const { data, error } = await db
      .from("source_documents")
      .select("id, title, document_url, raw_payload")
      .eq("source_name", LAHDE)
      .range(f, f + 999)
    if (error) throw error
    if (!data?.length) break
    dokit.push(...data)
    if (data.length < 1000) break
  }

  const ohuet = dokit.filter(
    (d) => String(((d.raw_payload ?? {}) as any).description ?? "").length < MIN_KUVAUS
  )

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")
  console.log(`dokumentteja ${dokit.length}, ohuita ${ohuet.length}\n`)

  let parani = 0
  let ei = 0

  for (const d of ohuet) {
    const hy = (d.raw_payload ?? {}) as any
    const pid = Number(hy.helsinki_plan_id ?? hy.plan_id ?? NaN)
    const nykyinen = String(hy.description ?? "")
    let paras = nykyinen

    for (const url of [oasUrl.get(pid), valitseKaavaselostus(liitteet.get(pid) ?? [])]) {
      if (!url) continue
      if (paras.length >= MIN_KUVAUS) break
      try {
        const r = await fetch(url, { headers: { accept: "application/pdf,*/*" } })
        if (!r.ok) continue
        const { text } = await pdfParse(Buffer.from(await r.arrayBuffer()))
        const ehdokas = poimiOas(text)
        if (ehdokas && ehdokas.length > paras.length) paras = ehdokas
      } catch {
        /* liite voi puuttua tai olla rikki — jatketaan */
      }
    }

    if (paras.length <= nykyinen.length) {
      ei += 1
      console.log(`  -  ${String(d.title).slice(0, 52).padEnd(54)} ${nykyinen.length} merkkia, ei parannusta`)
      continue
    }

    parani += 1
    console.log("=".repeat(98))
    console.log(`${String(d.title).slice(0, 72)}`)
    console.log(`  ${nykyinen.length} -> ${paras.length} merkkia`)
    console.log(`  ${paras.slice(0, 220)}${paras.length > 220 ? "…" : ""}`)

    if (!apply) continue

    const { error: dokVirhe } = await db
      .from("source_documents")
      .update({ raw_payload: { ...hy, description: paras }, updated_at: new Date().toISOString() })
      .eq("id", d.id)
    if (dokVirhe) {
      console.log(`  VIRHE dokumentissa: ${dokVirhe.message}`)
      continue
    }

    for (const taulu of ["potential_projects", "projects"] as const) {
      const { data: rivit } = await db
        .from(taulu)
        .select("id, metadata")
        .eq("metadata->>source_url", String(d.document_url))
      for (const r of rivit ?? []) {
        const md = ((r as any).metadata ?? {}) as any
        if (String(md.description ?? "").length >= paras.length) continue
        const { error: virhe } = await db
          .from(taulu)
          .update({ metadata: { ...md, description: paras } })
          .eq("id", (r as any).id)
        console.log(virhe ? `  VIRHE ${taulu}: ${virhe.message}` : `  TEHTY ${taulu} ${(r as any).id}`)
      }
    }
  }

  console.log("=".repeat(98))
  console.log(`parani ${parani}, ei parannusta ${ei}`)
  if (!apply) console.log("Ei muutettu mitaan. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
