import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * KAAVAN VOIMAANTULOPÄIVÄ TAKAUTUVASTI.
 *
 * Mitattu 29.8.2026: 127 hanketta näkyi asiakkaalle vaiheessa
 * "Kaavoitus" vaikka lähde kertoi kaavan tulleen voimaan — ja 59:llä
 * niistä päivää ei ollut poimittu lainkaan. Ilman päivää ei voi erottaa
 * vuoden 2026 lainvoimaista kaavaa (paras liidi) vuoden 2012 kaavasta
 * (kohde rakennettu tai ei toteudu).
 *
 * Skripti hakee hankkeen lähdesivun uudelleen ja lukee käsittelyvaiheet.
 * Poimintasääntö: lib/agent/kaavaVoimaantulo.ts.
 *
 * EI KIRJOITA VAIHETTA EIKÄ TILAA. Tämä ajo vain täydentää tiedon
 * (voimaantulopäivä ja onko kaava kumottu). Se mitä tiedosta seuraa —
 * vaiheen siirto tai vanhentaminen — on erillinen päätös, joka tehdään
 * vasta kun nämä luvut on luettu.
 *
 * Kuivaharjoitus oletuksena; kirjoittaa vasta --apply.
 *
 *   npx tsx scripts/backfill-kaava-voimaantulo.ts
 *   npx tsx scripts/backfill-kaava-voimaantulo.ts --apply
 */

const APPLY = process.argv.includes("--apply")
const VIIVE_MS = 400


function odota(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function main() {
  const cheerio: any = await import("cheerio")
  const { createClient } = await import("@supabase/supabase-js")
  const { parseKaavaPaatosTekstista } = await import("../lib/agent/kaavaVoimaantulo")
  const { anchorBlockText } = await import("../lib/agent/htmlAnchorBlock")
  /* Kaupungit jotka ovat kieltaneet koneellisen haun kirjallisesti. */
  const { kiellettyOsoite } = await import("../lib/agent/kielletytLahteet")
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  /* Dokumentit joissa lähde on kertonut kaavoituksen päättyneen. */
  const docs: any[] = []
  for (let f = 0; ; f += 1000) {
    const { data, error } = await admin
      .from("source_documents")
      .select("id,source_name,title,document_url,raw_payload")
      .not("raw_payload->>completed", "is", null)
      .range(f, f + 999)
    if (error) throw error
    docs.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  const voimassa = docs.filter((d) => d.raw_payload?.completed === true)

  const hankkeet: any[] = []
  for (let f = 0; ; f += 1000) {
    const { data } = await admin
      .from("projects")
      .select("id,name,city,phase,status,is_public,metadata")
      .range(f, f + 999)
    hankkeet.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  const urlMap = new Map<string, any>()
  for (const h of hankkeet) {
    const u = String(h.metadata?.source_url ?? "")
    if (u) urlMap.set(u, h)
  }

  /* Vain ne jotka näkyvät asiakkaalle: muut eivät ole ongelma. */
  const kohteet = voimassa
    .map((d) => ({ d, h: urlMap.get(String(d.document_url)) }))
    .filter((x) => x.h && x.h.phase !== "Valmistunut" && x.h.status !== "expired" && x.h.is_public !== false)

  const ohitetut = kohteet.filter((x) => kiellettyOsoite(String(x.d.document_url)))
  const haettavat = kohteet.filter((x) => !kiellettyOsoite(String(x.d.document_url)))

  console.log(`${APPLY ? "AJO" : "KUIVAHARJOITUS"}: ${kohteet.length} hanketta, haetaan ${haettavat.length}`)
  if (ohitetut.length) console.log(`  ohitettu ${ohitetut.length} (lähde kieltää haun)`)
  console.log("")

  const laskuri = { voimassa: 0, kumottu: 0, kesken: 0, virhe: 0, paiva: 0, eiLohkoa: 0 }
  const vuodet = new Map<string, number>()

  for (const { d, h } of haettavat) {
    let tulos: any = { tila: "kesken", paiva: null, rivi: null }
    try {
      const res = await fetch(String(d.document_url), { cache: "no-store" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const $ = cheerio.load(await res.text())
      /*
       * ANKKURI RAJAA LOHKON. Osa kunnista listaa kaikki kaavansa
       * yhdelle sivulle, jolloin koko sivun lukeminen antaa jokaiselle
       * kaavalle saman vastauksen: kuivaharjoitus antoi Pornaisten
       * viidelle kaavalle saman paivan 28.5.2018 ja Kustavin kolmelle
       * saman paivan 6.6.2022 - se oli sivun VIIMEINEN voimaantulo.
       * Jos ankkuria vastaavaa lohkoa ei loydy, paatosta ei tehda.
       */
      const ankkuri = String(d.document_url).split("#")[1] ?? ""
      let teksti = ""
      if (ankkuri) {
        const lohko = anchorBlockText($, ankkuri)
        if (!lohko) {
          laskuri.eiLohkoa++
          console.log(`  ei lohkoa  ${String(h.name).slice(0, 44)}`)
          await odota(VIIVE_MS)
          continue
        }
        teksti = lohko
      } else {
        teksti = ($("article").text() || $("body").text()).replace(/\s+/g, " ")
      }
      tulos = parseKaavaPaatosTekstista(teksti)
    } catch (e: any) {
      laskuri.virhe++
      console.log(`  VIRHE  ${String(h.name).slice(0, 44).padEnd(46)} ${String(e?.message).slice(0, 30)}`)
      await odota(VIIVE_MS)
      continue
    }

    laskuri[tulos.tila as "voimassa" | "kumottu" | "kesken"]++
    if (tulos.paiva) {
      laskuri.paiva++
      const v = tulos.paiva.slice(0, 4)
      vuodet.set(v, (vuodet.get(v) ?? 0) + 1)
    }

    console.log(
      `  ${String(tulos.tila).padEnd(9)} ${String(tulos.paiva ?? "-").padEnd(11)} ${String(h.city).slice(0, 12).padEnd(13)} ${String(h.name).slice(0, 44)}`
    )

    if (APPLY) {
      const payload = { ...(d.raw_payload ?? {}), kaava_tila: tulos.tila, voimaantulo: tulos.paiva }
      const { error: dErr } = await admin
        .from("source_documents")
        .update({ raw_payload: payload })
        .eq("id", d.id)
      if (dErr) console.log(`     dokumentti VIRHE: ${dErr.message}`)

      const md = {
        ...(h.metadata ?? {}),
        kaava_tila: tulos.tila,
        kaava_voimaantulo: tulos.paiva,
        kaava_voimaantulo_rivi: tulos.rivi,
      }
      const { error: hErr } = await admin.from("projects").update({ metadata: md }).eq("id", h.id)
      if (hErr) console.log(`     hanke VIRHE: ${hErr.message}`)
    }

    await odota(VIIVE_MS)
  }

  console.log(`
tila: voimassa ${laskuri.voimassa}  kumottu ${laskuri.kumottu}  kesken ${laskuri.kesken}  virhe ${laskuri.virhe}  ei lohkoa ${laskuri.eiLohkoa}`)
  console.log(`paiva loytyi: ${laskuri.paiva} / ${haettavat.length}`)
  console.log("\nvoimaantulovuosi:")
  for (const [k, v] of [...vuodet].sort()) console.log(`  ${k}  ${v}`)
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
export {}
