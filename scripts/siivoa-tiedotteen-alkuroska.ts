import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * STT:N SIVUPOHJA POIS KUVAUSTEN ALUSTA, TAKAUTUVASTI (D-266).
 *
 * Kuvaus alkoi otsikolla, aikaleimalla ja "TiedoteJaa"-palkilla ennen
 * varsinaista tekstia. Hanta siivottiin jo, alkua ei.
 *
 * EI TYHJENNA EIKA LYHENNA LIIKAA: `stripReleaseHead` palauttaa
 * alkuperaisen jos leikkaus veisi tekstin alle 80 merkkiin.
 *
 *   npx tsx scripts/siivoa-tiedotteen-alkuroska.ts
 *   npx tsx scripts/siivoa-tiedotteen-alkuroska.ts --apply
 */
const APPLY = process.argv.includes("--apply")

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { stripReleaseHead } = await import("../lib/agent/companyRelease")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  for (const taulu of ["projects", "potential_projects"]) {
    const muutettavat: any[] = []
    for (let f = 0; f < 20000; f += 1000) {
      const { data, error } = await db.from(taulu).select("*").range(f, f + 999)
      if (error) throw error
      if (!data?.length) break
      for (const r of data as any[]) {
        const md = r.metadata ?? {}
        const kentat: { mihin: "additional_info" | "description"; ennen: string }[] = []
        if (taulu === "projects" && r.additional_info) kentat.push({ mihin: "additional_info", ennen: r.additional_info })
        if (md.description) kentat.push({ mihin: "description", ennen: md.description })
        const muutokset = kentat
          .map((k) => ({ ...k, jalkeen: stripReleaseHead(k.ennen) }))
          .filter((k) => k.jalkeen !== k.ennen)
        if (muutokset.length) muutettavat.push({ id: r.id, nimi: r.name ?? r.title, md, muutokset })
      }
      if (data.length < 1000) break
    }

    console.log(`\n=== ${taulu}: siivottavia ${muutettavat.length}`)
    for (const m of muutettavat.slice(0, 5)) {
      const k = m.muutokset[0]
      console.log(`   ${String(m.nimi).slice(0, 52)}`)
      console.log(`      ennen:   ${String(k.ennen).slice(0, 96)}`)
      console.log(`      jalkeen: ${String(k.jalkeen).slice(0, 96)}`)
      console.log(`      poistui ${k.ennen.length - k.jalkeen.length} merkkia`)
    }
    const poistuu = muutettavat.flatMap((m: any) => m.muutokset).map((k: any) => k.ennen.length - k.jalkeen.length)
    if (poistuu.length) {
      console.log(`   poistuvia merkkeja: min ${Math.min(...poistuu)}, max ${Math.max(...poistuu)}, ka ${Math.round(poistuu.reduce((a: number, b: number) => a + b, 0) / poistuu.length)}`)
    }

    if (!APPLY) continue
    let n = 0
    for (const m of muutettavat) {
      const paivitys: any = {}
      let md = { ...m.md }
      for (const k of m.muutokset) {
        if (k.mihin === "additional_info") paivitys.additional_info = k.jalkeen
        else md = { ...md, description: k.jalkeen }
      }
      paivitys.metadata = md
      const { error } = await db.from(taulu).update(paivitys).eq("id", m.id)
      if (error) throw error
      n++
    }
    console.log(`   === SIIVOTTU ${n} ===`)
  }
  if (!APPLY) console.log("\n=== KUIVAHARJOITUS ===")
}
main().catch(e => { console.error(e); process.exit(1) })
