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
 * YMPÄRISTÖLUPALÄHTEEN HYLÄTYT UUDELLEEN KATSELMOITAVIKSI.
 *
 * Nämä hylättiin 7.8.2026, ja hylkäys oli sillä tiedolla oikea: jonorivin
 * koko kuvaus oli "Ympäristölupa-asia (diaarinro ...). Hakija: ...", eli
 * 79 merkkiä, jossa ei lue sanaakaan siitä mitä rakennetaan. Rikastin
 * (lib/agent/ymparistolupaAsiakirja.ts) hakee nyt asiakirjan ja poimii
 * kuvauksen — mitattu 10/15 riviä, mediaani 79 -> 214 merkkiä.
 *
 * Rivit eivät palaa itsestään: kaksoiskappalesuoja kysyy vain "onko tämä
 * osoite ollut jonossa", ei "mitä sille tehtiin" (importCandidate.ts).
 * Siksi tämä skripti.
 *
 * Kirjoittaa VAIN rivit joiden kuvaus parani. Jos rikastin ei saa
 * asiakirjasta mitään, rivi jää hylätyksi — tyhjää ei avata uudelleen
 * katsottavaksi, koska mikään ei ole muuttunut.
 *
 *   npx tsx scripts/avaa-ymparistolupa-hylatyt.ts
 *   npx tsx scripts/avaa-ymparistolupa-hylatyt.ts --apply
 */

/*
 * Rikastettu kuvaus voi itse osoittaa, ettei kyse ole hankkeesta.
 * Nämä ovat samat poissulut jotka lähteellä (fetchYmparistolupaSource)
 * jo on — ero on, että siellä ne luetaan OTSIKOSTA ja tässä kuvauksesta,
 * joka kertoo asian tarkemmin. Esimerkki: "Aloite koskee ... laitoksen
 * ympäristöluvan määräämistä raukeamaan." Luvan raukeaminen ei ole
 * koskaan rakennushanke, joten sitä ei nosteta katselmoitavaksi
 * uudelleen pelkästään siksi että kuvaus parani.
 */
const EI_KOSKAAN_HANKE = [
  "raukeam",
  "rauettamin",
  "koeluonteinen",
  "koetoiminta",
  "valvonta-asia",
  "lupamääräysten tarkistamin",
]

function eiKoskaanHanke(kuvaus: string): string | null {
  const pieni = kuvaus.toLowerCase()
  return EI_KOSKAAN_HANKE.find((sana) => pieni.includes(sana)) ?? null
}

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const { createYmparistolupaEnricher } = await import("../lib/agent/ymparistolupaEnricher")

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
  const rikasta = createYmparistolupaEnricher()

  const rivit: any[] = []
  for (let f = 0; f < 40000; f += 1000) {
    const { data, error } = await db
      .from("potential_projects")
      .select("id, title, status, metadata")
      .range(f, f + 999)
    if (error) throw error
    if (!data?.length) break
    rivit.push(...data)
    if (data.length < 1000) break
  }

  const kohteet = rivit.filter(
    (r) =>
      String((r.metadata ?? {}).source_name ?? "") === "ymparistolupa" &&
      r.status === "rejected"
  )

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")
  console.log(`ymparistolupalahteen hylattyja: ${kohteet.length}\n`)

  let avattavia = 0

  for (const r of kohteet) {
    const md = r.metadata ?? {}
    const vanha = String(md.description ?? "")
    const tulos = await rikasta({ source_url: md.source_url, description: vanha })
    const uusi = String(tulos?.description ?? "")

    if (!uusi || uusi === vanha) {
      console.log(`  JAA HYLATYKSI  ${String(r.title).slice(0, 56)}`)
      console.log(`      ei asiakirjaa josta lukea (kuvaus yha ${vanha.length} merkkia)`)
      continue
    }

    /* Otsikko ja kuvaus yhdessa: "koeluonteinen" oli otsikossa, ei kuvauksessa. */
    const este = eiKoskaanHanke(`${r.title} ${uusi}`)
    if (este) {
      console.log(`  JAA HYLATYKSI  ${String(r.title).slice(0, 56)}`)
      console.log(`      kuvaus osoittaa ettei ole hanke ("${este}"): "${uusi.slice(0, 110)}"`)
      continue
    }

    avattavia += 1
    console.log(`  AVATAAN        ${String(r.title).slice(0, 56)}`)
    console.log(`      ${vanha.length} -> ${uusi.length} merkkia`)
    console.log(`      "${uusi.slice(0, 190)}${uusi.length > 190 ? "..." : ""}"`)

    if (!apply) continue

    const { error } = await db
      .from("potential_projects")
      .update({
        status: "new",
        updated_at: new Date().toISOString(),
        metadata: {
          ...md,
          description: uusi,
          ymparistolupa_asiakirja: tulos?.ymparistolupa_asiakirja ?? null,
          /*
           * Aiempi hylkäys jää näkyviin: se ei ollut virhe vaan tehtiin
           * ilman kuvausta, ja se tieto kuuluu riville.
           */
          aiempi_hylkays: md.rejected_at ?? true,
          avattu_uudelleen: new Date().toISOString(),
          avattu_syy: "kuvaus haettu asiakirjasta (D-279)",
        },
      })
      .eq("id", r.id)

    console.log(error ? `      VIRHE: ${error.message}` : "      TEHTY")
  }

  console.log(`\navattavia ${avattavia} / ${kohteet.length}`)
  if (!apply) console.log("\nEi muutettu mitaan. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error(e?.message ?? e)
  process.exit(1)
})
