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
 * CLOUDNC-KAAVOJEN KUVAUKSET UUDELLEEN LAHTEESTA (D-311).
 *
 * Johannes 18.10.2026 Kajaanin Vimpelinlaakson rivista: *"tahan
 * kuvaukseen olisi pitanyt poimia myos: Asemakaavan tavoite on
 * mahdollistaa uusien palloilu- ja monitoimihallin sijoittuminen
 * Vimpelin urheilualueelle ja kehittaa urheilualuetta."*
 *
 * Keraaja luki Kajaanilta vain `.kuulutus-info`-lohkon ja Hollolalta
 * vain `.basic-content`-lohkon kolme ensimmaista kappaletta. Korjaus
 * (`cloudncKuvaus`) lukee molemmat. Vanhat rivit eivat korjaannu
 * itsestaan, koska keraaja ei kirjoita jo tuotua riviä uudelleen.
 *
 * TEKSTIA EI KEKSITA: jokainen sivu haetaan uudelleen ja kuvaus
 * lasketaan samalla funktiolla kuin keraajassa.
 *
 * KASIN MUOKATTUUN EI KOSKETA. Rivi kirjoitetaan vain jos uusi teksti
 * on PIDEMPI ja nykyinen teksti joko sisaltyy uuteen tai on tasmalleen
 * se minka VANHA poimija antaa samasta sivusta. Muuten rivi jaa
 * ennalleen ja tulostuu kohtaan "KASIN?" -- silloin joku on muokannut
 * kuvausta tai sivu on muuttunut, eika kone saa paattaa sen paalta.
 *
 * PAIVAMAARA EI KATOA. Kuulutusteksti vaihtuu sivulla kaavan edetessa:
 * Otanmaki-Alussuon sivu kertoo nyt valtuuston hyvaksynnan 9.6.2026,
 * mutta EI ENAA vireilletuloa 27.11.2024, joka on kannassa. Pelkka
 * korvaaminen havittaisi sen. Siksi jokaisesta kirjoituksesta
 * tarkistetaan nykyisen tekstin paivamaarat, ja lause, jonka paivaa
 * uusi teksti ei kerro, LIITETAAN perään. Kone ei siis koskaan vaihda
 * tiedettya paivaa tuntemattomaan.
 *
 * KUULUTUSLAUSE. Nama kaksi riviä (ja niiden hankeparit) eivat paase
 * yllaolevasta portista lapi, koska kannan teksti on kahdesta eri
 * ajankohdan kuulutuksesta koottu. Ne hyvaksytaan vain jos KAIKKI
 * nykyisen tekstin lauseet ovat kuulutuslauseita (vireilletulo,
 * nahtavillaolo, hyvaksynta, voimaantulo, valitus) -- kasin kirjoitettu
 * hankekuvaus ei koostu pelkista naista.
 *
 * KENTAT. `projects` nayttaa asiakkaalle `additional_info`-sarakkeen
 * (ks. muisti: measure-the-field-the-user-reads), joten se paivitetaan
 * yhdessa `metadata.description`-kentan kanssa. Jonorivilla kuvaus on
 * vain metadatassa.
 *
 *   npx tsx scripts/taydenna-cloudnc-kuvaukset.ts
 *   npx tsx scripts/taydenna-cloudnc-kuvaukset.ts --apply
 */

import * as cheerio from "cheerio"
import { cloudncKuvaus, siisti } from "../lib/agent/discovery/collectors/sivunKuvaus"

const UA = "Mozilla/5.0 (compatible; tyomaat.fi/1.0)"
const KAJAANI = /^https:\/\/kajaani\.cloudnc\.fi\/fi-FI\/content\//
const HOLLOLA = /^https:\/\/hollola\.cloudnc\.fi\/fi-FI\/content\//

/* Keraajien valinnat sellaisina kuin ne olivat ennen D-311:ta. */
function vanhaKuvaus($: cheerio.CheerioAPI, url: string): string | null {
  if (KAJAANI.test(url)) {
    return $(".kuulutus-info").first().text().replace(/\s+/g, " ").trim() || null
  }
  return (
    $(".basic-content p")
      .map((_, p) => $(p).text().replace(/\s+/g, " ").trim())
      .get()
      .filter(Boolean)
      .slice(0, 3)
      .join(" ") || null
  )
}

