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
 * VERKKOHAUN LOYTAMAT EDENNEET SUUNNITTELUHANKKEET (D-420).
 *
 * `scripts/hae-valmistuneet-verkosta.ts --aloitetut` haki 15.11.2026 kaikki
 * 2 633 kilpailutus-, rakennuslupa- ja suunnitteluvaiheen hanketta. 75
 * osumasta 31 hanketta todettiin lahdesivulta edenneiksi: 15 valmistunutta,
 * 15 rakenteilla, 1 sopimusvaiheessa. Johannes paatti siirrot 15.11.2026.
 *
 * Tama skripti tekee vaihesiirrot. Kaksoisrivit yhdistetaan erikseen
 * `merge-duplicate-projects.ts`:lla (lista D-420:ssa); siirto tehdaan
 * aina sailyvalle rivilla.
 *
 * Rivi muutetaan vain jos se on yha siina vaiheessa jossa se haussa oli.
 * Aloituspaiva kirjoitetaan vain tyhjaan kenttaan.
 *
 *   npx tsx scripts/fix-verkkohaun-aloitetut.ts
 *   npx tsx scripts/fix-verkkohaun-aloitetut.ts --apply
 */

type Siirto = {
  id: string
  nimi: string
  vaihe: string
  uusi: "completed" | "construction"
  valmistui?: string
  alkoi?: string
  todiste: string
}

