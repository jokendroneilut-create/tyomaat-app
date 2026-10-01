import { readFileSync } from "node:fs"

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * YLIAIKAISET RAKENTEILLA-HANKKEET KASIN TARKISTETTUNA (D-220).
 *
 * Kvartaalitarkistus jatti 12 hanketta, joilla arvioitu valmistumispaiva
 * on mennyt mutta automatiikka ohittaa ne. KAIKKI 12 KAATUVAT PORTTIIN 1:
 * paiva on vanhempi kuin loytohetki. Portti on oikeassa - paiva ei ole
 * todiste - mutta se ei erottele kahta eri tapausta, ja ero on iso:
 *
 *   9 kpl  artikkeli oli vanha ja hanke on todella valmistunut
 *   2 kpl  paiva on luettu vaarin ja hanke on aidosti kesken
 *   1 kpl  ei voi tietaa
 *
 * Jokainen tarkistettiin lahteesta 1.10.2026. Perustelu on rivikohtainen
 * eika yksikaan nojaa otsikkoon.
 *
 *   npx tsx scripts/fix-yliaikaiset-rakenteilla.ts
 *   npx tsx scripts/fix-yliaikaiset-rakenteilla.ts --apply
 */

type Valmis = {
  id: string
  nimi: string
  valmistui: string
  todiste: string
}

/*
 * VALMISTUNEET. Paiva on lahteen kertoma, ei tuontipaiva - sama ansa
 * kuin `fix-valmistuneet-vaiheet.ts`:ssa.
 */
const VALMISTUNEET: Valmis[] = [
  {
    id: "0a6a7b0c-ca49-41b8-a2b8-6b0567ee8402",
    nimi: "Asunto Oy Helsingin Atsalea, Haaga (Pohjola Rakennus)",
    valmistui: "2023-11-30",
    todiste:
      'Pohjola Rakennuksen artikkeli: "Helsingin Atsalean rakennustyot ovat alkaneet heinakuussa 2022 ja kodit valmistuvat arviolta marraskuussa 2023."',
  },
  {
    id: "6d07d8b6-9973-40d2-9081-bf00380dd87c",
    nimi: "Pohjola Rakennus, kuusi asuinkerrostaloa neljassa kaupungissa",
    valmistui: "2025-08-31",
    todiste:
      'Pohjola Rakennuksen artikkeli (2023): kohteet valmistuvat "syksylla 2024" ja viimeisin "arviolta kesalla 2025" - koko kokonaisuus on ohi.',
  },
  {
    id: "b958fc0d-66d5-4577-af45-c683087020e2",
    nimi: "Karjalan lennoston kasarmi, Rissalan tukikohta",
    valmistui: "2025-01-21",
    todiste:
      'Puolustuskiinteistojen tiedote: "Karjalan lennoston uusi kasarmi on valmistunut Rissalan tukikohtaan. Rakennus vihittiin kayttoon juhlallisin menoin 21. tammikuuta."',
  },
  {
    id: "af682d07-fa01-4671-bec7-ab8e17389f4e",
    nimi: "Vuorikatu 3 peruskorjaus, Helsinki (Skanska)",
    valmistui: "2025-11-30",
    todiste:
      'Skanskan tiedote: "Tyot kaynnistyvat lokakuussa 2024 ja urakka valmistuu marraskuussa 2025." Urakan arvo 29 M EUR.',
  },
  {
    id: "6df32dcd-f860-4d26-bd30-5dfbbe0e3c22",
    nimi: "Purku-urakka Viitaniementie 2 ja Nisulankatu 15-17, Jyvaskyla",
    valmistui: "2025-07-11",
    todiste:
      "Jyvaskylan hankintapaatos 21.5.2025: urakka Purkupiha Oy:lle 85 094 EUR, arvioitu valmistumisaika 11.7.2025.",
  },
  {
    id: "d53b1aa1-4f30-419e-b49c-8acc218ba052",
    nimi: "Julan myymalarakennus, paakaupunkiseutu (Hartela)",
    valmistui: "2025-12-31",
    todiste:
      'Hartelan tiedote: "Hankkeen rakentaminen on alkanut maaliskuussa ja sen odotetaan valmistuvan loppuvuonna 2025."',
  },
  {
    id: "e753b699-17fe-4dcc-b425-92238bf88f91",
    nimi: "Purku-urakka ja maaperan puhdistus, Salmirannantie 3, Jyvaskyla",
    valmistui: "2025-07-11",
    todiste:
      "Jyvaskylan hankintapaatos 13.5.2025: urakka Maansiirto Harry Makela Oy:lle 102 450 EUR, arvioitu valmistumisaika 11.7.2025.",
  },
  {
    id: "e9e28d77-946b-4480-98e6-599acbafb81b",
    nimi: "Vantaan uusi oikeustalo",
    valmistui: "2026-06-02",
    todiste:
      'NCC:n tiedote 2.6.2026 "Vantaan uusi oikeustalo valmistui Tikkurilaan": "Talon muutot ovat alkaneet suunnitellusti ja talo otetaan kayttoon kesakuusta alkaen vaiheittain."',
  },
  {
    id: "8bc29c89-09b4-4eb8-8e45-39fee096122d",
    nimi: "Jyvaskylan oikeustalon peruskorjaus ja laajennus",
    valmistui: "2026-02-20",
    todiste:
      'Keskisuomalainen 20.2.2026: "Keskella kaupunkia sijaitsevan Jyvaskylan oikeustalon laajennus- ja peruskorjaushanke on valmistunut." Oikeudenkaynnit alkoivat 9.3.2026. Hanke 21,9 M EUR.',
  },
]

