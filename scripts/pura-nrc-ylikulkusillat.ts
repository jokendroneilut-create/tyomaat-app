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
 * YKSI JONORIVI, KAKSI SILTAA (D-367).
 *
 * Rakennuslehden juttu "NRC Group sai ylikulkusiltojen rakennusurakan"
 * kertoo KAHDESTA sillasta kahdessa eri kunnassa. Yksi rivi ei voi olla
 * kahdessa kunnassa, ja liidin on loydyttava paikan perusteella
 * ([[multi-project-rows]]).
 *
 * ALKUPERAINEN LAHDE NIMEAA SILLAT, JALLEENJULKAISIJA EI.
 * Rakennuslehden juttu on maksumuurin takana ja sen julkinen karki
 * kertoo vain "Siilinjarvella ja Kuopiossa". NRC:n oma tiedote nimeaa
 * molemmat ja kertoo toteutustavan, joten lahteeksi tulee se
 * ([[rakennuslehti-is-secondary]]).
 *
 * KUSTANNUS EI MENE KUMMALLEKAAN RIVILLE. 3,8 M€ on sopimuksen
 * YHTEISARVO; sama luku kahdessa kentassa kaksinkertaistaisi markkinan
 * ([[alliance-split]], [[combined-figure-split-by-owner-page]]). Se
 * kerrotaan kuvauksessa yhteisarvona.
 *
 * VAIHE ON "Sopimus myonnetty", ei "Rakenteilla". Tiedote sanoo tyoiden
 * alkavan "heti kuluvan syksyn aikana" -- se on tulevaa, ei tapahtunut.
 * Valittu vaihe on se mika on todistettu: urakoitsija on valittu.
 *
 *   npx tsx scripts/pura-nrc-ylikulkusillat.ts
 *   npx tsx scripts/pura-nrc-ylikulkusillat.ts --apply
 */
const APPLY = process.argv.includes("--apply")

const JONORIVI = "7fde476c-84ac-47f9-aa5e-fe9c415923ec"
const LAHDE = "https://www.nrcgroup.fi/uutiset/toteutamme-kaksi-uutta-ylikulkusiltaa-ita-suomessa"
const EMO = "Ruokosuo–Sänkimäki-radan sähköistys ja raakapuun kuormausalue"

const YHTEINEN =
  "Väylävirasto on valinnut NRC Groupin rakentamaan kaksi uutta rautatien " +
  "ylittävää ylikulkusiltaa sekä niihin liittyvät tiejärjestelyt " +
  "Viinijärvi–Siilinjärvi-rataosuudella. Urakassa uusitaan elinkaarensa " +
  "päähän tulleet 1950-luvulla rakennetut sillat. Siltatyöt käynnistyvät " +
  "syksyllä 2026 ja valmistuvat elokuun 2027 loppuun mennessä. Sopimuksen " +
  `yhteisarvo on noin 3,8 miljoonaa euroa, eli se kattaa molemmat sillat. ` +
  `Hanke on osa Väyläviraston ${EMO}-hanketta.`

const SILLAT = [
  {
    title: "Sänkimäen ylikulkusilta",
    municipality: "Kuopio",
    address: "Pajulahti, Kuopio",
    kuvaus:
      "Sänkimäen ylikulkusillan uusiminen Kuopion Pajulahdessa. Uusi silta " +
      "rakennetaan nykyisen sillan länsipuolelle ja samalla tielinjausta " +
      `oikaistaan kyseiseltä kohdalta. ${YHTEINEN}`,
  },
  {
    title: "Kuuslahden ylikulkusilta",
    municipality: "Siilinjärvi",
    address: "Marjomäentie, Siilinjärvi",
    kuvaus:
      "Kuuslahden ylikulkusillan uusiminen Marjomäentiellä Siilinjärvellä. " +
      "Uusi silta rakennetaan nykyisen sillan paikalle ja kiertotieyhteys " +
      "järjestetään sillan länsipuolelle asennettavan varasillan kautta. " +
      YHTEINEN,
  },
]

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
  const { PHASE_LABELS } = await import("../lib/projects/phases")

  const { data: lahtorivi, error } = await db
    .from("potential_projects")
    .select("id,title,status,metadata")
    .eq("id", JONORIVI)
    .maybeSingle()
  if (error) throw error
  if (!lahtorivi) throw new Error("lahtorivia ei loydy")
  console.log(`Lahtorivi: [${lahtorivi.status}] ${lahtorivi.title}\n`)

  /* Ei luoda samaa kahdesti, jos ajo toistetaan. */
  const olemassa: string[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error: e } = await db
      .from("potential_projects")
      .select("title")
      .range(a, a + 999)
    if (e) throw e
    olemassa.push(...(data ?? []).map((r: any) => String(r.title)))
    if ((data ?? []).length < 1000) break
  }

  for (const s of SILLAT) {
    if (olemassa.includes(s.title)) {
      console.log(`OHITETAAN (on jo jonossa): ${s.title}`)
      continue
    }

    const rivi = {
      status: "new",
      title: s.title,
      municipality: s.municipality,
      address: s.address,
      confidence: 85,
      source_count: 1,
      evidence_count: 1,
      first_seen: new Date().toISOString(),
      last_seen: new Date().toISOString(),
      metadata: {
        source_name: "nrc_projektit",
        source_url: LAHDE,
        source: "NRC Group",
        description: s.kuvaus,
        operation: s.title,
        developer: "Väylävirasto",
        builder: "NRC Group Finland Oy",
        related_companies: ["NRC Group Finland Oy", "Väylävirasto"],
        contact_persons: [],
        building_type: "Silta",
        phase_hint: PHASE_LABELS.contract_awarded,
        /* Lahteen oma ilmoitus, ei tekstista paateltyä ([[declared-date-beats-text-date]]). */
        estimated_completion: "2027-08-31",
        liittyva_hanke: EMO,
        /*
         * Kustannus jatetaan tyhjaksi tahallaan: 3,8 M€ on molempien
         * siltojen yhteisarvo ja se kerrotaan kuvauksessa.
         */
        field_sources: {
          developer: "NRC Groupin tiedote 27.10.2026",
          builder: "NRC Groupin tiedote 27.10.2026",
          estimated_completion: "NRC Groupin tiedote 27.10.2026",
        },
        purettu_rivista: JONORIVI,
      },
    }

    console.log(`LUODAAN: ${s.title} | ${s.municipality} | ${s.address}`)
    console.log(`   vaihe ${rivi.metadata.phase_hint} | valmistuu ${rivi.metadata.estimated_completion}`)
    console.log(`   ${s.kuvaus.slice(0, 160)}…\n`)

    if (!APPLY) continue
    const { error: e } = await db.from("potential_projects").insert(rivi)
    if (e) console.error(`   VIRHE: ${e.message}`)
  }

  console.log(APPLY ? "=== LUOTU ===" : "=== KUIVAHARJOITUS ===")
  console.log(`Lahtorivin ${JONORIVI} voi hylata sen jalkeen kun molemmat rivit ovat olemassa.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
