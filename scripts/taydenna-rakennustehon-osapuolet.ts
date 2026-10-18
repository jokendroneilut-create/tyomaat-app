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
 * OSAPUOLET ROOLIKENTTIIN, EI VAIN LIITTYVIKSI YRITYKSIKSI (D-313).
 *
 * Johannes 19.10.2026: *"lisasitko myos uudet osapuolet noihin jos
 * hanke oli jo olemassa? ... riittaa etta kaikki hankkeen osapuolet on
 * listattu jos ei saa sen tarkemmin. lahdehan kertoo osapuolen."*
 *
 * EI RIITTANYT. D-313:ssa kirjoitin suunnittelijat vain
 * `metadata.related_companies`-listaan, jossa `collectProjectCompanies`
 * antaa niille roolin **"Liittyva yritys"** -- ja hanketaulun omat
 * roolisarakkeet jaivat tyhjiksi. Lahde kertoo roolit sanatarkasti:
 *
 *   "Rakennuttamistehtavat: A-Insinoorit Rakennuttaminen Oy
 *    Paa- ja arkkitehtisuunnittelu: Uuleo Arkkitehdit Oy ja AOR Arkkitehdit Oy
 *    Rakennesuunnittelu: WSP Finland Oy
 *    Talotekniikkasuunnittelu: Granlund Oy"
 *
 * joten rooli on tiedossa eika sita tarvitse heittaa pois.
 *
 * EROTIN ON `//`, EI PILKKU. Kannassa pilkku on tavallisempi (2 riviä
 * arkkitehtikentassa), mutta `splitCompanyField` katkaisee vain
 * `//`-merkilla tai SULUN JALKEISELLA pilkulla. Siksi "Ramboll, Sweco"
 * nakyy kortilla YHTENA yrityksena nimelta "Ramboll, Sweco". `//` on
 * sama erotin jota Hilman voittajalistat kayttavat, ja silla molemmat
 * arkkitehdit nakyvat omina osapuolinaan.
 *
 * MITA EI KIRJOITETA:
 *   A-Insinoorit Rakennuttaminen Oy  rakennuttajakonsultti; sarake
 *       `developer` on tilaaja (Koulutuskuntayhtyma OSAO), joten tama
 *       jaa related_companies-listaan. Omaa kenttaa ei ole.
 *   Granlund Oy  lahde sanoo "talotekniikkasuunnittelu", joka kattaa
 *       seka LVIA:n etta sahkon. Kirjoitetaan vain `hvac_design`;
 *       `electrical_design` jaa tyhjaksi, koska lahde ei nimea
 *       sahkosuunnittelijaa erikseen.
 *   Kontio  Mantytornin hirsikumppani, ei suunnittelija -- jaa listaan.
 *   Vesa Humalisto  henkilo, ei yritys.
 *
 * Jaakarinkankaan JONORIVILLA suunnittelija on
 * `metadata.related_companies`-listassa, koska hyvaksyntareitti
 * (`app/api/tic/projects/approve/route.ts`) EI lue jonorivin
 * metadatasta suunnittelijakenttia -- vain `earthworks_contractor` ja
 * `related_companies`. Sweco kirjataan siis sarakkeeseen vasta
 * hyvaksynnan jalkeen.
 *
 *   npx tsx scripts/taydenna-rakennustehon-osapuolet.ts
 *   npx tsx scripts/taydenna-rakennustehon-osapuolet.ts --apply
 */

