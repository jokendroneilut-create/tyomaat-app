/*
 * YRITYKSEN LIITOSAVAIN (D-242).
 *
 * Sama yritys kirjoitetaan kannassa monella tavalla. Mitattu 6.10.2026
 * samasta aineistosta:
 *
 *   "YIT", "YIT Suomi Oy", "YIT Infra", "Yit Rakennus Oy"
 *   "Lujatalo", "Lujatalo Oy", "Luja"
 *   "NCC", "NCC Suomi Oy"
 *
 * Rekisteri liitetaan hankkeeseen normalisoidulla avaimella, koska
 * nakyva nimi ei ole vakio — ja koska kentta voi sisaltaa listan
 * ("Are Oy (0989493-6), ISS Palvelut Oy (0906333-1)").
 *
 * AVAIN ON TAHALLAAN KARKEA: yhtiomuoto ja y-tunnus pois, valimerkit
 * pois, pienet kirjaimet. "YIT Suomi Oy" ja "YIT" osuvat samaan
 * yritykseen, mika on haluttua — mutta "YIT Infra" EI typisty "YIT":ksi,
 * koska se on eri yksikko jolla on eri yhteyshenkilot. Typistys tehdaan
 * vain yhtiomuodolle, ei liiketoiminnan nimelle.
 */

const YHTIOMUOTO = /\s+(oy|oyj|ab|ky|ltd|plc|group oyj)\.?$/i

export function yritysavain(nimi: string | null | undefined): string {
  /*
   * JARJESTYS RATKAISEE. Y-tunnus poistetaan ensin ja vali siistitaan
   * vasta sen jalkeen — muuten "Are Oy (0989493-6)" jattaa lopppuun
   * valilyonnin, jolloin yhtiomuodon tunnistava kuvio ei osu merkkijonon
   * loppuun ja avaimeksi jaa "areoy". Mitattu testissa.
   */
  const ilmanTunnusta = String(nimi ?? "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  return ilmanTunnusta
    .replace(YHTIOMUOTO, "")
    .toLowerCase()
    .replace(/[^a-z0-9åäö]+/g, "")
    .trim()
}

/*
 * Hankkeen kaikki yritysavaimet. Kentta voi olla lista, ja sama hanke
 * voi liittya seka rakennuttajaan etta urakoitsijaan.
 */
export function hankkeenYritysavaimet(hanke: {
  developer?: string | null
  builder?: string | null
}): string[] {
  const avaimet = new Set<string>()

  for (const kentta of [hanke.developer, hanke.builder]) {
    for (const osa of String(kentta ?? "").split(",")) {
      const avain = yritysavain(osa)
      if (avain.length >= 3) avaimet.add(avain)
    }
  }

  return [...avaimet]
}
