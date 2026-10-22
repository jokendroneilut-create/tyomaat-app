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
 * FORSSAN DATAKESKUS: RAKENNUTTAJA, URAKOITSIJA, ALOITUS JA VAIHE.
 *
 * Johannes 23.10.2026: *"tasta pitaa poimia rakennuttaja eli QTS Data
 * Centers (Blackstone) joka on mainittu myos kuvauksessa. yhdistin tahan
 * toisen hankkeen jossa selvisi etta Kreate on myos mukana"* ja *"tuon
 * hankkeen aloituspaiva on myos nyt eli siirretaan rakenteilla
 * vaiheeseen."*
 *
 * RIVILLA OLI KOLME YRITYSTA JA VAIN YKSI KENTTA:
 *
 *   developer           Pikku-Muolaan Kehitys Oy   (kiinteistoyhtio)
 *   metadata.operator   QTS Data Centers (Blackstone)
 *   kuvaus              "Green 3 Finland Oy rakennuttaa..."
 *
 * Johannes valitsi rakennuttajaksi QTS:n. Kaksi muuta EIVAT katoa vaan
 * siirtyvat liittyviin yrityksiin ([[show-everything-we-know]]) -- kasin
 * annettu valinta kestaa, mutta lahteesta tullut tieto ei saa havita.
 *
 * KREATE MENEE OMAAN ROOLISARAKKEESEENSA. Tiedote sanoo *"Kreate vastaa
 * maansiirto- ja maanrakennustoista"*, mika on `earthworks_contractor`
 * eika `builder` -- paaurakoitsijaa ei ole kerrottu
 * ([[party-role-fields]]).
 *
 * ALOITUS: tiedote sanoo tyot alkavat lokakuussa 2026, ei paivaa.
 * Kuukauden ensimmainen paiva on sama tulkinta kuin
 * `parseFinnishStartDate`illa kuukausi+vuosi -tapauksessa.
 *
 *   npx tsx scripts/korjaa-forssan-datakeskus.ts
 *   npx tsx scripts/korjaa-forssan-datakeskus.ts --apply
 */

const ID = "6e1e188d-952a-4815-945b-45b8f2a59782"

const RAKENNUTTAJA = "QTS Data Centers (Blackstone)"
const MAARAKENTAJA = "Kreate Oy"
const ALOITUS = "2026-10-01"
const VAIHE = "Rakenteilla"

/*
 * KUVAUS: HANKKEEN TIEDOT TAKAISIN, URAKKA LISAKSI.
 *
 * Yhdistetyn hankkeen tiedote korvasi asiakkaan lukeman kuvauksen
 * Kreaten myyntitekstilla ("Sopimus vahvistaa Kreaten asemaa kasvavalla
 * datakeskusmarkkinalla"), jolloin hankkeen omat luvut (9 datasalia,
 * 60 000 m2, 81 MW, 44 ha) katosivat kentasta jota asiakas katsoo
 * ([[measure-the-field-the-user-reads]], [[condense-dont-recreate]]).
 */
const KUVAUS = [
  "QTS Data Centers (Blackstone) rakennuttaa Forssan Ratasmäkeen (Masmalankatu 1) datakeskuskampuksen.",
  "Vaihe 1: yhdeksän datasalia, yhteensä n. 60 000 m², sähköteho 81 MW (9 MW/sali), 44 hehtaarin tontti.",
  "Kolmikerroksinen teräsrunkoinen rakennus, automaattinen sammutusjärjestelmä, hukkalämmön talteenotto, sähköasema sekä huolto- ja turvarakennukset.",
  "Rakennuslupa myönnetty ja päätös lainvoimainen alkusyyskuusta 2026; kahdelle lisärakennukselle haetaan lupaa myöhemmin.",
  "Kreate vastaa kampuksen maansiirto- ja maanrakennustöistä: noin miljoonan kuutiometrin massansiirrot seitsemän kuukauden aikana, työt alkavat lokakuussa 2026.",
  "Kampussuunnitelmissa on jopa 10 rakennusta noin 150 hehtaarin alueella, maksimikapasiteetti n. 630 MW.",
].join(" ")

/*
 * TIEDOTTEEN IHMISET TALTEEN ENNEN KUIN TEKSTI TIIVISTYY.
 *
 * Korvattava teksti on tiedote kahteen kertaan kopioituna, ja sen
 * lopussa on kaksi nimea joita rivilla ei ole: QTS:n Euroopan
 * kehitysjohtaja ja Kreaten yksikonjohtaja. Kumpaakaan ei saa paatella
 * sahkopostiksi -- nimi ja nimike riittavat, osoite jaa tyhjaksi.
 *
 * Timo Vikstromin nimike oli "Oyj" (tekstipoiminnan katkelma); tiedote
 * sanoo sen suoraan.
 */