const PAIVA = /\d{1,2}\.\d{1,2}\.\d{4}/g
const KUULUTUSLAUSE =
  /vireille|vireilletulo|nähtävill|nähtäväks|nähtäville|hyväksy|voimaan|lainvoima|valitet|valitus|keskeytet|mielipiteit|kaavaprosessin ajan/i

function lauseet(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((l) => l.trim())
    .filter(Boolean)
}

/* Kannan teksti on pelkkaa kuulutusta, ei kasin kirjoitettua kuvausta. */
function onPelkkaaKuulutusta(text: string): boolean {
  const osat = lauseet(text)
  return osat.length > 0 && osat.every((l) => KUULUTUSLAUSE.test(l))
}

/* Lauseet, joiden paivamaaraa uusi teksti ei kerro -- ne sailytetaan. */
function katoavatLauseet(nykyinen: string, uusi: string): string[] {
  return lauseet(nykyinen).filter((l) => {
    const paivat = l.match(PAIVA) ?? []
    return paivat.length > 0 && paivat.some((p) => !uusi.includes(p))
  })
}

type Rivi = {
  taulu: "potential_projects" | "projects"
  id: string
  nimi: string
  status: string | null
  url: string
  nykyinen: string
  nykyinenRaaka: string
  metadata: Record<string, any>
  additionalInfo: string | null
}

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  /* --- 1. Rivit, joiden lahde on Kajaanin tai Hollolan kaavasivu --- */
  const rivit: Rivi[] = []
  for (const taulu of ["potential_projects", "projects"] as const) {
    const sarakkeet =
      taulu === "projects" ? "id, name, status, additional_info, metadata" : "id, title, status, metadata"
    for (let a = 0; ; a += 1000) {
      const { data, error } = await db
        .from(taulu)
        .select(sarakkeet)
        .or("metadata->>source_url.ilike.%cloudnc.fi%,metadata->>paatos_url.ilike.%cloudnc.fi%")
        .range(a, a + 999)
      if (error) {
        console.error(`VIRHE ${taulu}: ${error.message}`)
        process.exit(1)
      }
      for (const r of (data ?? []) as any[]) {
        const m: Record<string, any> = r.metadata ?? {}
        const url = String(m.source_url ?? m.paatos_url ?? "")
        if (!KAJAANI.test(url) && !HOLLOLA.test(url)) continue
        rivit.push({
          taulu,
          id: r.id,
          nimi: String(r.name ?? r.title ?? ""),
          status: r.status ?? null,
          url,
          nykyinen: siisti(taulu === "projects" ? (r.additional_info ?? m.description) : m.description),
          nykyinenRaaka: String(
            (taulu === "projects" ? (r.additional_info ?? m.description) : m.description) ?? ""
          ).trim(),
          metadata: m,
          additionalInfo: taulu === "projects" ? (r.additional_info ?? null) : null,
        })
      }
      if ((data ?? []).length < 1000) break
    }
  }
  console.log(`\nRivejä Kajaanin ja Hollolan kaavasivuilta: ${rivit.length}`)

  /* --- 2. Sivut kerran, vaikka samaan sivuun viittaisi monta riviä --- */
  const sivut = new Map<string, { uusi: string | null; vanha: string | null } | null>()
  for (const url of new Set(rivit.map((r) => r.url))) {
    try {
      const res = await fetch(url, { cache: "no-store", headers: { "user-agent": UA } })
      if (!res.ok) {
        sivut.set(url, null)
        continue
      }
      const $ = cheerio.load(await res.text())
      sivut.set(url, { uusi: cloudncKuvaus($), vanha: vanhaKuvaus($, url) })
    } catch {
      sivut.set(url, null)
    }
    await new Promise((r) => setTimeout(r, 350))
  }
  const eiSaatu = [...sivut.values()].filter((v) => v == null).length
  console.log(`Sivuja haettu: ${sivut.size}, ei saatu: ${eiSaatu}`)

  /* --- 3. Paatos riveittain --- */
  let kirjoitetaan = 0
  let ennallaan = 0
  let kasin = 0
  let eiSivua = 0

  for (const r of rivit) {
    const sivu = sivut.get(r.url)
    const otsikko = `${r.taulu === "projects" ? "H" : "J"} ${r.id.slice(0, 8)} ${r.nimi.slice(0, 44)}`

    if (!sivu) {
      eiSivua += 1
      console.log(`\n${otsikko}\n   SIVUA EI SAATU, jatetaan ennalleen: ${r.url}`)
      continue
    }
    /*
     * Vertailu tehdaan siistityilla teksteilla, mutta KIRJOITETAAN
     * kappalejaot sailyttava muoto: hankesivu nayttaa kuvauksen
     * `white-space: pre-wrap` -lohkossa, joten tyhja rivi erottaa
     * kappaleet myos asiakkaalle.
     */
    const uusiRaaka = (sivu.uusi ?? "").trim()
    const uusi = siisti(sivu.uusi)
    const vanha = siisti(sivu.vanha)

    /* Paiva, jota uusi teksti ei kerro, sailytetaan sellaisenaan. */
    const sailytetaan = katoavatLauseet(r.nykyinen, uusi)
    const teksti = sailytetaan.length ? `${uusiRaaka}\n\n${sailytetaan.join(" ")}` : uusiRaaka
    const tekstiSiisti = siisti(teksti)

    /*
     * Kirjoitetaan kun teksti kasvaa -- tai kun sisalto on tasmalleen
     * sama mutta kannassa oleva muoto on menettanyt kappalejaot.
     */
    const samaSisalto = tekstiSiisti === r.nykyinen
    const kappalejaotPuuttuu = samaSisalto && teksti !== r.nykyinenRaaka
    if (!uusi || (tekstiSiisti.length <= r.nykyinen.length && !kappalejaotPuuttuu)) {
      ennallaan += 1
      console.log(
        `\n${otsikko}\n   ENNALLAAN: uusi ${tekstiSiisti.length} ei ole pidempi kuin nykyinen ${r.nykyinen.length}`
      )
      continue
    }
    /* `samaSisalto` = kannassa on tasmalleen taman ajon oma tulos. */
    const koneenTeksti = samaSisalto || r.nykyinen === vanha || uusi.includes(r.nykyinen)
    const kuulutusta = !koneenTeksti && onPelkkaaKuulutusta(r.nykyinen)
    if (!koneenTeksti && !kuulutusta) {
      kasin += 1
      console.log(`\n${otsikko}`)
      console.log(`   KASIN? nykyinen teksti ei sisally uuteen eika ole vanhan poimijan tulos -- ohitetaan`)
      console.log(`   nykyinen (${r.nykyinen.length}): ${r.nykyinen.slice(0, 160)}`)
      console.log(`   uusi     (${uusi.length}): ${uusi.slice(0, 160)}`)
      continue
    }

    kirjoitetaan += 1
    console.log(
      `\n${otsikko}  [${r.status}]${kuulutusta ? "  KUULUTUS+" : ""}${kappalejaotPuuttuu ? "  KAPPALEJAOT" : ""}`
    )
    console.log(`   ${r.nykyinen.length} -> ${teksti.length} merkkiä`)
    console.log(`   nykyinen: ${r.nykyinen.slice(0, 120)}`)
    console.log(`   uusi:     ${uusi.slice(0, 300)}`)
    if (sailytetaan.length) console.log(`   SAILYTETAAN: ${sailytetaan.join(" ").slice(0, 200)}`)

    if (!apply) continue

    const md = { ...r.metadata, description: teksti, description_source: "cloudnc_kuvaus_d311" }
    const paivitys: Record<string, unknown> =
      r.taulu === "projects" ? { additional_info: teksti, metadata: md } : { metadata: md }
    const { error } = await db.from(r.taulu).update(paivitys).eq("id", r.id)
    if (error) console.error(`   VIRHE: ${error.message}`)
    else console.log(`   kirjoitettu`)
  }

  console.log(
    `\nYhteensä: kirjoitetaan ${kirjoitetaan}, ennallaan ${ennallaan}, KASIN? ${kasin}, sivua ei saatu ${eiSivua}`
  )
  if (!apply) console.log("Ei kirjoitettu. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
