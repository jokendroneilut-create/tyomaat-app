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
 * KAAVAKUVAUS SELOSTUKSESTA, MIKA TAHANSA KAAVALAHDE (D-271).
 *
 * Sama tyo kuin Euralle (D-268) ja Helsingille (D-270), mutta lahteen
 * nimi annetaan argumenttina: dokumentin `document_url` on hankkeen oma
 * sivu, jolta liitteet luetaan. Jasennin ja valitsija ovat jaettuja,
 * vain sivurakenne vaihtelee ([[kaava-parser-vs-page]]).
 *
 * LISTAUSSIVUSUOJA. Osalla kunnista `document_url` osoittaa koko
 * kaavoitussivulle, jolla on KAIKKIEN kaavojen liitteet: mitattu
 * 11.10.2026 Nokia 300 pdf-linkkia, Pelkosenniemi 199, Pornainen 85,
 * Karkkila 46. Ensimmaisen selostuksen poimiminen liittaisi TOISEN
 * hankkeen tekstin. Siksi: jos linkkeja on yli `LISTAUSRAJA`, selostus
 * kelpaa vain jos sen nimi tunnistaa juuri taman kaavan (tunnus tai
 * harvinainen sana otsikosta).
 *
 *   npx tsx scripts/taydenna-kaavakuvaukset.ts "Kangasalan vireillä olevat asemakaavat"
 *   npx tsx scripts/taydenna-kaavakuvaukset.ts "..." --apply
 */

const MIN_KUVAUS = 200
const LISTAUSRAJA = 12

/* Sanoja jotka eivat yksiloi kaavaa. */
const YLEISSANA =
  /^(asemakaava|asemakaavan|kaava|kaavan|muutos|muutoksen|ranta|yleis|osa|ja|sekä|alue|alueen|kortteli|korttelin|kaupunginosa|vireillä|luonnos|ehdotus|tie|katu|kuja|puisto)$/i

function tunnisteet(otsikko: string): string[] {
  const ulos: string[] = []
  /* Kaavatunnus, esim. "697", "02-326", "Ak 216". */
  for (const m of otsikko.matchAll(/\b\d{2,4}(?:-\d{2,4})?\b/g)) ulos.push(m[0])
  /* Harvinaiset sanat: pitka, ei yleissana. */
  for (const sana of otsikko.split(/[^\wäöåÄÖÅ-]+/)) {
    if (sana.length < 6 || YLEISSANA.test(sana)) continue
    ulos.push(sana.toLowerCase())
  }
  return ulos
}

function osuukoKaavaan(linkki: { teksti: string; href: string }, otsikko: string): boolean {
  const nimi = `${decodeURIComponent(linkki.href.split("/").pop() ?? "")} ${linkki.teksti}`.toLowerCase()
  for (const t of tunnisteet(otsikko)) {
    /* Kannan alku riittaa: "Kappelinkierron" vs "kappelinkierto". */
    const kanta = t.length > 7 ? t.slice(0, -2) : t
    if (nimi.includes(kanta.toLowerCase())) return true
  }
  return false
}

