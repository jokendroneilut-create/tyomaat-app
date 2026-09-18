import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * TUUSULAN YHTEYSTIEDOT JÄSENNETÄÄN (D-198).
 *
 * Resolveri kirjoitti koko vapaan tekstin nimikenttään. Korvataan VAIN
 * rivit, joiden nimessä on numero, @ tai rivinvaihto, niiden jäsennetyllä
 * sisällöllä. Muut rivit (esim. kaavoitus@-osoite) säilyvät, ja jos
 * jäsennys ei tuota mitään, alkuperäinen rivi jää - yhteystiedoista ei
 * poisteta mitään.
 *
 *   npx tsx scripts/fix-tuusula-yhteystiedot.ts            (kuivaharjoitus)
 *   npx tsx scripts/fix-tuusula-yhteystiedot.ts --apply
 */
const APPLY = process.argv.includes("--apply")
const peita = (s: unknown) => String(s ?? "").replace(/[A-Za-z0-9._%+-]+@/g, "<x>@").replace(/\+?\d[\d\s-]{6,}\d/g, "<puh>")

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { yhteystiedotVapaastaTekstista } = await import("../lib/projects/vapaaYhteystieto")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  let n = 0
  let ohitettu = 0
  for (const taulu of ["projects", "potential_projects"] as const) {
    const { data, error } = await db.from(taulu).select("id, metadata").eq("metadata->>source_name", "Tuusulan vireillä olevat kaavat")
    if (error) throw error
    for (const r of (data ?? []) as any[]) {
      const nyt: any[] = Array.isArray(r.metadata?.contact_persons) ? r.metadata.contact_persons : []
      let muuttui = false
      const uusi: any[] = []
      for (const c of nyt) {
        const sotku = c && !c.email && !c.phone && /[@\d\n]/.test(String(c.name ?? ""))
        const jasennetty = sotku ? yhteystiedotVapaastaTekstista(c.name) : []
        /* Turva: jokainen alkuperäinen osoite ja numero löytyy jäsennyksestä. */
        const alku = String(c?.name ?? "")
        const numerot = (alku.match(/\d[\d\s-]{5,}\d/g) ?? []).map((x) => x.replace(/\D/g, "").slice(-7))
        const osoitteet = (alku.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? []).map((x) => x.toLowerCase())
        const tulosNumerot = jasennetty.map((x) => String(x.phone ?? "").replace(/\D/g, "")).join("|")
        const tulosOsoitteet = jasennetty.map((x) => String(x.email ?? "").toLowerCase())
        const kaikkiMukana =
          osoitteet.every((o) => tulosOsoitteet.includes(o)) && numerot.every((nro) => tulosNumerot.includes(nro))
        if (sotku && jasennetty.length > 0 && !kaikkiMukana) {
          ohitettu++
          console.log(`   OHITETAAN (tietoa katoaisi): ${peita(alku).replace(/\n/g, " / ").slice(0, 110)}`)
        }
        if (sotku && jasennetty.length > 0 && kaikkiMukana) { uusi.push(...jasennetty); muuttui = true } else uusi.push(c)
      }
      if (!muuttui) continue
      n++
      console.log(`${taulu} ${r.id.slice(0, 8)}\n   ennen: ${nyt.map((c) => peita(c.name).replace(/\n/g, " / ").slice(0, 90)).join(" ;; ")}\n   jälkeen: ${uusi.map((c) => `${c.name ?? c.email ? "" : ""}${peita(c.name)} | ${c.title ?? "-"} | ${c.phone ? "puh" : "-"} | ${c.email ? "email" : "-"}`).join(" ;; ")}`)
      if (APPLY) {
        const { error: e } = await db.from(taulu).update({ metadata: { ...r.metadata, contact_persons: uusi } }).eq("id", r.id)
        if (e) throw e
      }
    }
  }
  console.log(`\n=== ${APPLY ? "AJETTU" : "KUIVAHARJOITUS"}: ${n} riviä ===`)
}
main().catch((e) => { console.error(e); process.exit(1) })
