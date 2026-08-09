/*
 * Korjaa kuntien päätöslähteiden rivit: sekoittuneet ääkköset ja puuttuva
 * kohdetyyppi.
 *
 * KAKSI ERI VIKAA, joilla eri korjaus:
 *
 * 1. Dynasty-rivit (espoo, tuusula, kirkkonummi, kuopio, savonlinna,
 *    tornio, joensuu, kouvola, porvoo) purettiin latin1:nä vaikka asiasivu
 *    on UTF-8, joten ääkköset hajosivat: "Liitteenä" -> "LiitteenÃ¤".
 *    Kuvaus haetaan uudelleen korjatulla purkajalla. Koski kaikkia 73
 *    Dynasty-ehdokasta.
 *
 * 2. Kohdetyyppi puuttui KAIKILTA päätösriveiltä (922 kpl), myös
 *    Helsingiltä ja Tampereelta joiden teksti oli kunnossa. Se lasketaan
 *    otsikosta ja kuvauksesta ilman verkkohakua.
 *
 * Kertaluontoinen.
 *
 *   npx tsx scripts/backfill-decision-sources.ts
 *   npx tsx scripts/backfill-decision-sources.ts --apply
 *   npx tsx scripts/backfill-decision-sources.ts --apply --only=espoo_paatokset
 */
import { readFileSync } from "node:fs"

const APPLY = process.argv.includes("--apply")

/*
 * --refetch hakee Dynasty-asiasivut uudelleen vaikka teksti ei olisi
 * sekoittunut. Tarvittiin kun jäsentäjä alkoi rajata sivukalusteet pois:
 * navigaatio oli kaikkien 76 rivin kuvauksessa, eikä sitä voi siivota
 * ilman alkuperäistä HTML:ää.
 */
const REFETCH = process.argv.includes("--refetch")

/*
 * Alusta tunnistetaan CGI-päätepisteestä, EI isännästä. Kunnat ajavat
 * Dynastya omilla verkkotunnuksillaan (ep10.kouvola.fi,
 * dynastyjulkaisu.pohjoiskarjala.net), joten oncloudos.com-rajaus ohitti
 * 34 riviä kahdesta kunnasta.
 */
const DYNASTY_SOURCE = /DREQUEST\.PHP/
const ONLY = process.argv
  .find((a) => a.startsWith("--only="))
  ?.split("=")[1]
  ?.split(",")
  .map((s) => s.trim())

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8")
  .replace(/\r/g, "")
  .split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1)
  }
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * Sekoittuneen tekstin tunnusmerkit: UTF-8 luettuna latin1:nä tuottaa
 * "Ã¤"-alkuisia pareja, ja purkamattomat numeeriset entiteetit jäävät
 * näkyviin sellaisenaan.
 */
const MOJIBAKE = /Ã[¤¶Â¥„”]|Ã„|Ã–|&#x[0-9a-f]{2,4};|&#\d+;/i

