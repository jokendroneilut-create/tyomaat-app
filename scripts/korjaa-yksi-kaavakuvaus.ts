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
 * YHDEN KAAVARIVIN KUVAUS SELOSTUKSESTA (D-356).
 *
 * Yksi rivi kerrallaan, tunnisteella. Tama on se mita Johannes pyytaa
 * useimmiten: *"tasta ei ole poimittu tarkoitusta ... korjataan tama"*.
 * Takautuva massa-ajo on eri skripti
 * (`korjaa-liiteotsikkokuvaukset.ts`).
 *
 * Hakee rivin oman sivun, valitsee selostuksen ja lukee siita
 * kaava-alueen ja tarkoituksen. EI korvaa olemassa olevaa kuvausta
 * vaan yhdistaa: sivun oma teksti sailyy edessa.
 *
 *   npx tsx scripts/korjaa-yksi-kaavakuvaus.ts <uuid>
 *   npx tsx scripts/korjaa-yksi-kaavakuvaus.ts <uuid> --apply
 */

import * as cheerio from "cheerio"

async function main() {
  const id = process.argv[2]
  const apply = process.argv.includes("--apply")
  if (!id || id.startsWith("--")) {
    console.log("Anna rivin uuid: npx tsx scripts/korjaa-yksi-kaavakuvaus.ts <uuid>")
    process.exit(1)
  }

  const { createClient } = await import("@supabase/supabase-js")
  const kuvaus = await import("../lib/agent/kaavanKuvaus")
  const liite = await import("../lib/agent/kaavanLiite")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  for (const taulu of ["projects", "potential_projects"] as const) {
    const { data, error } = await db
      .from(taulu)
      .select("*")
      .eq("id", id)
      .maybeSingle()
    if (error || !data) continue
    const rivi = data as any

    const otsikko = String(rivi.name ?? rivi.title ?? "")
    const sivu = String(rivi.metadata?.documents_url ?? rivi.metadata?.source_url ?? "")
    const nykyinen = String(rivi.additional_info ?? rivi.metadata?.description ?? "")
    console.log(`\n${taulu}: ${otsikko}`)
    console.log(`   sivu: ${sivu}`)
    console.log(`   kuvaus nyt (${nykyinen.length}): ${nykyinen.replace(/\s+/g, " ").slice(0, 120)}`)

    const res = await fetch(sivu, { headers: { "user-agent": "Mozilla/5.0" }, cache: "no-store" })
    if (!res.ok) {
      console.error(`   sivu HTTP ${res.status}`)
      return
    }
    const $ = cheerio.load(await res.text())

    const lohko = liite.lohkonLinkit($, sivu, otsikko, (sivulla: string, haettu: string) => {
      const n = (x: string) => x.toLowerCase().replace(/[^\wåäö]+/g, " ").trim()
      return n(sivulla).length >= 10 && n(sivulla).includes(n(haettu).slice(0, 30))
    })
    const linkit = (lohko ?? liite.liitelinkit($, sivu)).filter((l: any) => /\.pdf(\?|$)/i.test(l.href))
    console.log(`   liitteitä: ${linkit.length}${lohko ? " (lohkosta)" : ""}`)

    const asiakirja = kuvaus.valitseKaavanAsiakirja(linkit)
    if (!asiakirja) {
      console.error("   ei selostusta eikä OAS:ia")
      return
    }
    console.log(`   valittu: ${decodeURIComponent(asiakirja.split("/").pop() ?? "")}`)

    const teksti = await kuvaus.haeKaavaselostuksenTeksti(asiakirja)
    const luku = teksti ? kuvaus.kaavanKuvausTekstista(teksti) : null
    if (!luku) {
      console.error("   selostuksesta ei lukua")
      return
    }

    const uusi = kuvaus.yhdistaKuvaukset(nykyinen, luku) ?? luku
    console.log(`\n   UUSI (${uusi.length}):\n   ${uusi.replace(/\s+/g, " ")}`)

    if (!apply) {
      console.log("\nEi kirjoitettu. Aja --apply kun rivi on luettu.")
      return
    }

    const md = {
      ...(rivi.metadata ?? {}),
      description: uusi,
      kuvaus_selostuksesta: { liite: asiakirja, milloin: new Date().toISOString().slice(0, 10) },
    }
    const paivitys: Record<string, any> = { metadata: md }
    if (taulu === "projects") paivitys.additional_info = uusi

    const { error: e } = await db.from(taulu).update(paivitys).eq("id", id)
    if (e) console.error(`   VIRHE: ${e.message}`)
    else console.log("\nKirjoitettu.")
    return
  }

  console.log("Riviä ei löydy kummastakaan taulusta.")
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
