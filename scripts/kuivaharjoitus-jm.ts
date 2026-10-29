import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * JM SUOMEN KOHTEET: KUIVAHARJOITUS (D-359).
 *
 * Nayttaa jokaisen ehdokkaan kenttineen ja sen, mita TASMAYTIN tekisi:
 * osuuko se olemassa olevaan riviin (ja silloin KIRJOITTAAKO kentat sen
 * paalle) vai meneeko se jonoon. Ei kirjoita mitaan.
 *
 * `--kansio=<polku>` lukee tallennetut GetViewModel-JSONit levylta,
 * jolloin saannon viritys ei kuormita lahdetta ([[backfill-run-limits]]:
 * virita otoksella, aja kerran).
 *
 *   npx tsx scripts/kuivaharjoitus-jm.ts
 *   npx tsx scripts/kuivaharjoitus-jm.ts --kansio=C:/polku/jm
 */

const kansioArg = process.argv.find((a) => a.startsWith("--kansio="))
const KANSIO = kansioArg ? kansioArg.slice("--kansio=".length) : null

async function ehdokkaat() {
  const { jasennaKohde, jmEhdokas, fetchJmSource } = await import("../lib/agent/fetchJmSource")
  if (!KANSIO) return fetchJmSource()

  const ulos: any[] = []
  for (const f of readdirSync(KANSIO)) {
    if (!f.endsWith(".json")) continue
    const data = JSON.parse(readFileSync(join(KANSIO, f), "utf8"))
    const linkki = data?.seo?.canonical ?? `https://www.jmoy.fi/${f}`
    const kohde = jasennaKohde(data, linkki)
    if (kohde) ulos.push(jmEhdokas(kohde))
  }
  return ulos
}

