import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * RIKKINAISET YHTEYSMERKINNAT KOLMESTA LAHTEESTA (D-410).
 *
 * Jatkoa D-409:lle: Rovaniemen korjauksen jalkeen kannasta mitattiin
 * 13.11.2026 vielä 83 rikkinaista merkintaa kolmesta lahteesta.
 *
 *   Hilma      48  malliosoite `etunimi.sukunimi@` tallennettuna
 *   Hilma      10  nimikentassa sahkopostiosoite
 *   Vesilahti  14  koko kappale yhdessa `name`-kentassa
 *   Lohja      11  tavallinen osoite jai nimen sisaan
 *
 * ALKUPERAINEN TEKSTI RAKENNETAAN RIKKINAISESTA RIVISTA ITSESTAAN,
 * ei haeta sivulta uudelleen. Kaksi syyta:
 *
 *   1. Rikkinaisessa rivissa on kaikki palat tallella — ne ovat vain
 *      vaarissa kentissa. Jasennettavaa ei siis puutu.
 *   2. Sivu on voinut muuttua. D-409:ssa kahdelta Rovaniemen sivulta
 *      oli "Lisatietoja"-lohko poistunut kokonaan, joten uudelleenhaku
 *      olisi TYHJENTANYT merkinnan jossa oli oikea nimi.
 *
 * EHJAT SAILYVAT. Korvataan vain ne jotka tunnistuvat rikkinaisiksi;
 * kasin lisatty osapuoli ja muu ehja merkinta jaa koskematta.
 *
 * Aja ensin ilman --apply-lippua ja lue tuotos riveittain.
 */

const APPLY = process.argv.includes("--apply")
const MERKKI = "yhteystietolohko_2026_11"

/*
 * VAIN NAMA LAHTEET.
 *
 * Ensimmainen kuivaharjoitus ajoi kaikille lahteille joiden merkinta
 * naytti rikkinaiselta, ja osui 23 riviin joita kukaan ei pyytanyt:
 * stt_haku, Oulu ja Hyvinkaa kirjoittavat yhteystietonsa eri muodossa,
 * ja jasennin teki niista HUONOMPAA jalkea -- Fingridin "Fingrid Oyj"
 * sai nimikkeen "osoitteet ovat muotoa".
 *
 * Mitattu lahde korjataan, arvattua ei. Jos naita lisataan, lisataan
 * samalla testi kyseisen lahteen oikealla tekstilla.
 */
const LAHTEET = [
  /hilma|hankintailmoitu/i,
  /^Lohjan ajankohtaiset kaavat$/i,
  /^Vesilahden vireill/i,
]

