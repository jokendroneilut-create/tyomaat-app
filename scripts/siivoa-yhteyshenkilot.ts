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
 * YHTEYSHENKILOMERKINTOJEN SIIVOUS (D-330).
 *
 * Johannes 22.10.2026: *"kay ne 325 lapi."*
 *
 * Merkinnat luettiin luokittain kokonaisina, ja luokat osoittautuivat
 * eri asioiksi kuin luvut antoivat ymmartaa. Siksi tama ajo tekee VAIN
 * KOLME yksikasitteista toimenpidetta eika poista mitaan kayttokelpoista
 * tietoa:
 *
 *   1. LAJI KORJATAAN. Hilman ilmoitus antaa yhteystiedoksi usein
 *      organisaation ("Suomen Hankintajuristit Asianajotoimisto Oy",
 *      "Kymenlaakson Jate Oy/kirjaamo"), ja se oli tallennettu
 *      `kind: "person"`. Sahkoposti ja puhelin ovat aitoja -- vain laji
 *      on vaara, joten se muutetaan `organization`:ksi. Tieto ei muutu.
 *
 *   2. KOYHEMPI KAKSONEN POISTETAAN, mutta vain kun se on aito
 *      OSAJOUKKO: sama nimi, eika siina ole yhtaan kenttaa jota
 *      toisessa ei ole. "Paivi Muhonen, sama posti ja puhelin, ei
 *      nimiketta" poistuu; "Ilpo Luhtala, eri posti ja eri puhelin"
 *      EI poistu, koska molemmat kantavat omaa tietoaan.
 *
 *   3. ROSKANIMIKE TYHJENNETAAN kun siihen on liimautunut TOISEN
 *      ihmisen sahkoposti tai merkinnan oma nimi -- molemmat ovat
 *      jasentimen jalkia, eivat nimikkeita. Yhteystieto jaa koskematta.
 *      Poistettu arvo talletetaan metadataan jaljitettavaksi.
 *
 * MITA EI TEHDA: merkintoja joiden NIMI on roskaa ("Vanttausjarventie
 * Rovaniemen", "621 5125") ei poisteta eika korjata -- se on arvausta.
 * Taydentavia kaksosia ei yhdisteta. Ne raportoidaan.
 *
 *   npx tsx scripts/siivoa-yhteyshenkilot.ts
 *   npx tsx scripts/siivoa-yhteyshenkilot.ts --apply
 */

const YRITYS = /\b(?:Oy|Oyj|Ab|Abp|Ky|Ltd|Group|GmbH|AS|A\/S|S\.?A\.?)\b/i

const ARVO = (v: unknown) => String(v ?? "").trim()

/*
 * Osajoukko: `a`:ssa ei ole yhtaan kenttaa jota `b`:ssa ei ole samana.
 * Tyhja kentta ei ole tietoa, joten se ei estä poistoa.
 */
function onOsajoukko(a: any, b: any): boolean {
  for (const k of ["email", "phone", "title", "organization", "role"]) {
    const av = ARVO(a?.[k])
    if (!av) continue
    if (av.toLowerCase() !== ARVO(b?.[k]).toLowerCase()) return false
  }
  return true
}

/*
 * NIMIKKEESTA RIISUTAAN YHTEYSTIEDOT, EI NIMIKETTA ITSEAAN.
 *
 * Ensimmainen versio tyhjensi nimikkeen aina kun siina oli
 * sahkopostiosoite tai merkinnan oma nimi. Kuivaharjoituksen rivit
 * paljastivat etta se olisi havittanyt AITOJA nimikkeita:
 *
 *   "ylitarkastaja etunimi.sukunimi@ely-keskus.fi"        -> ylitarkastaja
 *   "Sijoitussuunnittelija 040 7184466 simo...@rejlers.fi" -> Sijoitussuunnittelija
 *   "Arkkitehtitoimisto Jarmo Lokio Oy, kaavanlaatija"     -> jaa kokonaan
 *
 * Viimeinen osui vain siksi, etta toimiston nimessa on henkilon oma
 * nimi. Siksi nimi EI ole roskan merkki.
 */
function siistiNimike(merkinta: any): string | null {
  let t = ARVO(merkinta?.title)
  if (!t) return null

  /* Sahkoposti, myos [at]-muodossa, ja puhelinnumerot pois. */
  t = t
    .replace(/[\w.\-]+\s*(?:@|\[at\])\s*[\w.\-]+\.[a-z]{2,}/gi, " ")
    .replace(/\b(?:puh\.?|p\.)\s*\+?[\d\s\-()]{5,}/gi, " ")
    .replace(/\+?\d[\d\s\-()]{6,}/g, " ")
    /*
     * Osoitesaannon selitys ei ole nimike. Fingridin sivuilla lukee
     * "Sahkopostiosoitteemme ovat muotoa etunimi.sukunimi@fingrid.fi",
     * ja osoitteen poiston jalkeen jai "ovat muotoa".
     */
    .replace(/\bs[äa]hk[öo]postiosoitteemme\s+ovat\s+muotoa\b/gi, " ")
    /* Jaljelle jaava irrallinen kenttanimi ei kerro mitaan. */
    .replace(/\b(?:s[äa]hk[öo]posti|email|e-?mail|puh)\b\s*:?/gi, " ")
    /* Katkennut numerofragmentti ("…, . 016") on liian lyhyt ylla. */
    .replace(/[\s,;.]+\d{2,4}\s*$/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*,+/g, ",")
    .replace(/^[\s,;:.\-]+|[\s,;:.\-]+$/g, "")
    .trim()

  if (!t) return null

  /* Nimike joka vain toistaa nimen ei kerro mitaan. */
  const pelkistä = (s: string) => s.toLowerCase().replace(/[^a-zåäö0-9]/g, "")
  const nimi = ARVO(merkinta?.name)
  if (nimi && pelkistä(t) === pelkistä(nimi)) return null

  /*
   * Liimautuma jaljella ("...YhteyshenkilotJanne KananenLiiketoiminta")
   * tarkoittaa ettei rakennetta saa erotetuksi; silloin nimike on
   * jasentimen jalki eika tieto.
   */
  if (/[a-zåäö][A-ZÅÄÖ]/.test(t)) return null

  return t
}

type Muutos = { rivi: string; taulu: string; mita: string; ennen: string; jalkeen: string }

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  const muutokset: Muutos[] = []
  const luvut = { laji: 0, kaksonen: 0, nimike: 0, rivit: 0 }
  const jatetty = { taydentava: 0, roskanimi: 0 }

  for (const taulu of ["projects", "potential_projects"] as const) {
    /*
     * KAHDESSA VAIHEESSA, KOSKA KOKO METADATA AIKAKATKAISI KYSELYN.
     * Ensin luetaan vain yhteystietokentta (`metadata->contact_persons`),
     * ja taysi metadata haetaan vain niille riveille jotka muuttuvat.
     */
    const rivit: any[] = []
    for (let a = 0; ; a += 500) {
      const { data, error } = await db
        .from(taulu)
        .select(
          taulu === "projects"
            ? "id, name, kontaktit:metadata->contact_persons, lahde:metadata->>source_name"
            : "id, title, kontaktit:metadata->contact_persons, lahde:metadata->>source_name"
        )
        .range(a, a + 499)
      if (error) {
        console.error(`VIRHE ${taulu}: ${error.message}`)
        process.exit(1)
      }
      rivit.push(...(data ?? []))
      if ((data ?? []).length < 500) break
    }

    for (const p of rivit) {
      const vanha = Array.isArray(p.kontaktit) ? (p.kontaktit as any[]) : []
      if (!vanha.length) continue
      const rivinNimi = String(p.name ?? p.title ?? "").slice(0, 44)

      /* 2. Poistettavat kaksoset: aidot osajoukot. */
      const poista = new Set<number>()
      for (let i = 0; i < vanha.length; i += 1) {
        const ni = ARVO(vanha[i]?.name).toLowerCase()
        if (!ni || poista.has(i)) continue
        for (let j = 0; j < vanha.length; j += 1) {
          if (i === j || poista.has(j)) continue
          if (ARVO(vanha[j]?.name).toLowerCase() !== ni) continue
          if (onOsajoukko(vanha[j], vanha[i])) {
            poista.add(j)
            muutokset.push({
              rivi: rivinNimi,
              taulu,
              mita: "kaksonen pois",
              ennen: JSON.stringify(vanha[j]).slice(0, 150),
              jalkeen: `jaa: ${JSON.stringify(vanha[i]).slice(0, 110)}`,
            })
          } else if (!onOsajoukko(vanha[i], vanha[j])) {
            jatetty.taydentava += 1
          }
        }
      }

      const uusi: any[] = []
      let muuttui = poista.size > 0
      luvut.kaksonen += poista.size

      vanha.forEach((c, i) => {
        if (poista.has(i)) return
        let m = { ...c }

        /* 1. Laji: yritys ei ole henkilo. */
        const nimi = ARVO(m.name)
        if (nimi && YRITYS.test(nimi) && ARVO(m.kind) !== "organization") {
          muutokset.push({
            rivi: rivinNimi,
            taulu,
            mita: "laji -> organization",
            ennen: `${nimi} (kind=${ARVO(m.kind) || "puuttuu"})`,
            jalkeen: `${nimi} (kind=organization)`,
          })
          m = { ...m, kind: "organization" }
          luvut.laji += 1
          muuttui = true
        }

        /* 3. Nimikkeesta yhteystiedot pois, alkuperainen talteen. */
        const siistitty = siistiNimike(m)
        if (ARVO(m.title) && siistitty !== ARVO(m.title)) {
          muutokset.push({
            rivi: rivinNimi,
            taulu,
            mita: siistitty ? "nimike siistitty" : "nimike tyhjaksi",
            ennen: `${ARVO(m.name) || "(nimeton)"}: "${ARVO(m.title)}"`,
            jalkeen: siistitty ? `"${siistitty}"` : "(tyhja)",
          })
          m = { ...m, title: siistitty, title_alkuperainen: ARVO(m.title) }
          luvut.nimike += 1
          muuttui = true
        }

        /* Nimi roskaa: raportoidaan, ei koskettu. */
        if (nimi && (/^\d/.test(nimi) || /\d{3}/.test(nimi))) jatetty.roskanimi += 1

        uusi.push(m)
      })

      if (!muuttui) continue
      luvut.rivit += 1

      if (!apply) continue
      /* Taysi metadata vain nyt, kun rivi oikeasti muuttuu. */
      const { data: taysi, error: lukuVirhe } = await db
        .from(taulu)
        .select("metadata")
        .eq("id", p.id)
        .maybeSingle()
      if (lukuVirhe || !taysi) {
        console.error(`      VIRHE luku ${rivinNimi}: ${lukuVirhe?.message ?? "ei rivia"}`)
        continue
      }
      const md: Record<string, any> = { ...((taysi as any).metadata ?? {}) }
      md.contact_persons = uusi
      md.yhteystiedot_siivottu = new Date().toISOString().slice(0, 10)
      const { error } = await db.from(taulu).update({ metadata: md }).eq("id", p.id)
      if (error) console.error(`      VIRHE ${rivinNimi}: ${error.message}`)
    }
  }

  const ryhmat = new Map<string, Muutos[]>()
  for (const m of muutokset) ryhmat.set(m.mita, [...(ryhmat.get(m.mita) ?? []), m])

  for (const [mita, lista] of ryhmat) {
    console.log(`\n=== ${mita.toUpperCase()}: ${lista.length} ===`)
    const askel = Math.max(1, Math.floor(lista.length / 12))
    for (let i = 0; i < lista.length && i / askel < 12; i += askel) {
      const m = lista[i]
      console.log(`   ${m.rivi.padEnd(46)} [${m.taulu}]`)
      console.log(`      ennen:   ${m.ennen}`)
      console.log(`      jalkeen: ${m.jalkeen}`)
    }
  }

  console.log(
    `\nYhteensa: laji ${luvut.laji}, kaksonen pois ${luvut.kaksonen}, nimike tyhjaksi ${luvut.nimike} -- ${luvut.rivit} rivilla`
  )
  console.log(
    `Jatetty koskematta: taydentavia kaksospareja ${Math.round(jatetty.taydentava / 2)}, nimi roskaa ${jatetty.roskanimi}`
  )
  if (!apply) console.log("Ei kirjoitettu. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
