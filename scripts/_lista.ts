import { readFileSync, writeFileSync } from "node:fs"

/* Muuntaa etsi-lahde-verkosta.ts:n kuivaharjoituksen tarkistuslistaksi. */

const sisaan = process.argv[2]
const ulos = process.argv[3]

const rivit = readFileSync(sisaan, "utf8").replace(/\r/g, "").split("\n")
const lohkot: { otsikko: string; pituus: string; url: string; teksti: string }[] = []

for (let i = 0; i < rivit.length; i++) {
  if (!/^={20,}$/.test(rivit[i])) continue
  const otsikko = rivit[i + 1] ?? ""
  const pituus = (rivit[i + 2] ?? "").trim()
  const url = (rivit[i + 3] ?? "").trim()
  const teksti = (rivit[i + 4] ?? "").trim()
  if (!otsikko || !url.startsWith("http")) continue
  lohkot.push({ otsikko: otsikko.trim(), pituus, url, teksti })
}

const osat: string[] = [
  "# Verkosta löytyneet lähteet — tarkistettavaksi",
  "",
  "Nämä ovat **ehdotuksia**, ei kirjoitettu kantaan. Haku on ilmainen",
  "(DuckDuckGo), mutta mitattu tarkkuus on noin 60–70 %: hankkeiden nimet",
  "ovat lyhyitä omia otsikoita, eikä kone erota \"saman alan uutista samasta",
  "kaupungista\" tästä hankkeesta.",
  "",
  `Ehdotuksia: **${lohkot.length}**.`,
  "",
  "Kerro mitkä numerot ovat väärin, niin kirjoitan loput.",
  "",
]

lohkot.forEach((l, i) => {
  osat.push(`## ${i + 1}. ${l.otsikko}`)
  osat.push("")
  osat.push(`${l.pituus}`)
  osat.push("")
  osat.push(`<${l.url}>`)
  osat.push("")
  osat.push(`> ${l.teksti}`)
  osat.push("")
})

writeFileSync(ulos, osat.join("\n"), "utf8")
console.log(`${lohkot.length} ehdotusta -> ${ulos}`)
