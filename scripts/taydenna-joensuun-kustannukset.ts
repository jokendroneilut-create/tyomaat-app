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
 * LIITTEEN KUSTANNUSARVIOT JO OLEMASSA OLEVIIN HANKKEISIIN (D-308).
 *
 * Joensuun liite 2 antaa kustannusarvion myos neljalle hankkeelle,
 * jotka ovat jo kannassa. Johannes 18.10.2026: *"haluan etta
 * kayttajalle on nakyvissa kaikki mahdollinen tieto mita meilla on."*
 *
 * SAMA SAANTO KUIN D-307: vain tyhja kentta taytetaan. Olemassa olevaa
 * arvoa ei korvata -- se voi olla kasin korjattu tai tarkempi.
 *
 * Luvut ovat liitteen omia, euroina:
 *   Niittylahden koulu ja paivakoti   22,1  milj.
 *   Reijolan uusi paivakoti            7,32 milj.
 *   Mehtimaen uusi uimahalli          34,6  milj.
 *   Taidemuseon pihan parannus         0,7  milj.
 *
 *   npx tsx scripts/taydenna-joensuun-kustannukset.ts
 *   npx tsx scripts/taydenna-joensuun-kustannukset.ts --apply
 */

const LIITE =
  "https://dynastyjulkaisu.pohjoiskarjala.net:443/joensuu/kokous/20261518-3-126166.PDF"

const ARVIOT = [
  { haku: "Niittylahden uusi koulu", kustannus: 22_100_000, teksti: "22,1 milj. euroa" },
  { haku: "Reijolan päiväkoti", kustannus: 7_320_000, teksti: "7,32 milj. euroa" },
  { haku: "Mehtimäen uimahalli", kustannus: 34_600_000, teksti: "34,6 milj. euroa" },
  { haku: "Taidemuseon pihamuutos", kustannus: 700_000, teksti: "0,7 milj. euroa" },
] as const

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  for (const a of ARVIOT) {
    const { data, error } = await db
      .from("projects")
      .select("id, name, city, estimated_cost, metadata")
      .ilike("name", `%${a.haku}%`)
      .ilike("city", "%Joensuu%")
    if (error) {
      console.error(`VIRHE: ${error.message}`)
      continue
    }
    if (!(data ?? []).length) {
      console.log(`\n${a.haku}: EI LOYDY kannasta`)
      continue
    }
    for (const p of data ?? []) {
      /*
       * KAAVAHANKE EI OLE RAKENNUSHANKE. Kuivaharjoitus osui riviin
       * "Mehtimaen uimahallin asemakaavan muutoksen luonnokset", jolle
       * 34,6 milj. euron rakennuskustannus olisi ollut vaara: kaavan
       * laatiminen ei maksa sita, ja luku nakyisi asiakkaalle.
       */
      if (/asemakaav|kaavan muutos|kaavaluonno|yleiskaav/i.test(String(p.name ?? ""))) {
        console.log(`\n${String(p.name).slice(0, 58)}`)
        console.log(`   OHITETAAN: kaavahanke, ei rakennushanke`)
        continue
      }
      const nyt = p.estimated_cost
      console.log(`\n${String(p.name).slice(0, 58)}`)
      if (nyt != null) {
        console.log(`   kannassa jo ${nyt} -- EI korvata (liite sanoo ${a.teksti})`)
        continue
      }
      console.log(`   tyhja -> ${a.kustannus} (${a.teksti})`)
      if (!apply) continue
      const md: any = { ...(p.metadata ?? {}) }
      md.cost_source = "text"
      md.cost_source_url = LIITE
      const { error: e2 } = await db
        .from("projects")
        .update({ estimated_cost: a.kustannus, metadata: md })
        .eq("id", p.id)
      if (e2) console.error(`   VIRHE: ${e2.message}`)
      else console.log(`   kirjoitettu`)
    }
  }

  if (!apply) console.log("\nEi kirjoitettu. Aja --apply kun rivit on luettu.")
}
main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
