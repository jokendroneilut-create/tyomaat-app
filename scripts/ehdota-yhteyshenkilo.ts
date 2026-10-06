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
 * YHTEYSHENKILON HAKU VERKOSTA PUUTTUVILLE (D-244).
 *
 * Kohdejoukko: asiakkaalle nakyvat rakenteilla/suunnittelussa olevat
 * hankkeet joilta puuttuu HANKEKOHTAINEN yhteyshenkilo. Puolet niista on
 * kasin lisattyja, joilla ei ole lahdeasiakirjaa josta poimia.
 *
 * EI KIRJOITA ASIAKKAALLE NAKYVIA KENTTIA. --apply kirjoittaa
 * `metadata.yhteyshenkiloehdotus`iin, jonka ihminen hyvaksyy.
 *
 *   npx tsx scripts/ehdota-yhteyshenkilo.ts --limit=10
 *   npx tsx scripts/ehdota-yhteyshenkilo.ts --apply --limit=50
 */
async function main() {
  const apply = process.argv.includes("--apply")
  const limit = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? 10)
  /*
   * VAIHE VALITTAVISSA. Rakenteilla olevassa hankkeessa urakka on
   * lahempana kuin suunnitteluvaiheessa, joten yhteystieto on siella
   * arvokkaampi juuri nyt — ja budjetti on rajallinen.
   */
  const vaiheArg = process.argv.find((a) => a.startsWith("--vaihe="))?.split("=")[1]

  const { createClient } = await import("@supabase/supabase-js")
  const { normalizeLegacyPhase } = await import("../lib/projects/phases")
  const { onHankekohtainenYhteyshenkilo } = await import("../lib/metrics/yhteystiedonKattavuus")
  const { suggestProjectContact, isContactSuggestionEnabled, tokenit } = await import("../lib/agent/enrichment/suggestProjectContact")

  if (!isContactSuggestionEnabled()) {
    console.log("ANTHROPIC_API_KEY puuttuu - ei tehda mitaan.")
    return
  }

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const kaikki: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("projects")
      .select("id, name, city, phase, status, is_public, developer, builder, additional_info, metadata")
      .range(from, from + 999)
    if (error) throw error
    kaikki.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  const kohde = kaikki.filter((p) =>
    p.status === "active" && p.is_public === true &&
    (vaiheArg
      ? normalizeLegacyPhase(p.phase) === vaiheArg
      : ["construction", "planning"].includes(String(normalizeLegacyPhase(p.phase)))) &&
    !onHankekohtainenYhteyshenkilo(p.metadata) &&
    !(p.metadata ?? {}).yhteyshenkiloehdotus &&
    !(p.metadata ?? {}).yhteyshenkiloehdotus_paatos &&
    !(p.metadata ?? {}).yhteyshenkilohaku
  )

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")
  console.log("ilman hankekohtaista yhteyshenkiloa " + kohde.length + ", kasitellaan " + Math.min(limit, kohde.length))
  console.log("")

  /* Kolme rinnakkain: yksi haku vie noin minuutin. */
  const era = kohde.slice(0, limit)
  const RINNAKKAIN = 3
  let loytyi = 0, eiLoytynyt = 0, kirjoitettu = 0

  for (let i = 0; i < era.length; i += RINNAKKAIN) {
    const pala = era.slice(i, i + RINNAKKAIN)
    const tulokset = await Promise.all(
      pala.map(async (p) => ({
        p,
        ehdotus: await suggestProjectContact({
          name: String(p.name),
          city: p.city,
          developer: p.developer,
          builder: p.builder,
          description: p.additional_info,
        }),
      }))
    )

    for (const { p, ehdotus } of tulokset) {
      if (!ehdotus) {
        eiLoytynyt++
        console.log("  --   " + String(p.name).slice(0, 56))

        /*
         * OHITUS KIRJATAAN, JOTTEI SITA MAKSETA KAHDESTI.
         *
         * Haku maksaa saman verran loysi se tai ei (5,8 verkkohakua per
         * hanke). Ilman merkintaa seuraava ajo yrittaisi samat uudestaan:
         * sadasta yritetysta 59 oli tallaisia, eli yli puolet rahasta
         * olisi mennyt toistoon. Merkinta kertoo myos milloin yritettiin,
         * jotta hanke voidaan yrittaa myohemmin uudelleen kun siita on
         * ehka kirjoitettu lisaa.
         */
        if (apply) {
          const md = (p.metadata ?? {}) as any
          await db.from("projects").update({
            metadata: { ...md, yhteyshenkilohaku: { loytyi: false, yritetty: new Date().toISOString(), model: process.env.CONTACT_MODEL || "claude-opus-5" } },
          }).eq("id", p.id)
        }
        continue
      }
      loytyi++
      console.log("  " + ehdotus.varmuus.padEnd(6) + " " + String(p.name).slice(0, 44).padEnd(46))
      console.log("         " + ehdotus.nimi + ", " + (ehdotus.nimike ?? "-") + " (" + (ehdotus.organisaatio ?? "-") + ")")
      console.log("         " + (ehdotus.email ?? "-") + "  " + (ehdotus.puhelin ?? "-"))
      console.log("         lahde: " + (ehdotus.lahteet[0] ?? "-").slice(0, 86))

      if (!apply) continue
      const md = (p.metadata ?? {}) as any
      const { error } = await db.from("projects").update({
        metadata: { ...md, yhteyshenkiloehdotus: { ...ehdotus, luotu: new Date().toISOString() } },
      }).eq("id", p.id)
      if (error) console.log("         VIRHE: " + error.message)
      else kirjoitettu++
    }
  }

  console.log("")
  console.log("loytyi " + loytyi + " / " + era.length + ", ei loytynyt " + eiLoytynyt)
  console.log("")
  console.log("KAYTTO: " + tokenit.kutsuja + " kutsua, syote " + tokenit.syote.toLocaleString("fi-FI") +
    ", tuotos " + tokenit.tuotos.toLocaleString("fi-FI") + ", verkkohakuja " + tokenit.hakuja)
  if (era.length) {
    console.log("  per hanke: syote " + Math.round(tokenit.syote / era.length) +
      ", tuotos " + Math.round(tokenit.tuotos / era.length) +
      ", hakuja " + (tokenit.hakuja / era.length).toFixed(1))
  }
  if (apply) console.log("kirjoitettu " + kirjoitettu)
  else console.log("Ei kirjoitettu mitaan.")
}
main().catch((e) => { console.error(e); process.exit(1) })
