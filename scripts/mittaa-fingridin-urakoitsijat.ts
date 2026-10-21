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
 * FINGRIDIN HANKESIVUILLA KERROTAAN URAKOITSIJA (D-328).
 *
 * Johannes 22.10.2026 Lakeuslinjan jonorivista: *"tassa kuvauksessa on
 * mainittu: Urakoitsijaksi on valittu Leonhard Weiss Ou ja Enersense PN
 * Oy. lisaa nama hankkeeseen liittyviksi yrityksiksi. katso myos muut
 * (osa jo hyvaksytty) fingridista tulleet hankkeet (myos jono) ja etsi
 * onko muissa samaa loydettavissa."*
 *
 * Fingrid kertoo urakoitsijan hankesivun tekstissa, mutta kerääjä ei
 * poimi sitä mihinkään kenttään: `builder` ja `winners` ovat null
 * kaikilla riveillä.
 *
 * OSUUSKOHTAINEN TIETO. Voimajohtohanke jaetaan osuuksiin, joilla on
 * ERI urakoitsija: Lakeuslinjan kuvauksessa on neljä osuutta ja kolme
 * eri yritystä (Caverion kahdella). Siksi poimitaan KAIKKI osumat eikä
 * ensimmäistä -- yksi nimi olisi antanut väärän kuvan.
 *
 * Tämä ajo EI KIRJOITA MITÄÄN.
 *
 *   npx tsx scripts/mittaa-fingridin-urakoitsijat.ts
 */

import { poimiUrakoitsijat } from "../lib/agent/poimiUrakoitsija"

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  /* --- HYVAKSYTYT --- */
  const hankkeet: any[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error } = await db
      .from("projects")
      .select("id, name, phase, status, is_public, builder, developer, additional_info, metadata")
      .range(a, a + 999)
    if (error) {
      console.error(`VIRHE projects: ${error.message}`)
      process.exit(1)
    }
    hankkeet.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }
  const onFingrid = (p: any) =>
    /fingrid/i.test(
      `${p.metadata?.source_name ?? ""} ${p.metadata?.source ?? ""} ${p.metadata?.source_url ?? ""} ${p.developer ?? ""}`
    )
  const fg = hankkeet.filter(onFingrid)

  /* --- JONO --- */
  const jono: any[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error } = await db
      .from("potential_projects")
      .select("id, title, status, municipality, metadata")
      .range(a, a + 999)
    if (error) {
      console.error(`VIRHE potential_projects: ${error.message}`)
      process.exit(1)
    }
    jono.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }
  const jonoFg = jono.filter((p) =>
    /fingrid/i.test(`${p.metadata?.source_name ?? ""} ${p.metadata?.source ?? ""} ${p.metadata?.source_url ?? ""}`)
  )

  console.log(`Fingrid-hankkeita hyvaksyttyna ${fg.length}, jonossa ${jonoFg.length}\n`)

  console.log("=== HYVAKSYTYT ===")
  let hLoysi = 0
  for (const p of fg) {
    const teksti = `${p.additional_info ?? ""} ${p.metadata?.description ?? ""}`
    const u = poimiUrakoitsijat(teksti)
    const nyt =
      [p.builder, (p.metadata?.winners ?? []).join(" // "), (p.metadata?.related_companies ?? []).join(" // ")]
        .filter((x: any) => x && String(x).trim())
        .join(" | ") || "-"
    const puuttuu = u.filter((n) => !nyt.toLowerCase().includes(n.toLowerCase().slice(0, 10)))
    if (u.length) hLoysi += 1
    console.log(
      `   ${String(p.name).slice(0, 46).padEnd(48)} ${String(p.phase ?? "-").slice(0, 16).padEnd(17)} ${p.status}${p.is_public ? "" : "/ei-julkinen"}`
    )
    console.log(`      kannassa: ${nyt}`)
    console.log(`      tekstista: ${u.length ? u.join(" // ") : "-"}${puuttuu.length ? `   PUUTTUU: ${puuttuu.join(" // ")}` : ""}`)
  }

  console.log("\n=== JONO ===")
  let jLoysi = 0
  for (const p of jonoFg) {
    const u = poimiUrakoitsijat(String(p.metadata?.description ?? ""))
    if (u.length) jLoysi += 1
    const nyt =
      [p.metadata?.builder, (p.metadata?.winners ?? []).join(" // "), (p.metadata?.related_companies ?? []).join(" // ")]
        .filter((x: any) => x && String(x).trim())
        .join(" | ") || "-"
    console.log(`   ${String(p.title).slice(0, 46).padEnd(48)} ${p.status}`)
    console.log(`      kannassa: ${nyt}`)
    console.log(`      tekstista: ${u.length ? u.join(" // ") : "-"}`)
  }

  console.log(
    `\nUrakoitsija loytyi tekstista: hyvaksytyista ${hLoysi}/${fg.length}, jonosta ${jLoysi}/${jonoFg.length}`
  )
  console.log("Ei kirjoitettu mitaan.")
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
