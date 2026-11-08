import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * YLIVIESKAN KAAVAKUVAUKSET LIITTEESTA TAKAUTUVASTI (D-394).
 *
 * Johannes 8.11.2026 Koskipuhdon korttelin 102 rivista: *"tasta pitaisi
 * poimia kuvaukseen liitteessa oleva kuvaus."* Keraaja luki vain sivun
 * oman tekstin, joka on menettelytietoa (mika lautakunta paatti,
 * milloin OAS on nahtavilla, mihin mielipiteet). MITA alueelle tulee
 * lukee OAS-liitteessa.
 *
 * Tama ajo kay lapi KAIKKI lahteen sivut samalla koodilla jonka keraaja
 * nyt ajaa (`kuulutuksenOmaSisalto` + `taydennaKuvausLiitteesta`) ja
 * kirjoittaa kolmeen paikkaan: dokumenttiin, jonoriviin ja
 * hankkeeseen ([[backfill-skips-queue-rows]]).
 *
 * LYHYEMPI KELPAA KUN SE ON SAMAN TEKSTIN SIIVOTTU VERSIO
 * ([[backfill-shorter-is-cleanup]]).
 *
 *   npx tsx scripts/taydenna-ylivieskan-kuvaukset.ts
 *   npx tsx scripts/taydenna-ylivieskan-kuvaukset.ts --apply
 */
const APPLY = process.argv.includes("--apply")
const TUNNISTE = "ylivieskan_liitekuvaukset_2026_11"
const LISTAUS =
  "https://www.ylivieska.fi/asuminen-ja-ymparisto/kaavoitus-ja-kaupunkisuunnittelu/laadinnassa-olevat-kaavat/"
const OTSIKOT = ["nähtävillä olevat kaavat", "vireillä olevat asemakaavat"]