type Paiva = {
  id: string
  nimi: string
  /* null = tyhjennetaan, koska tyhja on parempi kuin vaara. */
  arvioValmis: string | null
  rakentamisenAlku?: string | null
  rakentaja?: string
  todiste: string
}

/*
 * AIDOSTI KESKEN, PAIVA VAARIN. Nama EI saa piilottaa - vaiheeseen ei
 * kosketa, vain virheellinen paiva korjataan.
 */
const PAIVAKORJAUKSET: Paiva[] = [
  {
    id: "50b5119a-6668-40da-bef0-3fd21a586de2",
    nimi: "Roihupellon raitiovaunuvarikon laajennus, Helsinki",
    arvioValmis: "2027-08-31",
    /*
     * Aloituspaiva oli loytohetki + 1 vrk, ei lahteen tieto: tarjous-
     * aineisto julkaistiin 19.2.2026, joten rakentaminen ei voinut alkaa
     * 23.2.2026. Tyhjennetaan - tyhja on parempi kuin vaara.
     */
    rakentamisenAlku: null,
    rakentaja: "VM Suomalainen",
    todiste:
      'Kaupunkiliikenne Oy 18.6.2026: "Rakentaminen alkaa kesan aikana", valmistuminen "noin vuoden kuluttua rakentamisen aloituksesta", paaurakoitsijana VM Suomalainen. Vanha paiva 2022-12-31 oli Raide-Jokerin varikosta, joka on eri hanke.',
  },
  {
    id: "ea695ab7-cdf7-43a5-b8ad-d19073f28830",
    nimi: "Helsingin uudet tekonurmikentat ja Ojapuiston liikuntapuisto",
    arvioValmis: "2026-11-30",
    todiste:
      'Helsingin kaupungin tiedote 24.4.2026: "Puiston rakennustyot alkavat toukokuussa ja valmistuvat suunnitelmien mukaan loka-marraskuussa." Vanha paiva 2025-12-31 oli esirakentamisesta, joka valmistui 2025.',
  },
]

/*
 * EI VOI TIETAA. Vaylan sivu on vuoden 2026 TYOLISTA, ei tilannekatsaus:
 * se kertoo aikataulun 04-06/2026 mutta ei kerro valmistumisesta. Muuta
 * lahdetta ei ole. Jatetaan nakyviin - kesken oleva hanke piilotettuna
 * on pahempi kuin valmistunut listalla. Seuraavalla kierroksella Vaylan
 * sivu on vaihtunut vuoteen 2027, ja sillan puuttuminen listalta on
 * itsessaan signaali.
 */
