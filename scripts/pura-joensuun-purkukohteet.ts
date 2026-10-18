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
 * JOENSUUN PURKUKOHTEET OMIKSI HANKKEIKSI (D-308).
 *
 * Johannes 18.10.2026 jonorivista `9beb523a`: *"tasta lahteesta pitaisi
 * purkaa erillisiksi hankkeiksi ... eli puratko ne ja teet niista omat
 * hankkeet tic:iin hyvaksyttavaksi."*
 *
 * Lahde on Joensuun konsernijaoston kokousasia "Tilakeskuksen vuoden
 * 2027 investointiohjelma". Yhdessa rivissa on viisi eri kohdetta,
 * jotka ovat erillisia purkuhankkeita eri osoitteissa -- yhtena rivina
 * ne eivat loydy haulla eivatka osu kenenkaan hakuvahtiin.
 *
 * KAYTTAA TUONNIN OMAA POLKUA (`importCandidate`), ei suoraa inserttia:
 * silloin rivit kayvat saman duplikaattitarkistuksen ja metadatan
 * kokoamisen lapi kuin oikeista lahteista tulevat.
 *
 * NIMET KORJATTU LAHTEEN KIRJOITUSVIRHEISTA. Kaupungin oma teksti
 * sanoo "Nittylahden" ja "Heinavaaran vanhan paivakoti". Oikeat muodot
 * tarkistettiin verkosta (Joensuun omat sivut): Niittylahden koulu ja
 * paivakoti, Heinavaaran paivakoti. Alkuperainen kirjoitusasu jaa
 * kuvaukseen nakyviin.
 *
 * VAIHE ON SUUNNITTELUSSA, EI SOPIMUS. Teksti on esitys
 * ("Tilakeskus esittaa vuodelle 2027 purettavaksi"), ja konsernijaosto
 * kasittelee sen 19.10.2026 -- paatosta ei ole tehty.
 *
 *   npx tsx scripts/pura-joensuun-purkukohteet.ts
 *   npx tsx scripts/pura-joensuun-purkukohteet.ts --apply
 */

const LAHDE = "9beb523a-28eb-4755-a511-99ef37bb5368"

const KOHTEET = [
  {
    nimi: "Niittylahden koulun ja päiväkodin purku",
    tyyppi: "Koulu",
    lahteessa: "Nittylahden koulu ja päiväkoti",
    tunnus: "niittylahden-koulu-ja-paivakoti",
  },
  {
    nimi: "Heinävaaran vanhan päiväkodin purku",
    tyyppi: "Päiväkoti",
    lahteessa: "Heinävaaran vanhan päiväkoti",
    tunnus: "heinavaaran-vanha-paivakoti",
  },
  {
    nimi: "Petäikkölän päiväkodin purku",
    tyyppi: "Päiväkoti",
    lahteessa: "Petäikkölän päiväkoti",
    tunnus: "petaikkolan-paivakoti",
  },
  {
    nimi: "Rantakylän terveysaseman purku",
    tyyppi: "Terveysasema",
    lahteessa: "Rantakylän terveysasema",
    tunnus: "rantakylan-terveysasema",
  },
  {
    nimi: "Tuupovaaran nuorisotalon purku",
    tyyppi: "Nuorisotalo",
    lahteessa: "Tuupovaaran nuorisotalo",
    tunnus: "tuupovaaran-nuorisotalo",
  },
] as const

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const { importCandidate } = await import("../lib/agent/importCandidate")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const { data: lahde, error } = await db
    .from("potential_projects")
    .select("id, title, municipality, metadata")
    .eq("id", LAHDE)
    .maybeSingle()
  if (error || !lahde) {
    console.error(`VIRHE: lahderivia ei loytynyt (${error?.message ?? "ei rivia"})`)
    process.exit(1)
  }
  const m: any = lahde.metadata ?? {}
  const teksti = String(m.description ?? "")

  /* Varmistus: kohde on oikeasti lahdetekstissa. */
  const puuttuvat = KOHTEET.filter((k) => !teksti.includes(k.lahteessa))
  if (puuttuvat.length) {
    console.error(`VIRHE: naita ei loydy lahdetekstista: ${puuttuvat.map((k) => k.lahteessa).join(", ")}`)
    process.exit(1)
  }

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")
  console.log(`lahde: ${lahde.title.slice(0, 70)}`)
  console.log(`       ${m.source_url}\n`)

  /* Vertailujoukko duplikaattitarkistukselle, kuten keraimella. */
  const projektit: any[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error: e2 } = await db
      .from("projects")
      .select("id, name, city, region, location, status, developer, builder, metadata")
      .range(a, a + 999)
    if (e2) {
      console.error(`VIRHE projects: ${e2.message}`)
      process.exit(1)
    }
    projektit.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }

  for (const k of KOHTEET) {
    const kuvaus =
      `Joensuun Tilakeskus esittää kohteen purettavaksi vuonna 2027. ` +
      `Lähteen sanamuoto: "${k.lahteessa}". ` +
      `Esitys sisältyy Tilakeskuksen vuoden 2027 investointiohjelmaan ja vuosien 2027–2029 ` +
      `investointisuunnitelmaan, jonka konsernijaosto käsittelee 19.10.2026. ` +
      `Tilakeskuksen toimitilainvestoinnit ovat vuonna 2027 yhteensä 15,06 milj. euroa. ` +
      `Purettavaksi esitetään myös: ` +
      KOHTEET.filter((x) => x.nimi !== k.nimi)
        .map((x) => x.lahteessa)
        .join(", ") +
      `.`

    const ehdokas = {
      name: k.nimi,
      city: "Joensuu",
      region: m.region ?? "Pohjois-Karjala",
      location: null,
      /* Esitys, ei paatos: kasitellaan 19.10.2026. */
      phase: "Suunnittelussa",
      description: kuvaus,
      developer: "Joensuun kaupunki",
      builder: null,
      property_type: k.tyyppi,
      /*
       * OMA TUNNISTE OSOITTEESEEN. `importCandidate` ohittaa rivin jos
       * samasta `source_url`:sta on jo jonorivi -- ja lahderivi tuli
       * tasta samasta osoitteesta, joten kaikki viisi olisi hylatty
       * tilassa `duplicate_source`. Fragmentti tekee osoitteesta
       * yksilollisen eika muuta sita mihin linkki vie: palvelin ei saa
       * fragmenttia, joten se avaa saman paatossivun.
       */
      source_url: `${m.source_url}#${k.tunnus}`,
      /*
       * Matalampi kuin lahderivin 90: nama on poimittu luettelosta
       * kasin, eika kohteesta ole omaa paatosta tai asiakirjaa.
       */
      confidence: 0.75,
      completed: false,
      source_name: m.source_name ?? "joensuu_paatokset",
      metadata: {
        purettava: true,
        purkuvuosi: 2027,
        /* Mista rivista tama irrotettiin, jotta ketju sailyy. */
        eroteltu_rivista: LAHDE,
        eroteltu_lahteen_sanamuoto: k.lahteessa,
      },
    }

    console.log("".padEnd(74, "-"))
    console.log(`${k.nimi}`)
    console.log(`  tyyppi ${k.tyyppi}   kaupunki Joensuu   vaihe Suunnittelussa`)
    console.log(`  kuvaus ${kuvaus.slice(0, 150)}...`)

    if (!apply) continue

    const tulos = await importCandidate(ehdokas, { projects: projektit })
    console.log(`  -> ${JSON.stringify(tulos).slice(0, 180)}`)
  }

  if (!apply) {
    console.log("\nEi kirjoitettu. Aja --apply kun rivit on luettu.")
  }
}
main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
