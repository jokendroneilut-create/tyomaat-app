import { readFileSync } from "node:fs"
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

import { haeKaavaselostuksenTeksti } from "../lib/agent/kaavanKuvaus"
import {
  jasennaLiitteet,
  liiteUrl,
  liiteluettelonOsoite,
  urakanLaajuus,
  valitseLiite,
} from "../lib/agent/hilmaLiitteet"

/*
 * HILMAN OHUET RIVIT TARJOUSASIAKIRJASTA (D-291).
 *
 * Johannes 15.10.2026 Hämeenkyrön ikkunaremontista: *"pitäisi poimia
 * ainakin [urakan laajuus]"*. Kuvaus oli 79 merkkiä, urakkaohjelmassa
 * lukee 212 ikkunaa, 64 parvekeovea ja seitsemän puuovea.
 *
 * KATTAVUUS ON PIENI JA SE SANOTAAN ETEEN. Otos 25 ohuesta Hilma-rivistä
 * (tasavälein 523:sta): liite löytyi 1:llä, 21:llä nolla liitettä, 3:lta
 * puuttuivat tunnisteet. Hilmassa on asiakirjat vain jos ilmoitus on
 * tehty Hilmassa; muuten ne ovat tilaajan omassa järjestelmässä
 * kirjautumisen takana. Tämä ei siis ratkaise Hilman ohuita yleisesti.
 *
 * TÄSMÄYSEHTO. D-290:n kuivaharjoituksessa yksi hanke olisi saanut
 * kokonaan toisen hankkeen tekstin. Siksi poiminnan on mainittava
 * hankkeen kunta tai jokin erotteleva sana otsikosta.
 *
 *   npx tsx scripts/taydenna-hilma-liitteista.ts
 *   npx tsx scripts/taydenna-hilma-liitteista.ts --apply
 */

const OHUT_RAJA = 400
const PARANNUS = 150
const KUVAUS_KATTO = 4000
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"

function normalisoi(s: string): string {
  return s.toLowerCase().replace(/[äå]/g, "a").replace(/ö/g, "o").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim()
}

const YLEISET = new Set([
  "urakka", "urakoitsijan", "valinta", "rakentaminen", "peruskorjaus", "hankinta",
  "rakennusurakka", "muutos", "kaupunki", "kunta", "ilmoitus", "jalki", "remontti",
])

function tasmaa(nimi: string, kunta: string | null, teksti: string): { ok: boolean; sanat: string[] } {
  const p = normalisoi(teksti)
  const sanat = normalisoi(nimi).split(" ").filter((w) => w.length >= 6 && !YLEISET.has(w))
  if (kunta && p.includes(normalisoi(kunta))) return { ok: true, sanat }
  if (!sanat.length) return { ok: false, sanat }
  return { ok: sanat.some((w) => p.includes(w)), sanat }
}