const SIIRROT: Siirto[] = [
  // --- valmistuneet ---
  {
    id: "51d262a5-50cc-4005-84b0-6cb0a8b47130",
    nimi: "Mt 16623 Keljonkankaantien jalankulku- ja pyöräilyväylä",
    vaihe: "Suunnittelu",
    uusi: "completed",
    valmistui: "2026-08-12",
    todiste: "Keski-Suomen elinvoimakeskus 12.8.2026: vayla avattu liikenteelle, rakennustyot alkoivat huhtikuussa. https://www.sttinfo.fi/tiedote/72227763/keljonkankaantien-uusi-jalankulku-ja-pyorailyvayla-on-avattu-liikenteelle-jyvaskylassa?lang=fi",
  },
  {
    id: "2f77535e-5fdf-4d59-b18e-0a99412a1aa3",
    nimi: "TAMKin musiikin keskus, Tampere",
    vaihe: "Suunnittelussa",
    uusi: "completed",
    valmistui: "2026-09-30",
    todiste: "Tamperelainen 30.9.2026: Jatke Pirkanmaan urakoima Tamkin laajennus ja saneeraus saatu paatokseen. https://www.tamperelainen.fi/paikalliset/9833584",
  },
  {
    id: "140c7ea5-8a5f-41cf-a5e4-0c4d3f3a75b6",
    nimi: "Tove Janssonin puisto ja Kanavapuisto, Katajanokka",
    vaihe: "Suunnittelussa",
    uusi: "completed",
    valmistui: "2026-08-31",
    todiste: "HS 31.8.2026: puisto avattiin, rakentaminen valmistui avajaisiin. https://www.hs.fi/pkseutu/art-2000012243315.html",
  },
  {
    id: "fc122520-2677-4164-8683-037d0f661270",
    nimi: "Aino Acktén puiston kuntoportaat, Pohjois-Haaga",
    vaihe: "Suunnittelussa",
    uusi: "completed",
    valmistui: "2026-04-14",
    todiste: "Newsbox 14.4.2026: tyot alkoivat joulukuussa ja kuntoportaat valmistuivat kevaalla. https://www.newsbox.fi/helsinki/pohjois-haagaan-valmistui-kuntoportaat-historialliseen-paikkaan/",
  },
  {
    id: "15e3e15e-4c45-4fdc-927a-2b8a59a2b3ba",
    nimi: "Vallilanpuisto",
    vaihe: "Suunnittelussa",
    uusi: "completed",
    valmistui: "2025-07-07",
    todiste: "hel.fi: Vallilanpuiston peruskorjaus valmistui etuajassa, kaytossa 7.7. alkaneella viikolla (sivua ei haettu, robots.txt; vuosi urakoitsijan referenssista 11/2025). https://www.hel.fi/fi/uutiset/vallilanpuiston-peruskorjaus-valmistui-etuajassa-puisto-on-asukkaiden-kaytossa-heinakuussa https://tieluiska.fi/vallilanpuisto/",
  },
  {
    id: "52f4894f-7e9b-496b-8517-a993dec336a4",
    nimi: "Haakoninlahdenpuiston eteläosa, Kruunuvuorenranta",
    vaihe: "Suunnittelussa",
    uusi: "completed",
    valmistui: "2024-10-31",
    todiste: "hel.fi: Haakoninlahdenpuiston etelaosa valmistui lokakuussa (vuosi paatelty: suunnitelma 2023, rakentaminen alkoi seuraavana maaliskuuna; sivua ei haettu, robots.txt). https://www.hel.fi/fi/uutiset/kruunuvuorenrannan-uuden-puiston-etelaosa-valmistui-seuraavaksi-rakennetaan-pohjoisosa",
  },
  {
    id: "1b1fd2d3-4c47-4b41-85d3-50677c67e33f",
    nimi: "Kalevanniemen kampus ja liikuntahalli, Naantali",
    vaihe: "Suunnittelussa",
    uusi: "completed",
    valmistui: "2026-08-31",
    todiste: "Yle 31.8.2026: Kalevanniemen kampus valmistui, muutamaa tilaa vaille valmis. https://yle.fi/a/74-20243799",
  },
  {
    id: "de4be395-d20d-4008-940c-b136e3ee4799",
    nimi: "Liedon keskuskoulu",
    vaihe: "Suunnittelussa",
    uusi: "completed",
    valmistui: "2025-12-31",
    todiste: "NCC: koulu valmistui kolme kuukautta etuajassa ja luovutettiin tilaajalle joulukuussa 2025. https://www.ncc.fi/projektit/liedon-keskuskoulu-lieto/",
  },
  {
    id: "9d7450b0-86df-4795-a380-b400f36a90e3",
    nimi: "Jäkärlän koulu ja päiväkoti, Turku",
    vaihe: "Suunnittelussa",
    uusi: "completed",
    valmistui: "2026-07-31",
    todiste: "NCC: kokonaisuus piha-alueineen valmistui heinakuussa 2026; kaytossa elokuusta. https://www.ncc.fi/projektit/jakarlan-koulu-ja-paivakoti-turku/",
  },
  {
    id: "4b5a8822-e69e-479c-a156-0df1f1c08c2e",
    nimi: "Limingan koulukodin päärakennus",
    vaihe: "Suunnittelussa",
    uusi: "completed",
    valmistui: "2025-08-31",
    todiste: "Senaatti-kiinteistot 4.9.2025: paarakennus valmistui aikataulussa elokuun lopussa. https://www.sttinfo.fi/tiedote/71415581/limingan-koulukodin-uusi-paarakennus-valmistui-ajallaan-kustannukset-miljoonia-alle-arvion?lang=fi",
  },
  {
    id: "c1bd0b53-5f8f-4661-9e35-91a871bf8556",
    nimi: "Karjasillan Verstas, Oulu",
    vaihe: "Suunnittelussa",
    uusi: "completed",
    valmistui: "2025-06-30",
    todiste: "Hartelan tiedote: rakentaminen alkoi 4/2024, valmistuu kesalla 2025; Kesko: K-Market Karjasilta avataan alkukesasta 2025, kauppa toiminnassa. https://www.kesko.fi/media/uutiset-ja-tiedotteet/uutiset/2024/uusi-k-market-oulun-karjasilta-hoyhtyan-alueelle/",
  },
  {
    id: "5b0eb22c-153b-4f0e-871e-d88f05df80a3",
    nimi: "Asunto Oy Helsingin Hellikki",
    vaihe: "Suunnittelussa",
    uusi: "completed",
    valmistui: "2024-05-31",
    todiste: "Pohjola Rakennus: Hellikki valmistui (arvio toukokuu 2024). https://www.pohjolarakennus.fi/kodit/helsinki/haaga/asunto-oy-helsingin-hellikki/",
  },
  {
    id: "6d111d23-9013-4a58-a86b-be7814df8a1b",
    nimi: "Sulkavuoren keskuspuhdistamo, Tampere",
    vaihe: "Suunnittelussa",
    uusi: "completed",
    valmistui: "2025-09-17",
    todiste: "Yle 17.9.2025: keskuspuhdistamon kaynnistys alkanut, otettu kayttoon vaiheittain syksylla 2025. https://yle.fi/a/74-20182601",
  },
  // --- rakenteilla ---
  {
    id: "3fa69eb5-949c-4a8f-af00-8457724b8c27",
    nimi: "Data Tank Nordic, Utajärvi",
    vaihe: "Rakennuslupa",
    uusi: "construction",
    alkoi: "2026-10-05",
    todiste: "Kaleva 8.10.2026: datakeskuksen rakentaminen on kaynnistynyt, ensimmainen tyomaakokous pidetty talla viikolla. https://www.kaleva.fi/utajarven-datakeskuksen-rakentaminen-alkoi-kysyimm/13700960",
  },
  {
    id: "08e4e0b0-ebab-445e-a610-340e48d75add",
    nimi: "Turun satamaradan siirto",
    vaihe: "Suunnittelu",
    uusi: "construction",
    alkoi: "2026-09-04",
    todiste: "Navigator Magazine 4.9.2026: uuden satamaradan rakentaminen alkoi 4. syyskuuta, valmistuu 2027. https://navigatormagazine.fi/uutiset/turun-satamaradan-siirto-kaynnistyi/",
  },
  {
    id: "9e80417b-f981-44e8-82fd-fcc763b652f8",
    nimi: "Vt 5 Leppävirta–Palokangas",
    vaihe: "Suunnittelu",
    uusi: "construction",
    alkoi: "2026-08-01",
    todiste: "Pohjois-Savon liitto 28.8.2026: Leppavirta-Palokangas-osuuden rakennustyot kaynnistyivat elokuun alussa, avataan syksylla 2028. https://www.pohjois-savo.fi/viestinta/uutiset/2026/08/valtatie-5n-rakennustyot-alkoivat-leppavirran-ja-kuopion-valilla.html",
  },
  {
    id: "b1bcce8b-c4fa-4e70-8096-2f73ced37f18",
    nimi: "Vt 27 jalankulku- ja pyöräilyväylä Rantakylä–Kotajoki, Kiuruvesi",
    vaihe: "Suunnittelu",
    uusi: "construction",
    alkoi: "2026-05-01",
    todiste: "Kiuruvesi-lehti 12.5.2026: vaylan ja kahden alikulkusillan rakentaminen kaynnistynyt toukokuussa. https://kiuruvesilehti.fi/2026/05/12/jalankulku-ja-pyorailyvaylan-rakentaminen-on-kaynnistynyt-kotajoentien-ja-rantakylan-valilla-hanke-parantaa-turvallisuutta-ja-liikennekin-sujuvoituu/",
  },
  {
    id: "86ab34bb-b442-4a6c-98ab-4992d8b3ef60",
    nimi: "Vt 4 / mt 18609 Haurukylän liittymä, Tyrnävä",
    vaihe: "Suunnittelu",
    uusi: "construction",
    alkoi: "2026-05-21",
    todiste: "Pohjois-Suomen elinvoimakeskus / Rantalakeus 21.5.2026: tyot alkoivat Haurukylantien liittymassa, valmistuu syksylla 2026. https://www.rantalakeus.fi/tyot-alkoivat-haurukylantien-liittymassa-tyrnavall/13502932",
  },
  {
    id: "41fa0d8e-9173-49ab-b595-1034275135fa",
    nimi: "Esplanadin vesihuoltotunneli, Helsinki",
    vaihe: "Suunnittelussa",
    uusi: "construction",
    alkoi: "2025-10-01",
    todiste: "HSY: YIT Infra kaynnisti louhinnan lokakuussa 2025, valmistuu 2027. https://www.sttinfo.fi/tiedote/71511820/hsy-rakentaa-vesihuoltotunnelia-esplanadin-alla-helsingissa?lang=fi",
  },
  {
    id: "0670dedd-2b82-42f7-9dec-939959be59e1",
    nimi: "Logicenters, Rykmentinportinkatu 3, Tuusula",
    vaihe: "Suunnittelussa",
    uusi: "construction",
    alkoi: "2025-10-01",
    todiste: "Logicenters 9.10.2025: peruskivi muurattiin 1.10.2025, valmistuu 2026 puolivalin jalkeen (valmistumisesta ei vahvistusta). https://www.sttinfo.fi/tiedote/71515521/logicentersin-uuden-logistiikkakeskuksen-peruskivi-muurattiin-tuusulassa?lang=fi",
  },
  {
    id: "404a5893-7d6e-4b67-b00f-579c5de37baf",
    nimi: "Minna Canthin koulu, Kuopio",
    vaihe: "Suunnittelussa",
    uusi: "construction",
    todiste: "Kuopion kaupunki 27.2.2026: koulu saavutti harjakorkeuden, valmistuu syyslukukaudeksi 2027. https://www.kuopio.fi/2026/02/27/minna-canthin-koulu-saavutti-harjakorkeuden-rehtorit-tutustuivat-koulun-tuleviin-tiloihin/",
  },
  {
    id: "7289f0a2-2e7e-479f-a3f5-600501371a5e",
    nimi: "Puistolan koulu, päiväkoti ja liikuntahalli, Helsinki",
    vaihe: "Suunnittelussa",
    uusi: "construction",
    todiste: "Kaupunginosat.fi 3.11.2025: vanhan koulun purku valmis 8/2025, tontilla esirakentamistyot; Fira rakentaa, valmis 11/2027. https://kaupunginosat.fi/puistola/puistolan-peruskoulun-paivakodin-leikkipuiston-ja-liikuntahallin-rakentaminen-on-kaynnistynyt/",
  },
  {
    id: "367bf136-f1b3-4607-8864-cb343134ba1c",
    nimi: "Porthanian peruskorjaus, Helsinki",
    vaihe: "Valmistunut",
    uusi: "construction",
    alkoi: "2026-10-19",
    todiste: "SRV 19.10.2026: toteutusvaiheen sopimus allekirjoitettu, SRV kaynnistaa rakennustyot; avataan syksylla 2028. Rivi oli virheellisesti Valmistunut/active ilman vaihehistoriaa. https://news.cision.com/fi/srv-yhtiot-oyj/r/porthanian-peruskorjaus-etenee-toteutusvaiheeseen---srv-kaynnistaa-rakennustyot,c4411705",
  },
  {
    id: "6628f798-b07a-46c6-beb1-8225414f6490",
    nimi: "Hartelan palvelutalo, Laitila",
    vaihe: "Suunnittelussa",
    uusi: "construction",
    todiste: "Hartela: rakennustyot kaynnistyneet toukokuussa 2025, valmistuu elokuussa 2026 (valmistumisesta ei vahvistusta). https://www.hartela.fi/fi/tietoa-meista/uutiset/hartela-rakentaa-laitilaan-uuden-palvelutalon",
  },
  {
    id: "f5ed1ff7-0daf-4d93-9b26-5ffd9fd8d027",
    nimi: "Ferry Terminal Turku, ARE talotekniikka",
    vaihe: "Suunnittelussa",
    uusi: "construction",
    todiste: "Aamuset 11.6.2025: Turun satamaan on rakenteilla uusi Ferry Terminal Turku -yhteisterminaali. https://aamuset.fi/artikkeli/6687479",
  },
  {
    id: "e7bf2b64-bfc8-4fa5-8702-8b5f98cf2dbf",
    nimi: "Kallanrannan kampus, Kuopio",
    vaihe: "Suunnittelu",
    uusi: "construction",
    alkoi: "2026-04-01",
    todiste: "Senaatti-kiinteistot (STT): rakennustyot alkavat huhtikuussa 2026 ja valmistuvat vaiheittain 2027 loppuun mennessa (heikoin naytto: aloitusta ei vahvistettu erikseen). https://www.sttinfo.fi/tiedote/71596627/kuopion-kallanrantaan-rakentuu-14-valtion-toimijan-yhteinen-tyoymparisto-ensimmaiset-tilat-kayttoon-alkuvuodesta-2027?lang=fi",
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

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===\n")

  for (const s of SIIRROT) {
    const { data: p, error } = await db
      .from("projects")
      .select("id, name, city, phase, status, is_public, construction_start")
      .eq("id", s.id)
      .maybeSingle()
    if (error) throw error
    if (!p) {
      console.log(`PUUTTUU  ${s.nimi}\n`)
      continue
    }
    const uusiVaihe = PHASE_LABELS[s.uusi]
    console.log(`${p.name.slice(0, 70)} | ${p.city} | "${p.phase}" / ${p.status}${p.is_public ? "" : " (piilotettu)"}`)
    if (p.phase !== s.vaihe || p.status !== "active") {
      console.log(`  ODOTETTU "${s.vaihe}" / active - EI MUUTETA\n`)
      continue
    }
    const muutos: Record<string, unknown> = { phase: uusiVaihe }
    if (s.uusi === "completed") {
      muutos.status = "completed"
      muutos.completed_at = new Date(`${s.valmistui}T12:00:00Z`).toISOString()
    }
    if (s.alkoi && !p.construction_start) muutos.construction_start = s.alkoi
    console.log(`  -> ${JSON.stringify(muutos)}\n  ${s.todiste.slice(0, 150)}\n`)
    if (!apply) continue

    const { error: e } = await db.from("projects").update(muutos).eq("id", s.id)
    if (e) {
      console.log(`  VIRHE: ${e.message}\n`)
      continue
    }
    await recordPhaseChange({
      supabase: db as any,
      projectId: s.id,
      newPhase: uusiVaihe,
      previousPhase: p.phase,
      source: "manual_correction",
      sourceName: "verkkohaku-aloitetut",
      reason: s.todiste,
    })
  }
  if (!apply) console.log("Ei muutettu mitaan. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
