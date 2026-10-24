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
 * POISTA VIERAS TALOYHTIO LIITTYVISTA YRITYKSISTA (D-343).
 *
 * Tunnettujen yritysten poiminta lisasi taloyhtioita, ennen kuin
 * `TALOYHTIO`-rajaus tehtiin: rakennuttajan tiedote luettelee muitakin
 * kohteitaan, joten helsinkilainen kerrostalo sai nimen "Asunto Oy
 * Oulun Graadi".
 *
 * POISTETAAN VAIN SE MIKA EI OLE RIVIN OMA. Rivin oma taloyhtio ei ole
 * virhe vaan korkeintaan toistoa, ja sen poistaminen voisi havittaa
 * tiedon joka ei ole missaan muualla ([[show-everything-we-know]]).
 *
 * TAIVUTUS RIKKOI ENSIMMAISEN VERSION. Suora vertailu piti naita
 * vieraina, koska otsikossa nimi on taivutettuna ja astevaihtelu
 * muuttaa vartalon kolmannesta kirjaimesta lahtien:
 *
 *   "Asunto Oy Tampereen Kalevan Kaiku"  <-> otsikko "...Kalevan Kaiun"
 *   "Asunto Oy Helsingin Islan"          <-> otsikko "...Isla"
 *
 * Siksi vertailu tehdaan sanojen ALKUVARTALOILLA jarjestyksessa
 * ("tam* kal* kai*"). Loysa vertailu erehtyy turvalliseen suuntaan:
 * epavarma nimi jaa riville.
 *
 * Kasketaan vain rivit joilla on oman ajon tunniste -- kasin lisattyihin
 * ei kosketa ([[manual-parties-linkedin]]).
 *
 *   npx tsx scripts/siivoa-taloyhtiot-liittyvista.ts
 *   npx tsx scripts/siivoa-taloyhtiot-liittyvista.ts --apply
 */

const TALOYHTIO = /^(?:As\.?|Asunto|Bostads)[\s-]*(?:Oy|Ab)\b/i

/* Yhtiomuoto ja valimerkit pois: jaljelle jaa erotteleva osa. */
function sanat(nimi: string): string[] {
  return nimi
    .toLowerCase()
    .replace(/^(?:as\.?|asunto|asunto-osakeyhtiö|bostads)[\s-]*(?:oy|ab)\b\.?/i, "")
    .replace(/[^\wåäö]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((s) => s.length >= 3)
}

/*
 * Onko nimi rivin oma? Kaikkien erottelevien sanojen alkuvartalot
 * jarjestyksessa tekstissa. Kolme kirjainta riittaa vartaloksi:
 * astevaihtelu ("kaiku" -> "kaiun") muuttaa jo neljannen.
 */
function onRivinOma(nimi: string, teksti: string): boolean {
  const osat = sanat(nimi)
  if (!osat.length) return false
  const kuvio = osat
    .map((s) => `${s.slice(0, 3).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\wåäö]*`)
    .join("[\\s-]+")
  return new RegExp(kuvio, "i").test(teksti)
}

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")
  let poistettu = 0
  let rivit = 0
  let omat = 0

  for (const taulu of ["projects", "potential_projects"] as const) {
    const data: any[] = []
    for (let a = 0; ; a += 500) {
      const { data: era, error } = await db
        .from(taulu)
        .select(taulu === "projects" ? "id,name,metadata" : "id,title,metadata")
        .not("metadata->>tunnetut_yritykset_poimittu", "is", null)
        .range(a, a + 499)
      if (error) {
        console.error(`VIRHE: ${error.message}`)
        process.exit(1)
      }
      data.push(...(era ?? []))
      if ((era ?? []).length < 500) break
    }

    for (const p of data) {
      const liittyvat: string[] = Array.isArray(p.metadata?.related_companies)
        ? p.metadata.related_companies
        : []
      if (!liittyvat.length) continue

      /* Rivin oma identiteetti: otsikko ja taloyhtiokentta. */
      const oma = `${p.name ?? p.title ?? ""} ${p.metadata?.housing_company ?? ""}`

      const jaa = liittyvat.filter((n) => {
        if (!TALOYHTIO.test(n)) return true
        if (onRivinOma(n, oma)) {
          omat += 1
          return true
        }
        return false
      })

      if (jaa.length === liittyvat.length) continue
      const pois = liittyvat.filter((n) => !jaa.includes(n))
      rivit += 1
      poistettu += pois.length
      console.log(
        `   ${taulu === "projects" ? "HANKE" : "JONO "} ${String(p.name ?? p.title).slice(0, 60).padEnd(62)} - ${pois.join(" | ")}`
      )

      if (!apply) continue
      const md = { ...(p.metadata ?? {}), related_companies: jaa }
      const { error } = await db.from(taulu).update({ metadata: md }).eq("id", p.id)
      if (error) console.error(`      VIRHE: ${error.message}`)
    }
  }

  console.log(`\nRivejä ${rivit}, poistettuja nimiä ${poistettu}, rivin omia jätettiin ${omat}`)
  if (!apply) console.log("Ei kirjoitettu. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
