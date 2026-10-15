import { readFileSync } from "node:fs"
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

import { extractItemText, fetchDecoded } from "../lib/agent/fetchDynastySource"

/*
 * TAKAUTUVA KORJAUS PAATOSLAHTEIDEN KUVAUKSIIN (D-290).
 *
 * Jasentimen korjaus koskee POIMINTAA, joten se ei muuta yhtaan jo
 * tuotua rivia. Mitattu 15.10.2026: jonossa ei ole yhtaan odottavaa
 * Dynasty-paatosehdokasta, mutta kannassa on 83 hyvaksyttya hanketta
 * naista lahteista ja 11:lla on alle 400 merkkia asiakkaalle nakyvassa
 * kentassa. Lyhyin on 179 merkkia ("Paatos tarkastetaan heti."), jonka
 * pitaisi olla 1 420.
 *
 * NAKYVA KENTTA ON additional_info, EI metadata.description (D-270).
 * Hanke nayttaa asiakkaalle `additional_info`-sarakkeen, joten molemmat
 * paivitetaan - muuten korjaus ei nay missaan.
 *
 * EI KORVAA PITKAA EIKA KASIN KIRJOITETTUA. `additional_info` on kentta
 * johon on voitu kirjoittaa kasin, ja se voi olla tarkoituksella eri
 * teksti kuin metadata.description. Siksi kirjoitetaan vain jos nykyinen
 * on alle OHUT_RAJA ja uusi on selvasti pidempi. Alkuperainen sailyy
 * metadatassa.
 *
 *   npx tsx scripts/taydenna-paatoskuvaukset.ts
 *   npx tsx scripts/taydenna-paatoskuvaukset.ts --apply
 */

const OHUT_RAJA = 400
/* Uuden on oltava selvasti pidempi, ei vain muutamaa merkkia. */
const PARANNUS = 300
const KUVAUS_KATTO = 4000

/*
 * POIMINNAN ON TASMATTAVA HANKKEESEEN.
 *
 * Kuivaharjoitus paljasti taman: "Taidekasarmin kayttotarkoituksen
 * muutos ja peruskorjaus" sai poiminnaksi "Lahelan elinkaarihanke,
 * palveluntuottajan valinta" - kokonaan toisen hankkeen tekstin. Syy on
 * hankkeen metadatassa oleva source_url, joka ei osoita taman asian
 * sivulle. Luku (276 -> 4 000) nayttaa parannukselta, mutta sisalto on
 * vaara, ja vaara osuma on pahempi kuin tyhja (19_KUVAUSTEN_KATTAVUUS).
 *
 * Vaatimus: hankkeen nimen jostakin erottelevasta sanasta on loydyttava
 * poiminnasta. Lyhyet sanat ("muutos", "valinta") eivat erottele, joten
 * raja on 6 merkkia.
 */
const EROTTELEVA_PITUUS = 6

