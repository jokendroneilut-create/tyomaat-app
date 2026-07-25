/*
 * Offline-arvio: kuinka hyvin Claude (Haiku) osuu SINUN aiempiin TIC-
 * hyväksyntä/hylkäys-päätöksiisi relevanssin arvioinnissa — ja paljonko se
 * maksaisi. Ajetaan ENNEN kuin mitään kytketään tuotantoon.
 *
 * Ei uusia npm-riippuvuuksia (raaka HTTP Anthropicin API:in) eikä muutoksia
 * tuotantokoodiin. Ei kirjoita kantaan — lukee vain potential_projects.
 *
 * Ground truth: status "approved" = relevantti (true), "rejected" = ei (false).
 *
 * Aja projektin juuresta:
 *   node --env-file=.env.local scripts/eval-relevance.mjs [N]
 * (N = montako esimerkkiä yhteensä, oletus 100 — puolet approved, puolet rejected)
 *
 * Vaatii ympäristömuuttujan ANTHROPIC_API_KEY (erillinen Anthropic API -tili,
 * eri kuin Claude Code). Ilman sitä skripti kertoo mitä puuttuu eikä maksa mitään.
 *
 * HUOM: tämä prompt + skeema on se sama "tehtävän määrittely", joka siirtyy
 * sellaisenaan tuotantoluokittelijaan JA mahdolliseen myöhempään hienosäätöön.
 */
import { createClient } from "@supabase/supabase-js"

const MODEL = "claude-haiku-4-5"
// Haikun hinnoittelu ($/miljoona tokenia) kustannusarviota varten:
const PRICE_IN = 1.0
const PRICE_OUT = 5.0

const SYSTEM_PROMPT =
  "Arvioi, onko annettu signaali aito, Suomessa sijaitseva rakennus- tai " +
  "infrastruktuurihanke, joka on relevantti rakennusalan myynnille. TÄRKEÄÄ: " +
  "hanke on relevantti MISSÄ TAHANSA vaiheessa aina aikaisesta kaavoituksesta " +
  "lähtien — kaavoitus, ideointi, suunnittelu, rakennuslupa, kilpailutus, " +
  "rakentaminen. Aikainen signaali on nimenomaan arvokas. Relevantteja ovat " +
  "myös energiainfran hankkeet ja niiden kaavoitus (esim. tuulivoima, " +
  "aurinkovoima) sekä rakennusluvat ja kaavaprosessit joilla on tunnistettava " +
  "hankekohde. Hylkää VAIN: pelkät hallinnolliset/menettelylliset ilmoitukset " +
  "joilla ei ole mitään tunnistettavaa hanketta (esim. yksittäinen puun kaato, " +
  "pelkkä kaavakoodi ilman muuta tietoa), uutiset ja mielipiteet ilman " +
  "konkreettista hanketta, sekä ulkomaiset kohteet. Vastaa vain annetun " +
  "skeeman mukaan. Pidä 'reason' lyhyenä: korkeintaan 1–2 lausetta."

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["relevant", "confidence", "reason"],
  properties: {
    relevant: { type: "boolean" },
    confidence: { type: "number" },
    reason: { type: "string" },
  },
}

function requireEnv(name) {
  const v = process.env[name]
  if (!v) {
    console.error(`Puuttuu ympäristömuuttuja: ${name}`)
    process.exit(1)
  }
  return v
}

function featuresOf(row) {
  const md = row.metadata ?? {}
  return {
    title: row.title ?? md.operation ?? "(ei otsikkoa)",
    description: md.description ?? md.operation ?? "",
    sourceName:
      md.firstSourceName ?? md.lastSourceName ?? md.source_name ?? md.source ?? "",
  }
}