const HENKILOT = [
  {
    kind: "person",
    name: "Simon Caron",
    title: "Euroopan kehitystoiminnoista vastaava johtaja",
    organization: "QTS",
    email: null,
    phone: null,
  },
  {
    kind: "person",
    name: "Juha Schönberg",
    title: "Väylärakentamisen yksikönjohtaja",
    organization: "Kreate",
    email: null,
    phone: null,
  },
]

function yhdistaHenkilot(vanhat: any[]): any[] {
  const lista = vanhat.map((h) => {
    /* Nimike "Oyj" on katkelma, ei nimike. */
    if (String(h?.name ?? "") === "Timo Vikstrom" || String(h?.name ?? "") === "Timo Vikström") {
      /* Nimi oli johdettu sahkopostista, joten o-umlaut puuttui. */
      return { ...h, name: "Timo Vikström", title: "Toimitusjohtaja", organization: "Kreate Group Oyj" }
    }
    return h
  })
  for (const uusi of HENKILOT) {
    if (lista.some((h) => String(h?.name ?? "").toLowerCase() === uusi.name.toLowerCase())) continue
    lista.push(uusi)
  }
  return lista
}

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  const { data: p, error } = await db.from("projects").select("*").eq("id", ID).maybeSingle()
  if (error || !p) {
    console.error(`Hanketta ei löytynyt: ${error?.message ?? "ei riviä"}`)
    process.exit(1)
  }

  const md: Record<string, any> = { ...(p.metadata ?? {}) }

  /* Vanha rakennuttaja ja kuvauksen nimeama rakennuttaja talteen. */
  const liittyvat: string[] = Array.isArray(md.related_companies) ? [...md.related_companies] : []
  for (const nimi of [p.developer, "Green 3 Finland Oy"]) {
    const n = String(nimi ?? "").trim()
    if (n && n !== RAKENNUTTAJA && !liittyvat.some((x) => x.toLowerCase() === n.toLowerCase())) {
      liittyvat.push(n)
    }
  }

  const vanhatHenkilot = Array.isArray(md.contact_persons) ? md.contact_persons : []
  const uudetHenkilot = yhdistaHenkilot(vanhatHenkilot)

  md.contact_persons = uudetHenkilot
  md.developer = RAKENNUTTAJA
  md.earthworks_contractor = MAARAKENTAJA
  md.related_companies = liittyvat
  md.construction_start = ALOITUS
  md.description = KUVAUS
  md.phase_hint = VAIHE

  const paivitys: Record<string, any> = {
    developer: RAKENNUTTAJA,
    earthworks_contractor: MAARAKENTAJA,
    construction_start: ALOITUS,
    phase: VAIHE,
    additional_info: KUVAUS,
    metadata: md,
  }

  console.log(`\nHanke: ${p.name} (${p.city})`)
  console.log(`  rakennuttaja        ${p.developer ?? "-"}  ->  ${RAKENNUTTAJA}`)
  console.log(`  maarakennusurakka   ${p.earthworks_contractor ?? "-"}  ->  ${MAARAKENTAJA}`)
  console.log(`  liittyvät yritykset ${JSON.stringify(md.related_companies)}`)
  console.log(`  aloitus             ${p.construction_start ?? "-"}  ->  ${ALOITUS}`)
  console.log(`  vaihe               ${p.phase}  ->  ${VAIHE}`)
  console.log(`  yhteyshenkilöt      ${vanhatHenkilot.length} -> ${uudetHenkilot.length}`)
  for (const h of uudetHenkilot) {
    console.log(`     ${String(h?.name ?? "")} | ${String(h?.title ?? "-")} | ${String(h?.organization ?? "-")} | ${String(h?.email ?? "-")}`)
  }
  console.log(`\n  kuvaus nyt (${String(p.additional_info ?? "").length} merkkiä):`)
  console.log(`    ${String(p.additional_info ?? "").replace(/\s+/g, " ").slice(0, 400)}`)
  console.log(`\n  kuvaus uusi (${KUVAUS.length} merkkiä):`)
  console.log(`    ${KUVAUS}`)

  if (!apply) {
    console.log("\nEi kirjoitettu. Aja --apply kun rivit on luettu.")
    return
  }

  const { error: e } = await db.from("projects").update(paivitys).eq("id", ID)
  if (e) {
    console.error(`VIRHE: ${e.message}`)
    process.exit(1)
  }

  const { recordPhaseChange } = await import("../lib/projects/recordPhaseChange")
  await recordPhaseChange({
    supabase: db as any,
    projectId: ID,
    newPhase: VAIHE,
    previousPhase: p.phase,
    source: "manual_correction",
    sourceName: "Kreate / QTS -tiedote",
    reason: "Maanrakennustyöt alkavat lokakuussa 2026 (Kreaten tiedote)",
  })

  console.log("\nPäivitetty.")
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
