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
 * LUETUT VALMISTUMISPAIVAT TYHJIIN KENTTIIN (D-348).
 *
 * Johannes 25.10.2026: *"katso nuo 121 lapi voisiko sielta poimia
 * jotain"*. Lapikaynti: `scripts/mittaa-tyhjat-valmistumiset.ts`.
 *
 * Kahden jasenninkorjauksen jalkeen (kaavavirke pois, vuoden osa
 * luettuna) jaljelle jai 33 tulevaa osumaa. NE LUETTIIN YKSITELLEN, ja
 * seitseman hylattiin: niissa paiva on tekstissa, mutta se koskee
 * JOTAKIN MUUTA kuin tata hanketta. Jasennin ei voi tata tietaa, joten
 * lista on kasin valittu eika saanto.
 *
 * Hylatyt ja syy:
 *
 *   560136cd  Mikonkorven risteyssilta   "ajoradalla tehtavat tyot" = osa toista
 *   1de72dd2  Tuulipuisto Kauhava        sahkoasema valmistuu vasta kevaalla 2027
 *   39fbe12e  Kainuun ravintokeskus      paiva koskee UPS-laitteen kayttoonottoa
 *   5b498eae  Kerrostalo Nihdin Pollari  paiva koskee VIEREISEN tontin kohdetta
 *   69c994b4  Purkamislupahakemus        "vuonna 2030 valmistuvat tilat" = Laakso
 *   39e2e34b  Kasvatuslautakunnan lausunto  2033 koskee eri paivakotia
 *   367bf136  Porthania                  rivi on jo vaiheessa Valmistunut
 *
 *   npx tsx scripts/taydenna-luetut-valmistumiset.ts
 *   npx tsx scripts/taydenna-luetut-valmistumiset.ts --apply
 */

import { parseEstimatedCompletionDate } from "../lib/agent/parseFinnishCompletionDate"

const LUETUT = [
  "465c21cb-fc68-4283-aa1f-8dab9ece840c", // Kerrostalo Tuiraan
  "6db17b29-e1be-404a-8312-05c6e1636c1c", // Rivitalo Kuivasjärvelle
  "2e8be101-4fd7-46ec-bf72-4039bcbb1d7b", // Kerrostalo Vaajakoskelle
  "42988144-ff87-4e74-970e-150785847b8f", // Mankkaan palvelutalo
  "3ac1a341-0751-40ab-8478-21a106f2038d", // Skanska, Kokkolan Sote-keskus
  "3c1c81fd-e2a4-448e-b27d-ef2501e001f2", // GRK, Jätkäsaari
  "c835d8da-c1d4-4e68-8027-8de932193ed8", // Hartela, TA:n kaksi kerrostaloa
  "b6b3c514-6e59-4d9b-8447-546f7bd199f4", // YIT, 28 kotia
  "96c9db68-f226-46ec-bbe8-70b1f1aaf261", // Tuotantolaitos Jyväskylään
  "83a6c735-53e5-4007-b531-b00b5985ce75", // Tuulivoimahanke Halsuaan
  "fdd18d87-e127-49fd-9784-1acfa31f515a", // Kerrostalo Jyväskylään
  "926215e8-26ef-4197-b5ce-e705dfb11181", // Kerrostalo Niittykumpuun
  "20f11bc2-36c7-4900-9063-001b8bcda4c9", // Kylpylän saneeraus Rauhanniemi
  "602b3c4f-fa3d-4572-8df0-29c4b4f65212", // Vuokrakerrostalo Naantaliin
  "c5326ae1-c5f2-4446-ba6e-6a5b2bf9e989", // Ilmasotakoulu (Suunnittelussa)
  "c8e2c136-9f6c-4319-a70c-8731bb2802f1", // Ilmasotakoulu (Rakenteilla)
  "e39e6c06-b95c-4d52-b71a-45ddc1a35ef0", // Automyymälä Raisio
  "6780a25a-3236-4732-b61b-ceb56549a0f8", // Laboratoriokiinteistö Myllykivenkuja
  "e82cae72-d7fa-44e2-9133-ef88108fa85d", // Heka Tihtaalinkatu 4
  "6fbf90f2-ef53-42d6-bea6-f6e0701cd42a", // Suklaatehdas Lahteen
  "66f1dc16-aa93-45bb-a5aa-69ca17b8cf01", // Asuinkortteli Jätkäsaareen
  "c339a732-672b-489f-9bcd-958a4d1d22ce", // NCC, S:t Olofsskolan
  "a102708d-4876-468c-aebc-4c9fbbd910fc", // Energiavarasto Soini
  "f4c57aa9-9d4a-4119-8264-a7b103de62a2", // Solar Foods, 1. vaihe
  "34e5789b-5f6d-4643-a25d-10dfd8be67dc", // Prisma, Espoon keskus
  "583c2648-e2a7-4667-9a56-7f08a960009d", // Tuulivoimahanke Rajamäenkylään
]

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  const { data, error } = await db
    .from("projects")
    .select("id,name,phase,estimated_completion,additional_info,metadata")
    .in("id", LUETUT)
  if (error) {
    console.error(`VIRHE: ${error.message}`)
    process.exit(1)
  }
  console.log(`Listalla ${LUETUT.length}, kannasta löytyi ${data?.length ?? 0}\n`)

  let kirjoitettu = 0
  for (const p of data ?? []) {
    if (p.estimated_completion) {
      console.log(`   OHI (kenttä ei enää tyhjä) ${String(p.name).slice(0, 50)}`)
      continue
    }
    const teksti = `${p.name ?? ""} ${p.additional_info ?? ""} ${p.metadata?.description ?? ""}`.trim()
    const paiva = parseEstimatedCompletionDate(teksti)
    if (!paiva) {
      console.log(`   OHI (jäsennin ei enää löydä) ${String(p.name).slice(0, 50)}`)
      continue
    }
    console.log(`   ${paiva}  ${String(p.phase ?? "-").slice(0, 16).padEnd(17)} ${String(p.name).slice(0, 52)}`)

    if (!apply) continue
    const md = {
      ...(p.metadata ?? {}),
      estimated_completion_lahde: {
        paiva,
        jasennin: "D-348 luettu käsin",
        milloin: new Date().toISOString().slice(0, 10),
      },
    }
    const { error: e } = await db
      .from("projects")
      .update({ estimated_completion: paiva, metadata: md })
      .eq("id", p.id)
    if (e) console.error(`      VIRHE: ${e.message}`)
    else kirjoitettu += 1
  }

  console.log(`\nKirjoitettu ${kirjoitettu}`)
  if (!apply) console.log("Ei kirjoitettu. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
