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
 * VALMISTUMINEN URAKKA-AJASTA TAKAUTUVASTI (D-342).
 *
 * Johannes 24.10.2026 Abackan sahkoasemasta: *"tasta ei ole poimittu
 * Arvioitu urakka-aika on huhtikuu 2026 - joulukuu 2026."*
 *
 * Ajaa SAMAA funktiota kuin tuleva poiminta (`urakkaAjanLoppu`), jottei
 * takautuva ja tuleva voi erkaantua. Kirjoittaa vain TYHJAAN kenttaan:
 * tiedossa oleva arvio voittaa aina.
 *
 * MENNYT PAIVA ON VAARALLINEN. `autoCompleteGate` siirtaa hankkeen
 * Valmistuneeksi 90 vrk kuluttua arvioidusta valmistumisesta ja
 * piilottaa sen asiakkaalta (D-298). Siksi ajo erittelee menneet
 * paivat omaksi ryhmakseen luettavaksi -- ne ovat oikeita (urakka on
 * paattynyt) mutta muuttavat rivin nakyvyytta.
 *
 *   npx tsx scripts/taydenna-urakka-ajat.ts
 *   npx tsx scripts/taydenna-urakka-ajat.ts --apply
 */

import { urakkaAjanLoppu, valmiinaMennessa } from "../lib/agent/urakkaAika"

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  const tanaan = new Date().toISOString().slice(0, 10)
  const luvut = { jono: 0, hanke: 0, mennyt: 0, virheita: 0 }
  const menneet: string[] = []

  for (const taulu of ["potential_projects", "projects"] as const) {
    const rivit: any[] = []
    for (let a = 0; ; a += 500) {
      const { data, error } = await db
        .from(taulu)
        .select(
          taulu === "projects"
            ? "id, name, phase, estimated_completion, additional_info, metadata"
            : "id, title, status, metadata"
        )
        .range(a, a + 499)
      if (error) {
        console.error(`VIRHE: ${error.message}`)
        process.exit(1)
      }
      rivit.push(...(data ?? []))
      if ((data ?? []).length < 500) break
    }

    const kohteet = taulu === "projects" ? rivit : rivit.filter((p) => p.status !== "ignored")
    console.log(`\n=== ${taulu}: ${kohteet.length} riviä ===\n`)

    for (const p of kohteet) {
      const nyt =
        (taulu === "projects" ? p.estimated_completion : null) ??
        p.metadata?.estimated_completion ??
        null
      if (nyt) continue

      const kuvaus =
        taulu === "projects"
          ? String(p.additional_info ?? p.metadata?.description ?? "")
          : String(p.metadata?.description ?? "")
      /* Jakso ensin, sitten "valmiina X mennessa" (D-342). */
      const loppu = urakkaAjanLoppu(kuvaus) ?? valmiinaMennessa(kuvaus)
      if (!loppu) continue

      const nimi = String(p.name ?? p.title ?? "").slice(0, 44)

      /*
       * MENNYTTA PAIVAA EI KIRJOITETA TAKAUTUVASTI.
       *
       * `autoCompleteGate` siirtaa hankkeen Valmistuneeksi 90 vrk
       * kuluttua arvioidusta valmistumisesta ja piilottaa sen
       * asiakkaalta (D-298). Takautuva ajo kirjoittaisi kerralla
       * kymmenia menneita paivia, ja osa riveista on yha
       * Suunnittelussa -- kesken oleva hanke piilotettuna on pahempi
       * kuin valmistunut listalla ([[hiding-threshold]]).
       *
       * Ne tulostetaan luettavaksi, jotta Johannes paattaa niista itse.
       * Tuleva poiminta ei tarvitse tata rajausta: siella mennyt paiva
       * kulkee jo `isPastDate`-portin lapi.
       */
      if (loppu < tanaan) {
        luvut.mennyt += 1
        menneet.push(
          `   ${nimi.padEnd(46)} ${loppu}  ${taulu === "projects" ? `vaihe ${p.phase}` : "jono"}`
        )
        continue
      }

      if (taulu === "projects") luvut.hanke += 1
      else luvut.jono += 1

      console.log(`   ${nimi.padEnd(46)} -> ${loppu}`)

      if (!apply) continue

      const md: Record<string, any> = { ...(p.metadata ?? {}) }
      md.estimated_completion = loppu
      md.valmistuminen_urakka_ajasta = new Date().toISOString().slice(0, 10)

      const paivitys: Record<string, any> = { metadata: md }
      if (taulu === "projects") paivitys.estimated_completion = loppu

      const { error } = await db.from(taulu).update(paivitys).eq("id", p.id)
      if (error) {
        luvut.virheita += 1
        console.error(`      VIRHE: ${error.message}`)
      }
    }
  }

  console.log(`\nJono ${luvut.jono}, hankkeet ${luvut.hanke}, virheitä ${luvut.virheita}`)
  if (menneet.length) {
    console.log(`\n=== OHITETTU, PÄIVÄ JO MENNYT: ${menneet.length} (ei kirjoitettu) ===`)
    for (const m of menneet) console.log(m)
  }
  if (!apply) console.log("\nEi kirjoitettu. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
