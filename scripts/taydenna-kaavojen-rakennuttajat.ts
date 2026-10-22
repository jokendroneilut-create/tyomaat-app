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
 * KAAVAHANKKEIDEN RAKENNUTTAJA TAKAUTUVASTI (D-338).
 *
 * Johannes 23.10.2026: *"selvitetaan syy, korjataan tama, takautuvasti,
 * jonosta jos on ja tulevista hankkeista."*
 *
 * Keraaja/resolveri on korjattu (tulevat). Tama ajo hoitaa olemassa
 * olevat rivit MOLEMMISTA tauluista.
 *
 * SAMA FUNKTIO KUIN LIVE-POLULLA. Ajo kutsuu `kaavanRakennuttaja`a eika
 * omaa kopiota saannosta, jottei takautuva ja tuleva poiminta voi
 * erkaantua toisistaan.
 *
 * KIRJOITTAA VAIN TYHJAAN TAI LUOKKASANAN PAALLE. Aito nimi kentassa
 * voittaa aina, myos silloin kun saanto antaisi toisen nimen -- mitattu
 * 23.10.2026: niita rivejä on 9, ja niissa kentan arvo oli luettuna
 * parempi (esim. "Enersense Wind Oy" vs. tekstin vanha nimi
 * "Megatuuli Oy").
 *
 *   npx tsx scripts/taydenna-kaavojen-rakennuttajat.ts
 *   npx tsx scripts/taydenna-kaavojen-rakennuttajat.ts --apply
 */

import { kaavanRakennuttaja, onLuokkasana } from "../lib/projects/kaavanRakennuttaja"

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  const luvut = { jono: 0, hanke: 0, luokkasanaKorvattu: 0, virheita: 0 }

  for (const taulu of ["potential_projects", "projects"] as const) {
    const rivit: any[] = []
    for (let a = 0; ; a += 500) {
      const { data, error } = await db
        .from(taulu)
        .select(
          taulu === "projects"
            ? "id, name, developer, additional_info, metadata"
            : "id, title, status, metadata"
        )
        .like("metadata->>resolver", "%KaavaResolver")
        .range(a, a + 499)
      if (error) {
        console.error(`VIRHE ${taulu}: ${error.message}`)
        process.exit(1)
      }
      rivit.push(...(data ?? []))
      if ((data ?? []).length < 500) break
    }

    const kohteet = taulu === "projects" ? rivit : rivit.filter((p) => p.status !== "ignored")
    console.log(`\n=== ${taulu}: ${kohteet.length} riviä ===\n`)

    for (const p of kohteet) {
      const kuvaus =
        taulu === "projects"
          ? String(p.additional_info ?? p.metadata?.description ?? "")
          : String(p.metadata?.description ?? "")
      const nykyinen = String((taulu === "projects" ? p.developer : null) ?? p.metadata?.developer ?? "").trim()

      const uusi = kaavanRakennuttaja({
        sourceName: p.metadata?.source_name,
        description: kuvaus,
        nykyinen,
      })
      if (!uusi || uusi === nykyinen) continue

      const luokka = onLuokkasana(nykyinen) ? nykyinen : null
      if (luokka) luvut.luokkasanaKorvattu += 1
      if (taulu === "projects") luvut.hanke += 1
      else luvut.jono += 1

      const nimi = String(p.name ?? p.title ?? "").slice(0, 46)
      console.log(`   ${nimi.padEnd(48)} ${(luokka ?? "-").padEnd(20)} -> ${uusi}`)

      if (!apply) continue

      const md: Record<string, any> = { ...(p.metadata ?? {}) }
      md.developer = uusi
      if (luokka) md.hakija_luokka = luokka
      md.rakennuttaja_poimittu = new Date().toISOString().slice(0, 10)

      const paivitys: Record<string, any> = { metadata: md }
      if (taulu === "projects") paivitys.developer = uusi

      const { error } = await db.from(taulu).update(paivitys).eq("id", p.id)
      if (error) {
        luvut.virheita += 1
        console.error(`      VIRHE: ${error.message}`)
      }
    }
  }

  console.log(
    `\nJono ${luvut.jono}, hankkeet ${luvut.hanke} (luokkasanan tilalle ${luvut.luokkasanaKorvattu}), virheitä ${luvut.virheita}`
  )
  if (!apply) console.log("Ei kirjoitettu. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
