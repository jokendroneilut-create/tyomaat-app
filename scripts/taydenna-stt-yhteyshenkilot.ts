import { readFileSync } from "node:fs"

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}


/*
 * STT-TIEDOTTEEN YHTEYSHENKILOT TAKAUTUVASTI (D-243).
 *
 * Johannes 6.10.2026: *"Olen tyytyvainen vasta kun jokaisessa
 * hankkeessa on projektikohtainen yhteystieto."*
 *
 * MITATTU: stt_haku-lahteesta 47 hanketta 349:sta on ilman
 * hankekohtaista yhteyshenkiloa — mutta tallennettu teksti on vain
 * ingressi, ja tiedotteen LOPUSSA on yhteystietolohko. Kymmenen sivun
 * otoksesta 8:lla oli nimetty henkilo sahkoposteineen.
 *
 * EI UUTTA JASENNINTA. `extractContacts` osaa jo lukea lohkon; vika oli
 * siina ettei koko sivua haettu. Vain ARTIKKELIN teksti luetaan, ei koko
 * sivua — muuten mukaan tulee STT:n oma viestinta jokaiselta sivulta.
 *
 *   npx tsx scripts/taydenna-stt-yhteyshenkilot.ts
 *   npx tsx scripts/taydenna-stt-yhteyshenkilot.ts --apply
 */

/*
 * Sahkoposti voi jatkua roskalla kun sivun teksti on kiinni toisissaan
 * ("veli-pekka.alkula@ox2.comOX2 on..."). Katkaistaan tunnettuun
 * paatteeseen; tuntematon paate jatetaan rauhaan.
 */
function siistiSahkoposti(email: string | null | undefined): string | null {
  const arvo = String(email ?? "").trim()
  if (!arvo.includes("@")) return null
  const osuma = arvo.match(/^[^@\s]+@[a-z0-9.-]+?\.(fi|com|se|net|org|eu)/i)
  return osuma ? osuma[0] : arvo
}


/*
 * OIKEA KIRJOITUSASU SIVULTA, EI SAHKOPOSTISTA (D-243).
 *
 * `extractContacts` johtaa nimen sahkopostista kun sivun tekstissa ei
 * ole nimea vieressa: "juha.keranen@senaatti.fi" -> "Juha Keranen".
 * Oikea nimi on Keranen TAI Keranen tarkkeineen — osoitteesta sita ei
 * voi tietaa, ja vaarin kirjoitettu nimi menee asiakkaalle nakyviin.
 * Sama ansa kuin profiilien nimissa (D-238).
 *
 * Tassa nimi etsitaan SIVUN TEKSTISTA: osoitteen paikallisosasta
 * rakennetaan kuvio jossa a voi olla myos a-umlaut ja o myos o-umlaut,
 * ja kaytetaan sita kirjoitusasua joka sivulla oikeasti lukee. Jos sita
 * ei loydy, nimi jatetaan sellaiseksi kuin poimija sen antoi.
 */
function nimiSivulta(email: string | null, teksti: string): string | null {
  const paikallinen = String(email ?? "").split("@")[0]
  if (!paikallinen.includes(".")) return null

  const osat = paikallinen.split(".").filter((o) => o.length >= 2)
  if (osat.length < 2) return null

  const kuvio = osat
    .map((osa) =>
      osa
        .split("")
        .map((kirjain) =>
          kirjain === "a" ? "[aa\u00e4]" : kirjain === "o" ? "[o\u00f6]" : kirjain
        )
        .join("")
    )
    .join("[\s-]+")

  const osuma = teksti.match(new RegExp(kuvio, "i"))
  if (!osuma) return null

  /* Alkukirjaimet isoiksi, muu sellaisenaan: "juha keranen" -> "Juha Keranen". */
  return osuma[0]
    .split(/([\s-]+)/)
    .map((pala) => (/^[\s-]+$/.test(pala) ? pala : pala.charAt(0).toUpperCase() + pala.slice(1)))
    .join("")
}


