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
 * JALONIN RIVIT: LOYSEMPI HAKU (katunimi ilman numeroa + erisnimet).
 * Tarkoitus on nostaa esiin MYOS ne joita tiukka osoiteavain ei loyda.
 * Ei kirjoita mitaan.
 */

const YLEISSANA = new Set([
  "helsinki","espoo","vantaa","tampere","turku","oulu","jyväskylä","mikkeli","riihimäki","järvenpää","vihti","pihtipudas",
  "market","supermarket","kaupungintalo","päiväkoti","koulu","asunnot","oy","ab","kiinteistö","kiinteistöosakeyhtiö",
  "tilamuutokset","uudisrakennus","peruskorjaus","rakentaminen","kaupunki","kaupungin","vanha","asemakaava","asemakaavan",
  "muutos","kortteli","tontti","alue","alueen","sekä","ja","as","heka",
])

function sanat(teksti: string | null | undefined): string[] {
  return String(teksti ?? "")
    .toLowerCase()
    .replace(/[^0-9a-zåäö]+/g, " ")
    .split(" ")
    .filter((s) => s.length >= 6 && !/^\d+$/.test(s) && !YLEISSANA.has(s))
}

/* Katunimi ilman numeroa: sana joka paattyy katusanaan. */
const KATUPAATE = /(tie|katu|kuja|polku|väylä|kierto|ranta|puisto|raitti|bulevardi|aukio|kaari|rinne|laita|mäki)$/

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const kaikki: any[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error } = await db
      .from("projects")
      .select("id,name,city,phase,developer,builder,location,estimated_completion,metadata")
      .range(a, a + 999)
    if (error) { console.error("VIRHE:", error.message); process.exit(1) }
    kaikki.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }
  const jalon = kaikki.filter((h) => h.metadata?.source_name === "jalon_tyomaat")
  const jalonIdt = new Set(jalon.map((h) => h.id))

  for (const j of jalon) {
    const omat = new Set(sanat(`${j.name} ${j.location ?? ""}`))
    const kadut = [...omat].filter((s) => KATUPAATE.test(s))
    const erisnimet = [...omat].filter((s) => !KATUPAATE.test(s))

    const osumat: { h: any; yhteiset: string[] }[] = []
    for (const h of kaikki) {
      if (jalonIdt.has(h.id)) continue
      if (!j.city || h.city !== j.city) continue
      const toiset = new Set(sanat(`${h.name} ${h.location ?? ""}`))
      const yhteiset = [...omat].filter((s) => toiset.has(s))
      if (!yhteiset.length) continue
      /* Pelkka yleinen kaupunginosa ei riita: vaaditaan katu tai kaksi sanaa. */
      const vahva = yhteiset.some((s) => KATUPAATE.test(s)) || yhteiset.length >= 2
      if (vahva) osumat.push({ h, yhteiset })
    }

    console.log(`— ${j.name}  [${j.city}]`)
    console.log(`   kadut: ${kadut.join(", ") || "-"}   erisnimet: ${erisnimet.join(", ") || "-"}`)
    if (!osumat.length) console.log(`   ei osumia`)
    for (const { h, yhteiset } of osumat.slice(0, 6)) {
      console.log(`   [${yhteiset.join("+")}] ${h.name}`)
      console.log(`       ${h.id} | ${h.phase ?? "-"} | ${h.metadata?.source_name ?? "-"} | tilaaja ${h.developer ?? "-"} | osoite ${h.location ?? "-"}`)
    }
    if (osumat.length > 6) console.log(`   ... ja ${osumat.length - 6} muuta`)
    console.log()
  }
}

main().catch((e) => { console.error("KAATUI:", e?.message ?? e); process.exit(1) })