const JATETAAN = [{ id: "975c3fc4-97ed-4a1e-b10c-8320ce2d1176", nimi: "SK-675 Valijoen silta, Kuopio" }]

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const { PHASE_LABELS } = await import("../lib/projects/phases")
  const { recordPhaseChange } = await import("../lib/projects/recordPhaseChange")

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")
  console.log(`valmistuneita ${VALMISTUNEET.length}, paivakorjauksia ${PAIVAKORJAUKSET.length}, jatetaan ${JATETAAN.length}\n`)

  console.log("--- 1. VALMISTUNEET: vaihe + status + completed_at ---\n")
  for (const k of VALMISTUNEET) {
    const { data: p, error } = await db
      .from("projects")
      .select("id, name, city, phase, status, estimated_completion")
      .eq("id", k.id)
      .maybeSingle()
    if (error) throw error
    if (!p) {
      console.log(`PUUTTUU ${k.nimi}\n`)
      continue
    }

    console.log(`${k.nimi}`)
    console.log(`  nyt: ${p.city ?? "-"} | ${p.phase} | ${p.status} | arvio ${String(p.estimated_completion ?? "-").slice(0, 10)}`)
    console.log(`  todiste: ${k.todiste}`)
    console.log(`  -> ${PHASE_LABELS.completed} / completed / completed_at ${k.valmistui}`)

    if (!apply) {
      console.log()
      continue
    }

    const { error: virhe } = await db
      .from("projects")
      .update({
        phase: PHASE_LABELS.completed,
        status: "completed",
        completed_at: new Date(`${k.valmistui}T12:00:00Z`).toISOString(),
      })
      .eq("id", k.id)
    if (virhe) {
      console.log(`  VIRHE: ${virhe.message}\n`)
      continue
    }

    await recordPhaseChange({
      supabase: db as any,
      projectId: k.id,
      newPhase: PHASE_LABELS.completed,
      previousPhase: p.phase,
      source: "manual_correction",
      sourceName: "kvartaalitarkistus-yliaikaiset",
      reason: k.todiste,
    })
    console.log(`  TEHTY\n`)
  }

  console.log("--- 2. AIDOSTI KESKEN: vain paiva korjataan, vaihe ennallaan ---\n")
  for (const k of PAIVAKORJAUKSET) {
    const { data: p, error } = await db
      .from("projects")
      .select("id, name, city, phase, status, estimated_completion, construction_start, builder")
      .eq("id", k.id)
      .maybeSingle()
    if (error) throw error
    if (!p) {
      console.log(`PUUTTUU ${k.nimi}\n`)
      continue
    }

    const paivitys: Record<string, unknown> = { estimated_completion: k.arvioValmis }
    if ("rakentamisenAlku" in k) paivitys.construction_start = k.rakentamisenAlku
    /* Rakentajaa ei korvata jos se on jo kirjattu. */
    if (k.rakentaja && !p.builder) paivitys.builder = k.rakentaja

    console.log(`${k.nimi}`)
    console.log(
      `  nyt: ${p.city ?? "-"} | ${p.phase} | arvio ${String(p.estimated_completion ?? "-").slice(0, 10)} | aloitus ${String(
        p.construction_start ?? "-"
      ).slice(0, 10)} | rakentaja ${p.builder || "-"}`
    )
    console.log(`  todiste: ${k.todiste}`)
    console.log(`  -> ${JSON.stringify(paivitys)}`)

    if (!apply) {
      console.log()
      continue
    }

    const { error: virhe } = await db.from("projects").update(paivitys).eq("id", k.id)
    console.log(virhe ? `  VIRHE: ${virhe.message}\n` : `  TEHTY\n`)
  }

  console.log("--- 3. JATETAAN ENNALLEEN ---")
  for (const k of JATETAAN) console.log(`  ${k.nimi} - ei valmistumistodistetta, jaa nakyviin`)

  if (!apply) console.log("\nEi muutettu mitaan. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
