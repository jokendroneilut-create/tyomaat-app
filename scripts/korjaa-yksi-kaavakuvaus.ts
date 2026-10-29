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
 * YHDEN KAAVARIVIN KUVAUS SELOSTUKSESTA (D-356).
 *
 * Yksi rivi kerrallaan, tunnisteella. Tama on se mita Johannes pyytaa
 * useimmiten: *"tasta ei ole poimittu tarkoitusta ... korjataan tama"*.
 * Takautuva massa-ajo on eri skripti
 * (`korjaa-liiteotsikkokuvaukset.ts`).
 *
 * Hakee rivin oman sivun, valitsee selostuksen ja lukee siita
 * kaava-alueen ja tarkoituksen. EI korvaa olemassa olevaa kuvausta
 * vaan yhdistaa: sivun oma teksti sailyy edessa.
 *
 *   npx tsx scripts/korjaa-yksi-kaavakuvaus.ts <uuid>
 *   npx tsx scripts/korjaa-yksi-kaavakuvaus.ts <uuid> --apply
 */

import * as cheerio from "cheerio"

async function main() {
  const id = process.argv[2]
  const apply = process.argv.includes("--apply")
  if (!id || id.startsWith("--")) {
    console.log("Anna rivin uuid: npx tsx scripts/korjaa-yksi-kaavakuvaus.ts <uuid>")
    process.exit(1)
  }

  const { createClient } = await import("@supabase/supabase-js")
  const kuvaus = await import("../lib/agent/kaavanKuvaus")
  const liite = await import("../lib/agent/kaavanLiite")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  for (const taulu of ["projects", "potential_projects"] as const) {
    const { data, error } = await db
      .from(taulu)
      .select("*")
      .eq("id", id)
      .maybeSingle()
    if (error || !data) continue
    const rivi = data as any

    const otsikko = String(rivi.name ?? rivi.title ?? "")
    const sivu = String(rivi.metadata?.documents_url ?? rivi.metadata?.source_url ?? "")
    const nykyinen = String(rivi.additional_info ?? rivi.metadata?.description ?? "")
    console.log(`\n${taulu}: ${otsikko}`)
    console.log(`   sivu: ${sivu}`)
    console.log(`   kuvaus nyt (${nykyinen.length}): ${nykyinen.replace(/\s+/g, " ").slice(0, 120)}`)

    const res = await fetch(sivu, { headers: { "user-agent": "Mozilla/5.0" }, cache: "no-store" })
    if (!res.ok) {
      console.error(`   sivu HTTP ${res.status}`)
      return
    }
    const $ = cheerio.load(await res.text())

    const lohko = liite.lohkonLinkit($, sivu, otsikko, (sivulla: string, haettu: string) => {
      const n = (x: string) => x.toLowerCase().replace(/[^\wåäö]+/g, " ").trim()
      return n(sivulla).length >= 10 && n(sivulla).includes(n(haettu).slice(0, 30))
    })
    /*
     * KUN LOHKOA EI LOYDY, NIMEN ON TUNNISTETTAVA KAAVA (D-362).
     *
     * Lohkosta tulleet liitteet ovat julkaisijan itsensä ryhmittelemiä,
     * eli varmasti taman kaavan. Jos lohkoa ei loydy, jaljelle jaa KOKO
     * sivun liitelista -- Ulvilassa 26 pdf:aa -- ja valinta ottaisi
     * ensimmaisen selostuksen. Mitattu: *"Nahkurin ja Nummelan
     * asemakaavan muutos"* olisi saanut **Palovainion** kuvauksen, ja
     * sama olisi toistunut kahdella muulla rivilla.
     *
     * Suoja on sama kuin massa-ajossa (D-352), nyt jaetusta moduulista.
     */
    const kaikki = (lohko ?? liite.liitelinkit($, sivu)).filter((l: any) => /\.pdf(\?|$)/i.test(l.href))
    const linkit = lohko
      ? kaikki
      : kaikki.filter((l: any) => liite.osuukoKaavaan(l, otsikko, rivi.city ?? rivi.municipality))
    console.log(`   liitteitä: ${linkit.length}${lohko ? " (lohkosta)" : ` / ${kaikki.length} (nimen tunnistettava kaava)`}`)
    if (!lohko && !linkit.length) {
      console.error(`   liitteen nimi ei tunnista kaavaa (${kaikki.length} linkkiä sivulla)`)
      return
    }

    /*
     * TUNNISTEEN ON EROTELTAVA (D-352, portti siirretty D-362).
     *
     * Ulvilan rivin otsikko on *"Keskustan, Suurpään, **Nahkurin**,
     * Nummelan ja Sahamäen asemakaava ... (**Friitalan**
     * esitasoliittymä)"* -- siina on kahden eri kaavan nimi, joten
     * tunnistesaanto paastaa lapi seka Nahkurin etta Friitalan
     * selostuksen. Ensimmainen voitti ja rivi olisi saanut VAARAN
     * kaavan tarkoituksen. Kun ehdokkaita on monta, oikeaa ei voi
     * valita nimesta -- silloin ei kirjoiteta mitaan.
     */
    if (!lohko) {
      const selostukset = linkit.filter((l: any) =>
        /selostus/i.test(decodeURIComponent(String(l.href).split("/").pop() ?? "") + " " + (l.teksti ?? ""))
      )
      /*
       * Vertailu KAAVOITTAIN, ei tiedostoittain: saman kaavan luonnos
       * ja ehdotus ovat sama kaava kahdessa vaiheessa, ja niiden valilla
       * valitsee `valitseKaavaselostus` (uusin voittaa). Ensimmainen
       * versio tasta portista laski ne kahdeksi ja esti kaksi oikeaa
       * riviä.
       */
      const kaavaAvain = (href: string) =>
        decodeURIComponent(String(href).split("/").pop() ?? "")
          .toLowerCase()
          .replace(/\.pdf$/, "")
          .replace(/selostus|luonnos|ehdotus|valmisteluvaihe|ehdotusvaihe/g, "")
          .replace(/[^a-zåäö0-9]+/g, "")
      const eri = new Set(selostukset.map((l: any) => kaavaAvain(l.href)))
      if (eri.size > 1) {
        console.error(`   tunniste ei erottele (${eri.size} eri kaavan selostus osuu):`)
        for (const l of selostukset)
          console.error(`      ${decodeURIComponent(String(l.href).split("/").pop() ?? "")}`)
        return
      }
    }

    const asiakirja = kuvaus.valitseKaavanAsiakirja(linkit)
    if (!asiakirja) {
      console.error("   ei selostusta eikä OAS:ia")
      return
    }
    console.log(`   valittu: ${decodeURIComponent(asiakirja.split("/").pop() ?? "")}`)

    const teksti = await kuvaus.haeKaavaselostuksenTeksti(asiakirja)
    const luku = teksti ? kuvaus.kaavanKuvausTekstista(teksti) : null
    if (!luku) {
      console.error("   selostuksesta ei lukua")
      return
    }

    const uusi = kuvaus.yhdistaKuvaukset(nykyinen, luku) ?? luku
    console.log(`\n   UUSI (${uusi.length}):\n   ${uusi.replace(/\s+/g, " ")}`)

    /*
     * YHTEYSHENKILO SAMASTA TEKSTISTA (D-362).
     *
     * Johannes: *"poimi myos yhteystieto"*. Selostus on jo haettu, joten
     * tama ei maksa yhtaan lisahakua -- sama peruste kuin D-230:ssa.
     * Kaavoittaja on juuri se henkilo jolle hankkeesta soitetaan, ja
     * hanen numeronsa ja osoitteensa ovat kansilehdella nimen vieressa.
     */
    const { kaavanYhteyshenkilot } = await import("../lib/agent/kaavanYhteyshenkilo")
    const { mergeContacts } = await import("../lib/projects/contacts")
    const loydot = kaavanYhteyshenkilot(teksti)
    const uudetKontaktit = loydot.map((y) => ({
      kind: "person" as const,
      name: y.nimi,
      title: y.rooli,
      organization: null,
      email: y.sahkoposti ?? "",
      phone: y.puhelin ?? null,
      role: "authority" as const,
    }))
    const vanhatKontaktit = Array.isArray(rivi.metadata?.contact_persons)
      ? rivi.metadata.contact_persons
      : []
    const kontaktit = mergeContacts(vanhatKontaktit as any, uudetKontaktit as any)

    console.log(`\n   YHTEYSHENKILOT (${vanhatKontaktit.length} -> ${kontaktit.length}):`)
    for (const c of kontaktit)
      console.log(`      ${c.name ?? "(nimetön)"} / ${c.title ?? "-"} / ${c.phone ?? "-"} / ${c.email || "-"}`)

    if (!apply) {
      console.log("\nEi kirjoitettu. Aja --apply kun rivi on luettu.")
      return
    }

    const md = {
      ...(rivi.metadata ?? {}),
      description: uusi,
      ...(kontaktit.length ? { contact_persons: kontaktit } : {}),
      kuvaus_selostuksesta: { liite: asiakirja, milloin: new Date().toISOString().slice(0, 10) },
    }
    const paivitys: Record<string, any> = { metadata: md }
    if (taulu === "projects") paivitys.additional_info = uusi

    const { error: e } = await db.from(taulu).update(paivitys).eq("id", id)
    if (e) console.error(`   VIRHE: ${e.message}`)
    else console.log("\nKirjoitettu.")
    return
  }

  console.log("Riviä ei löydy kummastakaan taulusta.")
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