/*
 * YHDYSNIMEN ISOT ALKUKIRJAIMET.
 *
 * Kun nimi on johdettu sahkopostista, yhdysnimen jalkiosa jaa pienelle:
 * "janne-pekka" -> "Janne-pekka". Oikea asu on "Janne-Pekka". Tarkkeita
 * ei voi palauttaa osoitteesta (keranen voi olla Keranen tai Keranen
 * tarkkein), mutta isot alkukirjaimet voi.
 */
function isotAlkukirjaimet(nimi: string): string {
  return nimi
    .split(/([\s-]+)/)
    .map((pala) => (/^[\s-]+$/.test(pala) ? pala : pala.charAt(0).toUpperCase() + pala.slice(1)))
    .join("")
}

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const cheerio = await import("cheerio")
  const { extractContacts } = await import("../lib/projects/contacts")
  const { kelpaaYhteyshenkiloksi, onHankekohtainenYhteyshenkilo } = await import("../lib/metrics/yhteystiedonKattavuus")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  const hankkeet: any[] = []
  for (let from = 0; ; from += 500) {
    const { data, error } = await db.from("projects").select("id, name, metadata").eq("metadata->>source_name", "stt_haku").range(from, from + 499)
    if (error) throw error
    hankkeet.push(...(data ?? []))
    if (!data || data.length < 500) break
  }

  const puuttuu = hankkeet.filter((p) => !onHankekohtainenYhteyshenkilo(p.metadata))
  console.log("stt_haku-hankkeita " + hankkeet.length + ", ilman hankekohtaista " + puuttuu.length)
  console.log("")

  let loytyi = 0, eiLoytynyt = 0, virheita = 0, kirjoitettu = 0

  for (const p of puuttuu) {
    const url = String((p.metadata ?? {}).source_url ?? "")
    if (!url.startsWith("http")) { eiLoytynyt++; continue }

    let kontaktit: any[] = []
    try {
      const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (compatible; tyomaat.fi/1.0)" } })
      if (!r.ok) { virheita++; continue }
      const $ = cheerio.load(await r.text())
      const artikkeli = ($("article").text() || $("main").text() || $("body").text()).split(/\s+/g).join(" ")
      kontaktit = extractContacts(artikkeli)
        .map((c: any) => {
          const email = siistiSahkoposti(c.email)
          const nimi = nimiSivulta(email, artikkeli) ?? isotAlkukirjaimet(String(c.name ?? ""))
          return { ...c, email, name: nimi }
        })
        .filter(kelpaaYhteyshenkiloksi)
        /* Sama henkilo voi esiintya tiedotteessa kahdesti. */
        .filter(
          (c: any, i: number, lista: any[]) =>
            lista.findIndex((m: any) => String(m.email ?? m.name).toLowerCase() === String(c.email ?? c.name).toLowerCase()) === i
        )
    } catch {
      virheita++
      continue
    }

    if (!kontaktit.length) {
      eiLoytynyt++
      continue
    }

    loytyi++
    console.log("  " + String(p.name).slice(0, 50).padEnd(52) + kontaktit.slice(0, 2).map((c: any) => c.name + " (" + (c.email ?? c.phone) + ")").join(", ").slice(0, 70))

    if (!apply) continue

    const md = (p.metadata ?? {}) as any
    const vanhat = Array.isArray(md.contact_persons) ? md.contact_persons : []
    const { error } = await db
      .from("projects")
      .update({ metadata: { ...md, contact_persons: [...vanhat, ...kontaktit] } })
      .eq("id", p.id)

    if (error) console.log("    VIRHE: " + error.message)
    else kirjoitettu++
  }

  console.log("")
  console.log("yhteyshenkilo loytyi: " + loytyi)
  console.log("ei loytynyt:          " + eiLoytynyt)
  console.log("hakuvirheita:         " + virheita)
  console.log(apply ? "kirjoitettu:          " + kirjoitettu : "Ei kirjoitettu mitaan. Aja --apply kun rivit on luettu.")
}
main().catch((e) => { console.error(e); process.exit(1) })
