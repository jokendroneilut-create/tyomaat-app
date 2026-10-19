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
 * KATSELMOIJAN OHJEET POIS ASIAKKAAN KUVAUKSESTA (D-316).
 *
 * Johannes 19.10.2026 jonorivista `5fb9058b`: *"kayttajalle ei voida
 * nayttaa tallaista tekstia: ... HUOM KATSELMOIJALLE: ... Jos sama
 * hanke, lisaa lupariville rakentajaksi Rakennusteho ja hylkaa tama
 * rivi."* -- *"poistatko tuon huom katselmoijalle osan."*
 *
 * Kirjoitin erottelussa (D-312, D-313, D-314) katselmoijalle
 * tarkoitetut muistiinpanot **kuvaukseen**, koska se oli ainoa kentta
 * jonka tiesin nakyvan TIC:ssa. Kuvaus on kuitenkin sama teksti joka
 * siirtyy hyvaksynnassa `additional_info`-sarakkeeseen ja nakyy
 * ASIAKKAALLE (muisti: measure-the-field-the-user-reads). Jaakarinkankaan
 * rivi ehti jo hyvaksytyksi, eli ohje oli julkaistussa hankkeessa.
 *
 * MITA POISTETAAN. Kolme luokkaa, kaikki omaa tuotantoani:
 *
 *   1. "HUOM KATSELMOIJALLE: ..." kappale loppuun asti -- puhdasta
 *      tyoohjetta ("hylkaa tama rivi"), ei kuulu asiakkaalle.
 *   2. "HUOM: ... -- tama rivi koskee X:aa" -- sisaltaa oikean FAKTAN
 *      (naapurihanke on eri hanke), joten se kirjoitetaan uudelleen
 *      neutraaliksi lauseeksi sen sijaan etta poistettaisiin.
 *   3. 'Lahteen sanamuoto: "..."' -- lahteen kirjoitusvirheen
 *      dokumentointi; sama tieto on metadatassa kentassa
 *      `eroteltu_lahteen_sanamuoto`, joten kuvauksesta se lahtee.
 *
 * EI KOSKETA LAHTEEN OMAAN TEKSTIIN. Hilman ilmoituksesta tuleva
 * "(HUOM: Samassa rakennuksessa toinen osuus Lumo kotien
 * omistuksessa, se EI sisally tahan urakkaan.)" on tilaajan oma
 * huomautus urakan laajuudesta ja kuuluu asiakkaalle.
 *
 * Ajo kay LAPI KAIKKI rivit molemmista tauluista, ei vain tiedettyja
 * id:ita: sama virhe voi olla muuallakin.
 *
 *   npx tsx scripts/siivoa-katselmoijan-ohjeet.ts
 *   npx tsx scripts/siivoa-katselmoijan-ohjeet.ts --apply
 */

type Saanto = { nimi: string; etsi: RegExp; korvaa: string }

const SAANNOT: Saanto[] = [
  {
    nimi: "HUOM KATSELMOIJALLE -kappale",
    etsi: /\n*HUOM KATSELMOIJALLE:[\s\S]*$/,
    korvaa: "",
  },
  {
    nimi: "Harvialan naapurihanke neutraaliksi",
    etsi: /\s*HUOM: samalla alueella on erillinen hanke Harviala[^.]*\.\s*/,
    korvaa: " Hanke on eri kuin saman alueen Harviala–Hangasmäki, joka on 14 kilometrin voimajohto.",
  },
  {
    nimi: "Niittylahden naapurihanke neutraaliksi (jonorivi)",
    etsi: /\s*HUOM: samalle paikkakunnalle rakennetaan uusi koulu ja päiväkoti[^.]*\.\s*/,
    korvaa: " Samalle tontille rakennetaan uusi koulu ja päiväkoti, joka on oma hankkeensa.",
  },
  {
    nimi: "Niittylahden naapurihanke neutraaliksi (hanke)",
    etsi: /\n*HUOM: samalle tontille rakennetaan uusi koulu ja päiväkoti[\s\S]*$/,
    korvaa:
      "\n\nSamalle tontille rakennetaan uusi koulu ja päiväkoti, joka on oma hankkeensa (22,1 milj. euroa).",
  },
  {
    /*
     * Muhoksen rivin jaljelle jaava kappale siteerasi lahdelausetta,
     * joka kertoo MYOS Peltolan hankkeesta -- toisen hankkeen nimi
     * keskella tata kuvausta on hammentava. Sama tieto suorana.
     */
    nimi: "Muhoksen kuvaus suoraksi",
    etsi: /^Rakennusteho kertoo katsauksessaan 15\.10\.2026: ["”][^"”]*["”][^\n]*/,
    korvaa:
      "Rakennusteho rakentaa Muhoksen kunnalle kerrostaloa. Yhtiö kertoi kohteen olevan rakenteilla " +
      "katsauksessaan 15.10.2026; muuta kohteesta ei lähteessä kerrota.",
  },
  {
    nimi: "Lähteen sanamuoto -maininta",
    etsi: /\s*Lähteen sanamuoto: ”[^”]*”\.|\s*Lähteen sanamuoto: "[^"]*"\./,
    korvaa: "",
  },
]

