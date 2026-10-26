import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * SUONENJOEN KAAVAKUVAUKSET SELOSTUKSESTA (D-351).
 *
 * Johannes 26.10.2026: *"pitaa poimia pdf:sta kuvaukseen ainakin 1.3
 * Kaavatyon tarkoitus ... korjataan tama ja tarkista onko muita
 * paassyt kantaan tai jonoon samasta lahteesta"*.
 *
 * Keraaja kirjasi kuvaukseksi liiteotsikot ("Kuulutus 17.9.2026
 * Asemakaavaselostusehdotus Asemakaavakartta Tonttijako") eika avannut
 * selostusta. Kytkenta on nyt tehty keraajaan, mutta jo kirjoitetut
 * rivit on korjattava erikseen.
 *
 * LIITTEET LUETAAN LOHKOSTA, EI KOKO SIVULTA. Sivu on kaikkien
 * vireilla olevien kaavojen listaus, ja koko sivun linkeista
 * valittaisiin toisen kaavan selostus
 * ([[listing-page-is-not-project-page]]). Lohko tunnistetaan rivin
 * otsikolla.
 *
 *   npx tsx scripts/korjaa-suonenjoen-kaavakuvaukset.ts
 *   npx tsx scripts/korjaa-suonenjoen-kaavakuvaukset.ts --apply
 */

import {
  haeKaavaselostuksenTeksti,
  kaavanKuvausTekstista,
  valitseKaavanAsiakirja,
} from "../lib/agent/kaavanKuvaus"
import { liitelinkit, omaSisalto } from "../lib/agent/kaavanLiite"

const SIVU =
  "https://www.suonenjoki.fi/asuminen-ja-ymparisto/kaavoitus-ja-maankaytto/kaavoitus/vireilla-olevat-kaavat/"
const LAHDE = "Suonenjoen kaavoitus"
const OHUT = 300

function normalisoi(teksti: string): string {
  return String(teksti ?? "")
    .toLowerCase()
    .replace(/[^\wåäö]+/g, " ")
    .trim()
}

async function main() {
  const apply = process.argv.includes("--apply")
  const cheerio = await import("cheerio")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  /* --- Sivun lohkot: otsikko -> omat liitteet --- */
  const res = await fetch(SIVU, { headers: { "user-agent": "Mozilla/5.0" }, cache: "no-store" })
  if (!res.ok) {
    console.error(`Sivu HTTP ${res.status}`)
    process.exit(1)
  }
  const $ = cheerio.load(await res.text())
  const lohkot: { otsikko: string; linkit: { href: string; teksti: string }[] }[] = []
  $(".block-link-list").each((_, el) => {
    const $el = $(el)
    const otsikko = $el.find("h2").first().text().replace(/\s+/g, " ").trim()
    if (!otsikko) return
    lohkot.push({ otsikko, linkit: liitelinkit($, SIVU, $el) })
  })
  console.log(`Sivulla lohkoja: ${lohkot.length}\n`)

  /* --- Rivit kannasta ja jonosta --- */
  type Rivi = { taulu: "projects" | "potential_projects"; id: string; otsikko: string; kuvaus: string; metadata: any }
  const rivit: Rivi[] = []

  for (const taulu of ["projects", "potential_projects"] as const) {
    const data: any[] = []
    for (let a = 0; ; a += 1000) {
      const { data: era, error } = await db
        .from(taulu)
        .select(taulu === "projects" ? "id,name,additional_info,metadata" : "id,title,status,metadata")
        .range(a, a + 999)
      if (error) {
        console.error(`VIRHE ${taulu}: ${error.message}`)
        process.exit(1)
      }
      data.push(...(era ?? []))
      if ((era ?? []).length < 1000) break
    }
    for (const r of data) {
      const nimi = String(r.metadata?.source_name ?? r.metadata?.source ?? "")
      if (nimi !== LAHDE) continue
      if (taulu === "potential_projects" && r.status === "ignored") continue
      rivit.push({
        taulu,
        id: r.id,
        otsikko: String(r.name ?? r.title ?? ""),
        kuvaus: String(r.additional_info ?? r.metadata?.description ?? ""),
        metadata: r.metadata ?? {},
      })
    }
  }
  console.log(`Rivejä lähteestä "${LAHDE}": ${rivit.length}`)

  let korjattu = 0
  const syyt = new Map<string, number>()
  const syy = (s: string) => syyt.set(s, (syyt.get(s) ?? 0) + 1)

  for (const r of rivit) {
    const lohko =
      lohkot.find((l) => normalisoi(l.otsikko) === normalisoi(r.otsikko)) ??
      lohkot.find((l) => normalisoi(l.otsikko).includes(normalisoi(r.otsikko).slice(0, 40)))
    if (!lohko) {
      syy("lohkoa ei löydy sivulta")
      continue
    }

    const oma = omaSisalto(r.kuvaus, lohko.linkit)
    if (oma.length >= OHUT) {
      syy("kuvaus on jo riittävä")
      continue
    }

    const asiakirja = valitseKaavanAsiakirja(lohko.linkit)
    if (!asiakirja) {
      syy("ei selostusta liitteissä")
      continue
    }

    const teksti = await haeKaavaselostuksenTeksti(asiakirja)
    if (!teksti) {
      syy("selostusta ei saatu luettua")
      continue
    }
    const uusi = kaavanKuvausTekstista(teksti)
    if (!uusi) {
      syy("selostuksesta ei lukua")
      continue
    }

    console.log(`\n${r.taulu === "projects" ? "HANKE" : "JONO "} ${r.otsikko.slice(0, 62)}`)
    console.log(`   vanha (${r.kuvaus.length}): ${r.kuvaus.slice(0, 90)}`)
    console.log(`   liite: ${asiakirja.split("/").pop()}`)
    console.log(`   UUSI (${uusi.length}): ${uusi.slice(0, 220)}`)
    korjattu += 1

    if (!apply) continue

    const md = { ...r.metadata, description: uusi, kuvaus_selostuksesta: { liite: asiakirja, milloin: new Date().toISOString().slice(0, 10) } }
    const paivitys: Record<string, any> = { metadata: md }
    /* Hanke nayttaa additional_info-sarakkeen ([[measure-the-field-the-user-reads]]). */
    if (r.taulu === "projects") paivitys.additional_info = uusi

    const { error } = await db.from(r.taulu).update(paivitys).eq("id", r.id)
    if (error) console.error(`   VIRHE: ${error.message}`)
  }

  console.log(`\nKorjattavia: ${korjattu} / ${rivit.length}`)
  if (syyt.size) {
    console.log("muut rivit:")
    for (const [s, n] of [...syyt.entries()].sort((a, b) => b[1] - a[1])) console.log(`   ${String(n).padStart(3)}  ${s}`)
  }
  if (!apply) console.log("\nEi kirjoitettu. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
