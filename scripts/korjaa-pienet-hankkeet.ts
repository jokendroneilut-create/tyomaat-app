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
 * PIENI-MERKINNÄN KORJAUS (D-442).
 *
 * Johannes 20.11.2026: *"Minulla oli jossain vaiheessa käsitys että
 * merkitsemällä hankkeen valmistumaan vuoden kuluttua saan sen poistumaan
 * käyttäjältä kun hanke valmistuu. Näinhän ei pitäisi toimia"*.
 *
 * Valinta "⏳ Aseta vanhenemaan vuoden kuluttua (pienet hankkeet…)" asettaa
 * `expire_at`-päivän, jonka jälkeen vanhennuscron asettaa status =
 * "expired" — hanke katoaa kaikista asiakasnäkymistä riippumatta siitä,
 * onko työ valmis. Valintaa oli käytetty myös isoille hankkeille, jotka
 * olisivat kadonneet kesken rakentamisen.
 *
 * 325 merkittyä luettiin käsin 20.11.2026 ja jaettiin:
 *   PITKA  = iso ja pitkäkestoinen: pieni pois JA expire_at pois
 *   OHJELMA = iso mutta vuosiurakka/-ohjelma/palvelu: pieni pois, expire_at jää
 *   muut   = pieni hanke: molemmat jäävät
 * Vanhat arvot talteen `metadata.pieni_korjaus`-kenttään.
 *
 *   npx tsx scripts/korjaa-pienet-hankkeet.ts [--apply]
 */

/* Iso ja pitkäkestoinen: vuoden vanheneminen piilottaisi käynnissä olevan työmaan. */
const PITKA = new Set([
  "50f26b0b", // HUSK sprinklerijärjestelmien hankinta 20 M€
  "73f97ddb", // Vt 27 Ylivieskan eteläinen ylikulkusilta 14 M€
  "0d06f32f", // sama, markkinavuoropuhelu
  "38fd0adf", // Rauman Äijänsuon jalkapallostadion, maarakennus 2 M€
  "5ba08945", // Luksia Harjun koulun katto- ja IV-urakka 1,6 M€
  "1d10e966", // Arkkukallion synkronikompensaattorilaitos, maanrakennus
  "353ed484", // Sankariniemen kampuksen A-siiven saneeraus
  "8620ad7d", // Lakeuden Keskuspuhdistamon typenpoisto, koneistourakka
  "a7b5c913", // sama, sähköurakka
  "bd3d54d5", // Helsingin päärautatieaseman uusi hotelli
  "0cf6605c", // Senopin uusi tuotantolaitos
  "c6274e3f", // Oopperatalon peruskorjaus 2026–2028, sääsuojat
  "33d642a3", // ARE, uusi hotelli Kokkolassa
  "2655055d", // Ylämyllyn pelastusasema, LVI-urakka
  "8f6ea480", // Ylämyllyn pelastusasema, sähköurakka
  "a85a2ed9", // Suomenlinnan huoltolaitureiden peruskorjausurakka
  "600a5d39", // Valkea, ravintolamaailma Hehku
  "95eeeefd", // K1-halli, PVC-halli 609 m²
  "d1eaea7e", // Keravan maauimalan peruskorjaus
  "8b60e1b1", // koiraurheiluhalli, Kärrytie 5
  "754939c1", // Puuilo Loviisa
  "0a70876e", // Halsua, hirsinen päiväkoti ja kunnantoimisto
  "8560fde1", // Jyskän koulun vanhan osan peruskorjaus, sähkö
  "6d8f5683", // sama, putki
  "3d038234", // sama, ilmanvaihto
  "9685c4ca", // Varia Hiekkaharju peruskorjaus, kevytpurku
  "75eb036b", // Holiday Club Saariselän kylpylän peruskorjaus
  "756fee94", // Hotel Santa Claus, laajennusosa
  "ae429748", // Hyvinkää Areena
  "81f0a950", // kaksi uutta leikkaussalia
  "475efaa3", // teollisuushallin laajennus, Pajatie 6
  "5576e71b", // Kannuksen Teollisuuskylä, teollisuushalli
  "60576ceb", // teollisuusrakennuksen laajentaminen, Mäkitie 4
  "e4a19eac", // teollisuusrakennuksen laajennus (expired)
])

/* Iso tai alueellinen, mutta vuosiurakka, -ohjelma tai palvelu: vanheneminen on oikein. */
const OHJELMA = new Set([
  "3dcec7ba", // Siltatyöt Pohjois-Pohjanmaalla 3,2 M€
  "6e9b3cbd", // Ison Pörrin siltaremontti (valmis)
  "96ad7e2d", // Vahinkosaneerauspalvelut / VAV
  "a73f69c3", // Päällystystyöurakka 2026, Hyvinkää
  "f845784a", // Liikennemerkkien uusiminen UUD 2026
  "3dc14ec6", // SIS Pirkanmaan maanteiden kuivatusurakka 2026
  "6923f019", // LOU Siltaurakka 3/2026
  "ea572304", // Rantaradan asetinlaitteen virransyöttö
  "7f7cc43b", // Kajaanintien alikulkukäytävä, kesä
  "6c687071", // ITA Sillankorjausurakka 2026
  "7f976121", // Päällystystyöt 2026 Kymenlaakso, Etelä-Karjala, Päijät-Häme
  "ff2d616a", // UUD Aluevalaistuksen saneeraukset 2027
  "ffcaae00", // Siltatyöt Satakunnassa 2026
  "ddd2e4df", // Varpaisjärven talvikunnossapito
  "55ef99ae", // Päällystystyöt 2026 Satakunta
  "83905793", // Päällystystyöt 2026 Varsinais-Suomi
  "545ec2c3", // Siltatyöt Varsinais-Suomessa 2026
  "e3d02352", // Päällystystyöt Lapissa
])

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
  const rivit: any[] = []
  for (let i = 0; ; i += 1000) {
    const { data, error } = await db
      .from("projects")
      .select("id,name,status,metadata")
      .eq("metadata->>pieni_hanke", "true")
      .range(i, i + 999)
    if (error) throw error
    rivit.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  const alku = (id: string) => id.slice(0, 8)
  const loytyy = new Set(rivit.map((r) => alku(r.id)))
  for (const id of [...PITKA, ...OHJELMA]) if (!loytyy.has(id)) console.log(`EI LÖYDY ${id}`)

  let pitka = 0, ohjelma = 0, pienet = 0
  for (const r of rivit) {
    const a = alku(r.id)
    const luokka = PITKA.has(a) ? "PITKA" : OHJELMA.has(a) ? "OHJELMA" : null
    if (!luokka) { pienet++; continue }
    const md: any = { ...r.metadata }
    md.pieni_korjaus = { vanha_pieni_hanke: true, vanha_expire_at: md.expire_at ?? null, luokka, korjattu: "2026-11-20" }
    delete md.pieni_hanke
    if (luokka === "PITKA") { delete md.expire_at; pitka++ } else ohjelma++
    console.log(`${luokka.padEnd(7)} ${a} ${String(r.status).padEnd(9)} ${String(r.name).replace(/\s+/g, " ").slice(0, 80)}`)
    if (!apply) continue
    const { error } = await db.from("projects").update({ metadata: md }).eq("id", r.id)
    if (error) console.log(`  VIRHE ${error.message}`)
  }
  console.log(`\npitkäkestoiset ${pitka} (pieni + vanheneminen pois), vuosiohjelmat ${ohjelma} (pieni pois), pieniksi jää ${pienet}`)
  if (!apply) console.log("Kuivaharjoitus. Aja --apply.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
