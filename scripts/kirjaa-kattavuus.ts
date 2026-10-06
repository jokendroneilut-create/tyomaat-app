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
 * ENSIMMAINEN TILANNEKUVA KASIN (D-239).
 *
 * Cron ajaa taman joka yo klo 3.30, mutta ensimmainen piste kannattaa
 * kirjata heti — muuten graafi on tyhja huomiseen asti. Sama laskenta ja
 * sama upsert kuin reitilla, joten ajo on toistettavissa.
 *
 *   npx tsx scripts/kirjaa-kattavuus.ts
 */
async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { laskeKattavuus, VAIHEEN_NIMI } = await import("../lib/metrics/yhteystiedonKattavuus")
  const { haeYritysrekisteri } = await import("../lib/metrics/yritysrekisteri")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const hankkeet: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("projects").select("phase, status, is_public, metadata, developer, builder").range(from, from + 999)
    if (error) throw error
    hankkeet.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  const paiva = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Helsinki", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())
  const rekisteri = await haeYritysrekisteri()
  console.log("yritysrekisterissa " + rekisteri.size + " yritysta")
  const kattavuus = laskeKattavuus(hankkeet, rekisteri)

  console.log("paiva " + paiva + ", luettu " + hankkeet.length + " hanketta")
  for (const k of kattavuus) {
    console.log("  " + VAIHEEN_NIMI[k.vaihe].padEnd(16) + "hankekohtaisia " + String(k.hankekohtaisia).padStart(5) + " / " + String(k.hankkeita).padEnd(6) + Math.round(k.hankekohtainenOsuus * 100) + " %   kaikki " + Math.round(k.osuus * 100) + " %")
  }

  const { error } = await db.from("yhteystieto_kattavuus").upsert(
    kattavuus.map((k) => ({ paiva, vaihe: k.vaihe, hankkeita: k.hankkeita, yhteystiedolla: k.yhteystiedolla, hankekohtaisia: k.hankekohtaisia })),
    { onConflict: "paiva,vaihe" }
  )
  if (error) throw error

  const { data: rivit } = await db.from("yhteystieto_kattavuus").select("*").order("paiva", { ascending: false }).limit(6)
  console.log("")
  console.log("taulussa nyt:")
  for (const r of rivit ?? []) console.log("  " + r.paiva + "  " + String(r.vaihe).padEnd(14) + r.yhteystiedolla + "/" + r.hankkeita)
}
main().catch((e) => { console.error(e); process.exit(1) })