type Merkinta = {
  kind?: string | null
  name?: string | null
  title?: string | null
  phone?: string | null
  email?: string | null
  organization?: string | null
  role?: string | null
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { parseYhteystietolohko } = await import("../lib/projects/yhteystietolohko")
  const { onMalliosoite, onMallinimi, nameFromEmail } = await import("../lib/projects/contacts")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const onLohko = (c: Merkinta) =>
    /@/.test(String(c?.name ?? "")) ||
    /s[äa]hk[öo]posti/i.test(String(c?.name ?? "")) ||
    /puh\.?\s*\d|p\.\s*\d/i.test(String(c?.name ?? "")) ||
    /puh\.?\s*\d/i.test(String(c?.title ?? "")) ||
    /s[äa]hk[öo]posti/i.test(String(c?.title ?? ""))

  const onRikki = (c: Merkinta) => onLohko(c) || onMalliosoite(c?.email) || onMallinimi(c?.name)

  /*
   * Teksti takaisin yhdeksi lohkoksi. Jarjestys on se jossa palat
   * sivulla olivat: nimike, nimi, osoite, numero — sama jarjestys
   * jonka jasennin osaa lukea.
   */
  const lohkoksi = (c: Merkinta) =>
    [c?.title, c?.name, c?.email, c?.phone ? "puh. " + c.phone : null]
      .map((x) => String(x ?? "").trim())
      .filter(Boolean)
      .join(" ")

  /*
   * Hilma on rakenteinen lahde: siella ei ole lohkoa jasennettavaksi,
   * vaan yksi kentta vaarin. Korjataan kenttina.
   */
  const korjaaHilma = (c: Merkinta): Merkinta | null => {
    const tulos: Merkinta = { ...c }

    /* Mallinimi kumoaa koko merkinnan, numero mukaan lukien. */
    if (onMallinimi(tulos.name)) return null

    if (onMalliosoite(tulos.email)) tulos.email = ""

    const nimi = String(tulos.name ?? "")
    if (/@/.test(nimi)) tulos.name = nameFromEmail(nimi)

    tulos.kind = tulos.name ? "person" : "organization"

    /* Ilman osoitetta ja numeroa ei ole yhteystietoa. */
    if (!tulos.email && !tulos.phone) return null
    return tulos
  }

  const avain = (c: Merkinta) => String(c?.name ?? "").trim().toLowerCase()

  const yhdista = (vanhat: Merkinta[], uudet: Merkinta[]) => {
    const tulos: Merkinta[] = (vanhat ?? []).filter((c) => !onRikki(c))
    for (const u of uudet) {
      if (!u?.name) continue
      const sama = tulos.find((c) => avain(c) === avain(u))
      if (sama) {
        sama.title = sama.title ?? u.title
        sama.phone = sama.phone ?? u.phone
        sama.email = sama.email || u.email
        continue
      }
      tulos.push({
        kind: "person",
        name: u.name,
        title: u.title ?? null,
        phone: u.phone ?? null,
        email: u.email ?? null,
        organization: u.organization ?? null,
      })
    }
    return tulos
  }

  let korjattu = 0
  let tyhjennetty = 0

  for (const [taulu, nimiKentta] of [
    ["potential_projects", "title"],
    ["projects", "name"],
  ] as const) {
    const rivit: any[] = []
    for (let f = 0; ; f += 1000) {
      const { data, error } = await supabase
        .from(taulu)
        .select(`id,${nimiKentta},metadata`)
        .range(f, f + 999)
      if (error) throw error
      rivit.push(...(data ?? []))
      if ((data ?? []).length < 1000) break
    }

    const muutokset: any[] = []

    for (const r of rivit) {
      const vanhat: Merkinta[] = r.metadata?.contact_persons ?? []
      if (!vanhat.length || !vanhat.some(onRikki)) continue

      const lahde = String(r.metadata?.source_name ?? r.metadata?.source ?? "")
      if (!LAHTEET.some((l) => l.test(lahde))) continue
      const hilma = /hilma|hankintailmoitu/i.test(lahde)

      let uusi: Merkinta[]
      if (hilma) {
        uusi = vanhat
          .map((c) => (onRikki(c) ? korjaaHilma(c) : c))
          .filter((c): c is Merkinta => c !== null)
      } else {
        const poimitut = vanhat.filter(onRikki).flatMap((c) => parseYhteystietolohko(lohkoksi(c)))
        /*
         * Jasennin ei saanut lohkosta ketaan: rivi jatetaan ennalleen.
         * Rikkinaisessa merkinnassa on silti nimi jonka olemme joskus
         * saaneet, eika tyhjentaminen ole korjaus (D-409).
         */
        if (!poimitut.length) continue
        uusi = yhdista(vanhat, poimitut)
      }

      if (JSON.stringify(uusi) === JSON.stringify(vanhat)) continue
      muutokset.push({ r, lahde, vanhat, uusi })
    }

    console.log(`\n=== ${taulu.toUpperCase()}: korjattavia ${muutokset.length} / ${rivit.length}`)

    for (const m of muutokset) {
      console.log(`\n  [${m.lahde}] ${String(m.r[nimiKentta]).slice(0, 56)}`)
      console.log("    ENNEN:")
      for (const c of m.vanhat) {
        console.log(
          "      " +
            String(c.name ?? "-").slice(0, 38).padEnd(40) +
            String(c.phone ?? "-").padEnd(17) +
            String(c.email ?? "-").slice(0, 34)
        )
      }
      console.log("    JALKEEN:" + (m.uusi.length ? "" : "   (merkinta poistuu kokonaan)"))
      for (const c of m.uusi) {
        console.log(
          "      " +
            String(c.name ?? "-").slice(0, 20).padEnd(22) +
            String(c.title ?? "-").slice(0, 26).padEnd(28) +
            String(c.phone ?? "-").padEnd(17) +
            String(c.email || "-").slice(0, 32)
        )
      }
      if (!m.uusi.length) tyhjennetty += 1
    }

    if (APPLY) {
      for (const m of muutokset) {
        const meta = { ...(m.r.metadata ?? {}) }
        meta.contact_persons = m.uusi
        meta.takautuvat_ajot = [...new Set([...(meta.takautuvat_ajot ?? []), MERKKI])]
        const { error } = await supabase.from(taulu).update({ metadata: meta }).eq("id", m.r.id)
        if (error) throw error
      }
      console.log(`\n  kirjoitettu ${muutokset.length}`)
    }

    korjattu += muutokset.length
  }

  console.log(
    `\n${APPLY ? "=== AJETTU ===" : "=== KUIVAHARJOITUS ==="}  rivejä ${korjattu}` +
      (tyhjennetty ? `, joista ${tyhjennetty} jää ilman yhtään yhteystietoa` : "")
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
