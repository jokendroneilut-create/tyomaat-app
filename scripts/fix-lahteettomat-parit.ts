import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * LÄHTEETÖN HANKE + SAMA HANKE TOISEN LÄHTEEN KAUTTA (D-200).
 *
 * `scripts/measure-lahteettomat.ts` löysi nimivertailulla 31 paria, joista
 * luettuna noin puolet oli vääriä ("Asunto Oy Espoon Luhtavehka" <->
 * "Asunto Oy Espoon Vuoritonttu"). Siksi parit on lueteltu KÄSIN; skripti
 * kopioi vastineen yhteyshenkilöt ja lähdeosoitteen lähteettömälle.
 * Vain lisätään: olemassa olevaa ei korvata, eikä hankkeita yhdistetä.
 *
 *   npx tsx scripts/fix-lahteettomat-parit.ts            (kuivaharjoitus)
 *   npx tsx scripts/fix-lahteettomat-parit.ts --apply
 */
const APPLY = process.argv.includes("--apply")

/* [lähteettömän nimen alku, vastineen otsikon alku] - luettu 19.9.2026. */
/*
 * Poistettu 19.9.2026 (D-202): Hatanpää Boijenkatu 2, Hiukkavaara ja
 * Tampereen Hatanpää - eri hankkeita, ks. scripts/peru-vaarat-parit.ts.
 */
const PARIT: [string, string][] = [
  ["Kulomäentien sillan peruskorjaus", "Kulomäentien risteyssillan peruskorjaus alkaa Tuusulassa"],
  ["Asunto Oy Tampereen Kalevan Kaiku", "Asunto Oy Tampereen Kalevan Kaiun rakentamisen"],
  ["Turun tuomiokirkon peruskorjaus", "Turun tuomiokirkon mittavan peruskorjauksen"],
  ["Helsingin Kruunuvuorenrantaan rakenteille 77 Bonava-kotia", "Helsingin Kruunuvuorenrantaan rakenteille 77 Bonava-kotia"],
  ["Kaksi uutta kerrostaloa Oulun Hiukkavaaraan", "Pohjola Rakennus Oy Suomi rakentaa kaksi uutta asuinkerrostaloa Oulun Hiukkavaaraan"],
  ["Ikäihmisten palvelutalo", "Ikäihmisten palvelutalo Poriin"],
  ["Väylähanke Kurkela - Kuusisto", "Mt 180 Kurkela-Kuusisto"],
  ["Väylähanke Kurkela - Kuusisto", "Siltoja, väyliä ja vaativaa infrarakentamista – mittava Mt 180 Kurkela–Kuusisto"],
  ["Asema- ja pysäköintikeskus Turkuun", "LogoHubin rakennustyöt alkavat lokakuussa"],
  ["Kansallisarkiston peruskorjaus Helsingissä", "Kansallisarkiston peruskorjaus ja toimistotilojen muutostyöt"],
  ["Kansallisarkiston peruskorjaus Helsingissä", "Kansallisarkiston peruskorjaus, Helsinki"],
  ["Tammelan koulun ja Sara Hildén -akatemian perusparannus", "Tammelan koulun ja Sara Hildén -akatemian perusparannus ja rakentaminen alkavat"],
  ["Vaativa asematunneliurakka käynnistyy Malminkartanossa", "Vaativa asematunneliurakka käynnistyy Malminkartanossa – Kreate"],
  ["Skanska rakentaa Garminille toimitilat Jyväskylään", "Garminille toimitilat Jyväskylään"],
  ["Espoon Asunnot Oy / Matinkatu 7 ja Ratamotie 1", "Espoon Asunnot Oy / Matinkatu 7 ja Ratamotie 1"],
]

const kelpo = (c: any) => c && (c.email || c.phone)

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const kaikki = async (t: string, cols: string) => {
    const out: any[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from(t).select(cols).range(from, from + 999)
      if (error) throw error
      out.push(...(data ?? [])); if (!data || data.length < 1000) break
    }
    return out
  }
  const projektit = await kaikki("projects", "id, name, is_public, metadata")
  const ehdokkaat = await kaikki("potential_projects", "id, title, metadata")

  const kohteet = new Map<string, { p: any; lisat: any[]; url: string | null; mista: string[] }>()
  for (const [lahteeton, vastine] of PARIT) {
    const p = projektit.find((x) => x.is_public && !x.metadata?.source_name && String(x.name).startsWith(lahteeton))
    if (!p) { console.log(`EI LÖYDY lähteetöntä: ${lahteeton}`); continue }
    const v = [
      ...projektit.filter((x) => x.metadata?.source_name && String(x.name).startsWith(vastine)).map((x) => ({ nimi: x.name, m: x.metadata })),
      ...ehdokkaat.filter((x) => x.metadata?.source_name && String(x.title).startsWith(vastine)).map((x) => ({ nimi: x.title, m: x.metadata })),
    ]
    if (!v.length) { console.log(`EI LÖYDY vastinetta: ${vastine}`); continue }
    const k = kohteet.get(p.id) ?? { p, lisat: [], url: null, mista: [] }
    for (const x of v) {
      for (const c of (x.m?.contact_persons ?? []).filter(kelpo)) {
        const avain = `${String(c.email ?? "").toLowerCase()}|${String(c.phone ?? "")}`
        const jo = [...(p.metadata?.contact_persons ?? []), ...k.lisat].some((y: any) => `${String(y.email ?? "").toLowerCase()}|${String(y.phone ?? "")}` === avain)
        if (!jo) k.lisat.push(c)
      }
      k.url = k.url ?? x.m?.source_url ?? x.m?.documents_url ?? null
      k.mista.push(`${x.m?.source_name}`)
    }
    kohteet.set(p.id, k)
  }

  let n = 0
  for (const { p, lisat, url, mista } of kohteet.values()) {
    const tarvitseeUrl = !p.metadata?.source_url && !p.metadata?.last_source_url && url
    if (!lisat.length && !tarvitseeUrl) continue
    n++
    console.log(`${String(p.name).slice(0, 60)}  <- ${[...new Set(mista)].join(", ")}\n   +${lisat.length} yhteyshenkilöä${tarvitseeUrl ? ` | lähde ${new URL(url!).hostname}` : ""}`)
    if (!APPLY) continue
    const metadata = {
      ...p.metadata,
      contact_persons: [...(p.metadata?.contact_persons ?? []), ...lisat],
      ...(tarvitseeUrl ? { source_url: url } : {}),
    }
    const { error } = await db.from("projects").update({ metadata }).eq("id", p.id)
    if (error) throw error
  }
  console.log(`\n=== ${APPLY ? "AJETTU" : "KUIVAHARJOITUS"}: ${n} hanketta ===`)
}
main().catch((e) => { console.error(e); process.exit(1) })