async function main() {
  const cheerio = await import("cheerio")
  const { createClient } = await import("@supabase/supabase-js")
  const { taydennaKuvausLiitteesta, liitelinkit } = await import("../lib/agent/kaavanLiite")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  /* Lahteen sivut samalla saannolla kuin keraajassa. */
  const listaus = cheerio.load(await (await fetch(LISTAUS, { cache: "no-store" })).text())
  const sivut: { href: string; title: string }[] = []
  const nahty = new Set<string>()
  for (const h2 of listaus("h2").toArray()) {
    const otsikko = listaus(h2).text().replace(/\s+/g, " ").trim().toLowerCase()
    const energia = otsikko === "vireillä olevat yleiskaavat"
    if (!OTSIKOT.includes(otsikko) && !energia) continue
    for (const el of listaus(h2).nextUntil("h2").toArray()) {
      const a = listaus(el).find("a").first()
      const href = a.attr("href") ?? ""
      const title = a.text().replace(/\s+/g, " ").trim()
      if (!href || !title || nahty.has(href)) continue
      if (energia && !/tuulivoima|aurinkovoima|tuulipuisto|aurinkopuisto/i.test(title)) continue
      nahty.add(href)
      sivut.push({ href, title })
    }
  }
  console.log(`Ylivieskan kaavasivuja: ${sivut.length}\n`)

  const { data: dokit, error } = await db
    .from("source_documents")
    .select("id,title,document_url,raw_payload")
    .ilike("source_name", "%Ylivieska%")
  if (error) throw error

  const jono: any[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error: e } = await db.from("potential_projects").select("id,title,status,metadata").range(a, a + 999)
    if (e) throw e
    jono.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  const hankkeet: any[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error: e } = await db.from("projects").select("id,name,additional_info,metadata").range(a, a + 999)
    if (e) throw e
    hankkeet.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  const budjetti = { haettu: 0, raja: 40 }
  let parani = 0
  const kirjoitettu = { dok: 0, jono: 0, hanke: 0 }
  const syyt = new Map<string, number>()
  const syy = (s: string) => syyt.set(s, (syyt.get(s) ?? 0) + 1)

  for (const sivu of sivut) {
    const vastaus = await fetch(sivu.href, { cache: "no-store" })
    if (!vastaus.ok) { syy(`sivu HTTP ${vastaus.status}`); continue }
    const $ = cheerio.load(await vastaus.text())
    const content = $(".entry-content").first()

    const kappaleet = content
      .find("p")
      .toArray()
      .map((p) => $(p).text().replace(/\s+/g, " ").trim())
      .filter(Boolean)

    /* Sama saanto kuin keraajassa: yksi kappale, ei koko sivu. */
    const sivunKuvaus = kappaleet.find((p, i) => i > 0 && p.length > 40) ?? null
    const kuvaus = await taydennaKuvausLiitteesta(
      sivunKuvaus,
      liitelinkit($, sivu.href, content),
      budjetti
    )
    if (!kuvaus) { syy("ei kuvausta sivulta eika liitteesta"); continue }

    const dokumentti = (dokit ?? []).find((d: any) => String(d.document_url) === sivu.href)
    const nykyinen = String(((dokumentti as any)?.raw_payload ?? {}).description ?? "")
    /*
     * JARJESTYSLUKU KATKAISEE VIRKEJAON. "Koskipuhdon 3. kaupunginosan
     * korttelin 25..." pilkkoutuu pisteesta, joten ensimmainen "virke"
     * on 14 merkkia pitka ("Koskipuhdon 3.") -- ja silla verrattu
     * siivousehto olisi pitanyt JOKA Koskipuhdon tekstia saman tekstin
     * vanhana versiona ja kirjoittanut 974 merkin kuvauksen paalle 400
     * merkkia. Tunniste kasvatetaan siksi vahintaan 60 merkkiin.
     */
    const VERTAILUN_MIN = 60
    let ekaVirke = ""
    for (const virke of kuvaus.split(/(?<=[.!?])\s+/)) {
      ekaVirke = ekaVirke ? `${ekaVirke} ${virke}` : virke
      if (ekaVirke.length >= VERTAILUN_MIN) break
    }
    const onSiivous = Boolean(nykyinen) && nykyinen.startsWith(ekaVirke)
    if (kuvaus === nykyinen) {
      /*
       * MUUTTUMATON EI OLE PARANNUS. Ensimmainen versio laski naita
       * "parantuneiksi", koska siivousehto paastaa saman tekstin lapi --
       * ja luku 8/8 nautti onnistumiselta vaikka vain kolme sivua
       * muuttui ([[look-at-visual-work]]).
       */
      syy("sivun kuvaus yli kynnyksen, liitetta ei haettu")
      continue
    }
    if (kuvaus.length <= nykyinen.length && !onSiivous) {
      syy("ei pidempi kuin nykyinen")
      continue
    }

    parani += 1
    console.log("=".repeat(96))
    console.log(`${sivu.title}`)
    console.log(`  ${nykyinen.length} -> ${kuvaus.length} merkkia   ${sivu.href}`)
    console.log(`  VANHA: ${nykyinen.slice(0, 120) || "-"}`)
    console.log(`  UUSI : ${kuvaus}`)

    const jonorivit = jono.filter(
      (x: any) =>
        String((x.metadata ?? {}).source_url ?? "") === sivu.href ||
        (dokumentti && String((x.metadata ?? {}).source_document_id ?? "") === String((dokumentti as any).id))
    )
    const hankerivit = hankkeet.filter(
      (x: any) =>
        String((x.metadata ?? {}).source_url ?? "") === sivu.href ||
        String((x.metadata ?? {}).documents_url ?? "") === sivu.href
    )
    console.log(`  jonoriviä ${jonorivit.length}, hanketta ${hankerivit.length}`)

    if (!APPLY) continue

    if (dokumentti) {
      const hy: any = (dokumentti as any).raw_payload ?? {}
      const { error: e1 } = await db
        .from("source_documents")
        .update({ raw_payload: { ...hy, description: kuvaus }, updated_at: new Date().toISOString() })
        .eq("id", (dokumentti as any).id)
      if (e1) console.log(`   VIRHE dokumentti: ${e1.message}`)
      else kirjoitettu.dok += 1
    }

    for (const x of jonorivit) {
      const md = x.metadata ?? {}
      /*
       * KOHTEEN OMA TEKSTI RATKAISEE, EI DOKUMENTIN. Dokumentissa oli
       * Koskipuhdon korttelin 25 kohdalla 74 merkkia mutta jonorivilla
       * 974: yleinen taydentaja oli jo kayny siella. Pelkka
       * dokumenttivertailu olisi kirjoittanut lyhyemman paalle
       * ([[both-sides-can-be-wrong]]).
       */
      const kohteen = String(md.description ?? "")
      if (kuvaus.length <= kohteen.length && !kohteen.startsWith(ekaVirke)) {
        console.log(`   OHITETTU jonorivi ${x.id}: oma kuvaus ${kohteen.length} mrk pidempi`)
        continue
      }
      const { error: e2 } = await db
        .from("potential_projects")
        .update({
          metadata: {
            ...md,
            description: kuvaus,
            takautuvat_ajot: [...new Set([...(Array.isArray(md.takautuvat_ajot) ? md.takautuvat_ajot : []), TUNNISTE])],
          },
        })
        .eq("id", x.id)
      if (e2) console.log(`   VIRHE jonorivi: ${e2.message}`)
      else kirjoitettu.jono += 1
    }

    for (const x of hankerivit) {
      const md = x.metadata ?? {}
      const vanha = String(x.additional_info ?? "").trim()
      const onVanhaVersio = Boolean(vanha) && vanha.startsWith(ekaVirke)
      if (kuvaus.length <= vanha.length && !onVanhaVersio) {
        console.log(`   OHITETTU hanke ${x.id}: nakyva teksti ${vanha.length} mrk pidempi`)
        continue
      }
      const nakyva = vanha && !onVanhaVersio && !kuvaus.includes(vanha) ? `${kuvaus}\n\n${vanha}` : kuvaus
      const { error: e3 } = await db
        .from("projects")
        .update({
          additional_info: nakyva,
          metadata: {
            ...md,
            description: kuvaus,
            takautuvat_ajot: [...new Set([...(Array.isArray(md.takautuvat_ajot) ? md.takautuvat_ajot : []), TUNNISTE])],
          },
        })
        .eq("id", x.id)
      if (e3) console.log(`   VIRHE hanke: ${e3.message}`)
      else kirjoitettu.hanke += 1
    }
  }

  console.log(`\n=== ${APPLY ? "AJETTU" : "KUIVAHARJOITUS"} ===`)
  console.log(`  parani ${parani} / ${sivut.length}   liitehakuja ${budjetti.haettu}`)
  if (APPLY) console.log(`  kirjoitettu: dokumentteja ${kirjoitettu.dok}, jonoriviä ${kirjoitettu.jono}, hanketta ${kirjoitettu.hanke}`)
  if (syyt.size) {
    console.log("  syyt joilla ei parantunut:")
    for (const [s, n] of [...syyt.entries()].sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(3)}  ${s}`)
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
