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
 * VERKKOHAUN LOYTAMAT VALMISTUNEET (D-419).
 *
 * Testiasiakas soitti hankkeeseen joka oli meilla "rakenteilla" mutta
 * valmistunut jo aikaa sitten. `scripts/hae-valmistuneet-verkosta.ts`
 * haki 14.11.2026 kaikki 1 489 rakentamisvaiheen hanketta; 61 osumasta
 * 12 hanketta (13 rivia, Polsun silta oli kahdesti) todettiin
 * lahdesivulta valmistuneiksi. Johannes paatti siirron 14.11.2026.
 *
 * Todiste on verkossa, ei kannassa, joten se kirjataan perusteluun
 * osoitteineen. Paiva luetaan tekstista (completion-date-from-text):
 * tarkka paiva kun sellainen on, muuten kuukauden tai kauden viimeinen.
 *
 * Rivi muutetaan vain jos se on yha siina vaiheessa jossa se haussa oli
 * — jos joku on ehtinyt muuttaa sita, ei kosketa.
 *
 *   npx tsx scripts/fix-verkkohaun-valmistuneet.ts
 *   npx tsx scripts/fix-verkkohaun-valmistuneet.ts --apply
 */

type Korjaus = { id: string; nimi: string; vaihe: string; valmistui: string; todiste: string }

