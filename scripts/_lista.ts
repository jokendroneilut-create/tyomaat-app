import { readFileSync, writeFileSync } from "node:fs"

/*
 * Muuntaa etsi-lahde-verkosta.ts:n kuivaharjoituksen tarkistuslistaksi.
 * Mukaan vain TARKISTA-rivit: VARMA-rivit kirjoitetaan automaattisesti.
 */

const sisaan = process.argv[2]
const ulos = process.argv[3]

const rivit = readFileSync(sisaan, "utf8").replace(/\r/g, "").split("\n")
type Lohko = { tila: string; otsikko: string; mitta: string; hakutulos: string; url: string; teksti: string }
const lohkot: Lohko[] = []

for (let i = 0; i < rivit.length; i++) {
  if (!/^={20,}$/.test(rivit[i])) continue
  const paa = rivit[i + 1] ?? ""
  const m = paa.match(/^(VARMA|TARKISTA)\s+(.*)$/)
  if (!m) continue
  lohkot.push({
    tila: m[1],
    otsikko: m[2].trim(),
    mitta: (rivit[i + 2] ?? "").trim(),
    hakutulos: (rivit[i + 3] ?? "").replace(/^\s*hakutulos:\s*/, "").trim(),
    url: (rivit[i + 4] ?? "").trim(),
    teksti: (rivit[i + 5] ?? "").trim(),
  })
}

const varmat = lohkot.filter((l) => l.tila === "VARMA")
const tarkistettavat = lohkot.filter((l) => l.tila === "TARKISTA")

const osat: string[] = [
  "# Verkosta löytyneet lähteet — tarkistettavaksi",
  "",
  `Haku on ilmainen (DuckDuckGo). **${varmat.length} osumaa kirjoitettiin automaattisesti**:`,
  "niissä hakutuloksen otsikko toistaa hankkeen nimen (≥ 75 % nimen",
  "sisältösanoista, vähintään kaksi sanaa).",
  "",
  `Alla **${tarkistettavat.length} osumaa**, joissa otsikko ei riitä todisteeksi.`,
  "Mitattu tarkkuus tässä joukossa on noin 60–70 %, joten ne vaativat silmäsi.",
  "",
  "**Kerro mitkä numerot ovat väärin, niin kirjoitan loput.**",
  "",
  "---",
  "",
]

tarkistettavat.forEach((l, i) => {
  osat.push(`## ${i + 1}. ${l.otsikko}`)
  osat.push("")
  osat.push(`Hakutulos: *${l.hakutulos}*`)
  osat.push("")
  osat.push(`<${l.url}>`)
  osat.push("")
  osat.push(`> ${l.teksti}`)
  osat.push("")
})

writeFileSync(ulos, osat.join("\n"), "utf8")
console.log(`varmoja ${varmat.length}, tarkistettavia ${tarkistettavat.length} -> ${ulos}`)
