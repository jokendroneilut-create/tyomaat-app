import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}
import https from "node:https"

/*
 * KUUSAMON KAAVAKUVAUKSET TAKAUTUVASTI (D-393).
 *
 * Kerain lukee nyt `<h1>`:n jalkeisen ingressin, mutta korjaus ei
 * kosketa jo haettuja sivuja. Tama ajo kay lapi Kuusamon kaavasivut ja
 * kirjoittaa kuvauksen kolmeen paikkaan: dokumenttiin, jonoriviin ja
 * hankkeeseen.
 *
 * HAKU NODE:HTTPS:LLA, kuten kerain. Yleinen taydentaja kayttaa
 * `fetch`ia Mozilla-tunnisteella, ja Kuusamon sivusto vastaa silloin
 * HTTP 500 -- keraimen oma reitti toimii, eika tunnistetta lahdeta
 * kiertamaan.
 *
 * MENETTELYTEKSTI EI KORVAA KUVAUSTA. Jos ingressia ei ole, rivi
 * jatetaan rauhaan.
 *
 *   npx tsx scripts/taydenna-kuusamon-kuvaukset.ts
 *   npx tsx scripts/taydenna-kuusamon-kuvaukset.ts --apply
 */
const APPLY = process.argv.includes("--apply")
const LAHDE = "Kuusamon vireillä olevat asemakaavat"
const TUNNISTE = "kuusamon_kuvaukset_2026_11"

function hae(url: string): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        const palat: Buffer[] = []
        res.on("data", (c) => palat.push(c as Buffer))
        res.on("end", () =>
          resolve({ status: res.statusCode ?? 0, text: Buffer.concat(palat).toString("utf-8") })
        )
      })
      .on("error", reject)
  })
}

/* Sama saanto kuin keraimessa: h1:n ja ensimmaisen haitarirruivin valista. */
function ingressistaKuvaus($: any): string | null {
  const osat: string[] = []
  let h1Nahty = false
  let haitariAlkoi = false
  $("h1, p, .accordion-row").each((_: unknown, el: unknown) => {
    if (haitariAlkoi) return
    const $el = $(el)
    /* Rivi on `li.accordion-row`, ei `div` — valitsin elementitoin. */
    if ($el.is(".accordion-row")) { haitariAlkoi = true; return }
    if ($el.is("h1")) { h1Nahty = true; return }
    if (!h1Nahty) return
    if ($el.closest("header, nav, footer, .is-sr-only").length) return
    const teksti = $el.text().replace(/\s+/g, " ").trim()
    if (teksti.length >= 40) osat.push(teksti)
  })
  const yhdessa = osat.join("\n\n").trim()
  return yhdessa || null
}

async function main() {
  const cheerio = await import("cheerio")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const { data: dokit, error } = await db
    .from("source_documents")
    .select("id,title,document_url,raw_payload")
    .eq("source_name", LAHDE)
  if (error) throw error
  console.log(`${LAHDE}: ${(dokit ?? []).length} dokumenttia\n`)

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

  let parani = 0
  let kirjoitettu = { dok: 0, jono: 0, hanke: 0 }
  const syyt = new Map<string, number>()
  const syy = (s: string) => syyt.set(s, (syyt.get(s) ?? 0) + 1)

  for (const d of dokit ?? []) {
    const hy: any = (d as any).raw_payload ?? {}
    const nykyinen = String(hy.description ?? "")
    const r = await hae(String((d as any).document_url))
    if (r.status !== 200) { syy(`sivu HTTP ${r.status}`); continue }
    const kuvaus = ingressistaKuvaus(cheerio.load(r.text))
    if (!kuvaus) { syy("ei ingressia h1:n jalkeen"); continue }
    /*
     * LYHYEMPI KELPAA KUN SE ON SIIVOTTU VERSIO SAMASTA. Ensimmainen
     * ajo kirjoitti kuvauksen perään alatunnisteen osoitteen, ja korjattu
     * sääntö tuottaa saman tekstin ilman sita — eli lyhyemman. Pelkka
     * pituusvertailu olisi estanyt oman korjauksensa.
     */
    const ekaKappale = kuvaus.split(/\n{2,}/)[0] ?? kuvaus
    const onSiivous = nykyinen.startsWith(ekaKappale)
    if (kuvaus.length <= nykyinen.length && !onSiivous) {
      syy("ingressi ei pidempi kuin nykyinen")
      continue
    }

    parani++
    console.log("=".repeat(96))
    console.log(`${String((d as any).title).slice(0, 80)}`)
    console.log(`  ${nykyinen.length} -> ${kuvaus.length} merkkia`)
    console.log(`  VANHA: ${nykyinen.slice(0, 130)}`)
    console.log(`  UUSI : ${kuvaus.slice(0, 260)}`)

    const jonorivit = jono.filter((x: any) => String((x.metadata ?? {}).source_document_id ?? "") === String((d as any).id))
    const hankerivit = hankkeet.filter(
      (x: any) =>
        String((x.metadata ?? {}).documents_url ?? "") === String((d as any).document_url) ||
        String((x.metadata ?? {}).source_url ?? "") === String((d as any).document_url)
    )
    console.log(`  jonoriviä ${jonorivit.length}, hanketta ${hankerivit.length}`)

    if (!APPLY) continue

    const { error: e1 } = await db
      .from("source_documents")
      .update({ raw_payload: { ...hy, description: kuvaus }, updated_at: new Date().toISOString() })
      .eq("id", (d as any).id)
    if (e1) console.log(`   VIRHE dokumentti: ${e1.message}`)
    else kirjoitettu.dok++

    for (const x of jonorivit) {
      const md = x.metadata ?? {}
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
      else kirjoitettu.jono++
    }

    for (const x of hankerivit) {
      const md = x.metadata ?? {}
      /*
       * VANHAA NAKYVAA TEKSTIA EI HEITETA POIS — paitsi jos se on SAMA
       * teksti aiemmasta, siivoamattomasta ajosta.
       *
       * Ensimmainen ajo kirjoitti kuvauksen perään menettelytekstin ja
       * alatunnisteen osoitteen. Kun saanto korjattiin, uusi teksti oli
       * LYHYEMPI, eika `includes`-ehto tunnistanut sita samaksi — joten
       * sama kuvaus tuli nakyviin kahdesti. Vertailu tehdaan siksi
       * ensimmaiseen kappaleeseen: jos vanha alkaa silla, se on saman
       * tekstin vanha versio ja korvataan.
       */
      const vanhaNakyva = String(x.additional_info ?? "").trim()
      const onVanhaVersio = vanhaNakyva.startsWith(ekaKappale)
      const nakyva =
        vanhaNakyva && !onVanhaVersio && !kuvaus.includes(vanhaNakyva)
          ? `${kuvaus}\n\n${vanhaNakyva}`
          : kuvaus
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
      else kirjoitettu.hanke++
    }
  }

  console.log(`\n=== ${APPLY ? "AJETTU" : "KUIVAHARJOITUS"} ===`)
  console.log(`  parani ${parani} / ${(dokit ?? []).length}`)
  if (APPLY) console.log(`  kirjoitettu: dokumentteja ${kirjoitettu.dok}, jonoriviä ${kirjoitettu.jono}, hanketta ${kirjoitettu.hanke}`)
  if (syyt.size) {
    console.log("  syyt joilla ei parantunut:")
    for (const [s, n] of [...syyt.entries()].sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(3)}  ${s}`)
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
