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
 * ALOITUSPÄIVÄ HILMAN SOPIMUSKAUDESTA (D-325).
 *
 * Kohdejoukko: julkiset aktiiviset Hilma-hankkeet joilta
 * `construction_start` puuttuu ja joilla on `procedure_id` +
 * `notice_id`. Mitattu 21.10.2026: 754 riviä, joista 459 Kilpailutus ja
 * 287 Sopimus myönnetty -- laajempaa joukkoa ei ole, joten tämä on yksi
 * ajo eikä otos.
 *
 * MITÄ KIRJOITETAAN. Vain `construction_start`, ja vain kun
 * `kelpaaAloitukseksi` hyväksyy. Sopimuskauden LOPPU menee
 * `metadata.hilma_sopimuskausi.loppu`-kenttään eikä
 * `estimated_completion`-kenttään: loppu syöttäisi `autoCompleteGate`-
 * porttia, joka piilottaisi hankkeen asiakkaalta 90 vrk:n jälkeen.
 *
 * ALKUPERÄ JÄÄ TALTEEN. `metadata.hilma_sopimuskausi` kertoo mistä päivä
 * tuli, mikä oli ilmoitettu luonne ja milloin se haettiin. Käsin
 * annettua päivää ei ylikirjoiteta koskaan, koska kohdejoukossa on vain
 * rivejä joilta kenttä puuttuu ([[manual-start-dates-are-real]]).
 *
 * TULEVA PÄIVÄ ON MYÖS TIETO, mutta se on suunnitelma eikä tapahtuma.
 * Se kirjoitetaan, mutta kuivaharjoitus erottelee menneet ja tulevat
 * jotta jakauma on nähtävissä ennen päätöstä.
 *
 * VÄLIMUISTI. Yksi kuivaharjoitus on 754 rajapintakutsua eli noin viisi
 * minuuttia. Karsintasääntöjä viritettiin kolme kierrosta mitatun
 * tuotoksen perusteella, joten haetut jaksot kirjoitetaan
 * `--valimuisti`-tiedostoon ja luetaan sieltä: sääntömuutoksen
 * tarkistus kestää sekunnin eikä viittä minuuttia. `--apply` ei lue
 * välimuistia.
 *
 *   npx tsx scripts/taydenna-hilman-aloituspaivat.ts --valimuisti jaksot.json
 *   npx tsx scripts/taydenna-hilman-aloituspaivat.ts --apply
 *   npx tsx scripts/taydenna-hilman-aloituspaivat.ts --raja 50
 */

import { existsSync, writeFileSync } from "node:fs"
import { fetchHilmaSopimuskausi, kelpaaAloitukseksi, type Sopimuskausi } from "../lib/agent/hilmaSopimuskausi"

/* Hilman rajapinta kestää tämän hyvin; liitehaku käyttää samaa. */
const TAUKO_MS = 120

const nukut = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const apply = process.argv.includes("--apply")
  const rajaArg = process.argv.indexOf("--raja")
  const raja = rajaArg > -1 ? Number(process.argv[rajaArg + 1]) : Infinity
  const vmArg = process.argv.indexOf("--valimuisti")
  const vmTiedosto = vmArg > -1 ? process.argv[vmArg + 1] : null

  const valimuisti: Record<string, Sopimuskausi> =
    vmTiedosto && !apply && existsSync(vmTiedosto) ? JSON.parse(readFileSync(vmTiedosto, "utf8")) : {}
  const vmKoko = Object.keys(valimuisti).length
  if (vmKoko) console.log(`Välimuistissa ${vmKoko} jaksoa, ei haeta uudelleen.`)

  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  const rivit: any[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error } = await db
      .from("projects")
      .select("id, name, phase, is_public, status, construction_start, metadata")
      .range(a, a + 999)
    if (error) {
      console.error(`VIRHE: ${error.message}`)
      process.exit(1)
    }
    rivit.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }

  const kohteet = rivit
    .filter(
      (p) =>
        p.is_public &&
        p.status === "active" &&
        String(p.metadata?.source_name ?? "") === "Hilma" &&
        !p.construction_start &&
        p.metadata?.procedure_id &&
        p.metadata?.notice_id
    )
    .slice(0, raja === Infinity ? undefined : raja)

  console.log(`Kohdejoukko ${kohteet.length} riviä\n`)

  const nyt = new Date().toISOString().slice(0, 10)
  const hylkysyyt = new Map<string, number>()
  const vaiheittain = new Map<string, number>()
  let kirjoitettu = 0
  let mennyt = 0
  let tuleva = 0
  let virheita = 0

  for (const [i, p] of kohteet.entries()) {
    const k = valimuisti[p.id] ?? (await fetchHilmaSopimuskausi(p.metadata.procedure_id, p.metadata.notice_id))
    if (!valimuisti[p.id]) {
      valimuisti[p.id] = k
      await nukut(TAUKO_MS)
    }
    const v = kelpaaAloitukseksi(k, p.name)

    if (!v.kelpaa) {
      hylkysyyt.set(v.syy, (hylkysyyt.get(v.syy) ?? 0) + 1)
      continue
    }

    const onTuleva = k.alku! > nyt
    if (onTuleva) tuleva += 1
    else mennyt += 1
    vaiheittain.set(String(p.phase ?? "-"), (vaiheittain.get(String(p.phase ?? "-")) ?? 0) + 1)

    console.log(
      `   ${k.alku} ${onTuleva ? "tuleva" : "mennyt"} ${String(p.name).slice(0, 56).padEnd(58)} ${String(p.phase).slice(0, 18).padEnd(19)} loppu ${k.loppu ?? "?"}`
    )

    if (!apply) continue

    const md: Record<string, any> = { ...(p.metadata ?? {}) }
    md.hilma_sopimuskausi = {
      alku: k.alku,
      loppu: k.loppu,
      luonne: k.luonne,
      cpv: k.cpv,
      haettu: new Date().toISOString().slice(0, 10),
    }
    const { error } = await db
      .from("projects")
      .update({ construction_start: k.alku, metadata: md })
      .eq("id", p.id)
    if (error) {
      virheita += 1
      console.error(`      VIRHE: ${error.message}`)
      continue
    }
    kirjoitettu += 1

    if ((i + 1) % 100 === 0) console.log(`   --- käsitelty ${i + 1}/${kohteet.length} ---`)
  }

  if (vmTiedosto && !apply) {
    writeFileSync(vmTiedosto, JSON.stringify(valimuisti), "utf8")
    console.log(`\nVälimuisti kirjoitettu: ${Object.keys(valimuisti).length} jaksoa`)
  }

  const kelpaavia = mennyt + tuleva
  console.log(
    `\nKelpaa ${kelpaavia}/${kohteet.length} (${((kelpaavia / Math.max(1, kohteet.length)) * 100).toFixed(0)} %): menneitä ${mennyt}, tulevia ${tuleva}`
  )
  console.log(`  vaiheittain: ${[...vaiheittain.entries()].map(([a, b]) => `${a} ${b}`).join(", ") || "-"}`)
  console.log(`  hylkäyssyyt: ${[...hylkysyyt.entries()].sort((a, b) => b[1] - a[1]).map(([a, b]) => `${a} ${b}`).join(", ") || "-"}`)
  if (apply) console.log(`  kirjoitettu ${kirjoitettu}, virheitä ${virheita}`)
  else console.log("Ei kirjoitettu. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
