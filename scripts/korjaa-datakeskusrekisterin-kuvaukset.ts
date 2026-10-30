import { readFileSync, existsSync } from "node:fs"
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
 * DATAKESKUSREKISTERIN KUVAUSTEN KORJAUS (D-365).
 *
 * Ensimmaisen ajon kahdeksan rivia ehtivat jonoon ennen kuin huomasin
 * taivutusvirheen ("Saarijarvilla", "Mikkelilla", "Oyn"). Kuvaus
 * rakennetaan uudelleen samalla funktiolla kuin keraajassa, jotta
 * maaritelmia on yksi ([[same-term-two-definitions]]).
 *
 *   npx tsx scripts/korjaa-datakeskusrekisterin-kuvaukset.ts --kansio=<polku>
 *   npx tsx scripts/korjaa-datakeskusrekisterin-kuvaukset.ts --kansio=<polku> --apply
 */
const APPLY = process.argv.includes("--apply")
const kansioArg = process.argv.find((a) => a.startsWith("--kansio="))
const KANSIO = kansioArg ? kansioArg.slice("--kansio=".length) : null

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
  const { datakeskusKuvaus, haeHankkeenTiedot } = await import(
    "../lib/agent/fetchDatakeskusrekisteriSource"
  )

  const { data: rivit, error } = await db
    .from("potential_projects")
    .select("id,title,municipality,metadata")
    .eq("metadata->>source_name", "datakeskusrekisteri")
  if (error) throw error

  let muuttuu = 0
  for (const r of (rivit ?? []) as any[]) {
    const id = String(r.metadata?.source_url ?? "").split("/").pop()
    if (!id) continue

    /* Levyltä jos on, muuten verkosta – korjaus ei saa kuormittaa turhaan. */
    const polku = KANSIO ? join(KANSIO, `${id}.json`) : null
    const tiedot =
      polku && existsSync(polku)
        ? JSON.parse(readFileSync(polku, "utf8"))?.hanke
        : await haeHankkeenTiedot(id)
    if (!tiedot) continue

    const uusi = datakeskusKuvaus(
      { id, nimi: r.title, /* Kunta on sarakkeessa, ei metadatassa. */
        kunta: r.municipality ?? r.metadata?.city ?? null, vaihe: r.metadata?.rekisterin_vaihe ?? null },
      tiedot
    )
    const vanha = String(r.metadata?.description ?? "")
    if (uusi === vanha) continue
    muuttuu++

    console.log(`\n${r.title}`)
    console.log(`  ENNEN:   ${vanha.replace(/\s+/g, " ").slice(0, 130)}`)
    console.log(`  JALKEEN: ${uusi.replace(/\s+/g, " ").slice(0, 130)}`)

    if (!APPLY) continue
    const { error: e } = await db
      .from("potential_projects")
      .update({ metadata: { ...(r.metadata ?? {}), description: uusi } })
      .eq("id", r.id)
    if (e) console.error(`  VIRHE: ${e.message}`)
  }

  console.log(`\n${APPLY ? "AJETTU" : "KUIVAHARJOITUS"}: ${muuttuu} / ${(rivit ?? []).length} riviä`)
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
