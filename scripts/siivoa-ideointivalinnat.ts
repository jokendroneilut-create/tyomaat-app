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
 * IDEOINTI POIS ASIAKKAIDEN TALLENNETUISTA VALINNOISTA (D-304).
 *
 * Vaihe poistettiin 18.10.2026, mutta asiakkaiden tallennetuissa
 * suodattimissa nimi jaa roikkumaan. Mitattu ennen poistoa:
 *
 *   hakuvahdit            1 / 40  (kaytossa oleva, 8 vaihetta listassa)
 *   bestSalesMoments      6 / 56  (6-9 vaihetta listassa)
 *
 * TARKISTETTU ETTEI YKSIKAAN OLE YKSIN. Jos Ideointi olisi listan
 * ainoa alkio, poisto jattaisi tyhjan listan joka tarkoittaa eri
 * asiaa kuin yksi valittu vaihe. Niin ei ole yhdessakaan: pienin
 * lista on kuusi alkiota.
 *
 * Poisto ei muuta yhdenkaan suodattimen tulosta, koska Ideointi
 * tasmasi 0 hankkeeseen jo ennen muutosta.
 *
 *   npx tsx scripts/siivoa-ideointivalinnat.ts
 *   npx tsx scripts/siivoa-ideointivalinnat.ts --apply
 */

const POISTETTAVA = /^ideointi$/i

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const kaikki = async (t: string, cols: string) => {
    const out: any[] = []
    for (let a = 0; ; a += 1000) {
      const { data, error } = await db.from(t).select(cols).range(a, a + 999)
      if (error) {
        console.error(`VIRHE ${t}: ${error.message}`)
        process.exit(1)
      }
      out.push(...(data ?? []))
      if ((data ?? []).length < 1000) break
    }
    return out
  }

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  /* 1. Hakuvahdit: filters.phase on vaihelista. */
  const vahdit = await kaikki("saved_searches", "id, name, filters, is_enabled")
  const vahtiKorjaukset: { id: string; nimi: string; ennen: string[]; jalkeen: string[]; filters: any }[] = []
  for (const v of vahdit) {
    const f: any = v.filters ?? {}
    const lista = Array.isArray(f.phase) ? (f.phase as string[]) : null
    if (!lista?.some((x) => POISTETTAVA.test(String(x)))) continue
    const jalkeen = lista.filter((x) => !POISTETTAVA.test(String(x)))
    if (!jalkeen.length) {
      console.log(`  OHI (jaisi tyhjaksi): ${String(v.name ?? "")}`)
      continue
    }
    vahtiKorjaukset.push({ id: String(v.id), nimi: String(v.name ?? ""), ennen: lista, jalkeen, filters: f })
  }

  /* 2. Today-asetukset: settings.bestSalesMoments. */
  const asetukset = await kaikki("user_today_preferences", "id, settings")
  const asetusKorjaukset: { id: string; ennen: string[]; jalkeen: string[]; settings: any }[] = []
  for (const r of asetukset) {
    const s: any = r.settings ?? {}
    const lista = Array.isArray(s.bestSalesMoments) ? (s.bestSalesMoments as string[]) : null
    if (!lista?.some((x) => POISTETTAVA.test(String(x)))) continue
    const jalkeen = lista.filter((x) => !POISTETTAVA.test(String(x)))
    if (!jalkeen.length) {
      console.log(`  OHI (jaisi tyhjaksi): asetusrivi ${r.id}`)
      continue
    }
    asetusKorjaukset.push({ id: String(r.id), ennen: lista, jalkeen, settings: s })
  }

  console.log(`\nhakuvahteja korjattavaksi    ${vahtiKorjaukset.length}`)
  for (const v of vahtiKorjaukset) {
    console.log(`  ${v.nimi.slice(0, 44)}`)
    console.log(`    ${v.ennen.length} -> ${v.jalkeen.length}: ${v.jalkeen.join(", ").slice(0, 140)}`)
  }
  console.log(`\ntoday-asetuksia korjattavaksi ${asetusKorjaukset.length}`)
  for (const a of asetusKorjaukset) {
    console.log(`  ${a.id}  ${a.ennen.length} -> ${a.jalkeen.length}: ${a.jalkeen.join(", ").slice(0, 130)}`)
  }

  if (!apply) {
    console.log("\nEi kirjoitettu. Aja --apply kun rivit on luettu.")
    return
  }

  let tehty = 0
  for (const v of vahtiKorjaukset) {
    const { error } = await db
      .from("saved_searches")
      .update({ filters: { ...v.filters, phase: v.jalkeen } })
      .eq("id", v.id)
    if (error) {
      console.error(`VIRHE vahti ${v.id}: ${error.message}`)
      continue
    }
    tehty++
  }
  for (const a of asetusKorjaukset) {
    const { error } = await db
      .from("user_today_preferences")
      .update({ settings: { ...a.settings, bestSalesMoments: a.jalkeen } })
      .eq("id", a.id)
    if (error) {
      console.error(`VIRHE asetus ${a.id}: ${error.message}`)
      continue
    }
    tehty++
  }
  console.log(`\nSIIVOTTU ${tehty} riviä.`)
}
main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