async function main() {
  const lahde = process.argv[2]
  const apply = process.argv.includes("--apply")
  if (!lahde || lahde.startsWith("--")) {
    console.log('Anna lahteen nimi: npx tsx scripts/taydenna-kaavakuvaukset.ts "<source_name>"')
    process.exit(1)
  }

  const { createClient } = await import("@supabase/supabase-js")
  const cheerio = await import("cheerio")
  const { kaavanKuvausTekstista, haeKaavaselostuksenTeksti, valitseKaavaselostus } =
    await import("../lib/agent/kaavanKuvaus")

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { data: dokit, error } = await db
    .from("source_documents")
    .select("id, title, document_url, raw_payload")
    .eq("source_name", lahde)
  if (error) throw error

  const ohuet = (dokit ?? []).filter(
    (d: any) => String((d.raw_payload ?? {}).description ?? "").length < MIN_KUVAUS
  )

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")
  console.log(`${lahde}: ${dokit?.length ?? 0} dokumenttia, ohuita ${ohuet.length}\n`)

  let parani = 0
  const syyt = new Map<string, number>()
  const syy = (s: string) => syyt.set(s, (syyt.get(s) ?? 0) + 1)

  for (const d of ohuet) {
    const hy = ((d as any).raw_payload ?? {}) as any
    const otsikko = String((d as any).title ?? "")
    const sivu = String((d as any).document_url ?? "")
    const nykyinen = String(hy.description ?? "")

    let linkit: { teksti: string; href: string }[] = []
    try {
      const r = await fetch(sivu, { headers: { "user-agent": "Mozilla/5.0" } })
      if (!r.ok) {
        syy(`sivu HTTP ${r.status}`)
        continue
      }
      const $ = cheerio.load(await r.text())
      for (const a of $("a[href]").toArray()) {
        const href = $(a).attr("href") ?? ""
        if (!/\.pdf(\?|$)/i.test(href)) continue
        let kokoUrl = href
        try {
          kokoUrl = new URL(href, sivu).toString()
        } catch {
          continue
        }
        linkit.push({ teksti: $(a).text().replace(/\s+/g, " ").trim(), href: kokoUrl })
      }
    } catch {
      syy("sivun haku epaonnistui")
      continue
    }

    if (!linkit.length) {
      syy("ei pdf-liitteita")
      continue
    }

    /* Listaussivu: vaadi etta liite tunnistaa juuri taman kaavan. */
    if (linkit.length > LISTAUSRAJA) {
      const omat = linkit.filter((l) => osuukoKaavaan(l, otsikko))
      if (!omat.length) {
        syy(`listaussivu (${linkit.length} linkkia), ei tunnistettavaa liitetta`)
        continue
      }
      linkit = omat
    }

    const selostus = valitseKaavaselostus(linkit)
    if (!selostus) {
      syy("ei paaselostusta liitteissa")
      continue
    }

    const teksti = await haeKaavaselostuksenTeksti(selostus)
    if (!teksti) {
      syy("selostuksen haku epaonnistui")
      continue
    }

    const kuvaus = kaavanKuvausTekstista(teksti)
    if (!kuvaus || kuvaus.length <= nykyinen.length) {
      syy(kuvaus ? "selostus ei pidempi" : "selostuksesta ei lukua")
      continue
    }

    parani += 1
    console.log("=".repeat(98))
    console.log(`${otsikko.slice(0, 74)}`)
    console.log(`  ${nykyinen.length} -> ${kuvaus.length} merkkia  [${decodeURIComponent(selostus.split("/").pop() ?? "").slice(0, 54)}]`)
    console.log(`  ${kuvaus.slice(0, 240)}${kuvaus.length > 240 ? "…" : ""}`)

    if (!apply) continue

    const { error: dokVirhe } = await db
      .from("source_documents")
      .update({
        raw_payload: { ...hy, description: kuvaus },
        updated_at: new Date().toISOString(),
      })
      .eq("id", (d as any).id)
    if (dokVirhe) {
      console.log(`  VIRHE dokumentissa: ${dokVirhe.message}`)
      continue
    }

    for (const taulu of ["potential_projects", "projects"] as const) {
      const { data: rivit } = await db
        .from(taulu)
        .select("id, metadata")
        .eq("metadata->>source_url", sivu)
      for (const r of rivit ?? []) {
        const md = ((r as any).metadata ?? {}) as any
        if (String(md.description ?? "").length >= kuvaus.length) continue
        const { error: virhe } = await db
          .from(taulu)
          .update({ metadata: { ...md, description: kuvaus } })
          .eq("id", (r as any).id)
        console.log(virhe ? `  VIRHE ${taulu}: ${virhe.message}` : `  TEHTY ${taulu} ${(r as any).id}`)
      }
    }
  }

  console.log("=".repeat(98))
  console.log(`parani ${parani} / ${ohuet.length}`)
  console.log("syyt joilla ei parantunut:")
  for (const [s, n] of [...syyt.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(3)}  ${s}`)
  }
  if (!apply) console.log("\nEi muutettu mitaan. Aja --apply kun rivit on luettu.")
  else console.log("\nMuista: npx tsx scripts/synkronoi-kuvaus-nakyviin.ts (hankkeen nakyva kentta)")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