const CONCURRENCY = 4

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { inferBuildingType } = await import("../lib/agent/buildingType")
  const { extractDecisionWinners } = await import("../lib/agent/decisionWinners")
  const { inferDecisionPhase, phaseFromTitle, PHASE_TENDER } = await import(
    "../lib/agent/decisionPhase"
  )
  const { genericizeDecisionTitle } = await import("../lib/agent/decisionTitle")
  const { fetchDecoded, extractItemText, upgradePermitTitle } = await import(
    "../lib/agent/fetchDynastySource"
  )

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const rows: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("potential_projects")
      .select("id, title, municipality, status, metadata")
      .range(from, from + 999)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  const targets = rows.filter((r: any) => {
    const source = r.metadata?.source ?? ""
    if (!/_paatokset$/.test(source)) return false
    if (ONLY && !ONLY.includes(source)) return false
    /*
     * Kaikki päätösrivit käydään läpi. Kohdetyyppi lasketaan uudelleen, ja
     * kirjoitus tapahtuu vain kun arvo muuttuu - muuten aiemman ajon väärä
     * arvo jäisi voimaan, koska rivi ei enää täytä "puuttuu"-ehtoa.
     */
    return true
  })

  const broken = targets.filter((r) => MOJIBAKE.test(r.metadata?.description ?? ""))

  console.log(
    `${APPLY ? "KIRJOITETAAN" : "KUIVAHARJOITTELU (--apply kirjoittaa)"} — ${targets.length} riviä`
  )
  console.log(`  joista sekoittunut teksti: ${broken.length} (haetaan uudelleen)\n`)
  if (targets.length === 0) return

  const stats = { teksti: 0, tyyppi: 0, otsikko: 0, operation: 0, voittajat: 0, vaihe: 0, epaonnistui: 0 }
  const types: Record<string, number> = {}

  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    await Promise.all(
      targets.slice(i, i + CONCURRENCY).map(async (row: any) => {
        const md = row.metadata ?? {}
        let description: string = md.description ?? ""

        /* Vain rikkinäiset haetaan uudelleen; muille riittää laskenta. */
        const needsRefetch =
          !!md.source_url &&
          (MOJIBAKE.test(description) || (REFETCH && DYNASTY_SOURCE.test(md.source_url)))

        if (needsRefetch) {
          const html = await fetchDecoded(md.source_url)
          const fresh = html ? extractItemText(html) : null
          if (fresh && !MOJIBAKE.test(fresh)) {
            /* Lasketaan vain oikeasti muuttuneet, ei jokaista hakua. */
            if (fresh !== description) stats.teksti++
            description = fresh
          } else {
            stats.epaonnistui++
            return
          }
        }

        const title = genericizeDecisionTitle(upgradePermitTitle(row.title, description))
        if (title !== row.title) stats.otsikko++

        /*
         * Kohdetyyppi lasketaan aina uudelleen: aiempi ajo saattoi kirjata
         * väärän arvon (lausunnonantaja "Kaupunginmuseo" -> Kulttuurirakennus).
         */
        /*
         * Voittajat poimitaan hankintapäätöksen tekstistä. Kenttä oli tyhjä
         * silloinkin kun päätös listasi kahdeksan valittua yritystä.
         */
        const winners = extractDecisionWinners(description)
        const oldWinners: string[] = Array.isArray(md.winners) ? md.winners : []
        if (winners.join("|") !== oldWinners.join("|")) stats.voittajat++

        /*
         * Urakoitsija tyhjennetään jos se on peräisin aiemmasta - nyt
         * kumotusta - voittajapoiminnasta. Muualta tullutta arvoa ei
         * kosketa.
         */
        const builderFromWinners = md.builder != null && oldWinners.includes(md.builder)

        /*
         * VARALLA ON NYKYINEN ARVO, ei lähteen otsikkopäättely. Ilman
         * vahvaa signaalia (sopimuskausi tai voittaja) rivi jää siis
         * ennalleen. Otsikosta uudelleen laskettuna 28 riviä olisi
         * heilahtanut "Suunnittelu" <-> "Suunnittelussa" ilman että mikään
         * niissä oli korjaantunut - se on kohinaa, ei korjaus.
         */
        /*
         * Poikkeus varasääntöön: kilpailutuksen aloituspäätös on niin
         * täsmällinen otsikkosignaali että se saa korjata vanhan arvon.
         * Nämä rivit oli merkitty myönnetyksi sopimukseksi, koska otsikossa
         * on sana "urakka" - urakoitsijaa ei kuitenkaan ole vielä valittu.
         */
        /*
         * Vaihe luetaan ALKUPERÄISESTÄ otsikosta: siivous poistaa juuri sen
         * sanan josta kilpailutus tunnistetaan ("kilpailutusperiaatteet").
         * Siivotusta otsikosta luettuna signaali katosi ja korjaus jäi
         * tekemättä - mitattu 0 muutosta, kun niitä piti olla 2.
         */
        const titleTender = phaseFromTitle(row.title) === PHASE_TENDER
        const phase = inferDecisionPhase({
          description,
          hasWinner: winners.length > 0,
          fallback: titleTender ? PHASE_TENDER : (md.phase_hint ?? "Suunnittelussa"),
        })
        if (phase !== md.phase_hint) stats.vaihe++

        /*
         * Onko operation vanhentunut kopio otsikosta? Vertailua ei voi
         * tehdä nykyiseen otsikkoon, koska se on jo siivottu - ehto
         * `operation === row.title` ei osunut kertaakaan. Oikea testi on
         * siivota operation ja katsoa antaako se saman otsikon.
         */
        const operationIsStaleTitle =
          typeof md.operation === "string" &&
          md.operation !== title &&
          genericizeDecisionTitle(md.operation) === title
        if (operationIsStaleTitle) stats.operation++

        const buildingType = inferBuildingType(title, description)
        if (buildingType !== md.building_type) {
          stats.tyyppi++
          const label = buildingType ?? "(tyhjennetty)"
          types[label] = (types[label] ?? 0) + 1
        }

        if (!APPLY) return

        const { error } = await supabase
          .from("potential_projects")
          .update({
            title,
            metadata: {
              ...md,
              description,
              /*
               * OTSIKKO ON KAHDESSA PAIKASSA. Tuonti kirjoittaa saman
               * arvon sekä title-sarakkeeseen että metadata.operationiin,
               * ja TIC:n lista renderöi `metadata.operation ?? title` -
               * joten pelkkä title-päivitys näkyi vain hankesivulla, ei
               * listassa.
               *
               * Operation päivitetään VAIN jos se oli synkassa vanhan
               * otsikon kanssa. Muualla se kantaa aidosti eri tekstiä:
               * Lupapisteellä title on lupatunnus ("Rakennuslupa:
               * Vanha-Stens 5") ja operation kertoo mitä rakennetaan
               * ("Urheilukentän rakentaminen tontille"). Sen
               * ylikirjoittaminen hävittäisi paremman tiedon 304 riviltä.
               */
              operation: operationIsStaleTitle ? title : (md.operation ?? null),
              phase_hint: phase,
              building_type: buildingType ?? null,
              /*
               * Uusi laskenta voittaa aina, myös tyhjänä. Jos vanha arvo
               * säilytettäisiin tyhjän tuloksen kohdalla, aiemman ajon
               * väärät voittajat jäisivät voimaan - juuri niin kävi
               * kohdetyypille kahdesti.
               */
              winners: winners.length ? winners : null,
              /*
               * Yksi voittaja on pääurakoitsija; useampi on puitesopimus,
               * eikä yhtä voi silloin nimetä. Sama periaate kuin
               * collectProjectCompaniesissa.
               */
              builder:
                winners.length === 1
                  ? winners[0]
                  : builderFromWinners
                    ? null
                    : (md.builder ?? null),
            },
          })
          .eq("id", row.id)

        if (error) stats.epaonnistui++
      })
    )
    process.stdout.write(
      `\r  käsitelty ${Math.min(i + CONCURRENCY, targets.length)}/${targets.length}`
    )
  }

  console.log("\n")
  console.log(`teksti korjattu:     ${stats.teksti}`)
  console.log(`kohdetyyppi muuttui: ${stats.tyyppi}`)
  console.log(`otsikko korjattu:    ${stats.otsikko}`)
  console.log(`voittajat poimittu:  ${stats.voittajat}`)
  console.log(`vaihe korjattu:      ${stats.vaihe}`)
  console.log(`operation synkattu:  ${stats.operation}`)
  console.log(`epäonnistui:         ${stats.epaonnistui}`)
  console.log("\nKohdetyypit:")
  for (const [t, n] of Object.entries(types).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${t.padEnd(20)} ${n}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
