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
 * S2-LAITURIURAKAN YHTEYSHENKILOT LOHKAREEN TIEDOTTEESTA (D-331).
 *
 * Johannes 22.10.2026: *"tassa annetaan myos tyopaallikon nimi ja
 * puhelin numero. en usko etta meilla oli niita tiedossa."* Ei ollut:
 * rivilla oli vain tilaajan vaihde (info@portofturku.fi).
 *
 * Lahde: Lohkare Infran tiedote 21.10.2026, joka nimeaa nelja
 * yhteyshenkiloa -- kaksi tilaajalta ja kaksi urakoitsijalta.
 *
 * SAHKOPOSTIN KATKAISU ON LAHTEESSA. Tyopaallikon osoite lukee
 * tiedotteessa muodossa `timo.luukkonen@oteran.f` seka linkin tekstissa
 * ETTA `mailto:`-osoitteessa -- eli kirjoitusvirhe on Lohkareen sivulla,
 * ei purussamme (tarkistettu raa'asta HTML:sta). Paatelty korjaus
 * `.fi` kirjataan, koska yrityksen domain nakyy samassa listassa
 * (`jukka.seeslinna@oteran.fi`): paikallinen osa on annettu
 * sellaisenaan, vain maatunnus on vajaa. Alkuperainen arvo jaa
 * metadataan.
 *
 * VALMISTUMINEN: *"S2-laiturin on maara valmistua vuonna 2028."* Vuosi
 * ilman kuukautta kirjataan vuoden loppuun, koska se on varovaisin
 * luenta eika syota `autoCompleteGate`-porttia liian aikaisin.
 *
 * KUVAUSTA EI MUUTETA TASSA. Se kertoo yha "Hankinta on keskeytetty",
 * mika on asiakkaalle vaara tieto -- mutta sen korvaaminen on oma
 * paatos omalla ajollaan.
 *
 *   npx tsx scripts/taydenna-s2-laituri.ts
 *   npx tsx scripts/taydenna-s2-laituri.ts --apply
 */

const HANKE = "e367dc88-b350-4684-b4c5-2e8a66aa7729"
const TIEDOTE =
  "https://lohkare.fi/lohkare-infraan-kuuluva-oteran-toteuttaa-turun-sataman-mittavan-s2-laituriurakan/"

const HENKILOT = [
  {
    kind: "person" as const,
    name: "Minna Pirkkanen",
    title: "Toimitusjohtaja",
    email: "minna.pirkkanen@portofturku.fi",
    phone: "050 5533 100",
    organization: "Turun Satama Oy",
  },
  {
    kind: "person" as const,
    name: "Markku Alahäme",
    title: "Tekninen johtaja",
    email: "markku.alahame@portofturku.fi",
    phone: "050 5533 109",
    organization: "Turun Satama Oy",
  },
  {
    kind: "person" as const,
    name: "Jukka Seeslinna",
    title: "Toimitusjohtaja",
    email: "jukka.seeslinna@oteran.fi",
    phone: "040 069 4497",
    organization: "Oteran Oy",
  },
  {
    kind: "person" as const,
    name: "Timo Luukkonen",
    title: "Työpäällikkö",
    email: "timo.luukkonen@oteran.fi",
    email_lahteessa: "timo.luukkonen@oteran.f",
    phone: "040 596 0331",
    organization: "Oteran Oy",
  },
]

const VALMISTUMINEN = "2028-12-31"

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  const { data, error } = await db
    .from("projects")
    .select("id, name, estimated_completion, metadata")
    .eq("id", HANKE)
    .maybeSingle()
  if (error || !data) {
    console.error(`VIRHE: ${error?.message ?? "ei rivia"}`)
    process.exit(1)
  }
  const p = data as any
  const vanhat = Array.isArray(p.metadata?.contact_persons) ? (p.metadata.contact_persons as any[]) : []
  const onJo = new Set(vanhat.map((c) => String(c?.name ?? "").trim().toLowerCase()).filter(Boolean))

  console.log(`\n${p.name}`)
  console.log(`   yhteystietoja nyt ${vanhat.length}:`)
  for (const c of vanhat) console.log(`      ${JSON.stringify(c)}`)

  const uudet = HENKILOT.filter((h) => !onJo.has(h.name.toLowerCase()))
  console.log(`\n   lisataan ${uudet.length}:`)
  for (const h of uudet)
    console.log(
      `      ${h.name.padEnd(18)} ${String(h.title).padEnd(18)} ${h.phone.padEnd(14)} ${h.email}${h.email_lahteessa ? `   (lahteessa: ${h.email_lahteessa})` : ""}`
    )

  console.log(
    `\n   valmistuminen: ${JSON.stringify(p.estimated_completion)} -> ${p.estimated_completion ? "(ei muuteta)" : VALMISTUMINEN}`
  )

  if (!apply) {
    console.log("\nEi kirjoitettu. Aja --apply kun rivit on luettu.")
    return
  }

  const md: Record<string, any> = { ...(p.metadata ?? {}) }
  md.contact_persons = [...vanhat, ...uudet]
  md.yhteyshenkilot_tiedotteesta = {
    lahde: TIEDOTE,
    lisatty: uudet.map((h) => h.name),
    huomio: "Työpäällikön sähköposti oli lähteessä muodossa @oteran.f; täydennetty @oteran.fi",
    milloin: new Date().toISOString().slice(0, 10),
  }
  /* Lahde talteen myos historiaan, jotta "avaa lahde" loytaa tiedotteen. */
  md.source_history = [
    ...(Array.isArray(md.source_history) ? md.source_history : []),
    { seen_at: new Date().toISOString(), source_name: "lohkare", document_url: TIEDOTE, winners: null },
  ]

  const paivitys: Record<string, any> = { metadata: md }
  if (!p.estimated_completion) paivitys.estimated_completion = VALMISTUMINEN

  const { error: kirjoitus } = await db.from("projects").update(paivitys).eq("id", HANKE)
  if (kirjoitus) {
    console.error(`VIRHE: ${kirjoitus.message}`)
    process.exit(1)
  }
  console.log(`\nKirjoitettu: ${uudet.length} yhteyshenkiloa${p.estimated_completion ? "" : `, valmistuminen ${VALMISTUMINEN}`}`)
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
