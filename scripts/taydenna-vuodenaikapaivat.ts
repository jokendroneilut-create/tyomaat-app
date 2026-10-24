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
 * VUODENAIKA JA TUOTANNON ALKU PAIVIKSI (D-347).
 *
 * Johannes 25.10.2026 Nivalan aurinkovoimalasta: *"lisaa aloitus ja
 * valmistumispaiva jotka ovat loydettavissa tekstista. miksi eivat ole
 * taydentyneet?"*
 *
 * Kaksi erillista aukkoa, molemmat korjattu jasentimiin:
 *   1. aloitusjasennin ei tuntenut vuodenaikoja lainkaan
 *   2. valmistumisjasennin ei tuntenut tuotannon kaynnistymista
 *
 * Tama ajaa korjatut saannot jo kannassa olevien riveiden yli. VAIN
 * TYHJAT KENTAT TAYTETAAN -- olemassa olevaa arvoa ei korvata, koska se
 * voi olla kasin kirjattu ([[manual-start-dates-are-real]]). Ristiriidat
 * tulostetaan, jotta ne voi lukea erikseen.
 *
 *   npx tsx scripts/taydenna-vuodenaikapaivat.ts
 *   npx tsx scripts/taydenna-vuodenaikapaivat.ts --apply
 */

import { parseFinnishStartDate } from "../lib/agent/parseFinnishStartDate"
import { parseEstimatedCompletionDate } from "../lib/agent/parseFinnishCompletionDate"

const MERKINTA = {
  jasennin: "D-347 vuodenaika + tuotannon alku",
  milloin: new Date().toISOString().slice(0, 10),
}

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  let kirjoitettu = 0
  const ristiriidat: string[] = []

  for (const taulu of ["projects", "potential_projects"] as const) {
    const rivit: any[] = []
    for (let a = 0; ; a += 1000) {
      const { data, error } = await db
        .from(taulu)
        .select(
          taulu === "projects"
            ? "id,name,phase,status,is_public,additional_info,construction_start,estimated_completion,metadata"
            : "id,title,status,metadata"
        )
        .range(a, a + 999)
      if (error) {
        console.error(`VIRHE ${taulu}: ${error.message}`)
        process.exit(1)
      }
      rivit.push(...(data ?? []))
      if ((data ?? []).length < 1000) break
    }

    const kohteet = taulu === "projects"
      ? rivit.filter((p) => p.is_public && p.status === "active")
      : rivit.filter((p) => p.status === "new" || p.status === "approved")

    console.log(`\n### ${taulu}: ${kohteet.length} riviä käsiteltävänä`)

    for (const p of kohteet) {
      const teksti = `${p.name ?? p.title ?? ""} ${p.additional_info ?? ""} ${p.metadata?.description ?? ""}`.trim()
      if (teksti.length < 40) continue

      const alkuNyt = p.construction_start ?? p.metadata?.construction_start ?? null
      const valmisNyt = p.estimated_completion ?? p.metadata?.estimated_completion ?? null

      const alku = parseFinnishStartDate(teksti)
      const valmis = parseEstimatedCompletionDate(teksti)

      /*
       * VAIN UUDEN SAANNON TUOTOS KIRJOITETAAN.
       *
       * Ensimmainen versio hyvaksyi minka tahansa valmistumisosuman
       * tyhjaan kenttaan, kunhan tekstissa esiintyi "kaynnisty".
       * Kuivaharjoitus naytti mita se olisi kirjoittanut: *"VALMISTUU
       * 1982-08-31"*, *"Tiesuunnitelma on valmistunut kevaalla 2025"*,
       * *"asemakaavan muutoksen on tavoitteena valmistua"* -- vanhoja
       * rivejä joilla kenttä on tyhjä muista syistä. Mennyt paiva
       * syottaa `autoCompleteGate`:a ja PIILOTTAA hankkeen (D-298).
       *
       * Siksi A/B samassa ajossa: jos osuma katoaa kun "kaynnisty"
       * neutraloidaan, se tuli uudesta saannosta. Muut jaavat omaan
       * mittaukseensa.
       */
      const uusiAlku = !alkuNyt && alku?.tarkkuus === "kausi" ? alku : null
      const ilmanUutta = valmis
        ? parseEstimatedCompletionDate(teksti.replace(/k[äa]ynnisty/gi, "xxxxxxxxx"))
        : null
      const uusiValmis = !valmisNyt && valmis && !ilmanUutta ? valmis : null

      if (alkuNyt && alku && String(alkuNyt).slice(0, 7) !== alku.paiva.slice(0, 7)) {
        ristiriidat.push(
          `   ${String(p.name ?? p.title).slice(0, 40).padEnd(42)} kanta ${String(alkuNyt).slice(0, 10)} vs. teksti ${alku.paiva}`
        )
      }

      if (!uusiAlku && !uusiValmis) continue

      console.log(`\n   ${String(p.name ?? p.title).slice(0, 62)}`)
      if (uusiAlku) console.log(`      ALOITUS    ${uusiAlku.paiva}  "${uusiAlku.osuma.slice(0, 90)}"`)
      if (uusiValmis) {
        /* Todiste luettavaksi: virke jossa valmistumissana esiintyy. */
        const virke =
          teksti
            .replace(/\s+/g, " ")
            .split(/(?<!(?:^|\s)[A-ZÄÖÅ])\.\s+/)
            .find((v) => /(valmistu|k[äa]ytt[öo][öo]n|luovute|k[äa]ynnisty|muuttama)/i.test(v) && /\d{4}|kev[äa][äa]ll|kes[äa]ll|syksyll|talvell/i.test(v)) ?? ""
        console.log(`      VALMISTUU  ${uusiValmis}  "${virke.slice(0, 120)}"`)
      }

      if (!apply) continue

      const md: Record<string, any> = { ...(p.metadata ?? {}) }
      const paivitys: Record<string, any> = {}

      if (uusiAlku) {
        md.construction_start_lahde = { paiva: uusiAlku.paiva, tarkkuus: uusiAlku.tarkkuus, lause: uusiAlku.osuma, ...MERKINTA }
        if (taulu === "projects") paivitys.construction_start = uusiAlku.paiva
        else md.construction_start = uusiAlku.paiva
      }
      if (uusiValmis) {
        md.estimated_completion_lahde = { paiva: uusiValmis, ...MERKINTA }
        if (taulu === "projects") paivitys.estimated_completion = uusiValmis
        else md.estimated_completion = uusiValmis
      }
      paivitys.metadata = md

      const { error } = await db.from(taulu).update(paivitys).eq("id", p.id)
      if (error) console.error(`      VIRHE: ${error.message}`)
      else kirjoitettu += 1
    }
  }

  if (ristiriidat.length) {
    console.log(`\n=== Ristiriidat (EI kirjoiteta, luettavaksi) ${ristiriidat.length} ===`)
    for (const r of ristiriidat.slice(0, 20)) console.log(r)
  }

  console.log(`\nKirjoitettu ${kirjoitettu} riviä`)
  if (!apply) console.log("Ei kirjoitettu. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