async function classify(apiKey, feats) {
  const body = {
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [
      {
        role: "user",
        content:
          `Otsikko: ${feats.title}\n` +
          `Kuvaus: ${feats.description || "-"}\n` +
          `Lähde: ${feats.sourceName || "-"}`,
      },
    ],
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Anthropic API ${res.status}: ${text.slice(0, 300)}`)
  }

  const json = await res.json()
  const text = (json.content ?? []).find((b) => b.type === "text")?.text ?? "{}"
  const verdict = JSON.parse(text)
  return { verdict, usage: json.usage ?? { input_tokens: 0, output_tokens: 0 } }
}

async function fetchLabeled(supabase, status, limit) {
  const { data, error } = await supabase
    .from("potential_projects")
    .select("id, title, metadata, status")
    .eq("status", status)
    .limit(limit)
  if (error) throw error
  return data ?? []
}

async function main() {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL")
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY")
  const apiKey = requireEnv("ANTHROPIC_API_KEY")

  const total = Number(process.argv[2] ?? 100)
  const half = Math.max(1, Math.floor(total / 2))

  const supabase = createClient(supabaseUrl, serviceKey)

  const approved = await fetchLabeled(supabase, "approved", half)
  const rejected = await fetchLabeled(supabase, "rejected", half)

  const dataset = [
    ...approved.map((r) => ({ row: r, actual: true })),
    ...rejected.map((r) => ({ row: r, actual: false })),
  ]

  console.log(
    `Arvioidaan ${dataset.length} esimerkkiä (approved=${approved.length}, rejected=${rejected.length}) mallilla ${MODEL}\n`
  )
  if (dataset.length === 0) {
    console.error("Ei labeloitua dataa (approved/rejected) — ei voi arvioida.")
    process.exit(1)
  }

  let tp = 0, fp = 0, tn = 0, fn = 0
  let inTok = 0, outTok = 0
  const disagreements = []

  for (const { row, actual } of dataset) {
    const feats = featuresOf(row)
    let predicted
    try {
      const { verdict, usage } = await classify(apiKey, feats)
      predicted = verdict.relevant === true
      inTok += usage.input_tokens ?? 0
      outTok += usage.output_tokens ?? 0
      if (predicted !== actual) {
        disagreements.push({
          title: feats.title,
          actual,
          predicted,
          confidence: verdict.confidence,
          reason: verdict.reason,
          // Sinun oma hylkäyssyysi (jos kirjattu) — paljastaa duplikaatti-
          // hylkäykset, jotka eivät ole mallin relevanssivirheitä.
          rejectedReason: row.metadata?.rejected_reason ?? null,
        })
      }
    } catch (err) {
      console.error(`  virhe kohteelle "${feats.title}": ${err.message}`)
      continue
    }

    if (predicted && actual) tp++
    else if (predicted && !actual) fp++
    else if (!predicted && !actual) tn++
    else fn++

    process.stdout.write(predicted === actual ? "." : "x")
  }

  const n = tp + fp + tn + fn
  const acc = n ? (tp + tn) / n : 0
  const precision = tp + fp ? tp / (tp + fp) : 0
  const recall = tp + fn ? tp / (tp + fn) : 0
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0

  const costUsd = (inTok / 1e6) * PRICE_IN + (outTok / 1e6) * PRICE_OUT

  console.log("\n\n== Tulokset ==")
  console.log(`  arvioitu:      ${n}`)
  console.log(`  osumatarkkuus: ${(acc * 100).toFixed(1)} %`)
  console.log(`  precision:     ${(precision * 100).toFixed(1)} %  (kun malli sanoo 'relevantti', kuinka usein oikeassa)`)
  console.log(`  recall:        ${(recall * 100).toFixed(1)} %  (kuinka moni oikeasti relevantti tunnistettiin)`)
  console.log(`  F1:            ${(f1 * 100).toFixed(1)} %`)
  console.log(`  sekaannus:     TP=${tp} FP=${fp} TN=${tn} FN=${fn}`)

  console.log("\n== Kustannus ==")
  console.log(`  tokenit:       ${inTok} sisään + ${outTok} ulos`)
  console.log(`  tämä ajo:      ~$${costUsd.toFixed(4)}`)
  console.log(`  per kutsu:     ~$${(costUsd / n).toFixed(5)}  (~${((costUsd / n) * 100).toFixed(3)} senttiä)`)

  // FP = malli sanoi relevantti, sinä hylkäsit (mahd. mallin virhe TAI labelikohina).
  // FN = malli sanoi ei, sinä hyväksyit (mahd. määritelmäaukko promptissa).
  const fpList = disagreements.filter((d) => d.predicted && !d.actual)
  const fnList = disagreements.filter((d) => !d.predicted && d.actual)
  const CAP = 15

  function printGroup(label, list) {
    if (list.length === 0) return
    console.log(`\n== ${label} (${list.length} kpl${list.length > CAP ? `, näytetään ${CAP}` : ""}) ==`)
    for (const d of list.slice(0, CAP)) {
      const yourReason = d.rejectedReason ? `  [sinun hylkäyssyy: ${d.rejectedReason}]` : ""
      console.log(
        `  "${d.title}"  (luottamus ${d.confidence})${yourReason}\n    ${d.reason}`
      )
    }
  }

  printGroup("FP — malli: RELEVANTTI, sinä: ei  (mallin virhe vai sinun labelikohina?)", fpList)
  printGroup("FN — malli: ei, sinä: RELEVANTTI  (promptin määritelmäaukko?)", fnList)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
