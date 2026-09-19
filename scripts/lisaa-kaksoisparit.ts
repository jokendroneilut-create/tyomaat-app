import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * LÄHTEETTÖMIEN HAUSSA LÖYTYNEET KAKSOISHANKKEET KATSELMOINTIJONOON (D-202).
 *
 * D-200:n haku ja parien luku löysivät hankkeita, jotka näkyvät
 * asiakkaalle kahdesti: lähteetön alkuaineiston rivi + sama hanke
 * myöhemmin toisen lähteen kautta. Skannaus ei löytänyt niitä, koska
 * otsikot ovat eri lauseita ("Asema- ja pysäköintikeskus Turkuun" vs.
 * "LogoHubin rakennustyöt alkavat lokakuussa").
 *
 * Skripti EI yhdistä mitään. Se kirjaa parin samaan jonoon kuin
 * TIC:n "Merkitse duplikaatiksi" -nappi (`/api/tic/duplicates/manual`);
 * ihminen vahvistaa, ja vahvistus valitsee säilyjän, nostaa vaiheen,
 * tarkistaa suosikit ja piilottaa toisen.
 *
 *   npx tsx scripts/lisaa-kaksoisparit.ts            (kuivaharjoitus)
 *   npx tsx scripts/lisaa-kaksoisparit.ts --apply
 */
const APPLY = process.argv.includes("--apply")

/* [hankkeen A nimen alku, hankkeen B nimen alku] - luettu 19.9.2026. */
const PARIT: [string, string][] = [
  ["Kerrostalo Hatanpäähän Boijenkatu 2", "Kerrostalo Hatanpäähän"],
  ["Kerrostalo Hiukkavaaraan", "Kerrostalo Oulun Hiukkavaaraan"],
  ["Kulomäentien sillan peruskorjaus", "Kulomäentien risteyssillan peruskorjaus alkaa Tuusulassa"],
  ["Kerrostalo Tampereen Hatanpäähän", "Lujatalo käynnistää omaperusteisen kerrostalon rakentamisen Tampereen Hatanpäähän"],
  ["Kaksi uutta kerrostaloa Oulun Hiukkavaaraan", "Pohjola Rakennus Oy Suomi rakentaa kaksi uutta asuinkerrostaloa Oulun Hiukkavaaraan"],
  ["Ikäihmisten palvelutalo", "Ikäihmisten palvelutalo Poriin"],
  ["Väylähanke Kurkela - Kuusisto", "Mt 180 Kurkela-Kuusisto"],
  ["Väylähanke Kurkela - Kuusisto", "Siltoja, väyliä ja vaativaa infrarakentamista – mittava Mt 180 Kurkela–Kuusisto"],
  ["Asema- ja pysäköintikeskus Turkuun", "LogoHubin rakennustyöt alkavat lokakuussa"],
  ["Kansallisarkiston peruskorjaus Helsingissä", "Kansallisarkiston peruskorjaus ja toimistotilojen muutostyöt"],
  ["Kansallisarkiston peruskorjaus Helsingissä", "Kansallisarkiston peruskorjaus, Helsinki"],
  ["Vaativa asematunneliurakka käynnistyy Malminkartanossa", "Vaativa asematunneliurakka käynnistyy Malminkartanossa – Kreate"],
  ["Espoon Asunnot Oy / Matinkatu 7 ja Ratamotie 1", "Espoon Asunnot Oy / Matinkatu 7 ja Ratamotie 1"],
  ["Kerrostalo Oulunkylään", "Kerrostalo As Oy Helsingin Kruunuvouti"],
  ["Kerrostalo Rauhanniemeen", "Kerrostalo Rauhanniemeen"],
  ["Kerrostalo Vuosaareen", "Helsingin Vuosaareen nousee ainutlaatuinen kerrostalokohde"],
]

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const projektit: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("projects").select("id, name, city, phase, is_public, developer, builder, metadata").eq("is_public", true).range(from, from + 999)
    if (error) throw error
    projektit.push(...(data ?? [])); if (!data || data.length < 1000) break
  }

  let n = 0
  for (const [nimiA, nimiB] of PARIT) {
    const a = projektit.filter((p) => String(p.name).startsWith(nimiA))
    const b = projektit.filter((p) => String(p.name).startsWith(nimiB) && !a.some((x) => x.id === p.id))
    /* Sama alku molemmilla (esim. Rauhanniemi): parin muodostavat kaksi eri riviä. */
    const ehdokkaat = nimiA === nimiB ? [[a[0], a[1]]] : a.flatMap((x) => b.map((y) => [x, y]))
    for (const [x, y] of ehdokkaat) {
      if (!x || !y) { console.log(`EI PARIA: ${nimiA} <-> ${nimiB} (${a.length}/${b.length})`); continue }
      const [idA, idB] = [x.id, y.id].sort()
      const { data: onJo } = await db.from("project_duplicate_candidates").select("status").eq("project_id_a", idA).eq("project_id_b", idB).maybeSingle()
      const kuvaa = (p: any) => `${String(p.name).slice(0, 60)} | ${p.city ?? "-"} | ${p.phase} | ${p.metadata?.source_name ?? "(lähteetön)"} | rak.tt ${p.developer ?? "-"} | rak ${p.builder ?? "-"}`
      console.log(`${onJo ? `JO JONOSSA (${onJo.status})` : "UUSI"}\n   A: ${kuvaa(x)}\n   B: ${kuvaa(y)}`)
      if (onJo) continue
      n++
      if (!APPLY) continue
      const { error } = await db.from("project_duplicate_candidates").insert({
        project_id_a: idA,
        project_id_b: idB,
        confidence: 100,
        reasons: ["manual"],
        status: "pending",
      })
      if (error) throw error
    }
  }
  console.log(`\n=== ${APPLY ? "AJETTU" : "KUIVAHARJOITUS"}: ${n} uutta paria jonoon ===`)
}
main().catch((e) => { console.error(e); process.exit(1) })
