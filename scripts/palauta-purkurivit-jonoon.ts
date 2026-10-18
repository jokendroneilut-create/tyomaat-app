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
 * AUTOMAATTISESTI OHITETUT PURKURIVIT TAKAISIN JONOON (D-308).
 *
 * Johannes pyysi viisi purkukohdetta katselmoitavaksi. LLM-portti
 * merkitsi niista kaksi `llm_ei_relevantti` ja siirsi tilaan `ignored`,
 * jolloin ne eivat nay katselmoinnissa lainkaan.
 *
 * PORTTI ON RISTIRIITAINEN TASSA AINEISTOSSA. Nelja kohdetta tulee
 * SAMASTA LAUSEESTA samassa investointiohjelmassa, ja portti antoi
 * vastakkaiset tuomiot korkealla varmuudella molempiin suuntiin:
 *
 *   Heinavaara  "ei merkitse aktiivista hankkeen vaihetta"   -> ohita (0.85)
 *   Rantakyla   "hallinnollinen ilmoitus, liian kaukainen"   -> ohita
 *   Petaikkola  "konkreettinen infrastruktuurihanke"         -> sailyta
 *   Tuupovaara  "konkreettinen rakennushanke, relevantti"    -> sailyta (0.85)
 *
 * Varmuusluku ei siis erottele oikeaa vaarasta; erimielisyys
 * identtisten tapausten valilla erottelee. Ihmisen pyynto menee
 * portin edelle: rivit palautetaan tilaan `new`.
 *
 * Automaattiportin lippu poistetaan, jotta rivi ei valu takaisin
 * `ignored`-tilaan seuraavalla tunnistusajolla
 * (`resolvePotentialProject` lukee `recommended_action`-avainta).
 *
 *   npx tsx scripts/palauta-purkurivit-jonoon.ts
 *   npx tsx scripts/palauta-purkurivit-jonoon.ts --apply
 */

const LAHDE = "9beb523a-28eb-4755-a511-99ef37bb5368"

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const { data, error } = await db
    .from("potential_projects")
    .select("id, title, status, metadata")
    .eq("metadata->>eroteltu_rivista", LAHDE)
  if (error) {
    console.error(`VIRHE: ${error.message}`)
    process.exit(1)
  }

  const ohitetut = (data ?? []).filter((r: any) => r.status === "ignored")
  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")
  console.log(`eroteltuja rivejä ${(data ?? []).length}, automaattisesti ohitettuja ${ohitetut.length}\n`)

  for (const r of ohitetut) {
    const m: any = r.metadata ?? {}
    console.log(`${r.title}`)
    console.log(`   syy: ${m.auto_ignored_reason ?? "-"}`)
    console.log(`   LLM: ${String(m.llm_relevance?.reason ?? "-").slice(0, 120)}`)
  }

  if (!ohitetut.length) {
    console.log("Ei palautettavaa.")
    return
  }
  if (!apply) {
    console.log("\nEi kirjoitettu. Aja --apply kun rivit on luettu.")
    return
  }

  let tehty = 0
  for (const r of ohitetut) {
    const m: any = { ...(r.metadata ?? {}) }
    delete m.recommended_action
    delete m.auto_ignored_reason
    /*
     * LLM:n arvio jaa nakyviin, jotta katselmoija nakee mita kone
     * ajatteli -- vain sen automaattinen vaikutus poistetaan.
     */
    m.palautettu_jonoon = {
      milloin: new Date().toISOString(),
      syy: "Johanneksen pyynto: purkukohteet katselmoitavaksi; LLM-portti oli ristiriitainen samasta lauseesta tulleiden kohteiden valilla",
    }
    const { error: e2 } = await db
      .from("potential_projects")
      .update({ status: "new", metadata: m })
      .eq("id", r.id)
    if (e2) {
      console.error(`VIRHE ${r.id}: ${e2.message}`)
      continue
    }
    tehty++
  }
  console.log(`\nPALAUTETTU ${tehty} riviä jonoon.`)
}
main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