function normalisoi(s: string): string {
  return s
    .toLowerCase()
    .replace(/[äå]/g, "a")
    .replace(/ö/g, "o")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/* Yleiset sanat eivat kerro mista hankkeesta on kyse. */
const YLEISET = new Set([
  "urakoitsijan", "valinta", "muutos", "peruskorjaus", "rakentaminen",
  "hyvaksyminen", "esittely", "hankesuunnitelma", "hankesuunnitelman",
  "asemakaavan", "asemakaava", "kaupungin", "kunnan", "osittainen",
  "rakennushankkeen", "kayttotarkoituksen", "jatkeen", "uuden",
])

function tasmaakoHanke(nimi: string, teksti: string): { ok: boolean; sanat: string[] } {
  const poiminta = normalisoi(teksti)
  const sanat = normalisoi(nimi)
    .split(" ")
    .filter((w) => w.length >= EROTTELEVA_PITUUS && !YLEISET.has(w))
  if (!sanat.length) return { ok: false, sanat }
  return { ok: sanat.some((w) => poiminta.includes(w)), sanat }
}

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const hankkeet: any[] = []
  for (let alku = 0; ; alku += 1000) {
    const { data, error } = await db
      .from("projects")
      .select("id, name, additional_info, metadata")
      .range(alku, alku + 999)
    if (error) {
      console.error("VIRHE:", error.message)
      process.exit(1)
    }
    hankkeet.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }

  const kohteet = hankkeet.filter((p) => {
    const md = (p.metadata as any) ?? {}
    const url = String(md.source_url ?? md.documents_url ?? "")
    return /page=meetingitem/i.test(url)
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")
  console.log(`hankkeita ${hankkeet.length}, Dynastyn paatossivulta ${kohteet.length}\n`)

  let kirjoitettu = 0
  let ohut = 0
  let eiParane = 0
  let nullPoiminta = 0
  let eiVastausta = 0
  let eiTasmaa = 0
  const riittavat = kohteet.filter((p) => String(p.additional_info ?? "").length >= OHUT_RAJA).length

  for (const p of kohteet) {
    const nykyinen = String(p.additional_info ?? "").trim()
    if (nykyinen.length >= OHUT_RAJA) continue
    ohut++

    const md = (p.metadata as any) ?? {}
    const url = String(md.source_url ?? md.documents_url ?? "")
    const html = await fetchDecoded(url)
    if (!html) {
      console.log(`[${nykyinen.length}] ${String(p.name).slice(0, 56)}\n  ei vastausta: ${url}`)
      eiVastausta++
      continue
    }

    const teksti = extractItemText(html)
    if (!teksti) {
      console.log(`[${nykyinen.length}] ${String(p.name).slice(0, 56)}\n  poiminta antoi null (Dynastyn versio?) — ohitettu`)
      nullPoiminta++
      continue
    }
    if (teksti.length < nykyinen.length + PARANNUS) {
      console.log(`[${nykyinen.length}] ${String(p.name).slice(0, 56)}\n  poiminta ${teksti.length} merkkia ei paranna riittavasti — ohitettu`)
      eiParane++
      continue
    }

    const tasmays = tasmaakoHanke(String(p.name), teksti)
    if (!tasmays.ok) {
      console.log(`[${nykyinen.length}] ${String(p.name).slice(0, 56)}`)
      console.log(`  EI TASMAA: poiminta ei sisalla sanoja [${tasmays.sanat.join(", ")}]`)
      console.log(`  poiminta alkaa: ${teksti.slice(0, 90)}`)
      console.log(`  source_url: ${url}`)
      eiTasmaa++
      continue
    }

    const kuvaus = teksti.slice(0, KUVAUS_KATTO)
    console.log(`[${nykyinen.length} -> ${kuvaus.length}] ${String(p.name).slice(0, 56)}`)
    console.log(`  NYT:  ${nykyinen.slice(0, 110)}`)
    console.log(`  UUSI: ${kuvaus.slice(0, 200)}…`)

    if (!apply) continue

    const { error: uv } = await db
      .from("projects")
      .update({
        additional_info: kuvaus,
        metadata: {
          ...md,
          description: kuvaus,
          additional_info_alkuperainen: nykyinen || null,
          description_taydennetty: new Date().toISOString(),
        },
      })
      .eq("id", p.id)

    if (uv) console.log(`  VIRHE: ${uv.message}`)
    else kirjoitettu++
  }

  console.log(`\nriittavan pitka jo ennestaan: ${riittavat}`)
  console.log(`ohuita tarkistettu:           ${ohut}`)
  console.log(`  kirjoitettu:                ${kirjoitettu}`)
  console.log(`  ei parane riittavasti:      ${eiParane}`)
  console.log(`  poiminta null:              ${nullPoiminta}`)
  console.log(`  ei tasmaa hankkeeseen:      ${eiTasmaa}`)
  console.log(`  ei vastausta:               ${eiVastausta}`)
  if (!apply) console.log("\nEi muutettu mitaan. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error(e?.message ?? e)
  process.exit(1)
})