function siivoa(teksti: string): { uusi: string; osumat: string[]; poistetut: string[] } {
  let uusi = teksti
  const osumat: string[] = []
  /* Tulostetaan se mika OIKEASTI poistui, ei lopputuloksen hantaa. */
  const poistetut: string[] = []
  for (const s of SAANNOT) {
    const osuma = uusi.match(s.etsi)
    if (!osuma) continue
    osumat.push(s.nimi)
    poistetut.push(osuma[0].replace(/\s+/g, " ").trim())
    uusi = uusi.replace(s.etsi, s.korvaa)
  }
  return { uusi: uusi.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim(), osumat, poistetut }
}

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  let muutettu = 0
  for (const taulu of ["potential_projects", "projects"] as const) {
    const sarakkeet =
      taulu === "projects" ? "id, name, status, additional_info, metadata" : "id, title, status, metadata"
    const rivit: any[] = []
    for (let a = 0; ; a += 1000) {
      const { data, error } = await db.from(taulu).select(sarakkeet).range(a, a + 999)
      if (error) {
        console.error(`VIRHE ${taulu}: ${error.message}`)
        process.exit(1)
      }
      rivit.push(...(data ?? []))
      if ((data ?? []).length < 1000) break
    }
    console.log(`\n### ${taulu}: ${rivit.length} riviä luettu`)

    for (const r of rivit) {
      const md: Record<string, any> = r.metadata ?? {}
      const kuvausNyt = String(md.description ?? "")
      const infoNyt = String(r.additional_info ?? "")

      const kuvaus = siivoa(kuvausNyt)
      const info = siivoa(infoNyt)
      if (!kuvaus.osumat.length && !info.osumat.length) continue

      muutettu += 1
      console.log(`\n   ${r.id.slice(0, 8)} ${String(r.name ?? r.title).slice(0, 50)} [${r.status}]`)
      console.log(`      säännöt: ${[...new Set([...kuvaus.osumat, ...info.osumat])].join(", ")}`)
      if (kuvaus.osumat.length) {
        console.log(`      metadata.description ${kuvausNyt.length} -> ${kuvaus.uusi.length}`)
        for (const p of kuvaus.poistetut) console.log(`      POIS:  "${p.slice(0, 200)}"`)
        console.log(`      LOPPU: ...${kuvaus.uusi.slice(-170).replace(/\n/g, " ")}`)
      }
      if (info.osumat.length) {
        console.log(`      additional_info ${infoNyt.length} -> ${info.uusi.length}`)
        console.log(`      LOPPU: ...${info.uusi.slice(-170).replace(/\n/g, " ")}`)
      }

      if (!apply) continue
      const paivitys: Record<string, unknown> = {}
      if (kuvaus.osumat.length) paivitys.metadata = { ...md, description: kuvaus.uusi }
      if (info.osumat.length && taulu === "projects") paivitys.additional_info = info.uusi
      const { error: e1 } = await db.from(taulu).update(paivitys).eq("id", r.id)
      if (e1) console.error(`      VIRHE: ${e1.message}`)
      else console.log(`      kirjoitettu`)
    }
  }

  console.log(`\nYhteensä ${muutettu} riviä`)
  if (!apply) console.log("Ei kirjoitettu. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