const OSAPUOLET = [
  {
    id: "242b2adf-8259-4b29-8702-aadad5b44b38",
    nimi: "OSAO Kampus 2030",
    kentat: {
      architectural_design: "Uuleo Arkkitehdit Oy // AOR Arkkitehdit Oy",
      structural_design: "WSP Finland Oy",
      hvac_design: "Granlund Oy",
    },
    sanamuoto:
      "Pää- ja arkkitehtisuunnittelu: Uuleo Arkkitehdit Oy ja AOR Arkkitehdit Oy; " +
      "Rakennesuunnittelu: WSP Finland Oy; Talotekniikkasuunnittelu: Granlund Oy",
  },
  {
    id: "d7660f0d-6944-45c4-a5b6-62283caaaf56",
    nimi: "PSOAS:in Quattro, Välkkylä",
    kentat: { architectural_design: "Inaro Oy" },
    sanamuoto: "Hankkeen arkkitehtisuunnittelusta vastaa pitkäaikainen kumppanimme Inaro",
  },
  {
    id: "4c84069f-f136-4ab6-895c-d4f92926a800",
    nimi: "Peltolan vaativan asumisen yksikkö",
    /*
     * TILAAJA OLI TYHJA. D-313 lisasi Peltolalle vain metadatan eika
     * huomannut, etta koko tilaaja puuttui -- sama puute jonka
     * Johannes kysyi: osapuoli on lahteessa, mutta ei kannassa.
     */
    kentat: {
      developer: "Pohjois-Pohjanmaan hyvinvointialue (Pohde)",
      architectural_design: "Arco Architecture Company Oy",
    },
    sanamuoto:
      "Tilaajana Pohjois-Pohjanmaan hyvinvointialue eli Pohde; " +
      "hankkeen arkkitehtisuunnittelusta vastaa Arco Architecture Company Oy",
  },
] as const

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const { collectProjectCompanies } = await import("../lib/projects/projectCompanies")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  const { data: rivit, error } = await db
    .from("projects")
    .select("*")
    .in(
      "id",
      OSAPUOLET.map((o) => o.id)
    )
  if (error || (rivit ?? []).length !== OSAPUOLET.length) {
    console.error(`VIRHE: odotettiin ${OSAPUOLET.length} riviä, saatiin ${(rivit ?? []).length} (${error?.message ?? ""})`)
    process.exit(1)
  }

  for (const o of OSAPUOLET) {
    const p: any = (rivit ?? []).find((r: any) => r.id === o.id)
    console.log(`\n${"=".repeat(74)}\n${o.id.slice(0, 8)} ${o.nimi}`)
    console.log(`   lähde: "${o.sanamuoto}"`)

    const paivitys: Record<string, any> = {}

    /*
     * SAMA YRITYS KAHTENA OSAPUOLENA. `builder` on "Rakennusteho" ja
     * D-313 lisasi listaan "Rakennusteho Oy": `dedupeKey` ei poista
     * "Oy":ta, joten kortilla ne ovat kaksi yritysta. Korjataan niin
     * kuin `mergeCompanyNames` tekee -- pisin kirjoitusasu voittaa --
     * ja turha listamerkinta poistetaan. Lahde: kohdesivun
     * "KVR-urakoitsija: Rakennusteho Oy".
     */
    const md: Record<string, any> = { ...(p.metadata ?? {}) }
    const builder = String(p.builder ?? "").trim()
    const lista: string[] = Array.isArray(md.related_companies) ? [...md.related_companies] : []
    const tasma = (a: string, b: string) =>
      a.toLowerCase().replace(/\s+(oy|oyj)$/i, "") === b.toLowerCase().replace(/\s+(oy|oyj)$/i, "")
    const paallekkain = lista.filter((y) => tasma(String(y), builder) && String(y) !== builder)
    if (paallekkain.length) {
      const pisin = [builder, ...paallekkain].sort((a, b) => b.length - a.length)[0]
      console.log(`   builder                "${builder}" -> "${pisin}" (sama yritys, pisin muoto)`)
      console.log(`   related_companies      poistetaan ${JSON.stringify(paallekkain)} (sama kuin rakentaja)`)
      if (pisin !== builder) paivitys.builder = pisin
      md.related_companies = lista.filter((y) => !paallekkain.includes(y))
      paivitys.metadata = md
      p.builder = pisin
      p.metadata = md
    }
    for (const [kentta, arvo] of Object.entries(o.kentat) as [string, string][]) {
      const nyt = String(p[kentta] ?? "").trim()
      if (nyt && nyt !== "-") {
        console.log(`   ${kentta.padEnd(22)} ON JO "${nyt}" -- ei korvata`)
        continue
      }
      console.log(`   ${kentta.padEnd(22)} tyhjä -> ${arvo}`)
      paivitys[kentta] = arvo
    }

    /* Nain osapuolet nakyvat kortilla ennen ja jalkeen. */
    const ennen = collectProjectCompanies(p)
    const jalkeen = collectProjectCompanies({ ...p, ...paivitys })
    console.log(`   osapuolet ennen (${ennen.length}):`)
    for (const c of ennen) console.log(`      ${c.role.padEnd(24)} ${c.name}`)
    console.log(`   osapuolet jälkeen (${jalkeen.length}):`)
    for (const c of jalkeen) console.log(`      ${c.role.padEnd(24)} ${c.name}`)

    if (!apply || !Object.keys(paivitys).length) continue
    const { error: e1 } = await db.from("projects").update(paivitys).eq("id", o.id)
    if (e1) console.error(`   VIRHE: ${e1.message}`)
    else console.log(`   kirjoitettu`)
  }

  if (!apply) console.log("\nEi kirjoitettu. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