async function haeLaajuus(pid: unknown, nid: unknown): Promise<{ teksti: string; liite: string } | { syy: string }> {
  if (pid == null || nid == null) return { syy: "ei procedure/notice-tunnistetta" }
  try {
    const r = await fetch(liiteluettelonOsoite(String(pid), String(nid)), {
      cache: "no-store",
      headers: { "user-agent": UA, accept: "application/json" },
    })
    if (!r.ok) return { syy: `rajapinta HTTP ${r.status}` }
    const liitteet = jasennaLiitteet(await r.json())
    if (!liitteet.length) return { syy: "0 liitetta" }
    const valittu = valitseLiite(liitteet)
    if (!valittu) return { syy: `${liitteet.length} liitetta, ei sisaltoliitetta` }
    const pdf = await haeKaavaselostuksenTeksti(liiteUrl(valittu.id))
    if (!pdf) return { syy: `pdf ei purkautunut (${valittu.name.slice(0, 40)})` }
    const laajuus = urakanLaajuus(pdf)
    if (!laajuus) return { syy: `ei laajuusosiota (${valittu.name.slice(0, 40)})` }
    return { teksti: laajuus, liite: valittu.name }
  } catch (e: any) {
    return { syy: `virhe ${e?.message ?? e}` }
  }
}

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  /* 1. Jonorivit joita ei ole viela hyvaksytty. */
  const ehdokkaat: any[] = []
  for (let alku = 0; ; alku += 1000) {
    const { data, error } = await db.from("potential_projects").select("id, title, status, municipality, metadata").range(alku, alku + 999)
    if (error) {
      console.error("VIRHE ehdokkaat:", error.message)
      process.exit(1)
    }
    ehdokkaat.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }

  const jono = ehdokkaat.filter((e) => {
    const md = (e.metadata as any) ?? {}
    return (
      String(md.source_name ?? "") === "Hilma" &&
      e.status === "new" &&
      String(md.description ?? "").length < OHUT_RAJA
    )
  })
  console.log(`\nJONO: ohuita Hilma-rivejä tilassa new: ${jono.length}`)

  const syyt = new Map<string, number>()
  let kirjoitettu = 0
  let eiTasmaa = 0

  for (const e of jono) {
    const md = (e.metadata as any) ?? {}
    const nykyinen = String(md.description ?? "").trim()
    const tulos = await haeLaajuus(md.procedure_id, md.notice_id)

    if ("syy" in tulos) {
      syyt.set(tulos.syy.split("(")[0].trim(), (syyt.get(tulos.syy.split("(")[0].trim()) ?? 0) + 1)
      continue
    }
    if (tulos.teksti.length < nykyinen.length + PARANNUS) {
      syyt.set("ei paranna riittavasti", (syyt.get("ei paranna riittavasti") ?? 0) + 1)
      continue
    }

    const t = tasmaa(String(e.title), e.municipality, tulos.teksti)
    if (!t.ok) {
      console.log(`  EI TASMAA  ${String(e.title).slice(0, 50)}`)
      console.log(`    etsittiin kuntaa "${e.municipality}" tai sanoja [${t.sanat.join(", ")}]`)
      console.log(`    poiminta: ${tulos.teksti.slice(0, 90)}`)
      eiTasmaa++
      continue
    }

    /*
     * Tulostetaan TALLENNETTAVAN kentan pituus, ei poiminnan. Ensimmaisessa
     * versiossa loki sanoi 613 vaikka kantaan tuli 694, koska ilmoituksen
     * oma kuvaus jaa poiminnan eteen - ja ero nayttaa jalkitarkistuksessa
     * virheelta joka sita ei ole.
     */
    const kuvaus = `${nykyinen} ${tulos.teksti}`.trim().slice(0, KUVAUS_KATTO)
    console.log(`\n  [${nykyinen.length} -> ${kuvaus.length}] ${String(e.title).slice(0, 56)}`)
    console.log(`    liite: ${tulos.liite.slice(0, 70)}`)
    console.log(`    NYT:  ${nykyinen.slice(0, 100)}`)
    console.log(`    UUSI: ${kuvaus.slice(0, 220)}…`)

    if (!apply) continue

    const { error: uv } = await db
      .from("potential_projects")
      .update({
        metadata: {
          ...md,
          description: kuvaus,
          description_alkuperainen: nykyinen || null,
          description_lahde: tulos.liite,
          description_taydennetty: new Date().toISOString(),
        },
      })
      .eq("id", e.id)
    if (uv) console.log(`    VIRHE: ${uv.message}`)
    else kirjoitettu++
  }

  console.log(`\n--- jonon tulos ---`)
  console.log(`kirjoitettu:      ${kirjoitettu}`)
  console.log(`ei tasmaa:        ${eiTasmaa}`)
  for (const [s, n] of [...syyt].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${s}`)

  /*
   * 2. HYVAKSYTYT HANKKEET.
   *
   * Nakyva kentta on `additional_info`, ei `metadata.description`
   * (D-270), joten molemmat paivitetaan - muuten korjaus ei nay missaan.
   * Jonoskripti ei naita kata, koska jonorivi on jo kasitelty.
   */
  const hankkeet: any[] = []
  for (let alku = 0; ; alku += 1000) {
    const { data, error } = await db.from("projects").select("id, name, city, additional_info, metadata").range(alku, alku + 999)
    if (error) {
      console.error("VIRHE hankkeet:", error.message)
      process.exit(1)
    }
    hankkeet.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }

  const ohuetHankkeet = hankkeet.filter((p) => {
    const md = (p.metadata as any) ?? {}
    const onHilma = /hankintailmoitukset\.fi/i.test(String(md.source_url ?? "")) || String(md.source_name ?? "") === "Hilma"
    return onHilma && String(p.additional_info ?? "").length < OHUT_RAJA
  })
  console.log(`\nKANTA: ohuita Hilma-hankkeita: ${ohuetHankkeet.length}`)

  const syyt2 = new Map<string, number>()
  let kirjoitettu2 = 0
  let eiTasmaa2 = 0

  for (const p of ohuetHankkeet) {
    const md = (p.metadata as any) ?? {}
    const nykyinen = String(p.additional_info ?? "").trim()
    const tulos = await haeLaajuus(md.procedure_id, md.notice_id)

    if ("syy" in tulos) {
      const avain = tulos.syy.split("(")[0].trim()
      syyt2.set(avain, (syyt2.get(avain) ?? 0) + 1)
      continue
    }
    if (tulos.teksti.length < nykyinen.length + PARANNUS) {
      syyt2.set("ei paranna riittavasti", (syyt2.get("ei paranna riittavasti") ?? 0) + 1)
      continue
    }

    const t = tasmaa(String(p.name), p.city, tulos.teksti)
    if (!t.ok) {
      console.log(`  EI TASMAA  ${String(p.name).slice(0, 50)}`)
      console.log(`    etsittiin kuntaa "${p.city}" tai sanoja [${t.sanat.join(", ")}]`)
      console.log(`    poiminta: ${tulos.teksti.slice(0, 90)}`)
      eiTasmaa2++
      continue
    }

    const kuvaus = `${nykyinen} ${tulos.teksti}`.trim().slice(0, KUVAUS_KATTO)
    console.log(`\n  [${nykyinen.length} -> ${kuvaus.length}] ${String(p.name).slice(0, 56)}`)
    console.log(`    liite: ${tulos.liite.slice(0, 70)}`)
    console.log(`    UUSI: ${tulos.teksti.slice(0, 200)}…`)

    if (!apply) continue

    const { error: uv } = await db
      .from("projects")
      .update({
        additional_info: kuvaus,
        metadata: {
          ...md,
          description: kuvaus,
          additional_info_alkuperainen: nykyinen || null,
          description_lahde: tulos.liite,
          description_taydennetty: new Date().toISOString(),
        },
      })
      .eq("id", p.id)
    if (uv) console.log(`    VIRHE: ${uv.message}`)
    else kirjoitettu2++
  }

  console.log(`\n--- kannan tulos ---`)
  console.log(`kirjoitettu:      ${kirjoitettu2}`)
  console.log(`ei tasmaa:        ${eiTasmaa2}`)
  for (const [s, n] of [...syyt2].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${s}`)

  if (!apply) console.log("\nEi muutettu mitaan. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error(e?.message ?? e)
  process.exit(1)
})