async function main() {
  const alkoi = Date.now()
  const lista: any[] = await ehdokkaat()
  console.log(
    `${KANSIO ? `Luettu levylta (${KANSIO})` : "Haettu verkosta"}: ${lista.length} ehdokasta, ${((Date.now() - alkoi) / 1000).toFixed(1)} s\n`
  )

  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  /*
   * VAIN TARVITTAVAT SARAKKEET. `select("*")` 7 000 rivin yli kaatui
   * kannan aikakatkaisuun kesken virityksen; kuvauskentat ovat isoja eika
   * tasmaytin tarvitse niista kuin `additional_info`in. Kanta on kaatunut
   * ennenkin turhan raskaan virityskierroksen aikana
   * ([[supabase-outage-history]]).
   */
  const SARAKKEET =
    "id,name,city,region,location,phase,status,developer,builder,property_type," +
    "estimated_completion,construction_start,additional_info,metadata,is_public"

  const hankkeet: any[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error } = await db.from("projects").select(SARAKKEET).range(a, a + 999)
    if (error) {
      console.error(`VIRHE: ${error.message}`)
      process.exit(1)
    }
    hankkeet.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }

  const jono: any[] = []
  for (let a = 0; ; a += 1000) {
    const { data } = await db.from("potential_projects").select("id,title,status").range(a, a + 999)
    jono.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }
  console.log(`(verrattu ${hankkeet.length} hankkeeseen ja ${jono.length} jonoriviin)\n`)

  const { findProjectMatchDetailed } = await import("../lib/agent/projectMatcher")
  /*
   * Vaihe verrataan `phaseAdvances`illa, EI merkkijonona. Ensimmainen
   * versio vertasi nimilappuja ja raportoi kolme muutosta joita ei
   * tapahtuisi: "Suunnittelussa" -> "Suunnittelu" on sama vaihe eri
   * nimella, ja "Rakentaminen aloitettu" -> "Suunnittelu" ei toteudu
   * lainkaan, koska vaihe saa vain edeta. Vaara mittari olisi vienyt
   * Johannekselle kolme valehalytysta.
   */
  const { phaseAdvances } = await import("../lib/projects/phases")

  let uusia = 0
  let osuvia = 0
  let valmiita = 0
  const kirjoittaisi: string[] = []

  for (const e of lista) {
    const osuma: any = findProjectMatchDetailed(hankkeet as any, e as any)
    const kohde = osuma ? hankkeet.find((h) => h.id === (osuma.project?.id ?? osuma.projectId)) : null
    const pisteet = osuma?.confidence ?? 0

    console.log(`— ${e.name}`)
    console.log(`   ${String(e.city ?? "?").padEnd(12)} ${e.phase ?? "(ei vaihetta)"} | valmis ${e.completed} | valmistuu ${e.estimated_completion ?? "-"}`)
    console.log(`   osoite: ${e.location ?? "-"}`)
    console.log(`   tilaaja ${e.developer} | rakentaja ${e.builder} | tyyppi ${e.property_type ?? "-"}`)
    console.log(`   yhteystieto: ${(e.metadata.contact_persons ?? []).map((c: any) => `${c.title} ${c.phone ?? "-"} ${c.email || "-"}`).join(" ; ") || "-"}`)

    if (e.completed) valmiita++

    if (osuma && pisteet >= 70) {
      osuvia++
      console.log(`   TASMAA (${pisteet}) -> ${String(kohde?.name ?? "?").slice(0, 60)}`)
      console.log(`      perusteet: ${(osuma.reasons ?? []).join(", ")}`)
      console.log(`      kannassa: vaihe ${kohde?.phase ?? "-"} | valmistuu ${kohde?.estimated_completion ?? "-"} | rakentaja ${kohde?.builder ?? "-"}`)
      console.log(`      kontaktit kannassa: ${(kohde?.metadata?.contact_persons ?? []).map((c: any) => c.name ?? "(nimeton)").join(" ; ") || "-"}`)
      /* Mika kannassa oleva arvo MUUTTUISI. */
      const muutos: string[] = []
      if (kohde?.estimated_completion && e.estimated_completion && kohde.estimated_completion !== e.estimated_completion)
        muutos.push(`valmistuminen ${kohde.estimated_completion} -> ${e.estimated_completion}`)
      if (phaseAdvances(kohde?.phase, e.phase)) muutos.push(`vaihe ${kohde?.phase ?? "-"} -> ${e.phase}`)
      if (e.completed && kohde?.status !== "completed") muutos.push(`tila -> completed (needs_review)`)
      if (muutos.length) {
        console.log(`      MUUTTAISI: ${muutos.join(" | ")}`)
        kirjoittaisi.push(`${e.name}: ${muutos.join(" | ")}`)
      }
    } else if (osuma) {
      console.log(`   heikko osuma (${pisteet}) -> ${String(kohde?.name ?? "?").slice(0, 60)}`)
      console.log(`      perusteet: ${(osuma.reasons ?? []).join(", ")}`)
      console.log(`   ${e.completed ? "VALMIS, EI MENE JONOON (kirjautuu completed_source)" : "JONOON"}`)
      if (!e.completed) uusia++
    } else {
      console.log(`   ${e.completed ? "VALMIS, EI MENE JONOON (kirjautuu completed_source)" : "UUSI -> JONOON"}`)
      if (!e.completed) uusia++
    }
    console.log(`   kuvaus (${e.description.length} merkkiä): ${e.description.replace(/\n/g, " ").slice(0, 150)}…`)
    console.log()
  }

  console.log(`=== YHTEENVETO ===`)
  console.log(`ehdokkaita        ${lista.length}`)
  console.log(`  tasmaa (>=70)   ${osuvia}`)
  console.log(`  valmiita        ${valmiita}`)
  console.log(`  jonoon          ${uusia}`)
  if (kirjoittaisi.length) {
    console.log(`\nKANNAN ARVOJA MUUTTUISI ${kirjoittaisi.length} rivilla:`)
    for (const r of kirjoittaisi) console.log(`   ${r}`)
  }
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
