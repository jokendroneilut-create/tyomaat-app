import { readFileSync } from "node:fs"

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .replace(/\r/g, "")
  .split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/* Helsingin kaavalahteiden kuvausten tila. Ei kirjoita mitaan. */

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { data: lahteet } = await db
    .from("discovery_sources")
    .select("id, name, url, parser")
    .ilike("name", "%helsin%")
  console.log("HELSINGIN LAHTEET:")
  for (const l of lahteet ?? []) {
    console.log(`  ${String((l as any).name).padEnd(46)} ${(l as any).parser ?? "-"}`)
    console.log(`     ${(l as any).url}`)
  }

  for (const nimi of [
    "Helsingin vireillä olevat kaavat",
    "Helsingin vireillä olevat asemakaavat (SUKKA)",
  ]) {
    const dokit: any[] = []
    for (let f = 0; f < 20000; f += 1000) {
      const { data, error } = await db
        .from("source_documents")
        .select("id, title, document_url, raw_payload, raw_text")
        .eq("source_name", nimi)
        .range(f, f + 999)
      if (error) throw error
      if (!data?.length) break
      dokit.push(...data)
      if (data.length < 1000) break
    }

    let tyhja = 0
    let ohut = 0
    let hyva = 0
    let liitteita = 0
    const esimerkit: string[] = []

    for (const d of dokit) {
      const hyoty = (d.raw_payload ?? {}) as any
      let kuvaus = String(hyoty.description ?? "")
      if (!kuvaus) {
        try {
          const raaka = JSON.parse(String(d.raw_text ?? "{}"))
          kuvaus = String(raaka?.properties?.description ?? raaka?.description ?? "")
        } catch {
          /* ei jsonia */
        }
      }
      const liitteet = hyoty.attachment_titles ?? hyoty.attachments ?? null
      if (Array.isArray(liitteet) && liitteet.length) liitteita += 1

      if (kuvaus.length < 40) {
        tyhja += 1
        if (esimerkit.length < 8) {
          esimerkit.push(
            `    ${String(d.title).slice(0, 46).padEnd(48)} kuvaus=${kuvaus.length} liitteita=${Array.isArray(liitteet) ? liitteet.length : 0}`
          )
        }
      } else if (kuvaus.length < 200) ohut += 1
      else hyva += 1
    }

    console.log(`\n=== ${nimi} (${dokit.length} dokumenttia)`)
    console.log(`  alle 40 merkkia : ${tyhja}`)
    console.log(`  40-200          : ${ohut}`)
    console.log(`  yli 200         : ${hyva}`)
    console.log(`  liitteita tiedossa: ${liitteita}`)
    if (esimerkit.length) {
      console.log("  esimerkkeja tyhjista:")
      esimerkit.forEach((e) => console.log(e))
    }
    const malli = dokit.find((d) => (d.raw_payload as any)?.description)
    if (malli) {
      console.log(`  raw_payload-avaimet: ${Object.keys((malli.raw_payload ?? {}) as any).join(", ")}`)
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
