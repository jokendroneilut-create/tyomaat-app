import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * PIETARSAAREN KESKUSTAN KAHDEN KAAVAN EROTTAMINEN.
 *
 * Sivulla on kaksi eri kaavaa otsikolla "Asemakaavan muutos
 * Keskustassa" (kirkon kortteli 15 ja Maria Malmin kortteli). Molemmat
 * kirjoittuivat samaan slugiin, joten jalkimmainen ylikirjoitti
 * ensimmaisen ja kirkon kortteli jai kokonaan keraamatta.
 *
 * Kerääjä erottaa ne nyt kuvauksesta lasketulla tiivisteella. Tallessa
 * oleva hanke on Maria Malm, ja sen tunniste on viela vanha pelkka
 * otsikkoslug. Tama skripti siirtaa sen uuteen tunnisteeseen, jotta se
 * pysyy samana hankkeena eika palaa jonoon kaksoiskappaleena. Kirkon
 * kortteli tulee jonoon uutena ehdokkaana seuraavalla ajolla.
 *
 * Kertaluontoinen. Kuivaharjoitus oletuksena; kirjoittaa vasta --apply.
 */

const APPLY = process.argv.includes("--apply")
const VANHA = "asemakaavan-muutos-keskustassa"
const URL_ = "https://pietarsaari.fi/asuminen-ja-ymparisto/tekniset-palvelut/kaavoitus/vireilla-olevat-asemakaavahankkeet"

/* Tunnistetaan Maria Malmin kortteli kuvauksesta, ei lohkon paikasta. */
const MARIA_MALM = /maria malm/i

async function main() {
  const cheerio: any = await import("cheerio")
  const { createClient } = await import("@supabase/supabase-js")
  const { pietarsaariKaavaDescription } = await import("../lib/agent/pietarsaariKaavaDescription")
  const { pietarsaariKaavaSlugs } = await import("../lib/agent/pietarsaariKaavaSlug")
  const { normalizeIdentifierValue } = await import("../lib/projects/identity")

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  /* 1. Laske uudet slugit sivulta samalla logiikalla kuin keraaja. */
  const $ = cheerio.load(await (await fetch(URL_, { cache: "no-store" })).text())
  const lohkot: { title: string; nodes: any[] }[] = []
  let nyk: any = null
  for (const el of $("div.page-content").first().children().toArray()) {
    if ((el as any).name === "h2") {
      const t = $(el).text().replace(/\s+/g, " ").trim()
      if (t.toLowerCase() === "katso myös nämä") break
      nyk = { title: t, nodes: [] }; lohkot.push(nyk); continue
    }
    if (nyk) nyk.nodes.push(el)
  }
  const kuvaukset = lohkot.map((l) =>
    pietarsaariKaavaDescription(l.nodes.map((n: any) => ({ tag: String(n.name ?? ""), text: $(n).text().replace(/\s+/g, " ").trim() })))
  )
  const slugit = pietarsaariKaavaSlugs(lohkot.map((l, i) => ({ title: l.title, description: kuvaukset[i] })))

  const i = kuvaukset.findIndex((k) => k && MARIA_MALM.test(k))
  if (i < 0) { console.log("Maria Malmin kuvausta ei loytynyt sivulta — ei muutoksia."); return }
  const UUSI = slugit[i]
  if (UUSI === VANHA) { console.log("Slug ei muutu — ei muutoksia."); return }

  console.log(`${APPLY ? "AJO" : "KUIVAHARJOITUS"}`)
  console.log(`  vanha slug   ${VANHA}`)
  console.log(`  uusi slug    ${UUSI}`)
  console.log(`  kuvaus       ${String(kuvaukset[i]).slice(0, 90)}\n`)

  /* 2. Tunnisterivi. */
  const { data: tunnus, error: tErr } = await admin
    .from("project_identifiers")
    .select("*")
    .eq("identifier_type", "pietarsaari_kaava_slug")
    .eq("identifier_value_normalized", normalizeIdentifierValue(VANHA)!)
    .maybeSingle()
  if (tErr) throw tErr
  if (!tunnus) { console.log("Tunnisteriviä ei löydy — ei muutoksia."); return }
  console.log(`  tunnus       ${tunnus.id} hanke=${tunnus.project_id ?? "-"} ehdokas=${tunnus.potential_project_id ?? "-"}`)

  /* 3. Hanke ja ehdokas. */
  const { data: hanke } = await admin.from("projects").select("id,name,additional_info,metadata").eq("id", tunnus.project_id ?? "").maybeSingle()
  if (hanke) {
    console.log(`  hanke        ${hanke.name}`)
    console.log(`               ${String(hanke.additional_info).slice(0, 80)}`)
    if (!MARIA_MALM.test(String(hanke.additional_info ?? ""))) {
      console.log("\nHanke EI ole Maria Malm — keskeytetaan, ettei vaara hanke siirry.")
      return
    }
  }

  if (!APPLY) { console.log("\nKuivaharjoitus: mitaan ei kirjoitettu."); return }

  const uusiUrl = `${URL_}#${UUSI}`

  const a = await admin.from("project_identifiers")
    .update({ identifier_value: UUSI, identifier_value_normalized: normalizeIdentifierValue(UUSI)! })
    .eq("id", tunnus.id)
  console.log(a.error ? `  tunnus VIRHE: ${a.error.message}` : "  tunnus paivitetty")

  if (hanke) {
    const md: any = { ...(hanke.metadata ?? {}), slug: UUSI, source_url: uusiUrl, documents_url: uusiUrl }
    const b = await admin.from("projects").update({ metadata: md }).eq("id", hanke.id)
    console.log(b.error ? `  hanke VIRHE: ${b.error.message}` : "  hanke paivitetty")
  }

  if (tunnus.potential_project_id) {
    const { data: pp } = await admin.from("potential_projects").select("id,metadata").eq("id", tunnus.potential_project_id).maybeSingle()
    if (pp) {
      const md: any = { ...((pp as any).metadata ?? {}), slug: UUSI, source_url: uusiUrl, documents_url: uusiUrl }
      const c = await admin.from("potential_projects").update({ metadata: md }).eq("id", pp.id)
      console.log(c.error ? `  ehdokas VIRHE: ${c.error.message}` : "  ehdokas paivitetty")
    }
  }
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
export {}
