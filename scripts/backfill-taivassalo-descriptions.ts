import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * TAIVASSALON KAAVAKUVAUKSET TAKAUTUVASTI.
 *
 * Keraaja luki vain listauksen yhden lauseen ("vireilletulo hyvaksytty
 * kunnanhallituksessa 24.8.2026", 55 merkkia). Jokaisella kaavalla on oma
 * sivu, jolla lukee "Kuvaus kaavasta:" ja koko suunnittelualueen kuvaus:
 * kiinteistot, pinta-ala ja kaavatyon tavoite (344-833 merkkia).
 *
 * Keraaja lukee ne nyt itse, mutta fact-tyolainen kasittelee dokumentin
 * vain kerran - siksi tama ajo.
 *
 * EI LYHENNA: jos kohdesivua ei loydy tai kuvaus on lyhyempi kuin
 * nykyinen, rivi ohitetaan.
 *
 * Aja ensin ilman --apply-lippua.
 */

const APPLY = process.argv.includes("--apply")
const LISTAUS = "https://www.taivassalo.fi/asuminen/rakentaminen/kaavoitus-ja-paikkatieto"
const LABEL = "Kuvaus kaavasta:"
const END = /Takaisin\s+Kaavoitus/i
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const cheerio = await import("cheerio")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  /* 1. Kohdesivujen linkit listaukselta. */
  const r0 = await fetch(LISTAUS, { headers: { "User-Agent": UA } })
  if (!r0.ok) throw new Error(`listaus HTTP ${r0.status}`)
  const $0 = cheerio.load(await r0.text())

  const linkit = new Map<string, string>()
  $0("a").each((_, el) => {
    const href = $0(el).attr("href") ?? ""
    if (!href.includes("/kaavoitus-ja-paikkatieto/")) return
    const teksti = $0(el).text().replace(/\s+/g, " ").trim().toLowerCase()
    if (teksti) linkit.set(teksti, href.startsWith("http") ? href : `https://www.taivassalo.fi${href}`)
  })
  console.log(`kohdesivulinkkeja: ${linkit.size}`)

  /* 2. Kuvaukset kohdesivuilta. */
  const kuvaukset = new Map<string, string>()
  for (const [nimi, url] of linkit) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA } })
      if (!r.ok) continue
      const $ = cheerio.load(await r.text())
      $("script, style, noscript, nav, header, footer").remove()
      const body = $("body").text().replace(/\s+/g, " ").trim()
      const i = body.indexOf(LABEL)
      if (i < 0) continue
      let teksti = body.slice(i + LABEL.length)
      const loppu = teksti.search(END)
      if (loppu > 0) teksti = teksti.slice(0, loppu)
      teksti = teksti.trim()
      if (teksti.length >= 80) kuvaukset.set(nimi, teksti)
    } catch { /* kohdesivu on lisatieto, ei ehto */ }
  }
  console.log(`kuvauksia loytyi: ${kuvaukset.size}\n`)

  const lataa = async (t: string) => {
    const r: any[] = []
    for (let f = 0; ; f += 1000) {
      const { data, error } = await supabase.from(t).select("*").range(f, f + 999)
      if (error) throw error
      r.push(...(data ?? [])); if (!data || data.length < 1000) break
    }
    return r
  }

  console.log(APPLY ? "=== AJETAAN ===" : "=== KUIVAHARJOITUS (ei kirjoiteta) ===")

  for (const [taulu, nimiSarake] of [["potential_projects", "title"], ["projects", "name"]] as const) {
    const rivit = (await lataa(taulu)).filter((p: any) =>
      /taivassalo/i.test(String(p.metadata?.source_name ?? ""))
    )

    const paivitykset: any[] = []
    for (const p of rivit) {
      const uusi = kuvaukset.get(String(p[nimiSarake]).toLowerCase())
      if (!uusi) continue

      const nykyinen = String(p.metadata?.description ?? "").trim()
      if (nykyinen.includes(uusi)) continue

      /* Listan lause sailyy: siina on vaiheen paivamaara. */
      const yhdistetty = nykyinen ? `${nykyinen}\n\n${uusi}` : uusi
      if (yhdistetty.length <= nykyinen.length) continue

      paivitykset.push({ id: p.id, nimi: p[nimiSarake], nykyinen, yhdistetty, additional_info: p.additional_info })
    }

    console.log(`\n=== ${taulu} ===`)
    console.log(`  taivassalo-rivja: ${rivit.length}   paivitettavia: ${paivitykset.length}`)
    for (const u of paivitykset) {
      console.log(`    ${String(u.nimi).slice(0, 40).padEnd(42)} ${String(u.nykyinen.length).padStart(4)} -> ${String(u.yhdistetty.length).padStart(4)}`)
    }

    if (!APPLY) continue

    let n = 0
    for (const u of paivitykset) {
      const { data: nyt } = await supabase.from(taulu).select("metadata,additional_info").eq("id", u.id).maybeSingle()
      const meta: any = nyt?.metadata ?? {}

      const paivitys: any = { metadata: { ...meta, description: u.yhdistetty } }

      /*
       * projects-taulussa asiakkaalle nakyva teksti on additional_info.
       * Paivitetaan vain jos se on nykyinen lyhyt kuvaus - kasin
       * taydennettya ei ylikirjoiteta.
       */
      if (taulu === "projects") {
        const nykyinenInfo = String(nyt?.additional_info ?? "").trim()
        if (!nykyinenInfo || nykyinenInfo === u.nykyinen) paivitys.additional_info = u.yhdistetty
      }

      await supabase.from(taulu).update(paivitys).eq("id", u.id)
      n++
    }
    console.log(`  kirjoitettu: ${n}`)
  }

  /* 3. Lahdedokumentit, jotta putki ei palauta vanhaa. */
  if (APPLY) {
    const { data: docs } = await supabase
      .from("source_documents")
      .select("id,title,raw_payload")
      .ilike("source_name", "%taivassalo%")

    let n = 0
    for (const d of docs ?? []) {
      const uusi = kuvaukset.get(String(d.title).toLowerCase())
      if (!uusi) continue
      const rp: any = d.raw_payload ?? {}
      const nykyinen = String(rp.description ?? "")
      if (nykyinen.includes(uusi)) continue
      await supabase
        .from("source_documents")
        .update({ raw_payload: { ...rp, description: nykyinen ? `${nykyinen}\n\n${uusi}` : uusi } })
        .eq("id", d.id)
      n++
    }
    console.log(`\nlahdedokumentteja paivitetty: ${n}`)
  }
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
