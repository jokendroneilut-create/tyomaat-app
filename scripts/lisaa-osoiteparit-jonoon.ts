import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); const q = v.slice(0,1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1,-1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * SAMAN KATUOSOITTEEN PARIT KATSELMOINTIJONOON (D-357).
 *
 * Tasmaytin vertaa osoitekenttaa merkkijonona, joten "Kirkonkyläntie 17,
 * 00700 Helsinki" ja "Kirkonkyläntie 17, Helsinki" ovat sille eri paikkoja.
 * Avain katu + talonumero loytaa nama. Numeron pudottamista tasmayttimeen
 * kokeiltiin ja se peruttiin (yksi vaara yhdistaminen 21:sta), joten
 * signaali jaa loytotyokaluksi: pari jonoon, ihminen paattaa.
 *
 * Skripti EI yhdista mitaan. Se kirjoittaa `project_duplicate_candidates`
 * -riveja, samaan jonoon kuin TIC:n "Merkitse duplikaatiksi" -nappi.
 *
 *   npx tsx scripts/lisaa-osoiteparit-jonoon.ts            (kuivaharjoitus)
 *   npx tsx scripts/lisaa-osoiteparit-jonoon.ts --apply
 */
const APPLY = process.argv.includes("--apply")

import { findProjectMatchDetailed } from "../lib/agent/projectMatcher"

/*
 * Katusana vaaditaan. Ilman sita "asemakaavan muutos 609 1695" tuotti
 * avaimen "muutos 609", ja Porin kaikki kaavat nayttivat samalta
 * osoitteelta -- otos paljasti sen, luku ei.
 */
const KATUPAATE =
  /(tie|katu|kuja|polku|vayla|kierto|ranta|puisto|raitti|bulevardi|aukio|kaari|rinne|laita|maki|tori|silta|portti|penger|kaarre|linja|reitti|solmu|kallio|niitty|harju|laakso|saari|lahti|nummi|kentta)$/
const EI_KATUA = new Set(["kerrosta","vaihe","osa","tontti","kortteli","asuntoa","vuonna","numero"])
const riisu = (s: string) => s.replace(/ä/g, "a").replace(/ö/g, "o").replace(/å/g, "a")

function osoiteavaimet(teksti: string | null | undefined): string[] {
  if (!teksti) return []
  const t = String(teksti).replace(/\u00a0/g, " ")
  const ulos = new Set<string>()
  const re = /([A-Za-zÅÄÖåäö][A-Za-zÅÄÖåäö-]{3,})\s+(\d{1,3})(?![\d])/g
  let m: RegExpExecArray | null
  while ((m = re.exec(t))) {
    const katu = m[1].toLowerCase()
    if (EI_KATUA.has(katu)) continue
    if (!KATUPAATE.test(riisu(katu))) continue
    ulos.add(`${katu} ${Number(m[2])}`)
  }
  return [...ulos]
}
const norm = (s: any) => String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim()

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const rivit: any[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error } = await db.from("projects").select("*").eq("is_public", true).range(a, a + 999)
    if (error) throw error
    rivit.push(...(data ?? [])); if ((data ?? []).length < 1000) break
  }
  console.log(`Julkisia hankkeita ${rivit.length}`)

  const ryhmat = new Map<string, any[]>()
  for (const r of rivit) {
    if (!r.city) continue
    for (const a of osoiteavaimet(r.location)) {
      const k = `${norm(r.city)}|${a}`
      if (!ryhmat.has(k)) ryhmat.set(k, [])
      ryhmat.get(k)!.push(r)
    }
  }

  /* Kaikki aiemmat katselmoinnit, myos not_duplicate: niita ei kysyta uudelleen. */
  const tila = new Map<string, string>()
  for (let a = 0; ; a += 1000) {
    const { data, error } = await db.from("project_duplicate_candidates")
      .select("project_id_a,project_id_b,status").range(a, a + 999)
    if (error) throw error
    for (const p of data ?? []) tila.set([p.project_id_a, p.project_id_b].sort().join("|"), p.status)
    if ((data ?? []).length < 1000) break
  }
  console.log(`Jonossa / katselmoitu ennestaan ${tila.size} paria\n`)

  const nahty = new Set<string>()
  const uudet: { idA: string; idB: string; a: any; b: any; avain: string; pisteet: number; syyt: string[] }[] = []
  let ohitettu = 0
  for (const [k, g] of ryhmat) {
    if (g.length < 2) continue
    for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) {
      const [idA, idB] = [g[i].id, g[j].id].sort()
      const avainPari = `${idA}|${idB}`
      if (nahty.has(avainPari)) continue
      nahty.add(avainPari)
      /* Sama merkkijono -> tasmaytin nakee sen jo itse, ei tarvitse jonoon. */
      if (norm(g[i].location) === norm(g[j].location)) { ohitettu++; continue }
      if (tila.has(avainPari)) { ohitettu++; continue }

      const ehdokas: any = {
        name: g[j].name, city: g[j].city, region: g[j].region, location: g[j].location,
        developer: g[j].developer, builder: g[j].builder,
        description: g[j].additional_info ?? null, metadata: g[j].metadata ?? null,
      }
      const osuma: any = findProjectMatchDetailed([g[i]] as any, ehdokas)
      uudet.push({
        idA, idB,
        a: idA === g[i].id ? g[i] : g[j],
        b: idA === g[i].id ? g[j] : g[i],
        avain: k.split("|")[1],
        pisteet: osuma?.confidence ?? 0,
        syyt: osuma?.reasons ?? [],
      })
    }
  }

  uudet.sort((x, y) => y.pisteet - x.pisteet)
  console.log(`Saman katuosoitteen pareja ohitettu (sama merkkijono tai jo katselmoitu): ${ohitettu}`)
  console.log(`UUSIA jonoon vietavia: ${uudet.length}\n`)

  const kuvaa = (p: any) =>
    `${String(p.phase ?? "-").padEnd(22)} ${String(p.name).slice(0, 62)}\n          "${p.location}"  | ${p.metadata?.source_name ?? "(lähteetön)"}`
  for (const u of uudet) {
    console.log(`[${u.avain}]  tasmaytin ${u.pisteet} p.${u.pisteet === 0 ? "  (veto)" : ""}`)
    console.log(`    A: ${kuvaa(u.a)}`)
    console.log(`    B: ${kuvaa(u.b)}`)
    if (u.syyt.length) console.log(`       ${u.syyt.join(", ")}`)
    console.log()
  }

  if (!APPLY) { console.log("(kuivaharjoitus, ei kirjoitettu)"); return }
  let n = 0
  for (const u of uudet) {
    /*
     * Lista nayttaa "Varmuus: N%" ja perusteet lappuina. Veto antaa
     * nollan, joka ilman selitysta nayttaa virheelta -- siksi nolla
     * saa oman lappunsa, joka kertoo ETTA osoite tasmaa mutta jokin
     * veto (purku vs. rakentaminen, eri urakkalaji) erottaa rivit.
     */
    const lappu = u.pisteet === 0 ? "osoite tasmaa, veto erottaa" : "sama katuosoite"
    const reasons = [...new Set([lappu, u.avain, ...u.syyt])]
    const { error } = await db.from("project_duplicate_candidates").insert({
      project_id_a: u.idA,
      project_id_b: u.idB,
      /*
       * Luottamus = tasmayttimen oma luku, ei 100. Nama eivat ole kasin
       * todettuja kaksoiskappaleita vaan saman osoitteen pareja, ja osa
       * on varmasti saman talon eri urakoita.
       */
      confidence: u.pisteet,
      reasons,
      status: "pending",
    })
    if (error) { console.error(`VIRHE ${u.idA}/${u.idB}: ${error.message}`); continue }
    n++
  }
  console.log(`=== AJETTU: ${n} paria jonoon ===`)
}
main().catch((e) => { console.error(e); process.exit(1) })
