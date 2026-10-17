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
 * TILAAJA TEKSTISTA RIVEILLE JOILTA SE PUUTTUU (D-301).
 *
 * Poimija korjattiin 18.10.2026 (kirjainkoko, kopula, organisaatiosana),
 * mutta korjaus vaikuttaa vain uusiin riveihin. Tama taydentaa vanhat.
 *
 * KUIVAHARJOITUS TULOSTAA JOKAISEN RIVIN KOKONAAN. Mitattu syy: otoksessa
 * oli jo yksi virhe ("LPR-arkkitehdit" on arkkitehti, ei tilaaja), eika
 * virhetta nay luvusta vaan vain rivilta.
 *
 *   npx tsx scripts/taydenna-tilaaja-tekstista.ts
 *   npx tsx scripts/taydenna-tilaaja-tekstista.ts --apply
 */

/*
 * HYLKYLISTA on luettu kuivaharjoituksen tuotoksesta, ei keksitty.
 * Nimet jotka esiintyvat tilaajakuvion kohdalla mutta eivat ole
 * tilaajia: suunnittelijat, urakoitsijat ja viranomaiset.
 */
const EI_TILAAJA = [
  /arkkitehdit|arkkitehtitoimisto|arkkitehtuuritoimisto/i,
  /\bsitowise\b|\bramboll\b|\bsweco\b|\bfcg\b|\benvineer\b|\bafry\b|\bgranlund\b/i,
  /aluehallintovirasto|ely-keskus.*lupa|valvontavirasto/i,
  /*
   * Nama kaksi ovat rivikohtaisia paatelmia, ei yleisia saantoja:
   *
   *   "MCF Group Estonia ja Caverion Suomi ovat allekirjoittaneet
   *    sopimuksen Virossa sijaitsevan Greenergy Data Centerin..."
   *    -> Caverion on urakoitsija, tilaaja on MCF Group Estonia.
   *
   *   "HC Hoivakodit rakennustoihin Kirkkonummella - tilaajana Humana"
   *    -> poiminta liimasi julkaisijan nimen tilaajan peraan
   *       ("Humana HC Hoivakodit").
   */
  /^Caverion\b/i,
  /\bHC Hoivakodit\b/i,
]

/*
 * KUNNAN NIMI OIKEAAN MUOTOON LAHDETEKSTISTA.
 *
 * Poiminta antoi seitsemalle riville "Vantaa kaupunki", kun oikea muoto
 * on "Vantaan kaupunki". Genetiivia ei voi muodostaa mekaanisesti
 * (Turku -> Turun, Helsinki -> Helsingin), joten muotoa EI arvata vaan
 * se luetaan samasta tekstista josta nimi tuli.
 */
function korjaaKunnanMuoto(nimi: string, teksti: string): string {
  const osat = nimi.match(/^(\S+)\s+(kaupunki|kunta)$/i)
  if (!osat) return nimi
  const runko = osat[1]
  const sana = osat[2]
  /* Etsi tekstista "<runko><paate> <kaupunki|kunta>". */
  const kuvio = new RegExp(`\\b(${runko}[a-zåäö]{1,4})\\s+${sana}\\b`, "i")
  const loytyi = teksti.match(kuvio)
  if (!loytyi) return nimi
  return `${loytyi[1]} ${sana.toLowerCase()}`
}

