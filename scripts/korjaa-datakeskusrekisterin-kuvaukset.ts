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
 * DATAKESKUSREKISTERIN RIVIEN TAYDENNYS (D-365).
 *
 * Rakentaa kuvauksen, konsultit ja liittyvat yritykset uudelleen
 * SAMOILLA funktioilla kuin keraaja, jotta maaritelmia on yksi
 * ([[same-term-two-definitions]]).
 *
 * Kaksi kierrosta:
 *   30.10. taivutusvirhe kuvauksessa ("Saarijarvilla", "Oyn").
 *   31.10. `organisaatiot` ja `paatokset` otettiin kayttoon -- ne
 *          tulivat samassa vastauksessa mutta heitettiin pois.
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
  const { datakeskusKuvaus, datakeskusKonsultit, datakeskusLiittyvat, haeHankkeenTiedot } =
    await import("../lib/agent/fetchDatakeskusrekisteriSource")
  const { mergeCompanyNames } = await import("../lib/projects/projectCompanies")

  /*
   * KAKSI VAIHETTA, EI YKSI KYSELY.
   *
   * `metadata->>source_name` joutuu lukemaan koko taulun, ja kun
   * samalla vedetaan 134 metadata-lohkoa, kysely kaatuu kannan
   * aikakatkaisuun ([[backfill-run-limits]]). Ensin kevyt tunnistehaku,
   * sitten metadata paloissa.
   */
  /*
   * SUODATUS TEHDAAN TAALLA, EI KANNASSA. `.eq("metadata->>source_name")`
   * on taysi taulunluku ilman indeksia ja kaatui aikakatkaisuun
   * satunnaisesti. Sivutettu luku yhdella JSON-kentalla on kevyt ja
   * vakaa.
   */
  const tunnisteet: string[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error: e } = await db
      .from("potential_projects")
      .select("id,lahde:metadata->>source_name")
      .range(a, a + 999)
    if (e) throw e
    for (const r of (data ?? []) as any[]) {
      if (r.lahde === "datakeskusrekisteri") tunnisteet.push(r.id)
    }
    if ((data ?? []).length < 1000) break
  }

  const rivit: any[] = []
  for (let i = 0; i < tunnisteet.length; i += 50) {
    const { data, error: e } = await db
      .from("potential_projects")
      .select("id,title,municipality,metadata")
      .in("id", tunnisteet.slice(i, i + 50))
    if (e) throw e
    rivit.push(...(data ?? []))
  }
  console.log(`Riveja ${rivit.length}`)

  let muuttuu = 0
  for (const r of (rivit ?? []) as any[]) {
    const id = String(r.metadata?.source_url ?? "").split("/").pop()
    if (!id) continue

    /* Levyltä jos on, muuten verkosta – korjaus ei saa kuormittaa turhaan. */
    const polku = KANSIO ? join(KANSIO, `${id}.json`) : null
    /*
     * `organisaatiot` ja `paatokset` ovat `hanke`n SISARUKSIA, joten
     * levylta luettaessa ne on liitettava mukaan -- muuten takautuva
     * ajo tuottaisi eri tuloksen kuin keraaja.
     */
    let tiedot: any = null
    if (polku && existsSync(polku)) {
      const koko = JSON.parse(readFileSync(polku, "utf8"))
      if (koko?.hanke) {
        tiedot = {
          ...koko.hanke,
          organisaatiot: koko.organisaatiot ?? [],
          paatokset: koko.paatokset ?? [],
        }
      }
    } else {
      tiedot = await haeHankkeenTiedot(id)
    }
    if (!tiedot) continue

    const uusi = datakeskusKuvaus(
      { id, nimi: r.title, /* Kunta on sarakkeessa, ei metadatassa. */
        kunta: r.municipality ?? r.metadata?.city ?? null, vaihe: r.metadata?.rekisterin_vaihe ?? null },
      tiedot
    )
    const vanha = String(r.metadata?.description ?? "")

    const konsultit = datakeskusKonsultit(tiedot)
    const vanhatKonsultit = Array.isArray(r.metadata?.consultants)
      ? r.metadata.consultants
      : []
    const vanhatLiittyvat = Array.isArray(r.metadata?.related_companies)
      ? r.metadata.related_companies
      : []
    const liittyvat = mergeCompanyNames(vanhatLiittyvat, datakeskusLiittyvat(tiedot))

    const kuvausMuuttuu = uusi !== vanha
    const konsultitMuuttuu =
      JSON.stringify(konsultit) !== JSON.stringify(vanhatKonsultit)
    const liittyvatMuuttuu =
      JSON.stringify(liittyvat) !== JSON.stringify(vanhatLiittyvat)
    if (!kuvausMuuttuu && !konsultitMuuttuu && !liittyvatMuuttuu) continue
    muuttuu++

    console.log(`\n${r.title}`)
    if (kuvausMuuttuu) {
      console.log(`  KUVAUS ENNEN:   ${vanha.replace(/\s+/g, " ").slice(-140)}`)
      console.log(`  KUVAUS JALKEEN: ${uusi.replace(/\s+/g, " ").slice(-140)}`)
    }
    if (konsultitMuuttuu) {
      console.log(
        `  KONSULTIT: ${konsultit.map((k) => `${k.name} (${k.role})`).join(" // ") || "-"}`
      )
    }
    if (liittyvatMuuttuu) {
      console.log(`  LIITTYVAT: ${vanhatLiittyvat.join(" // ") || "-"} -> ${liittyvat.join(" // ")}`)
    }

    if (!APPLY) continue
    const { error: e } = await db
      .from("potential_projects")
      .update({
        metadata: {
          ...(r.metadata ?? {}),
          description: uusi,
          consultants: konsultit,
          related_companies: liittyvat,
        },
      })
      .eq("id", r.id)
    if (e) console.error(`  VIRHE: ${e.message}`)
  }

  console.log(`\n${APPLY ? "AJETTU" : "KUIVAHARJOITUS"}: ${muuttuu} / ${(rivit ?? []).length} riviä`)
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
