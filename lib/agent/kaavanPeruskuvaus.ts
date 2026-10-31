/*
 * KAAVAN PERUSKUVAUS, KUN SIVUA EI OLE.
 *
 * Vantaan kaavat tulevat karttapalvelun WFS-rajapinnasta, ja kuvaus
 * luetaan kaavan omalta sivulta. Jos `kaavalinkki` on tyhja, sivua ei
 * ole eika kuvausta tule. Mitattu 31.10.2026: 7 kaavaa 98:sta on
 * tassa tilassa.
 *
 * Johannes kysyi yhdesta niista: *"miksi kuvausta ei tullut, lahde on
 * pelkkaa merkkijonoa. hylkaanko vain?"* Ei hylata: hanke on aito ja
 * poikkeuksellisen aikainen, ja puuttuva tieto ei ole peruste
 * piilottaa ([[hiding-threshold]], [[never-hide-on-missing-data]]).
 *
 * Tama kirjoittaa kuvauksen SIITA MITA LAHDE ANTAA -- kuusi kenttaa,
 * ei enempaa. Se ei paattele mitaan eika tayta aukkoja.
 *
 * KAKSI ASIAA JOITA EI VAITETA:
 *
 *   1. KAAVALAJIA EI SANOTA. "002258" on asemakaava, mutta samassa
 *      aineistossa on sarjat 251900, 181200 ja 920600, jotka eivat
 *      ole. Kirjoitetaan "Kaava", ei "Asemakaava".
 *   2. VAIHE KIRJOITETAAN SELLAISENAAN. Arvot ovat "Vireilletullut"
 *      mutta myos "Alustava kuuleminen (MRL 62 §)" ja "Lautakunta, OAS
 *      tiedoksi". Niita ei taivuteta eika pienenneta -- lahteen sana
 *      kelpaa kenttaan, ei vapaaseen tekstiin
 *      ([[curated-map-field-not-prose]]).
 */

export type Peruskuvauksenosat = {
  kunta: string
  kaavaTunnus: string | null
  nimi: string | null
  vaihe: string | null
  /* ISO-muodossa, esim. "2027-12-14". */
  oasPvm: string | null
}

function paivaSuomeksi(iso: string | null): string | null {
  const m = String(iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  return `${Number(m[3])}.${Number(m[2])}.${m[1]}`
}

/*
 * Kaavan nimi alkaa yleensa tunnuksella: "002258 Perintotie 6 ja
 * Robert Huberintie 5". Tunnus on jo lauseen alussa, joten se
 * riisutaan nimesta ettei se toistu.
 */
function nimiIlmanTunnusta(nimi: string, tunnus: string | null): string {
  if (!tunnus) return nimi
  const alku = nimi.trimStart()
  if (!alku.startsWith(tunnus)) return nimi
  return alku.slice(tunnus.length).replace(/^[\s\-–—:]+/, "").trim() || nimi
}

export function kaavanPeruskuvaus(osat: Peruskuvauksenosat): string | null {
  const lauseet: string[] = []

  const tunnus = osat.kaavaTunnus?.trim() || null
  const nimi = osat.nimi?.trim() || null
  const vaihe = osat.vaihe?.trim() || null
  const oas = paivaSuomeksi(osat.oasPvm)

  /*
   * Pelkka kunta ei ole kuvaus. Jos lahteella ei ole tunnusta eika
   * nimea, jatetaan kirjoittamatta -- tyhja on rehellisempi kuin
   * sisallotön lause.
   */
  if (!tunnus && !nimi) return null

  lauseet.push(tunnus ? `Kaava ${tunnus}, ${osat.kunta}.` : `Kaavahanke, ${osat.kunta}.`)

  if (nimi) {
    const kohde = nimiIlmanTunnusta(nimi, tunnus)
    if (kohde) lauseet.push(`Kohde ${kohde}.`)
  }

  if (vaihe) lauseet.push(`Vaihe: ${vaihe}.`)
  if (oas) lauseet.push(`Osallistumis- ja arviointisuunnitelma ${oas}.`)

  return lauseet.join(" ")
}