function onKelvoton(nimi: string): boolean {
  if (nimi.length < 4) return true
  /* Pelkka iso kirjain tai numerosarja ei ole nimi. */
  if (!/[A-Za-zÅÄÖåäö]{3}/.test(nimi)) return true
  return EI_TILAAJA.some((k) => k.test(nimi))
}

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const { extractExplicitClient, extractClientFromText } = await import(
    "../lib/agent/fetchSttHakuSource"
  )
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const kaikki = async (t: string, cols: string) => {
    const out: any[] = []
    for (let a = 0; ; a += 1000) {
      const { data, error } = await db.from(t).select(cols).range(a, a + 999)
      if (error) {
        console.error(`VIRHE ${t}: ${error.message}`)
        process.exit(1)
      }
      out.push(...(data ?? []))
      if ((data ?? []).length < 1000) break
    }
    return out
  }

  const jono = await kaikki("potential_projects", "id, title, status, metadata")
  const hankkeet = await kaikki(
    "projects",
    "id, name, status, developer, builder, additional_info, metadata"
  )

  type Osuma = {
    taulu: "jono" | "hanke"
    id: string
    otsikko: string
    nimi: string
    teksti: string
    rakentaja: string | null
    metadata: any
  }
  const osumat: Osuma[] = []

  for (const r of jono) {
    const m: any = r.metadata ?? {}
    if (m.developer) continue
    const teksti = String(m.description ?? m.additional_info ?? "")
    if (teksti.length < 80) continue
    const raaka = extractExplicitClient(teksti) ?? extractClientFromText(String(r.title ?? ""), teksti)
    if (!raaka) continue
    const nimi = korjaaKunnanMuoto(raaka, teksti)
    osumat.push({
      taulu: "jono",
      id: String(r.id),
      otsikko: String(r.title ?? ""),
      nimi,
      teksti,
      rakentaja: m.builder ?? null,
      metadata: m,
    })
  }
  for (const p of hankkeet) {
    if (p.developer) continue
    const teksti = String(p.additional_info ?? (p.metadata as any)?.description ?? "")
    if (teksti.length < 80) continue
    const raaka = extractExplicitClient(teksti) ?? extractClientFromText(String(p.name ?? ""), teksti)
    if (!raaka) continue
    const nimi = korjaaKunnanMuoto(raaka, teksti)
    osumat.push({
      taulu: "hanke",
      id: String(p.id),
      otsikko: String(p.name ?? ""),
      nimi,
      teksti,
      rakentaja: p.builder ?? null,
      metadata: p.metadata,
    })
  }

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")
  console.log(`osumia ${osumat.length} (jono ${osumat.filter((o) => o.taulu === "jono").length}, hankkeet ${osumat.filter((o) => o.taulu === "hanke").length})\n`)

  const hylatyt = osumat.filter((o) => onKelvoton(o.nimi))
  /*
   * TILAAJA EI VOI OLLA SAMA KUIN RAKENTAJA. Jos poiminta antaa saman
   * nimen kuin rivin rakentaja, kuvio on osunut vaaraan osapuoleen.
   */
  const samaKuinRakentaja = osumat.filter((o) => {
    if (onKelvoton(o.nimi) || !o.rakentaja) return false
    const r = String(o.rakentaja).toLowerCase()
    const t = o.nimi.toLowerCase()
    /*
     * Vertailu MOLEMPIIN suuntiin. Pelkka "rakentaja sisaltaa tilaajan"
     * ei riittanyt: rivi "Liedossa Rakennusyhtio Hartela" (rakentaja
     * Hartela) lapaisi sen, koska vertailu katsoi vain tilaajan
     * ensimmaista sanaa "liedossa".
     */
    return r.includes(t.split(" ")[0]) || t.includes(r.split(" ")[0])
  })
  const kirjoitettavat = osumat.filter(
    (o) => !onKelvoton(o.nimi) && !samaKuinRakentaja.includes(o)
  )

  console.log(`HYLATTY hylkylistalla:        ${hylatyt.length}`)
  for (const o of hylatyt) console.log(`   ${o.nimi}  <-  ${o.otsikko.slice(0, 56)}`)
  console.log(`\nHYLATTY sama kuin rakentaja:  ${samaKuinRakentaja.length}`)
  for (const o of samaKuinRakentaja) {
    console.log(`   ${o.nimi}  (rakentaja ${o.rakentaja})  <-  ${o.otsikko.slice(0, 44)}`)
  }
  console.log(`\nKIRJOITETAAN:                 ${kirjoitettavat.length}\n`)

  for (const o of kirjoitettavat) {
    const avainsana = o.nimi.split(/\s+/)[0]
    const i = o.teksti.indexOf(avainsana)
    console.log("".padEnd(76, "-"))
    console.log(`${o.taulu}  ${o.id}`)
    console.log(`  TILAAJA: ${o.nimi}${o.rakentaja ? `   (rakentaja: ${o.rakentaja})` : ""}`)
    console.log(`  otsikko: ${o.otsikko.slice(0, 70)}`)
    if (i >= 0) {
      console.log(`  konteksti: ...${o.teksti.slice(Math.max(0, i - 130), i + 110).replace(/\s+/g, " ")}...`)
    }
  }

  if (!apply) {
    console.log("\nEi kirjoitettu. Aja --apply kun rivit on luettu.")
    return
  }

  let tehty = 0
  for (const o of kirjoitettavat) {
    if (o.taulu === "hanke") {
      const { error } = await db.from("projects").update({ developer: o.nimi }).eq("id", o.id)
      if (error) {
        console.error(`VIRHE hanke ${o.id}: ${error.message}`)
        continue
      }
    } else {
      const { error } = await db
        .from("potential_projects")
        .update({ metadata: { ...(o.metadata ?? {}), developer: o.nimi } })
        .eq("id", o.id)
      if (error) {
        console.error(`VIRHE jono ${o.id}: ${error.message}`)
        continue
      }
    }
    tehty++
  }
  console.log(`\nTAYDENNETTY ${tehty} riviä.`)
}
main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