const KORJAUKSET: Korjaus[] = [
  {
    id: "b55773a8-4eaa-45c5-973d-15faab15fd7e",
    nimi: "Kupittaa–Turku-ratahanke",
    vaihe: "Rakenteilla",
    valmistui: "2025-10-08",
    todiste: "Turun Seutusanomat 15.10.2025: ratapihat otettiin kokonaisuudessaan kayttoon 8.10.2025, hanke tullut paatokseensa. https://turunseutusanomat.fi/2025/10/kupittaa-turku-ratahanke-on-valmistunut/",
  },
  {
    id: "4c6c4e39-cb98-4a2e-98a5-604183d3ea61",
    nimi: "Pasilan virastokeskuksen yhteinen työympäristö",
    vaihe: "Rakenteilla",
    valmistui: "2026-05-29",
    todiste: "SRV:n tiedote 29.5.2026: peruskorjaus valmis, hanke valmistui kevaalla 2026. https://news.cision.com/fi/srv-yhtiot-oyj/r/pasilan-virastokeskuksen-peruskorjaus-valmis---suomen-suurin-yhteinen-tyoymparisto-kayttoon-helsingi,c4354984",
  },
  {
    id: "65509bbb-4688-41f0-960a-24fe7c1fff0c",
    nimi: "Naantaliin Prisman Turun Osuuskaupalle",
    vaihe: "Rakenteilla",
    valmistui: "2026-09-17",
    todiste: "Turun Seutusanomat 17.9.2026: Prisma Naantali avattiin. https://turunseutusanomat.fi/2026/09/prisma-naantali-avasi-ovensa/",
  },
  {
    id: "664dfe9b-2711-4203-8964-6a3bab8b4ee8",
    nimi: "Liike- ja palvelukeskus Särmä, Tuusula",
    vaihe: "Rakenteilla",
    valmistui: "2026-08-31",
    todiste: "Keski-Uusimaa/Newsbox 31.8.2026: Sarma on valmistunut Hyrylan keskustaan, palvelut avataan syksyn aikana. https://www.newsbox.fi/keha/liike-ja-palvelukeskus-sarma-valmistui-hyrylaan/",
  },
  {
    id: "77aaef07-b59d-4fbb-8a07-5f1320b0fb52",
    nimi: "Savonlinnan Ohrasuon aurinkovoimala",
    vaihe: "Rakenteilla",
    valmistui: "2026-07-02",
    todiste: "Ita-Savo 2.7.2026: Ohrasuon aurinkopuisto on valmistunut. https://www.ita-savo.fi/paikalliset/9587817",
  },
  {
    id: "8296498f-a494-4555-a5fa-b52f3a9cdf43",
    nimi: "Polsun silta, Säkylä",
    vaihe: "Rakentaminen aloitettu",
    valmistui: "2026-08-26",
    todiste: "Alueviesti 26.8.2026: uusi Polsun silta avattiin liikenteelle; vanhan sillan purku alkaa. https://alueviesti.fi/2026/08/26/uusi-polsun-silta-avattiin-liikenteelle-koyliossa/",
  },
  {
    id: "a64ca9cb-f453-4d7d-b2d7-4e18c6886fe9",
    nimi: "Myllypohjan monitoimitalo Vire, Lahti",
    vaihe: "Rakenteilla",
    valmistui: "2026-08-31",
    todiste: "Lahden kaupunki: Myllypohjan monitoimitalo Vire otettiin kayttoon elokuussa 2026. https://www.lahti.fi/asuminen-ja-ymparisto/asuminen/monitoimitalot/myllypohjan-alueen-monitoimitalo/",
  },
  {
    id: "e21f58b8-de2a-44e3-81be-1bb7255fee8c",
    nimi: "Akaan Toijalan alakoulu",
    vaihe: "Rakenteilla",
    valmistui: "2026-10-07",
    todiste: "NCC:n uutinen 7.10.2026: NCC:n rakentama Toijalan alakoulu valmistui. https://www.ncc.fi/tietoa-nccsta/media/ajankohtaista/nccn-rakentama-toijalan-alakoulu-valmistui/",
  },
  {
    id: "6e080e5d-bb06-49ab-9842-4773e57ae767",
    nimi: "Harjun stadionin peruskorjaus, Jyväskylä",
    vaihe: "Rakentaminen aloitettu",
    valmistui: "2026-07-04",
    todiste: "Jyvaskylan kaupungin uutinen 4.7.2026 (otsikko; sivu palautti 403): Harjun stadionin peruskorjaus ja laajennus valmistui. https://linkki.jyvaskyla.fi/uutinen/2026-07-04_harjun-stadionin-peruskorjaus-ja-laajennus-valmistui-satavuotiaalla-urheilun-nayttamolla-alkaa-uusi",
  },
  {
    id: "6562f0bf-b7d3-4617-8b23-c259de162dca",
    nimi: "Lidl Lahden Karistoon",
    vaihe: "Rakentaminen aloitettu",
    valmistui: "2026-05-21",
    todiste: "PEFC Suomi: Lidlin uusi myymala avautui Lahteen 21.5.2026. https://pefc.fi/yritykset-coc-ja-pefc-merkki/tutustu-yrityscaseihin/blogi/suomen-kolmas-pefc-sertifioidusta-puusta-rakennettu-lidl-valmistui-lahteen/",
  },
  {
    id: "67ed9b5f-2f09-42ea-aebd-24bb3b2953e4",
    nimi: "Jyväskylän Kankaalle uusia vuokra-asuntoja (Paperitehtaankatu 15)",
    vaihe: "Sopimus myönnetty",
    valmistui: "2026-01-31",
    todiste: "Avain Asunnot 3.2.2026: As Oy Jyvaskylan Paperitehtaankatu 15 valmistui tammikuun lopussa. https://avainasunnot.fi/ajankohtaista/uusia-avain-asuntojen-vuokrakoteja-valmistui-jyvaskylan-kankaalle/",
  },
  {
    id: "08ca8340-93a5-4cff-81dd-ddf5d7c6dac3",
    nimi: "Harjulan koulu ja päiväkoti, Järvenpää",
    vaihe: "Rakentaminen aloitettu",
    valmistui: "2022-05-31",
    todiste: "Firan referenssi: Harjulan koulu ja paivakoti valmistui loppukevaalla 2022. Rivi oli luotu 3/2026 vanhasta uutisesta. https://fira.fi/referenssit/harjulan-koulu-ja-paivakoti/",
  },
]

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const { PHASE_LABELS } = await import("../lib/projects/phases")
  const { recordPhaseChange } = await import("../lib/projects/recordPhaseChange")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")
  console.log(`kohdevaihe "${PHASE_LABELS.completed}", status "completed"\n`)

  for (const k of KORJAUKSET) {
    const { data: p, error } = await db
      .from("projects")
      .select("id, name, city, phase, status, is_public")
      .eq("id", k.id)
      .maybeSingle()
    if (error) throw error
    if (!p) {
      console.log(`PUUTTUU  ${k.nimi}\n`)
      continue
    }
    console.log(`${p.name.slice(0, 70)} | ${p.city} | "${p.phase}" / ${p.status}${p.is_public ? "" : " (piilotettu)"}`)
    if (p.phase !== k.vaihe || p.status !== "active") {
      console.log(`  ODOTETTU "${k.vaihe}" / active - EI MUUTETA\n`)
      continue
    }
    console.log(`  -> "${PHASE_LABELS.completed}", completed_at ${k.valmistui}\n  ${k.todiste.slice(0, 140)}\n`)
    if (!apply) continue

    const { error: e } = await db
      .from("projects")
      .update({
        phase: PHASE_LABELS.completed,
        status: "completed",
        completed_at: new Date(`${k.valmistui}T12:00:00Z`).toISOString(),
      })
      .eq("id", k.id)
    if (e) {
      console.log(`  VIRHE: ${e.message}\n`)
      continue
    }
    await recordPhaseChange({
      supabase: db as any,
      projectId: k.id,
      newPhase: PHASE_LABELS.completed,
      previousPhase: p.phase,
      source: "manual_correction",
      sourceName: "verkkohaku-valmistuneet",
      reason: k.todiste,
    })
  }
  if (!apply) console.log("Ei muutettu mitaan. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
