import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * KUSTANNUS JA PINTA-ALA TALLENNETUSTA TEKSTISTÄ (D-187).
 *
 * Kaksi poimintasääntöä puuttui: auki kirjoitettu "bruttoneliömetriä" ja
 * lause "Hankekokonaisuuden kustannukset ovat...". Molemmat tiedot olivat
 * kuvauksessa, joten korjaus tehdään siihen - EI UUTTA VERKKOHAKUA.
 *
 * EI YLIKIRJOITA: ala kirjoitetaan vain jos kenttä on tyhjä, ja kustannus
 * vain jos `resolveProjectCost` antaa eri arvon kuin nykyinen (se tuntee
 * alkuperien järjestyksen manual > contract > text).
 *
 * Aja ensin ilman --apply-lippua ja LUE RIVIT: näyte kertoo mistä
 * lauseesta luku tuli.
 *
 *   npx tsx scripts/fix-kustannus-ja-ala.ts
 *   npx tsx scripts/fix-kustannus-ja-ala.ts --apply
 */

const APPLY = process.argv.includes("--apply")
const NAYTTEITA = Number(process.argv.find((a) => a.startsWith("--naytteet="))?.split("=")[1] ?? 10)

/*
 * OLETUS ON KAPEA: vain ne rivit jotka UUDET säännöt avaavat.
 *
 * Ensimmäinen kuivaharjoitus muutti 564 kustannusta ja 453 alaa, vaikka
 * uudet säännöt koskevat noin 120:tä riviä. Loput tulivat siitä, että
 * vanhat säännöt ajettiin uudelleen tekstiin joka on kasvanut rungon haun
 * myötä - eri työ ja omat riskinsä: luetuista näytteistä yksi olisi
 * antanut päiväkodille alan, joka oli tekstissä TOISEN yksikön
 * peruskorjauksen ala.
 *
 * `--kaikki` ajaa laajan version. Sitä ei pidä ajaa lukematta rivejä.
 */
const KAIKKI = process.argv.includes("--kaikki")

const UUSI_ALA = /brutto-?neliö/i
const UUSI_KUSTANNUS = /hankekokonaisuuden\s+kustannu/i

/*
 * NÄYTTEEN ON OLTAVA OIKEA LAUSE. Ensimmäinen versio etsi lukua sen
 * kahdella ensimmäisellä numerolla, joten näyte osoitti usein väärään
 * kohtaan tekstiä - eikä riviä voi lukea niin.
 *
 * Luku etsitään kaikissa kirjoitusasuissa: "12000000", "12 000 000",
 * "12.000.000" ja miljoonamuoto "12" / "1,3".
 */
function ymparilta(teksti: string, arvo: number): string {
  const numeroina = String(arvo)
  const valein = numeroina.replace(/\B(?=(\d{3})+(?!\d))/g, " ")
  const pistein = numeroina.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
  const miljoonina = (arvo / 1_000_000).toString().replace(".", ",")

  for (const muoto of [valein, pistein, numeroina, miljoonina]) {
    const i = teksti.indexOf(muoto)
    if (i >= 0) return teksti.slice(Math.max(0, i - 90), i + muoto.length + 60).replace(/\s+/g, " ")
  }
  return "(lukua ei löytynyt tekstistä sellaisenaan)"
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { resolveProjectCost } = await import("../lib/projects/resolveProjectCost")
  const { extractFloorAreaFromText } = await import("../lib/projects/extractFloorAreaFromText")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  let kustannuksia = 0
  let aloja = 0
  const naytteet: string[] = []

  for (const table of ["potential_projects", "projects"] as const) {
    const isQueue = table === "potential_projects"
    const columns = isQueue
      ? "id, title, metadata"
      : "id, name, estimated_cost, floor_area, additional_info, metadata"

    const rows: any[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from(table).select(columns).range(from, from + 999)
      if (error) throw error
      rows.push(...(data ?? []))
      if (!data || data.length < 1000) break
    }

    for (const row of rows) {
      const nimi = String(row.title ?? row.name ?? "")
      const teksti = `${nimi} ${row.additional_info ?? row.metadata?.description ?? ""}`.trim()
      if (teksti.length < 40) continue

      /* Kapea oletus: vain uusien sääntöjen avaamat rivit (ks. yllä). */
      const koskeeAlaa = KAIKKI || UUSI_ALA.test(teksti)
      const koskeeKustannusta = KAIKKI || UUSI_KUSTANNUS.test(teksti)
      if (!koskeeAlaa && !koskeeKustannusta) continue

      const nykyKustannus = isQueue ? row.metadata?.estimated_cost : row.estimated_cost
      const nykyAla = isQueue ? row.metadata?.floor_area : (row.floor_area ?? row.metadata?.floor_area)

      const kustannus = koskeeKustannusta
        ? resolveProjectCost({
            contractValue: row.metadata?.contract_value,
            text: teksti,
            existingCost: nykyKustannus,
            existingSource: row.metadata?.cost_source,
          })
        : null
      const kustannusMuuttuu =
        !!kustannus && Number(kustannus.estimated_cost) !== Number(nykyKustannus ?? 0)

      const ala = koskeeAlaa && !nykyAla ? extractFloorAreaFromText(teksti) : null

      if (!kustannusMuuttuu && !ala) continue

      if (kustannusMuuttuu) kustannuksia++
      if (ala) aloja++

      if (naytteet.length < NAYTTEITA) {
        const osat = [`${table} ${nimi.slice(0, 60)}`]
        if (kustannusMuuttuu) {
          osat.push(
            `  kustannus ${nykyKustannus ?? "-"} -> ${kustannus!.estimated_cost} (${kustannus!.cost_source})`,
            `    "${ymparilta(teksti, kustannus!.estimated_cost)}"`
          )
        }
        if (ala) {
          osat.push(`  ala -> ${ala} m2`, `    "${ymparilta(teksti, ala)}"`)
        }
        naytteet.push(osat.join("\n"))
      }

      if (!APPLY) continue

      const metadata = {
        ...(row.metadata ?? {}),
        ...(kustannusMuuttuu
          ? { estimated_cost: kustannus!.estimated_cost, cost_source: kustannus!.cost_source }
          : {}),
        ...(ala ? { floor_area: ala } : {}),
      }

      await supabase
        .from(table)
        .update(
          isQueue
            ? { metadata }
            : {
                metadata,
                ...(kustannusMuuttuu ? { estimated_cost: kustannus!.estimated_cost } : {}),
                ...(ala ? { floor_area: ala } : {}),
              }
        )
        .eq("id", row.id)
    }
  }

  console.log(APPLY ? "=== AJETTU ===" : "=== KUIVAHARJOITUS (ei kirjoiteta) ===")
  console.log(`kustannus taydentyy: ${kustannuksia}`)
  console.log(`pinta-ala taydentyy: ${aloja}`)
  console.log("\nnaytteita:")
  for (const n of naytteet) console.log(n)
}

main().catch((e) => { console.error(e); process.exit(1) })
