import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * RAKENTAJA TALLENNETUSTA TEKSTISTÄ (D-189).
 *
 * Mitattu 12.9.2026: 27 riviä (19 hanketta), joilla teksti nimeää
 * pääurakoitsijan mutta kenttä oli tyhjä - ja kolmella rakentajaksi oli
 * merkitty tilaaja. Kaikki 27 luettiin läpi ennen kuviota; yksikään ei
 * ollut aliurakoitsija.
 *
 * EI UUTTA VERKKOHAKUA - teksti on tallessa.
 *
 * KIRJOITETAAN VAIN KAHDESSA TAPAUKSESSA:
 *   1. rakentaja puuttuu
 *   2. rakentajaksi on merkitty sama yritys kuin rakennuttajaksi
 *
 * Muuta olemassa olevaa rakentajaa EI korvata: se voi olla ihmisen
 * korjaama, ja kone on tässä juuri se joka on ollut väärässä.
 *
 *   npx tsx scripts/fix-rakentaja-tekstista.ts
 *   npx tsx scripts/fix-rakentaja-tekstista.ts --apply
 */

const APPLY = process.argv.includes("--apply")

/*
 * Yhtiömuoto jätetään vertailussa huomiotta: "Rakennusliike Lapti" ja
 * "Rakennusliike Lapti Oy" ovat sama yritys, eikä sama yritys saa päätyä
 * molempiin rooleihin.
 */
function sama(a: unknown, b: unknown): boolean {
  const avain = (v: unknown) =>
    String(v ?? "")
      .toLowerCase()
      .replace(/\b(oyj|oy|abp|ab|ky|ltd|group|konserni)\b/g, " ")
      .replace(/[^a-zåäö0-9]+/g, "")
  const x = avain(a)
  const y = avain(b)
  /* Sisältyminen riittää: "KSBR" vs "KSBR, Keski-Suomen Betonirakenne Oy". */
  return !!x && !!y && (x === y || x.includes(y) || y.includes(x))
}

function lause(teksti: string, nimi: string): string {
  const i = teksti.indexOf(nimi.split(" ")[0])
  if (i < 0) return ""
  return teksti.slice(Math.max(0, i - 120), i + nimi.length + 40).replace(/\s+/g, " ")
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { extractBuilderFromText } = await import("../lib/agent/fetchSttHakuSource")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  let lisatty = 0
  let korjattu = 0

  for (const table of ["potential_projects", "projects"] as const) {
    const isQueue = table === "potential_projects"
    const columns = isQueue
      ? "id, title, metadata"
      : "id, name, developer, builder, additional_info, metadata"

    const rows: any[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from(table).select(columns).range(from, from + 999)
      if (error) throw error
      rows.push(...(data ?? []))
      if (!data || data.length < 1000) break
    }

    for (const row of rows) {
      const teksti = String(row.additional_info ?? row.metadata?.description ?? "")
      if (teksti.length < 60) continue

      const nykyRakentaja = row.builder ?? row.metadata?.builder ?? null
      const rakennuttaja = row.developer ?? row.metadata?.developer ?? null

      const puuttuu = !nykyRakentaja
      const ristissa = sama(nykyRakentaja, rakennuttaja)

      /*
       * KOLMAS TAPAUS: tallennettu rakentaja on TEKSTIN nimeämä
       * rakennuttaja. Mitattu Senaatti/Tulli: `builder` oli
       * "Senaatti-kiinteistöt" ja `developer` "Tulli", joten kumpikaan
       * yllä olevista ehdoista ei osunut - mutta teksti sanoo
       * "Senaatti-kiinteistöt rakennuttaa" ja "Rakentamisesta vastaa NCC".
       */
      const tekstinRakennuttaja = teksti.match(
        /([A-ZÄÖÅ][\wÄÖÅäöå&-]*(?:\s+[A-ZÄÖÅ][\wÄÖÅäöå&-]*){0,3})\s+rakennutta/
      )?.[1]
      const rakennuttajaRakentajana = !!nykyRakentaja && sama(nykyRakentaja, tekstinRakennuttaja)

      if (!puuttuu && !ristissa && !rakennuttajaRakentajana) continue

      const uusi = extractBuilderFromText(String(row.title ?? row.name ?? ""), teksti)
      if (!uusi || sama(uusi, rakennuttaja) || sama(uusi, nykyRakentaja)) continue

      if (puuttuu) lisatty++
      else korjattu++

      console.log(
        `\n${table} ${String(row.title ?? row.name).slice(0, 56)}\n` +
          `    rakentaja ${nykyRakentaja ? `"${nykyRakentaja}"` : "(tyhjä)"} -> "${uusi}"  ` +
          `(rakennuttaja "${rakennuttaja ?? "-"}")\n` +
          `    …${lause(teksti, uusi)}…`
      )

      if (!APPLY) continue

      const metadata = { ...(row.metadata ?? {}), builder: uusi }

      await supabase
        .from(table)
        .update(isQueue ? { metadata } : { metadata, builder: uusi })
        .eq("id", row.id)
    }
  }

  console.log(APPLY ? "\n=== AJETTU ===" : "\n=== KUIVAHARJOITUS (ei kirjoiteta) ===")
  console.log(`rakentaja lisatty:  ${lisatty}`)
  console.log(`rooli korjattu:     ${korjattu}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
