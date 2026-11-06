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
 * KUNNOSSAPITOSOPIMUKSET POIS NAKYVISTA (D-375).
 *
 * Johannes 6.11.2026 Rataverkon kunnossapidosta: *"koko lahde on
 * minusta vaarin?"* ja tarkennus: *"poista nuo kunnossapitosopimukset
 * kokonaan, eivat ole hankkeita. Olen itse ollut ehka vahan
 * epajohdonmukainen hankkeita hyvaksyessa."*
 *
 * Kunnossapitosopimus ei ole tyomaa: voittaja ei rakenna vaan yllapitaa,
 * valmistumispaivaa ei ole, ja kaupunki on mielivaltainen -- Rataverkon
 * kunnossapito oli sijoitettu Ylivieskaan vaikka sopimus kattaa
 * paaradan Kokkolasta Ouluun seka kaksi muuta rataosuutta.
 *
 * POISTO ON `is_public: false` + `piilotuksen_syy`, EI DELETE. Sama
 * konventio kuin 201 muulla piilotetulla ("Ei hanke - pelkka uutinen
 * tai markkinointi", "liian pieni"). Historia sailyy, eika sama sopimus
 * palaa lahteesta uutena rivina ([[queue-removal-ignored]]).
 *
 * SANAHAKU EI RIITA, RIVIT ON LUETTAVA.
 *
 *   - Kuvaukseen osuva haku antoi 562 osumaa: "kunnossapito" esiintyy
 *     tavallisten katusuunnitelmien kuvauksissa. Kelvoton kriteeri.
 *   - Otsikkoon osuva antoi 10, joista YKSI on aito rakennushanke:
 *     **Espoon kaupunkiradan alueurakka 4**, 73 M€, YIT, urakkasopimus
 *     5.3.2026. "Alueurakka" on siina kaupunkiradan rakennusurakan osa,
 *     ei kunnossapitoaluetta. Sanahaku olisi poistanut sen
 *     ([[verify-findings-against-source]]).
 *
 * Tunnisteet on siksi kirjoitettu kasin eika haettu kuviolla.
 *
 *   npx tsx scripts/piilota-kunnossapitosopimukset.ts
 *   npx tsx scripts/piilota-kunnossapitosopimukset.ts --apply
 */
const APPLY = process.argv.includes("--apply")

const SOPIMUS = "Ei hanke – kunnossapito- tai huoltosopimus, ei rakentamista"
const KARTOITUS = "Ei hanke – markkinakartoitus tai markkinavuoropuhelu, ei hankintaa"

const POISTETTAVAT: { id: string; syy: string }[] = [
  /* Rataverkon kunnossapito Pohjois-Suomi — 2 v jatkosopimus, 9,4 M€. */
  { id: "42a7f731-fde8-4952-82b4-9842cab5525c", syy: SOPIMUS },
  /* Kaakkois-Suomen elinvoimakeskuksen siltojen ylläpitourakka 2027-2028. */
  { id: "da78ee10-8369-4ee5-b5ae-e6f42752900b", syy: SOPIMUS },
  /* Sodankylän valaistuksien vuosihuolto 2026. */
  { id: "573b1914-2d8b-4e85-89d0-99b6239d4b94", syy: SOPIMUS },
  /* Varpaisjärven liikenneväylien ja kiinteistöjen talvikunnossapito. */
  { id: "ddd2e4df-25d0-42cf-842e-db70173ab26c", syy: SOPIMUS },
  /* Ilmanvaihtojärjestelmien ennakkohuolto- ja kunnossapitotyöt. */
  { id: "f8e5c017-7204-4e86-9c60-4feb130557a7", syy: SOPIMUS },
  /* Lounais-Suomen ratojen kunnossapito — GRK. */
  { id: "cbf8122d-8d9c-44f3-a92a-437e0eb847d8", syy: SOPIMUS },
  /* Markkinakartoitus: Kuiturakentaminen ja verkon ylläpitotyöt. */
  { id: "0fe289ec-0f4f-43a1-aed6-f18ddcf191fa", syy: KARTOITUS },
  /* KUTSU MARKKINAVUOROPUHELUUN — Kymenlaakson Sähköverkko. */
  { id: "d064e51c-c194-44c0-9f5c-e33aeb48eef9", syy: KARTOITUS },
]

/*
 * EI MUKANA, TAHALLAAN:
 *
 *   4781903b  Espoon kaupunkiradan alueurakka 4 — aito rakennusurakka
 *   d972840f  Omnian korjaus-, kunnossapito- ja muutostyöt — puitesopimus
 *             joka sisaltaa myos korjaus- ja muutostyot eli oikeaa
 *             rakentamista; rajatapaus, jatetaan Johanneksen
 *             paatettavaksi ([[reject-is-not-final]]).
 */

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  let piilotettu = 0
  for (const kohde of POISTETTAVAT) {
    const { data: h, error } = await db
      .from("projects")
      .select("id,name,city,is_public,metadata")
      .eq("id", kohde.id)
      .maybeSingle()
    if (error) throw error
    if (!h) {
      console.log(`EI LOYDY ${kohde.id}`)
      continue
    }
    if (!h.is_public) {
      console.log(`jo piilossa: ${String(h.name).slice(0, 56)}`)
      continue
    }

    console.log(`${APPLY ? "PIILOTETAAN" : "(kuiva)    "} ${String(h.name).slice(0, 56)}`)
    console.log(`              syy: ${kohde.syy}`)
    if (!APPLY) continue

    const md = {
      ...(h.metadata ?? {}),
      piilotuksen_syy: kohde.syy,
      piilotettu_at: new Date().toISOString(),
    }
    const { error: e2 } = await db
      .from("projects")
      .update({ is_public: false, metadata: md })
      .eq("id", h.id)
    if (e2) console.log(`   VIRHE: ${e2.message}`)
    else piilotettu++
  }

  console.log(`\n=== ${APPLY ? "AJETTU" : "KUIVAHARJOITUS"} ===`)
  if (APPLY) console.log(`  piilotettu ${piilotettu}/${POISTETTAVAT.length}`)
  console.log(`  jatettiin nakyviin: Espoon kaupunkiradan alueurakka 4 (aito urakka),`)
  console.log(`                      Omnian puitesopimus (rajatapaus)`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
