import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * HILMAN HANKINTATUNNUS TAKAUTUVASTI.
 *
 * Sama hankinta julkaistaan Hilmassa useana ilmoituksena, ja jokainen saa
 * oman ilmoitusnumeronsa. Tallennettu tunniste oli `hilma_notice_number`,
 * joka siis eroaa joka kerta — niinpä korjausilmoitus loi uuden ehdokkaan
 * vaikka hanke oli jo kannassa. Resolver-reitti ei tee sumeaa täsmäystä
 * hyväksyttyihin hankkeisiin, joten mikään ei sitonut niitä yhteen.
 *
 * Tämä skripti tekee kaksi asiaa:
 *   1. Kirjaa `hilma_procedure_id`-tunnisteen kaikille ehdokkaille ja
 *      niistä syntyneille hankkeille, jotta TULEVAT ilmoitukset osuvat.
 *   2. Sivuuttaa jonossa olevat ehdokkaat, joiden hankinnasta on jo
 *      hyväksytty hanke — ne ovat duplikaatteja.
 *
 * SIVUUTUS EI OLE POISTO. Rivi jää `ignored`-tilaan, joten historia
 * säilyy eikä sama ilmoitus palaa jonoon.
 *
 * Aja ensin ilman --apply-lippua.
 */

const APPLY = process.argv.includes("--apply")

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { linkIdentifier } = await import("../lib/projects/identity")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const candidates: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("potential_projects")
      .select("id, title, status, created_at, metadata")
      .not("metadata->>procedure_id", "is", null)
      .range(from, from + 999)
    if (error) throw error
    candidates.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  /*
   * Hyvaksytysta ehdokkaasta syntynyt hanke tunnistetaan ILMOITUSNUMEROSTA,
   * ei koko osoitteesta: Hilman osoitemuoto eroaa hankkeella ja ehdokkaalla
   * (.../54275/notice/overview vs .../enotice/54275/). Pelkalla osoitteella
   * vertailtuna 4 duplikaattiryhmaa jai ilman hankekytkentaa.
   */
  /*
   * Ilmoitusnumero on eri kohdassa riippuen siitä kumpi osoite on kyseessä:
   *   ehdokas .../public/procedure/35676/enotice/54275/
   *   hanke   .../public/procurement/54275/notice/overview/overview
   *
   * Kuvio on siksi ankkuroitava polun osaan. Yleinen "ensimmäinen pitkä
   * luku" poimi ehdokkaalta hankinnan tunnuksen 35676 eikä ilmoitusnumeroa,
   * jolloin kytkentä ei osunut.
   */
  const noticeIdFrom = (url: string): string | null =>
    url.match(/enotice\/(\d+)/)?.[1] ?? url.match(/procurement\/(\d+)/)?.[1] ?? null

  const projects = new Map<string, string>()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("projects")
      .select("id, metadata->>source_url")
      .range(from, from + 999)
    if (error) throw error
    for (const row of data ?? []) {
      const url = String((row as any).source_url ?? "")
      if (!url) continue
      projects.set(url, String((row as any).id))
      const noticeId = noticeIdFrom(url)
      if (noticeId) projects.set("notice:" + noticeId, String((row as any).id))
    }
    if (!data || data.length < 1000) break
  }

  const groups = new Map<string, any[]>()
  for (const c of candidates) {
    const key = String(c.metadata.procedure_id)
    const list = groups.get(key) ?? []
    list.push(c)
    groups.set(key, list)
  }

  let identifiersLinked = 0
  let projectsLinked = 0
  let ignored = 0
  const samples: string[] = []

  for (const [procedureId, list] of groups) {
    list.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))

    /* Tunniste kaikille - myos yhden ilmoituksen hankinnoille, jotta
     * seuraava korjausilmoitus osuu. */
    for (const c of list) {
      identifiersLinked++

      const candidateUrl = String(c.metadata?.source_url ?? "")
      const candidateNotice = noticeIdFrom(candidateUrl)
      const projectId =
        projects.get(candidateUrl) ??
        (candidateNotice ? projects.get("notice:" + candidateNotice) : undefined)
      if (projectId) projectsLinked++

      if (!APPLY) continue

      await linkIdentifier({
        type: "hilma_procedure_id",
        value: procedureId,
        potentialProjectId: c.id,
        ...(projectId ? { projectId } : {}),
        sourceName: String(c.metadata?.source_name ?? "Hilma"),
        supabase,
      } as any)
    }

    if (list.length < 2) continue

    /* Jonossa oleva duplikaatti sivuutetaan, jos ryhmassa on jo hyvaksytty. */
    const hasApproved = list.some((c) => c.status === "approved")
    if (!hasApproved) continue

    for (const c of list) {
      if (c.status !== "new") continue

      ignored++
      if (samples.length < 8) {
        samples.push(
          `${procedureId}  ${String(c.title).slice(0, 42).padEnd(44)} (${list.length} ilmoitusta)`
        )
      }

      if (!APPLY) continue

      await supabase
        .from("potential_projects")
        .update({
          status: "ignored",
          metadata: {
            ...(c.metadata ?? {}),
            ignored_reason: `Sama Hilma-hankinta ${procedureId} on jo hyväksytty hankkeeksi`,
            ignored_at: new Date().toISOString(),
          },
        })
        .eq("id", c.id)
    }
  }

  console.log(APPLY ? "=== AJETTU ===" : "=== KUIVAHARJOITUS (ei kirjoiteta) ===")
  console.log(`hankintoja:                    ${groups.size}`)
  console.log(`tunnisteita kirjattaisiin:     ${identifiersLinked}`)
  console.log(`  niistä myös hankkeeseen:     ${projectsLinked}`)
  console.log(`jonosta sivuutettaisiin:       ${ignored}`)
  console.log("\nsivuutettavat:")
  for (const s of samples) console.log(`  ${s}`)
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
