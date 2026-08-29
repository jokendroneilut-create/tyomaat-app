import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * VAHVISTETUT KAKSOISKAPPALEET JOISSA MOLEMMAT OVAT YHA JULKISIA.
 *
 * Vahvistus kirjasi aiemmin vain paatoksen; piilotus oli erillinen
 * nappi joka jai valilla painamatta. Nama ovat ne parit jotka jaivat
 * puolitiehen.
 *
 * Piilotettava valitaan samalla logiikalla kuin reitti kayttaa
 * (chooseDuplicateSurvivor), ja asiakkaan omissa oleva hanke jatetaan
 * rauhaan.
 *
 * Kuivaharjoitus oletuksena; kirjoittaa vasta --apply.
 */

const APPLY = process.argv.includes("--apply")

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { chooseDuplicateSurvivor, completeness, moreAdvancedPhase } = await import("../lib/projects/duplicateSurvivor")
  const { phaseOrder } = await import("../lib/projects/phases")

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { data: parit, error } = await admin
    .from("project_duplicate_candidates")
    .select("id,project_id_a,project_id_b,confidence")
    .eq("status", "confirmed_duplicate")
  if (error) throw error

  const idt = [...new Set((parit ?? []).flatMap((p: any) => [p.project_id_a, p.project_id_b]))]

  const hankkeet: any[] = []
  for (let i = 0; i < idt.length; i += 100) {
    const { data } = await admin
      .from("projects")
      .select(
        "id,name,city,phase,created_at,is_public,developer,builder,location,lat,lng,apartments,floor_area,estimated_cost,construction_start,property_type,metadata"
      )
      .in("id", idt.slice(i, i + 100))
    hankkeet.push(...(data ?? []))
  }
  const kartta = new Map(hankkeet.map((h) => [h.id, h]))

  const kesken = (parit ?? []).filter((p: any) => {
    const a = kartta.get(p.project_id_a)
    const b = kartta.get(p.project_id_b)
    return a && b && a.is_public !== false && b.is_public !== false
  })

  /*
   * VAIHEEN NOSTO MYOS JO PIILOTETUILLE.
   *
   * Piilotus ei aiemmin siirtanyt vaihetta, joten sailyneelle on voinut
   * jaada vanhentunut vaihe vaikka piilotettu tiesi paremmin.
   */
  let nostoja = 0
  for (const p of (parit ?? []) as any[]) {
    const a = kartta.get(p.project_id_a)
    const b = kartta.get(p.project_id_b)
    if (!a || !b) continue

    const jaava = a.is_public !== false ? a : b
    const piiloon = a.is_public !== false ? b : a
    if (jaava.id === piiloon.id) continue

    const uusiVaihe = moreAdvancedPhase(jaava.phase, piiloon.phase, phaseOrder)
    if (!uusiVaihe) continue

    nostoja++
    console.log(`  VAIHE  ${String(jaava.name).slice(0, 46)}`)
    console.log(`         "${jaava.phase}" -> "${uusiVaihe}" (piilotetulta)`)

    if (APPLY) {
      const { error } = await admin.from("projects").update({ phase: uusiVaihe }).eq("id", jaava.id)
      console.log(error ? `         VIRHE: ${error.message}` : "         nostettu")
      jaava.phase = uusiVaihe
    }
  }
  if (nostoja) console.log(`
vaiheen nostoja: ${nostoja}
`)

  console.log(`${APPLY ? "AJO" : "KUIVAHARJOITUS"}`)
  console.log(`vahvistettuja pareja: ${parit?.length ?? 0}`)
  console.log(`niista puolitiehen jaaneita: ${kesken.length}\n`)

  for (const p of kesken as any[]) {
    const a = kartta.get(p.project_id_a)!
    const b = kartta.get(p.project_id_b)!
    const valinta = chooseDuplicateSurvivor(a, b)
    const jaava = kartta.get(valinta.keepId)!
    const piiloon = kartta.get(valinta.hideId)!

    const { data: suosikit } = await admin
      .from("user_project_favorites")
      .select("user_id")
      .eq("project_id", valinta.hideId)

    console.log(`  luottamus ${p.confidence} | ${a.city ?? "-"}`)
    console.log(`    JAA     [${String(jaava.id).slice(0, 8)}] ${String(jaava.name).slice(0, 58)}  (${completeness(jaava)} kenttaa)`)
    console.log(`    PIILOON [${String(piiloon.id).slice(0, 8)}] ${String(piiloon.name).slice(0, 58)}  (${completeness(piiloon)} kenttaa)`)
    console.log(`    peruste: ${valinta.reason}`)

    if ((suosikit?.length ?? 0) > 0) {
      console.log(`    OHITETAAN: piilotettava on ${suosikit!.length} kayttajan omissa\n`)
      continue
    }

    if (!APPLY) { console.log("") ; continue }

    const { error: e } = await admin
      .from("projects")
      .update({ is_public: false })
      .eq("id", valinta.hideId)

    console.log(e ? `    VIRHE: ${e.message}\n` : "    piilotettu\n")
  }
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
export {}
