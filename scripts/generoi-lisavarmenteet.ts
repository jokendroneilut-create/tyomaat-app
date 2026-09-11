import { readFileSync, writeFileSync } from "node:fs"
import { X509Certificate } from "node:crypto"

/*
 * GENEROI lib/agent/lisavarmenteet.ts LADATUISTA PEM-TIEDOSTOISTA.
 *
 * Varmenteita ei kopioida käsin: yksikin väärä merkki base64:ssä rikkoisi
 * ketjun. Tiedostot ladataan Let's Encryptin omista AIA-osoitteista, jotka
 * palvelimen oma varmenne nimeää (D-185):
 *
 *   curl -o ye1.der http://ye1.i.lencr.org/   (ja ye2, ye3)
 *   curl -o rootye.der http://ye.i.lencr.org/
 *   openssl x509 -inform DER -in X.der -out X.pem
 *
 *   npx tsx scripts/generoi-lisavarmenteet.ts <hakemisto>
 */

const hakemisto = process.argv[2]
if (!hakemisto) throw new Error("anna PEM-tiedostojen hakemisto")

const lue = (nimi: string) => readFileSync(`${hakemisto}/${nimi}`, "utf8").replace(/\r/g, "").trim()

const varmenteet = [
  { vakio: "LE_YE1", tiedosto: "ye1.pem" },
  { vakio: "LE_YE2", tiedosto: "ye2.pem" },
  { vakio: "LE_YE3", tiedosto: "ye3.pem" },
  { vakio: "LE_ROOT_YE_RISTI_X2", tiedosto: "rootye.pem" },
].map((v) => {
  const pem = lue(v.tiedosto)
  const x = new X509Certificate(pem)
  return {
    ...v,
    pem,
    subject: x.subject.replace(/\n/g, ", "),
    issuer: x.issuer.replace(/\n/g, ", "),
    validTo: x.validTo,
    sormenjalki: x.fingerprint256,
  }
})

const osat = varmenteet.map(
  (v) => `/*
 * ${v.subject}
 * myöntäjä: ${v.issuer}
 * voimassa: ${v.validTo}
 * SHA-256: ${v.sormenjalki}
 */
export const ${v.vakio} = \`${v.pem}\``
)

const sisalto = `/*
 * LET'S ENCRYPTIN "GENERATION Y" -VÄLIVARMENTEET (D-185).
 *
 * TÄMÄ TIEDOSTO ON GENEROITU: scripts/generoi-lisavarmenteet.ts. Älä
 * muokkaa käsin.
 *
 * MIKSI. Pyhtään palvelin lähettää vain oman varmenteensa ilman
 * välivarmennetta. Selain hakee puuttuvan itse (AIA), Node ei, joten
 * haku kaatui virheeseen UNABLE_TO_VERIFY_LEAF_SIGNATURE. Vika on
 * palvelimen asetuksissa, ei meillä.
 *
 * KETJU: palvelin -> YE1/YE2/YE3 -> Root YE -> ISRG Root X2.
 * Noden omassa juurivarastossa on vain ISRG Root X1 ja X2, joten pelkkä
 * YE1 EI RIITÄ: todennettu openssl verify -ajolla, joka kaatui ilman
 * Root YE:tä. Root YE on tässä X2:n ristiinallekirjoittamana, jolloin
 * ketju päättyy luotettuun juureen.
 *
 * KAIKKI KOLME YE-VÄLIVARMENNETTA, EI VAIN YE1. Let's Encrypt myöntää
 * varmenteen satunnaisesti aktiivisista välivarmenteista, ja palvelimen
 * varmenne uusitaan 90 päivän välein. Pelkällä YE1:llä haku hajoaisi
 * heti kun seuraava varmenne tulisi YE2:lta.
 *
 * TARKISTUS EI HEIKKENE. Nämä lisätään luotettujen juurten JATKOKSI
 * ketjunrakennusta varten; allekirjoitukset tarkistetaan normaalisti ja
 * ketjun on päätyttävä Noden omaan juureen. Varmennetta ei ohiteta.
 *
 * VANHENEE: välivarmenteet 2.9.2028, Root YE -ristivarmenne 2.9.2032.
 * Testi (lisavarmenteet.spec.ts) kaatuu ennen vanhenemista.
 */

${osat.join("\n\n")}

export const LE_YE_KETJU: string[] = [${varmenteet.map((v) => v.vakio).join(", ")}]

export const LE_YE_SORMENJALJET: Record<string, string> = {
${varmenteet.map((v) => `  ${v.vakio}: "${v.sormenjalki}",`).join("\n")}
}
`

writeFileSync("lib/agent/lisavarmenteet.ts", sisalto)
console.log(`kirjoitettu lib/agent/lisavarmenteet.ts, ${varmenteet.length} varmennetta`)
for (const v of varmenteet) console.log(`  ${v.vakio.padEnd(20)} ${v.subject}  <- ${v.issuer}`)
